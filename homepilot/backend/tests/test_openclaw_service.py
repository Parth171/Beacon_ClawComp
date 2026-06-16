import asyncio

import pytest

from app.services.openclaw import (
    OpenClawError,
    fetch_openclaw_listings,
    map_openclaw_listing_to_property,
)


FETCH_LISTINGS_PAYLOAD = {
    "source": "realtor.ca",
    "url": "https://www.realtor.ca/real-estate/29867678/example",
    "photoCount": 2,
    "listing": {
        "id": "29867678",
        "mlsNumber": "X13412214",
        "url": "https://www.realtor.ca/real-estate/29867678/example",
        "listingPrice": 553000,
        "description": "Updated townhouse near parks.",
        "address": {
            "text": "18-535 Windflower Crescent, Kitchener, Ontario N2E4L7",
            "city": "Kitchener",
            "province": "Ontario",
            "postalCode": "N2E4L7",
        },
        "bedrooms": 2,
        "bathrooms": 2,
        "squareFeet": 1000,
        "propertyType": "Single Family",
        "buildingType": "Row / Townhouse",
        "annualPropertyTax": 3256,
        "maintenanceFees": "$200 Monthly",
        "photoUrls": [
            "https://cdn.realtor.ca/listings/example/highres/8/x13412214_1.jpg",
            "https://cdn.realtor.ca/listings/example/highres/8/x13412214_2.jpg",
        ],
    },
}


def test_map_openclaw_listing_to_property_maps_fetch_listings_output() -> None:
    property_listing = map_openclaw_listing_to_property(FETCH_LISTINGS_PAYLOAD)

    assert property_listing.id == "29867678"
    assert property_listing.mls_number == "X13412214"
    assert str(property_listing.url) == "https://www.realtor.ca/real-estate/29867678/example"
    assert property_listing.listing_price == 553000
    assert property_listing.location.city == "Kitchener"
    assert property_listing.location.postal_code == "N2E4L7"
    assert property_listing.square_feet == 1000
    assert property_listing.property_type == "Single Family"
    assert property_listing.annual_property_tax == 3256
    assert property_listing.maintenance_fees == "$200 Monthly"
    assert len(property_listing.photo_urls) == 2


def test_map_openclaw_listing_to_property_rejects_missing_listing() -> None:
    with pytest.raises(OpenClawError, match="listing"):
        map_openclaw_listing_to_property({})


def test_fetch_openclaw_listings_uses_runner_and_maps_output() -> None:
    async def fake_runner(listing_url: str):
        assert listing_url == "https://www.realtor.ca/real-estate/29867678/example"
        return FETCH_LISTINGS_PAYLOAD

    properties = asyncio.run(
        fetch_openclaw_listings(
            ["https://www.realtor.ca/real-estate/29867678/example"],
            runner=fake_runner,
        )
    )

    assert len(properties) == 1
    assert properties[0].id == "29867678"
