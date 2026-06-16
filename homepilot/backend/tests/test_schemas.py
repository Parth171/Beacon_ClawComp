import pytest
from pydantic import ValidationError

from app.models import (
    BuyerProfile,
    FamilyFitResult,
    HiddenCostResult,
    PropertyIntelligenceResult,
    RecommendationRequest,
)


def test_recommendation_request_validates_nested_payload() -> None:
    request = RecommendationRequest(
        buyer={
            "budget": 1_000_000,
            "children": 2,
            "dog": True,
        },
        properties=[
            {
                "id": "demo",
                "listing_price": 900_000,
                "school_score": 85,
                "safety_score": 80,
                "park_distance_meters": 500,
                "commute_minutes": 35,
            }
        ],
    )

    assert isinstance(request.buyer, BuyerProfile)
    assert request.properties[0].id == "demo"


def test_recommendation_request_rejects_empty_property_list() -> None:
    with pytest.raises(ValidationError):
        RecommendationRequest(
            buyer={"budget": 1_000_000},
            properties=[],
        )


def test_recommendation_request_accepts_listing_urls_without_properties() -> None:
    request = RecommendationRequest(
        buyer={"budget": 1_000_000},
        listing_urls=["https://www.realtor.ca/real-estate/29867678/example"],
    )

    assert request.properties == []
    assert str(request.listing_urls[0]) == "https://www.realtor.ca/real-estate/29867678/example"


def test_agent_outputs_reject_out_of_range_scores() -> None:
    with pytest.raises(ValidationError):
        PropertyIntelligenceResult(
            property_quality_score=120,
            repair_risk_score=20,
        )

    with pytest.raises(ValidationError):
        FamilyFitResult(family_fit_score=-1)


def test_hidden_cost_requires_non_negative_costs() -> None:
    with pytest.raises(ValidationError):
        HiddenCostResult(
            annual_property_tax=-1,
            annual_utilities=1,
            annual_insurance=1,
            annual_maintenance=1,
            true_annual_cost=2,
        )
