import json
from pathlib import Path

import pytest

from app.agents.data_collection import DataCollectionAgent, DataCollectionInput
from app.services.openclaw import OpenClawError, map_listing_to_canonical

FIXTURE = Path(__file__).parent / "fixtures" / "realtor_detail.json"


def _payload() -> dict:
    return json.loads(FIXTURE.read_text())


def test_map_listing_to_canonical_full_fields():
    prop = map_listing_to_canonical(_payload())
    assert prop.price == 820000
    assert prop.address == "123 Main St, Toronto, Ontario M5V2T6"
    assert prop.bedrooms == 3
    assert prop.bathrooms == 2
    assert prop.sqft == 1450
    assert prop.year_built == 1987
    assert prop.property_type == "Semi-Detached"
    assert prop.days_on_market == 34
    assert len(prop.images) == 3
    assert prop.postal_code == "M5V2T6"
    assert prop.latitude == pytest.approx(43.6426)


def test_price_history_mapped_in_order():
    prop = map_listing_to_canonical(_payload())
    assert [e.price for e in prop.price_history] == [859000, 835000, 820000]
    assert prop.price_history[0].date == "2024-11-01"


def test_canonical_serializes_camelcase():
    prop = map_listing_to_canonical(_payload())
    data = prop.model_dump(by_alias=True)
    # plan.md contract is camelCase.
    assert "priceHistory" in data
    assert "daysOnMarket" in data
    assert "yearBuilt" in data
    assert data["daysOnMarket"] == 34


def test_missing_price_raises():
    payload = _payload()
    payload["listing"]["listingPrice"] = None
    with pytest.raises(OpenClawError, match="no usable price"):
        map_listing_to_canonical(payload)


def test_missing_listing_object_raises():
    with pytest.raises(OpenClawError, match="missing"):
        map_listing_to_canonical({"url": "x"})


def test_bad_price_history_entries_skipped():
    payload = _payload()
    payload["listing"]["priceHistory"] = [
        {"date": "2024-11-01", "price": 859000},
        {"date": None, "price": 835000},
        {"price": 820000},
        "garbage",
    ]
    prop = map_listing_to_canonical(payload)
    assert len(prop.price_history) == 1


async def test_agent_run_with_injected_runner():
    async def fake_runner(url: str) -> dict:
        assert url == "https://example.com/listing"
        return _payload()

    agent = DataCollectionAgent(runner=fake_runner)
    prop = await agent.run(DataCollectionInput(listing_url="https://example.com/listing"))
    assert prop.price == 820000
    assert len(prop.images) == 3
