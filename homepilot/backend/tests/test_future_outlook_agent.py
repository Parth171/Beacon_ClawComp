from __future__ import annotations

import asyncio

from app.agents.future_outlook import FutureOutlookAgent, FutureOutlookInput
from app.models import PropertyListing


def _run(city: str | None):
    location = {"city": city} if city else {}
    listing = PropertyListing(id="x", listing_price=800_000, location=location)
    return asyncio.run(FutureOutlookAgent().run(FutureOutlookInput(property=listing)))


def test_known_area_returns_signals_and_reasons() -> None:
    result = _run("Waterloo")

    assert result.future_score > 60
    assert result.reasons
    assert result.signals
    assert result.confidence == 0.7


def test_unknown_area_falls_back_to_neutral_baseline() -> None:
    result = _run("Nowheresville")

    assert 0 <= result.future_score <= 100
    assert result.confidence == 0.4


def test_transit_and_growth_signals_raise_score() -> None:
    custom = {
        "_default": {"base_score": 60, "signals": {}, "reasons": []},
        "boomtown": {
            "base_score": 60,
            "signals": {"new_transit_line": True, "population_growth": "high"},
            "reasons": ["test"],
        },
    }
    agent = FutureOutlookAgent(area_signals=custom)
    listing = PropertyListing(id="x", listing_price=800_000, location={"city": "Boomtown"})
    result = asyncio.run(agent.run(FutureOutlookInput(property=listing)))

    # base 60 + transit 8 + high growth 6 = 74
    assert result.future_score == 74
