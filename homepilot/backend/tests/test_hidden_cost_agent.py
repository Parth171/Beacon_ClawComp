import asyncio

from app.agents.hidden_cost import HiddenCostAgent, HiddenCostInput
from app.models import PropertyIntelligenceResult, PropertyListing


def test_hidden_cost_estimates_true_annual_cost() -> None:
    agent = HiddenCostAgent()
    listing = PropertyListing(
        id="toronto-home",
        listing_price=1_000_000,
        location={"city": "Toronto"},
        square_feet=2_000,
        year_built=2018,
        property_type="detached",
    )
    property_intelligence = PropertyIntelligenceResult(
        property_quality_score=88,
        repair_risk_score=25,
    )

    result = asyncio.run(
        agent.run(
            HiddenCostInput(
                property=listing,
                property_intelligence=property_intelligence,
            )
        )
    )

    assert result.annual_property_tax == 6_700
    assert result.annual_utilities > 0
    assert result.annual_insurance >= 1_200
    assert result.annual_maintenance > 0
    assert result.true_annual_cost == (
        result.annual_property_tax
        + result.annual_utilities
        + result.annual_insurance
        + result.annual_maintenance
    )


def test_hidden_cost_increases_maintenance_for_older_high_risk_home() -> None:
    agent = HiddenCostAgent()
    base_listing = PropertyListing(
        id="base-home",
        listing_price=800_000,
        square_feet=1_800,
        year_built=2020,
    )
    risky_listing = PropertyListing(
        id="risky-home",
        listing_price=800_000,
        square_feet=1_800,
        year_built=1960,
    )

    base_result = asyncio.run(
        agent.run(
            HiddenCostInput(
                property=base_listing,
                property_intelligence=PropertyIntelligenceResult(
                    property_quality_score=90,
                    repair_risk_score=20,
                ),
            )
        )
    )
    risky_result = asyncio.run(
        agent.run(
            HiddenCostInput(
                property=risky_listing,
                property_intelligence=PropertyIntelligenceResult(
                    property_quality_score=45,
                    repair_risk_score=85,
                ),
            )
        )
    )

    assert risky_result.annual_maintenance > base_result.annual_maintenance
    assert risky_result.true_annual_cost > base_result.true_annual_cost
