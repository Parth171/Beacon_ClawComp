import json

from fastapi.testclient import TestClient

from app.main import create_app


def test_recommendations_stream_endpoint_returns_progress_events() -> None:
    client = TestClient(create_app())

    with client.stream(
        "POST",
        "/api/v1/recommendations/stream",
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
    ) as response:
        assert response.status_code == 200

        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line.removeprefix("data: ")))

    assert any(event["type"] == "agent_started" for event in events)
    assert any(event["type"] == "agent_completed" for event in events)
    assert events[-1]["type"] == "complete"
    assert events[-1]["result"]["recommendations"][0]["rank"] == 1
