from app.agents.valuation import ValuationAgent, ValuationInput
from app.models.inspection import InspectionResult
from app.models.property import CanonicalProperty, PriceHistoryEntry
from app.models.valuation import LISTING_CONTEXT_SCHEMA
from app.services.comps import Comp
from app.services.inference.base import TextClient


class FakeTextClient(TextClient):
    name = "fake-text"

    def __init__(self, response: dict) -> None:
        self._response = response

    def available(self) -> bool:
        return True

    async def generate_json(self, prompt, schema, *, system=None, temperature=None, max_tokens=None):
        return dict(self._response)


def comps_provider(comps):
    async def provider(city, beds, max_price):
        return comps

    return provider


def _comps(ppsfs):
    return [Comp(url=f"u{i}", price=int(p * 1500), sqft=1500, ppsf=p) for i, p in enumerate(ppsfs)]


def _property(**kw):
    base = dict(price=820000, sqft=1500, city="Toronto", bedrooms=3)
    base.update(kw)
    return CanonicalProperty(**base)


NEUTRAL_SIGNAL = {"sellerUrgency": 0.0, "distressSale": False, "signals": []}


async def test_mispricing_from_live_comps():
    # median ppsf 600 -> base 900k; no inspection -> no condition adj.
    agent = ValuationAgent(
        text_client=FakeTextClient(NEUTRAL_SIGNAL),
        comps_provider=comps_provider(_comps([560, 600, 640])),
    )
    res = await agent.run(ValuationInput(property=_property()))
    assert res.using_live_comps is True
    assert res.median_ppsf == 600
    assert res.estimated_value == 900000  # 1500 * 600
    assert res.mispricing == 80000        # 900k - 820k
    assert round(res.mispricing_pct, 4) == round(80000 / 820000, 4)


async def test_condition_adjustment_from_inspection():
    insp = InspectionResult(repair_risk=80, renovation_score=40, estimated_repair_cost=30000)
    agent = ValuationAgent(
        text_client=FakeTextClient(NEUTRAL_SIGNAL),
        comps_provider=comps_provider(_comps([600, 600, 600])),
    )
    res = await agent.run(ValuationInput(property=_property(), inspection=insp))
    # reno 40 -> (40-70)*0.0015 = -0.045 ; repair 80 -> -(80-40)*0.0015 = -0.06
    # adj = 1 - 0.045 - 0.06 = 0.895 ; 900000 * 0.895 = 805500
    assert res.estimated_value == 805500
    assert res.mispricing == 805500 - 820000


async def test_baseline_fallback_when_few_comps():
    agent = ValuationAgent(
        text_client=FakeTextClient(NEUTRAL_SIGNAL),
        comps_provider=comps_provider(_comps([600])),  # < 3 comps
    )
    res = await agent.run(ValuationInput(property=_property(city="Toronto")))
    assert res.using_live_comps is False
    assert res.median_ppsf == 760  # Toronto baseline
    assert res.notes


async def test_price_reductions_computed_from_history():
    prop = _property(price_history=[
        PriceHistoryEntry(date="2024-11-01", price=859000),
        PriceHistoryEntry(date="2024-12-15", price=835000),
        PriceHistoryEntry(date="2025-01-20", price=820000),
    ], days_on_market=34)
    agent = ValuationAgent(
        text_client=FakeTextClient(NEUTRAL_SIGNAL),
        comps_provider=comps_provider(_comps([600, 600, 600])),
    )
    res = await agent.run(ValuationInput(property=prop))
    assert res.price_reduction_count == 2
    assert res.price_reduction_total == 39000
    # 2 reductions -> distress + urgency floor 0.6 even though LLM said 0.
    assert res.distress_sale is True
    assert res.seller_urgency >= 0.6
    # price_reduction evidence present, high weight
    pr = [e for e in res.evidence if e.type == "price_reduction"]
    assert pr and pr[0].weight == "high"
    assert "over 80 days" in pr[0].detail


async def test_llm_signals_become_evidence():
    signal = {"sellerUrgency": 0.7, "distressSale": True,
              "signals": ["motivated seller", "sold as-is"]}
    agent = ValuationAgent(
        text_client=FakeTextClient(signal),
        comps_provider=comps_provider(_comps([600, 600, 600])),
    )
    res = await agent.run(ValuationInput(property=_property(description="Motivated seller, as-is")))
    ctx = [e for e in res.evidence if e.type == "context_signal"]
    assert ctx and "motivated seller" in ctx[0].detail
    assert res.seller_urgency >= 0.7


async def test_undervalued_mispricing_evidence():
    agent = ValuationAgent(
        text_client=FakeTextClient(NEUTRAL_SIGNAL),
        comps_provider=comps_provider(_comps([700, 700, 700])),  # base 1.05M vs 820k
    )
    res = await agent.run(ValuationInput(property=_property()))
    mis = [e for e in res.evidence if e.type == "mispricing"]
    assert mis and mis[0].weight == "high"


async def test_serializes_camelcase():
    agent = ValuationAgent(
        text_client=FakeTextClient(NEUTRAL_SIGNAL),
        comps_provider=comps_provider(_comps([600, 600, 600])),
    )
    res = await agent.run(ValuationInput(property=_property()))
    data = res.model_dump(by_alias=True)
    for key in ("askingPrice", "estimatedValue", "mispricingPct", "sellerUrgency",
                "priceReductionCount", "usingLiveComps"):
        assert key in data


def test_listing_context_schema_shape():
    assert set(LISTING_CONTEXT_SCHEMA["required"]) == {"sellerUrgency", "distressSale", "signals"}
