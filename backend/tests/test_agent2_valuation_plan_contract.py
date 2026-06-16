from __future__ import annotations

from app.agents.valuation import ValuationAgent, ValuationInput
from app.models.property import CanonicalProperty, PriceHistoryEntry
from app.models.valuation import LISTING_CONTEXT_SCHEMA
from app.services.comps import Comp
from app.services.inference.base import TextClient


class CapturingTextClient(TextClient):
    name = "capturing-text"

    def __init__(self, response: dict | Exception) -> None:
        self._response = response
        self.calls: list[dict] = []

    def available(self) -> bool:
        return True

    async def generate_json(
        self,
        prompt,
        schema,
        *,
        system=None,
        temperature=None,
        max_tokens=None,
    ):
        self.calls.append(
            {
                "prompt": prompt,
                "schema": schema,
                "system": system,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )
        if isinstance(self._response, Exception):
            raise self._response
        return dict(self._response)


def comps_provider(ppsfs):
    comps = [
        Comp(url=f"https://example.test/comp-{i}", price=int(ppsf * 1500), sqft=1500, ppsf=ppsf)
        for i, ppsf in enumerate(ppsfs)
    ]

    async def provider(city, beds, max_price):
        return comps

    return provider


def plan_property(**overrides) -> CanonicalProperty:
    base = {
        "address": "123 Main St, Toronto, ON M5V 2T6",
        "price": 820000,
        "bedrooms": 3,
        "bathrooms": 2,
        "sqft": 1500,
        "lot_size": 2200,
        "year_built": 1987,
        "property_type": "Semi-Detached",
        "city": "Toronto",
        "description": "Motivated seller. Sold as-is.",
        "days_on_market": 34,
        "price_history": [
            PriceHistoryEntry(date="2024-11-01", price=859000),
            PriceHistoryEntry(date="2024-12-15", price=835000),
            PriceHistoryEntry(date="2025-01-20", price=820000),
        ],
    }
    base.update(overrides)
    return CanonicalProperty(**base)


async def test_agent2_combined_output_matches_plan_signals():
    text = CapturingTextClient(
        {
            "sellerUrgency": 0.82,
            "distressSale": True,
            "signals": ["motivated seller", "sold as-is"],
        }
    )
    agent = ValuationAgent(
        text_client=text,
        comps_provider=comps_provider([560, 600, 640]),
    )

    result = await agent.run(ValuationInput(property=plan_property()))

    assert result.asking_price == 820000
    assert result.estimated_value == 900000
    assert result.mispricing == 80000
    assert result.mispricing_pct == round(80000 / 820000, 4)
    assert result.seller_urgency == 0.82
    assert result.distress_sale is True
    assert result.price_reduction_count == 2
    assert result.price_reduction_total == 39000
    assert result.urgency_modifier == -0.041

    by_type = {e.type: e for e in result.evidence}
    assert by_type["price_reduction"].weight == "high"
    assert by_type["price_reduction"].model_dump()["count"] == 2
    assert by_type["price_reduction"].model_dump()["total"] == 39000
    assert "motivated seller" in by_type["context_signal"].detail
    assert by_type["mispricing"].weight == "high"


async def test_agent2_listing_context_prompt_uses_structured_price_history():
    text = CapturingTextClient(
        {
            "sellerUrgency": 0.25,
            "distressSale": False,
            "signals": [],
        }
    )
    agent = ValuationAgent(
        text_client=text,
        comps_provider=comps_provider([600, 600, 600]),
    )

    await agent.run(ValuationInput(property=plan_property(description="Estate sale.")))

    assert len(text.calls) == 1
    call = text.calls[0]
    assert call["schema"] == LISTING_CONTEXT_SCHEMA
    assert call["system"] == "You are a precise real estate analyst. Return strict JSON only."
    assert "Estate sale." in call["prompt"]
    assert "2 price reduction(s) totalling $39,000" in call["prompt"]
    assert "Days on market: 34" in call["prompt"]


async def test_agent2_keeps_deterministic_reduction_signal_when_text_model_fails():
    text = CapturingTextClient(RuntimeError("local model unavailable"))
    agent = ValuationAgent(
        text_client=text,
        comps_provider=comps_provider([600, 600, 600]),
    )

    result = await agent.run(ValuationInput(property=plan_property()))

    assert result.model == "capturing-text"
    assert result.seller_urgency == 0.6
    assert result.distress_sale is True
    assert result.price_reduction_count == 2
    assert result.price_reduction_total == 39000
    assert [e.type for e in result.evidence if e.type == "context_signal"] == []


async def test_agent2_uses_city_baseline_when_live_comps_are_unavailable():
    text = CapturingTextClient(
        {
            "sellerUrgency": 0.0,
            "distressSale": False,
            "signals": [],
        }
    )
    agent = ValuationAgent(
        text_client=text,
        comps_provider=comps_provider([600, 620]),
    )

    result = await agent.run(
        ValuationInput(property=plan_property(city="Waterloo", price_history=[]))
    )

    assert result.using_live_comps is False
    assert result.comparable_count == 2
    assert result.median_ppsf == 540
    assert result.estimated_value == 810000
    assert result.notes
    assert "fewer than 3 live comps available" in result.notes[0]
