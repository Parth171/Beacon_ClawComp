import asyncio

from app.agents.ceo import CEOAgent
from app.models import (
    FamilyFitResult,
    HiddenCostResult,
    PropertyIntelligenceResult,
    RecommendationRequest,
)


class FakePropertyIntelligenceAgent:
    async def run(self, payload):
        scores = {
            "strong": 90,
            "weak": 65,
        }
        return PropertyIntelligenceResult(
            property_quality_score=scores[payload.property.id],
            repair_risk_score=25,
            roof_condition="good",
            water_damage_risk="low",
        )


class FakeHiddenCostAgent:
    async def run(self, payload):
        costs = {
            "strong": 12_000,
            "weak": 28_000,
        }
        return HiddenCostResult(
            annual_property_tax=6_000,
            annual_utilities=3_000,
            annual_insurance=1_500,
            annual_maintenance=costs[payload.property.id] - 10_500,
            true_annual_cost=costs[payload.property.id],
        )


class FakeFamilyFitAgent:
    async def run(self, payload):
        scores = {
            "strong": 88,
            "weak": 70,
        }
        return FamilyFitResult(
            family_fit_score=scores[payload.property.id],
            school_score=scores[payload.property.id],
            commute_score=scores[payload.property.id],
            safety_score=scores[payload.property.id],
            park_score=scores[payload.property.id],
        )


def test_ceo_agent_ranks_properties_from_specialist_outputs() -> None:
    request = RecommendationRequest(
        buyer={
            "budget": 1_000_000,
            "children": 2,
            "dog": True,
            "work_location": "Toronto",
        },
        properties=[
            {
                "id": "weak",
                "listing_price": 900_000,
            },
            {
                "id": "strong",
                "listing_price": 900_000,
            },
        ],
    )
    ceo_agent = CEOAgent(
        property_intelligence_agent=FakePropertyIntelligenceAgent(),
        hidden_cost_agent=FakeHiddenCostAgent(),
        family_fit_agent=FakeFamilyFitAgent(),
    )

    response = asyncio.run(ceo_agent.run(request))

    assert [recommendation.property.id for recommendation in response.recommendations] == [
        "strong",
        "weak",
    ]
    assert [recommendation.rank for recommendation in response.recommendations] == [1, 2]
    assert response.recommendations[0].overall_score > response.recommendations[1].overall_score
    assert response.recommendations[0].recommendation_summary

    top = response.recommendations[0]
    assert top.property_value.estimated_value > 0
    assert 0 <= top.property_value.deal_score <= 100
    assert 0 <= top.future_outlook.future_score <= 100
