import asyncio

from app.agents.property_intelligence import PropertyIntelligenceAgent, PropertyIntelligenceInput
from app.models import PropertyListing


def test_property_intelligence_scores_renovated_home_as_lower_risk() -> None:
    agent = PropertyIntelligenceAgent(use_vision=False)
    listing = PropertyListing(
        id="renovated-home",
        listing_price=950_000,
        year_built=2018,
        description="Well maintained, move-in ready home with updated kitchen and new roof.",
        photo_urls=[
            "https://example.com/front.jpg",
            "https://example.com/kitchen.jpg",
            "https://example.com/backyard.jpg",
        ],
    )

    result = asyncio.run(agent.run(PropertyIntelligenceInput(property=listing)))

    assert result.property_quality_score >= 85
    assert result.repair_risk_score <= 35
    assert result.roof_condition == "good"
    assert result.water_damage_risk == "low"
    assert result.confidence is not None


def test_property_intelligence_flags_older_home_repair_risk() -> None:
    agent = PropertyIntelligenceAgent(use_vision=False)
    listing = PropertyListing(
        id="older-home",
        listing_price=725_000,
        year_built=1965,
        description="As-is fixer with dated finishes, old roof, leak history, and foundation concerns.",
    )

    result = asyncio.run(agent.run(PropertyIntelligenceInput(property=listing)))

    assert result.property_quality_score < 60
    assert result.repair_risk_score >= 75
    assert result.roof_condition == "poor"
    assert result.water_damage_risk == "medium"
    assert "roof" in result.estimated_major_repairs
    assert "foundation" in result.estimated_major_repairs
