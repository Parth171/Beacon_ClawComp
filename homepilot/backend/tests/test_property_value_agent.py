"""Tests for the Property Value agent.

All tests are offline-safe: the fetch_comps service is monkeypatched so no
network calls are made. The heuristic fallback path is tested by injecting an
empty comp list.
"""

from __future__ import annotations

import asyncio

import pytest

from app.agents import property_value as pv_module
from app.agents.property_value import PropertyValueAgent, PropertyValueInput
from app.models import PropertyIntelligenceResult, PropertyListing
from app.services.comps import Comp

# Shared area signals fixture — no transit/development signals.
NEUTRAL_SIGNALS = {"_default": {"base_score": 60, "signals": {}, "reasons": []}}

# Six realistic Kitchener comps (~$490/sqft).
KITCHENER_COMPS = [
    Comp(url="u1", price=540_000, sqft=1100, ppsf=490.9, bedrooms=3),
    Comp(url="u2", price=620_000, sqft=1300, ppsf=476.9, bedrooms=3),
    Comp(url="u3", price=489_000, sqft=1000, ppsf=489.0, bedrooms=3),
    Comp(url="u4", price=699_000, sqft=1500, ppsf=466.0, bedrooms=3),
    Comp(url="u5", price=550_000, sqft=1100, ppsf=500.0, bedrooms=3),
    Comp(url="u6", price=630_000, sqft=1250, ppsf=504.0, bedrooms=3),
]


def _agent(area_signals=None):
    return PropertyValueAgent(area_signals=area_signals or NEUTRAL_SIGNALS)


def _run(agent, payload):
    return asyncio.run(agent.run(payload))


def _listing(**kwargs):
    defaults = dict(id="test", listing_price=550_000, location={"city": "Kitchener"}, square_feet=1_200, bedrooms=3)
    defaults.update(kwargs)
    return PropertyListing(**defaults)


# ------------------------------------------------------------------ live-comps path

def test_underpriced_home_is_undervalued(monkeypatch) -> None:
    async def fake_fetch_comps(**_):
        return KITCHENER_COMPS

    monkeypatch.setattr(pv_module, "fetch_comps", fake_fetch_comps)
    # median ppsf ~490; 1200 sqft -> est ~$588k; asking $499k -> undervalued
    listing = _listing(listing_price=499_000, square_feet=1_200)
    result = _run(_agent(), PropertyValueInput(property=listing))

    assert result.estimated_value > result.asking_price
    assert result.deal_score > 50
    assert result.recommendation == "UNDERVALUED"
    assert result.comparable_count == 6
    assert result.median_ppsf is not None


def test_overpriced_home_is_overvalued(monkeypatch) -> None:
    async def fake_fetch_comps(**_):
        return KITCHENER_COMPS

    monkeypatch.setattr(pv_module, "fetch_comps", fake_fetch_comps)
    # median ppsf ~490; 1200 sqft -> est ~$588k; asking $900k -> overvalued
    listing = _listing(listing_price=900_000)
    result = _run(_agent(), PropertyValueInput(property=listing))

    assert result.estimated_value < result.asking_price
    assert result.deal_score < 50
    assert result.recommendation == "OVERVALUED"
    assert any("above" in f or "Asking" in f for f in result.negative_factors)


def test_factors_include_comp_count(monkeypatch) -> None:
    async def fake_fetch_comps(**_):
        return KITCHENER_COMPS

    monkeypatch.setattr(pv_module, "fetch_comps", fake_fetch_comps)
    result = _run(_agent(), PropertyValueInput(property=_listing()))

    assert any("comparable" in f.lower() for f in result.positive_factors)


def test_pi_condition_affects_estimated_value(monkeypatch) -> None:
    async def fake_fetch_comps(**_):
        return KITCHENER_COMPS

    monkeypatch.setattr(pv_module, "fetch_comps", fake_fetch_comps)
    listing = _listing()
    high = _run(
        _agent(),
        PropertyValueInput(
            property=listing,
            property_intelligence=PropertyIntelligenceResult(property_quality_score=95, repair_risk_score=10),
        ),
    )
    low = _run(
        _agent(),
        PropertyValueInput(
            property=listing,
            property_intelligence=PropertyIntelligenceResult(property_quality_score=50, repair_risk_score=80),
        ),
    )

    assert high.estimated_value > low.estimated_value
    assert any("repair" in f.lower() for f in low.negative_factors)


def test_development_signals_lift_value(monkeypatch) -> None:
    async def fake_fetch_comps(**_):
        return KITCHENER_COMPS

    monkeypatch.setattr(pv_module, "fetch_comps", fake_fetch_comps)
    transit_signals = {
        "_default": {"base_score": 60, "signals": {}, "reasons": []},
        "kitchener": {
            "base_score": 76,
            "signals": {"new_transit_line": True, "transit_project": "GO Rail", "population_growth": "high"},
            "reasons": [],
        },
    }
    no_transit = _run(_agent(NEUTRAL_SIGNALS), PropertyValueInput(property=_listing()))
    with_transit = _run(_agent(transit_signals), PropertyValueInput(property=_listing()))

    assert with_transit.estimated_value > no_transit.estimated_value
    assert any("transit" in f.lower() for f in with_transit.positive_factors)


# ------------------------------------------------------------------ fallback path

def test_no_comps_falls_back_to_baseline(monkeypatch) -> None:
    async def fake_fetch_comps(**_):
        return []

    monkeypatch.setattr(pv_module, "fetch_comps", fake_fetch_comps)
    result = _run(_agent(), PropertyValueInput(property=_listing()))

    assert result.comparable_count == 0
    assert result.estimated_value > 0
    assert any("baseline" in f.lower() or "unavailable" in f.lower() for f in result.negative_factors)


def test_output_has_summary_text(monkeypatch) -> None:
    async def fake_fetch_comps(**_):
        return KITCHENER_COMPS

    monkeypatch.setattr(pv_module, "fetch_comps", fake_fetch_comps)
    result = _run(_agent(), PropertyValueInput(property=_listing()))

    assert result.explanation
    assert len(result.explanation) > 50
