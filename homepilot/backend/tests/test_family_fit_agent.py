import asyncio

from app.agents.family_fit import FamilyFitAgent, FamilyFitInput
from app.models import BuyerProfile, PropertyListing


def test_family_fit_scores_strong_family_match() -> None:
    agent = FamilyFitAgent()
    buyer = BuyerProfile(
        budget=1_000_000,
        children=2,
        dog=True,
        work_location="Toronto",
        max_commute_minutes=40,
    )
    listing = PropertyListing(
        id="family-home",
        listing_price=925_000,
        location={"city": "Toronto"},
        bedrooms=4,
        property_type="detached",
        school_score=90,
        safety_score=86,
        park_distance_meters=300,
        commute_minutes=30,
    )

    result = asyncio.run(agent.run(FamilyFitInput(buyer=buyer, property=listing)))

    assert result.family_fit_score >= 85
    assert result.school_score == 90
    assert result.commute_score >= 80
    assert result.park_score >= 85
    assert result.confidence is not None


def test_family_fit_penalizes_over_budget_and_poor_commute() -> None:
    agent = FamilyFitAgent()
    buyer = BuyerProfile(
        budget=900_000,
        children=2,
        dog=True,
        work_location="Toronto",
        max_commute_minutes=35,
    )
    listing = PropertyListing(
        id="poor-fit",
        listing_price=1_050_000,
        location={"city": "Mississauga"},
        bedrooms=2,
        property_type="condo",
        school_score=60,
        safety_score=65,
        park_distance_meters=1_500,
        commute_minutes=70,
    )

    result = asyncio.run(agent.run(FamilyFitInput(buyer=buyer, property=listing)))

    assert result.family_fit_score < 65
    assert result.commute_score <= 40
    assert result.park_score < 30
