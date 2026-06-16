from __future__ import annotations

from pydantic import BaseModel

from app.agents.base import Agent
from app.models import BreakdownItem, BuyerProfile, CalcInput, FamilyFitResult, PropertyListing


CITY_BASELINES = {
    "toronto": {
        "school_score": 74,
        "safety_score": 68,
        "commute_minutes": 35,
        "park_distance_meters": 650,
    },
    "mississauga": {
        "school_score": 78,
        "safety_score": 76,
        "commute_minutes": 45,
        "park_distance_meters": 700,
    },
    "waterloo": {
        "school_score": 80,
        "safety_score": 82,
        "commute_minutes": 25,
        "park_distance_meters": 600,
    },
    "kitchener": {
        "school_score": 73,
        "safety_score": 74,
        "commute_minutes": 30,
        "park_distance_meters": 700,
    },
}

DEFAULT_BASELINE = {
    "school_score": 70,
    "safety_score": 72,
    "commute_minutes": 45,
    "park_distance_meters": 800,
}


class FamilyFitInput(BaseModel):
    buyer: BuyerProfile
    property: PropertyListing


class FamilyFitAgent(Agent[FamilyFitInput, FamilyFitResult]):
    """Scores how well a listing fits a buyer's household and lifestyle."""

    name = "family_fit"

    async def run(self, payload: FamilyFitInput) -> FamilyFitResult:
        buyer = payload.buyer
        property_listing = payload.property

        school_score = self._school_score(buyer, property_listing)
        commute_score = self._commute_score(buyer, property_listing)
        safety_score = self._safety_score(property_listing)
        park_score = self._park_score(buyer, property_listing)
        weights = self._weights(buyer)
        budget_adjustment = self._budget_adjustment(buyer, property_listing)
        bedroom_adjustment = self._bedroom_adjustment(buyer, property_listing)

        family_fit_score = self._clamp(
            weights["school"] * school_score
            + weights["commute"] * commute_score
            + weights["safety"] * safety_score
            + weights["park"] * park_score
            + budget_adjustment
            + bedroom_adjustment
        )

        return FamilyFitResult(
            family_fit_score=family_fit_score,
            school_score=school_score,
            commute_score=commute_score,
            safety_score=safety_score,
            park_score=park_score,
            explanation=self._explanation(
                buyer=buyer,
                property_listing=property_listing,
                weights=weights,
                budget_adjustment=budget_adjustment,
                bedroom_adjustment=bedroom_adjustment,
            ),
            confidence=self._confidence(property_listing),
            breakdown=self._breakdown(
                buyer=buyer,
                property_listing=property_listing,
                weights=weights,
                school_score=school_score,
                commute_score=commute_score,
                safety_score=safety_score,
                park_score=park_score,
                budget_adjustment=budget_adjustment,
                bedroom_adjustment=bedroom_adjustment,
            ),
        )

    def _breakdown(
        self,
        buyer: BuyerProfile,
        property_listing: PropertyListing,
        weights: dict[str, float],
        school_score: float,
        commute_score: float,
        safety_score: float,
        park_score: float,
        budget_adjustment: float,
        bedroom_adjustment: float,
    ) -> list[BreakdownItem]:
        def component(label: str, score: float, weight_key: str, listed: bool, detail: str) -> BreakdownItem:
            return BreakdownItem(
                label=label,
                value=f"{score:.0f}/100",
                formula=f"Weighted {weights[weight_key]:.0%} of the family-fit score",
                inputs=[
                    CalcInput(
                        label="Data source",
                        value="Listing data" if listed else f"{property_listing.location.city or 'City'} baseline",
                        source="listing" if listed else "assumption",
                        note=None if listed else "No listing value; used a city baseline.",
                    ),
                    CalcInput(label="Weight", value=f"{weights[weight_key]:.0%}", source="computed", note=detail),
                ],
            )

        items = [
            component(
                "Schools",
                school_score,
                "school",
                property_listing.school_score is not None,
                "Higher when the buyer has children." if buyer.children else "Lower weight (no children).",
            ),
            component(
                "Commute",
                commute_score,
                "commute",
                property_listing.commute_minutes is not None,
                f"Target {buyer.max_commute_minutes or 45} min."
                + (" Work location set." if buyer.work_location else ""),
            ),
            component(
                "Safety",
                safety_score,
                "safety",
                property_listing.safety_score is not None,
                "Neighborhood safety score.",
            ),
            component(
                "Parks",
                park_score,
                "park",
                property_listing.park_distance_meters is not None,
                "Higher weight because a dog is in the household." if buyer.dog else "Proximity to green space.",
            ),
        ]

        if abs(budget_adjustment) > 0.01:
            items.append(
                BreakdownItem(
                    label="Budget adjustment",
                    value=f"{budget_adjustment:+.1f} pts",
                    inputs=[
                        CalcInput(label="Budget", value=f"${buyer.budget:,}", source="listing"),
                        CalcInput(label="Listing price", value=f"${property_listing.listing_price:,}", source="listing"),
                    ],
                    note="Bonus for headroom under budget; penalty for going over.",
                )
            )

        if abs(bedroom_adjustment) > 0.01:
            items.append(
                BreakdownItem(
                    label="Bedroom adjustment",
                    value=f"{bedroom_adjustment:+.1f} pts",
                    inputs=[
                        CalcInput(
                            label="Bedrooms",
                            value=str(property_listing.bedrooms),
                            source="listing",
                        ),
                        CalcInput(label="Children", value=str(buyer.children), source="listing"),
                    ],
                    note="Matches bedroom count to household size.",
                )
            )

        return items

    def _school_score(
        self,
        buyer: BuyerProfile,
        property_listing: PropertyListing,
    ) -> float:
        base_score = property_listing.school_score
        if base_score is None:
            base_score = self._city_baseline(property_listing)["school_score"]

        if buyer.children == 0:
            base_score = (base_score * 0.7) + 21

        return self._clamp(base_score)

    def _commute_score(
        self,
        buyer: BuyerProfile,
        property_listing: PropertyListing,
    ) -> float:
        commute_minutes = property_listing.commute_minutes

        if commute_minutes is None:
            commute_minutes = self._city_baseline(property_listing)["commute_minutes"]
            if self._same_city(property_listing.location.city, buyer.work_location):
                commute_minutes = min(commute_minutes, 25)

        target_commute = buyer.max_commute_minutes or 45
        score = 100 - max(0, commute_minutes - target_commute) * 2

        if commute_minutes <= target_commute:
            score = 100 - (commute_minutes / max(target_commute, 1)) * 20

        return self._clamp(score)

    def _safety_score(self, property_listing: PropertyListing) -> float:
        score = property_listing.safety_score
        if score is None:
            score = self._city_baseline(property_listing)["safety_score"]
        return self._clamp(score)

    def _park_score(
        self,
        buyer: BuyerProfile,
        property_listing: PropertyListing,
    ) -> float:
        park_distance = property_listing.park_distance_meters
        if park_distance is None:
            park_distance = self._city_baseline(property_listing)["park_distance_meters"]

        score = 100 - (park_distance / 20)

        if buyer.dog and property_listing.property_type == "condo":
            score -= 8
        if buyer.dog and property_listing.property_type in {"detached", "semi-detached"}:
            score += 5

        return self._clamp(score)

    def _weights(self, buyer: BuyerProfile) -> dict[str, float]:
        weights = {
            "school": 0.35,
            "commute": 0.25,
            "safety": 0.20,
            "park": 0.20,
        }

        if buyer.children == 0:
            weights["school"] -= 0.10
            weights["commute"] += 0.05
            weights["safety"] += 0.05
        if buyer.dog:
            weights["park"] += 0.05
            weights["commute"] -= 0.05
        if buyer.work_location:
            weights["commute"] += 0.05
            weights["park"] -= 0.05

        total = sum(weights.values())
        return {key: value / total for key, value in weights.items()}

    def _budget_adjustment(
        self,
        buyer: BuyerProfile,
        property_listing: PropertyListing,
    ) -> float:
        if property_listing.listing_price <= buyer.budget:
            headroom_ratio = (buyer.budget - property_listing.listing_price) / buyer.budget
            return min(5, headroom_ratio * 20)

        over_budget_ratio = (property_listing.listing_price - buyer.budget) / buyer.budget
        return -min(20, over_budget_ratio * 100)

    def _bedroom_adjustment(
        self,
        buyer: BuyerProfile,
        property_listing: PropertyListing,
    ) -> float:
        if property_listing.bedrooms is None or buyer.children == 0:
            return 0

        preferred_bedrooms = min(5, 2 + buyer.children)
        if property_listing.bedrooms >= preferred_bedrooms:
            return 3
        return -4 * (preferred_bedrooms - property_listing.bedrooms)

    def _confidence(self, property_listing: PropertyListing) -> float:
        signals = [
            property_listing.school_score is not None,
            property_listing.safety_score is not None,
            property_listing.park_distance_meters is not None,
            property_listing.commute_minutes is not None,
            property_listing.bedrooms is not None,
        ]
        return round(0.45 + sum(signals) * 0.08, 2)

    def _explanation(
        self,
        buyer: BuyerProfile,
        property_listing: PropertyListing,
        weights: dict[str, float],
        budget_adjustment: float,
        bedroom_adjustment: float,
    ) -> str:
        city = property_listing.location.city or "the listing area"
        household_text = f"{buyer.children} children" if buyer.children else "no children"
        dog_text = "with a dog" if buyer.dog else "without a dog"

        return (
            f"Family fit used school, commute, safety, and park scores for {city}. "
            f"The buyer profile has {household_text} and is {dog_text}. "
            f"Weights were school {weights['school']:.0%}, commute {weights['commute']:.0%}, "
            f"safety {weights['safety']:.0%}, and park {weights['park']:.0%}; budget adjustment "
            f"was {budget_adjustment:.1f} and bedroom adjustment was {bedroom_adjustment:.1f}."
        )

    def _city_baseline(self, property_listing: PropertyListing) -> dict[str, int]:
        city = (property_listing.location.city or "").lower()
        return CITY_BASELINES.get(city, DEFAULT_BASELINE)

    def _same_city(self, city: str | None, location_text: str | None) -> bool:
        if not city or not location_text:
            return False
        return city.lower() in location_text.lower()

    def _clamp(self, score: float) -> float:
        return round(min(100, max(0, score)), 2)
