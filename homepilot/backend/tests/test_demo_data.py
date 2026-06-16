import asyncio

from app.agents import CEOAgent
from app.services.data_sources import load_demo_recommendation_request


def test_demo_recommendation_request_loads() -> None:
    request = load_demo_recommendation_request()

    assert request.buyer.budget == 1_000_000
    assert len(request.properties) == 3
    assert {property_listing.id for property_listing in request.properties} == {
        "riverdale-family-home",
        "mississauga-townhouse",
        "older-fixer-upper",
    }


def test_demo_recommendation_request_produces_ranked_results() -> None:
    request = load_demo_recommendation_request()

    response = asyncio.run(CEOAgent().run(request))

    ranked_ids = [recommendation.property.id for recommendation in response.recommendations]
    assert ranked_ids[0] == "riverdale-family-home"
    assert ranked_ids[-1] == "older-fixer-upper"
    assert [recommendation.rank for recommendation in response.recommendations] == [1, 2, 3]
    assert all(recommendation.recommendation_summary for recommendation in response.recommendations)
