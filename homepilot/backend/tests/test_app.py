from fastapi.testclient import TestClient

from app.api import recommendations
from app.main import create_app
from app.models import PropertyListing


def test_recommendations_endpoint_returns_ranked_results() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/v1/recommendations",
        json={
            "buyer": {
                "budget": 1_000_000,
                "children": 2,
                "dog": True,
                "work_location": "Toronto",
            },
            "properties": [
                {
                    "id": "demo-1",
                    "listing_price": 899_000,
                    "location": {"city": "Toronto"},
                    "bedrooms": 4,
                    "year_built": 2018,
                    "school_score": 88,
                    "safety_score": 84,
                    "park_distance_meters": 400,
                    "commute_minutes": 30,
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["recommendations"][0]["rank"] == 1


def test_recommendations_endpoint_accepts_listing_urls(monkeypatch) -> None:
    async def fake_fetch_openclaw_listings(listing_urls):
        assert [str(url) for url in listing_urls] == [
            "https://www.realtor.ca/real-estate/29867678/example"
        ]
        return [
            PropertyListing(
                id="openclaw-1",
                url="https://www.realtor.ca/real-estate/29867678/example",
                listing_price=899_000,
                location={"city": "Kitchener"},
                bedrooms=3,
                year_built=2018,
                school_score=82,
                safety_score=80,
                park_distance_meters=500,
                commute_minutes=45,
            )
        ]

    monkeypatch.setattr(
        recommendations,
        "fetch_openclaw_listings",
        fake_fetch_openclaw_listings,
    )
    client = TestClient(create_app())

    response = client.post(
        "/api/v1/recommendations",
        json={
            "buyer": {
                "budget": 1_000_000,
                "children": 2,
                "dog": True,
                "work_location": "Toronto",
            },
            "listing_urls": ["https://www.realtor.ca/real-estate/29867678/example"],
        },
    )

    assert response.status_code == 200
    assert response.json()["recommendations"][0]["property"]["id"] == "openclaw-1"
