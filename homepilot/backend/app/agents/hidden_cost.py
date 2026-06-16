from __future__ import annotations

from pydantic import BaseModel

from app.agents.base import Agent
from app.models import (
    BreakdownItem,
    CalcInput,
    HiddenCostResult,
    PropertyIntelligenceResult,
    PropertyListing,
)


CURRENT_YEAR = 2026
DEFAULT_SQUARE_FEET = 1_800

MUNICIPAL_TAX_RATES = {
    "toronto": 0.0067,
    "mississauga": 0.0083,
    "waterloo": 0.0110,
    "kitchener": 0.0114,
    "ottawa": 0.0108,
}

PROPERTY_TYPE_INSURANCE_MULTIPLIERS = {
    "detached": 1.15,
    "semi-detached": 1.05,
    "townhouse": 0.95,
    "condo": 0.75,
}


class HiddenCostInput(BaseModel):
    property: PropertyListing
    property_intelligence: PropertyIntelligenceResult | None = None


class HiddenCostAgent(Agent[HiddenCostInput, HiddenCostResult]):
    """Estimates the true annual ownership cost for a listing."""

    name = "hidden_cost"

    async def run(self, payload: HiddenCostInput) -> HiddenCostResult:
        property_listing = payload.property
        property_age = self._property_age(property_listing)
        square_feet = property_listing.square_feet or DEFAULT_SQUARE_FEET
        repair_risk_score = (
            payload.property_intelligence.repair_risk_score
            if payload.property_intelligence is not None
            else 45
        )

        annual_property_tax = self._annual_property_tax(property_listing)
        annual_utilities = self._annual_utilities(square_feet, property_age)
        annual_insurance = self._annual_insurance(property_listing, property_age)
        annual_maintenance = self._annual_maintenance(
            listing_price=property_listing.listing_price,
            property_age=property_age,
            repair_risk_score=repair_risk_score,
        )
        true_annual_cost = (
            annual_property_tax
            + annual_utilities
            + annual_insurance
            + annual_maintenance
        )

        return HiddenCostResult(
            annual_property_tax=annual_property_tax,
            annual_utilities=annual_utilities,
            annual_insurance=annual_insurance,
            annual_maintenance=annual_maintenance,
            true_annual_cost=true_annual_cost,
            explanation=self._explanation(
                city=property_listing.location.city,
                square_feet=square_feet,
                property_age=property_age,
                repair_risk_score=repair_risk_score,
            ),
            confidence=self._confidence(property_listing, payload.property_intelligence),
            breakdown=self._breakdown(
                property_listing=property_listing,
                square_feet=square_feet,
                property_age=property_age,
                repair_risk_score=repair_risk_score,
                has_pi=payload.property_intelligence is not None,
                annual_property_tax=annual_property_tax,
                annual_utilities=annual_utilities,
                annual_insurance=annual_insurance,
                annual_maintenance=annual_maintenance,
                true_annual_cost=true_annual_cost,
            ),
        )

    def _breakdown(
        self,
        property_listing: PropertyListing,
        square_feet: int,
        property_age: int | None,
        repair_risk_score: float,
        has_pi: bool,
        annual_property_tax: int,
        annual_utilities: int,
        annual_insurance: int,
        annual_maintenance: int,
        true_annual_cost: int,
    ) -> list[BreakdownItem]:
        price = property_listing.listing_price
        city = property_listing.location.city
        city_key = (city or "").lower()
        sqft_is_listed = property_listing.square_feet is not None

        items: list[BreakdownItem] = []

        # --- Property tax ---
        if property_listing.annual_property_tax is not None:
            items.append(
                BreakdownItem(
                    label="Property tax",
                    value=f"${annual_property_tax:,}/yr",
                    formula="Taken directly from the listing",
                    inputs=[
                        CalcInput(
                            label="Listing-stated annual tax",
                            value=f"${annual_property_tax:,}",
                            source="listing",
                        )
                    ],
                    note="The seller disclosed the actual annual property tax.",
                )
            )
        else:
            tax_rate = MUNICIPAL_TAX_RATES.get(city_key, 0.0095)
            rate_known = city_key in MUNICIPAL_TAX_RATES
            items.append(
                BreakdownItem(
                    label="Property tax",
                    value=f"${annual_property_tax:,}/yr",
                    formula=f"${price:,} × {tax_rate:.3%}",
                    inputs=[
                        CalcInput(label="Listing price", value=f"${price:,}", source="listing"),
                        CalcInput(
                            label=f"{city or 'Ontario'} mill rate",
                            value=f"{tax_rate:.3%}",
                            source="market" if rate_known else "assumption",
                            note=None if rate_known else "Default Ontario rate; city rate unknown.",
                        ),
                    ],
                    note="Listing did not state taxes, so we applied the municipal rate.",
                )
            )

        # --- Utilities ---
        age_adjustment = 0 if property_age is None else min(90, property_age * 1.5)
        items.append(
            BreakdownItem(
                label="Utilities",
                value=f"${annual_utilities:,}/yr",
                formula=f"($160 base + {square_feet:,} sqft × $0.08 + ${age_adjustment:.0f} age) × 12",
                inputs=[
                    CalcInput(label="Base monthly utilities", value="$160", source="assumption"),
                    CalcInput(
                        label="Square footage",
                        value=f"{square_feet:,} sqft",
                        source="listing" if sqft_is_listed else "assumption",
                        note=None if sqft_is_listed else "Listing had no sqft; used 1,800 default.",
                    ),
                    CalcInput(
                        label="Age surcharge",
                        value=f"${age_adjustment:.0f}/mo",
                        source="computed",
                        note="Older homes are less energy efficient.",
                    ),
                ],
                note="Estimated from size and age — older, larger homes cost more to run.",
            )
        )

        # --- Insurance ---
        property_type = (property_listing.property_type or "").lower()
        type_multiplier = PROPERTY_TYPE_INSURANCE_MULTIPLIERS.get(property_type, 1.0)
        age_multiplier = 1.0 if property_age is None else 1 + min(0.25, property_age * 0.004)
        items.append(
            BreakdownItem(
                label="Insurance",
                value=f"${annual_insurance:,}/yr",
                formula=f"${price:,} × 0.18% × {type_multiplier:.2f} (type) × {age_multiplier:.2f} (age)",
                inputs=[
                    CalcInput(label="Listing price", value=f"${price:,}", source="listing"),
                    CalcInput(
                        label=f"{property_type or 'property'} risk factor",
                        value=f"×{type_multiplier:.2f}",
                        source="assumption",
                    ),
                    CalcInput(label="Age risk factor", value=f"×{age_multiplier:.2f}", source="computed"),
                ],
                note="Detached homes cost more to insure than condos; min $1,200/yr.",
            )
        )

        # --- Maintenance ---
        maintenance_pct = (annual_maintenance / price) if price else 0
        repair_source: str = "model" if has_pi else "assumption"
        items.append(
            BreakdownItem(
                label="Maintenance",
                value=f"${annual_maintenance:,}/yr",
                formula=f"${price:,} × {maintenance_pct:.2%} (base + age + repair-risk rates)",
                inputs=[
                    CalcInput(label="Listing price", value=f"${price:,}", source="listing"),
                    CalcInput(label="Base rate", value="0.60%", source="assumption"),
                    CalcInput(
                        label="Age rate",
                        value=self._age_rate_label(property_age),
                        source="computed",
                    ),
                    CalcInput(
                        label="Repair-risk rate",
                        value=f"{(repair_risk_score / 100) * 0.006:.2%}",
                        source=repair_source,
                        note=(
                            f"From Property Intelligence repair risk {repair_risk_score:.0f}/100."
                            if has_pi
                            else "No photo analysis available; used a neutral 45/100 risk."
                        ),
                    ),
                ],
                note="Annual upkeep scales with price, age, and the condition findings.",
            )
        )

        # --- Total ---
        items.append(
            BreakdownItem(
                label="True annual cost",
                value=f"${true_annual_cost:,}/yr",
                formula="Tax + Utilities + Insurance + Maintenance",
                inputs=[
                    CalcInput(label="Property tax", value=f"${annual_property_tax:,}", source="computed"),
                    CalcInput(label="Utilities", value=f"${annual_utilities:,}", source="computed"),
                    CalcInput(label="Insurance", value=f"${annual_insurance:,}", source="computed"),
                    CalcInput(label="Maintenance", value=f"${annual_maintenance:,}", source="computed"),
                ],
                note="What you actually pay each year beyond the mortgage.",
            )
        )

        return items

    def _age_rate_label(self, property_age: int | None) -> str:
        if property_age is None:
            return "0.20%"
        if property_age > 40:
            return "0.60%"
        if property_age > 25:
            return "0.40%"
        if property_age > 10:
            return "0.20%"
        return "0.10%"

    def _annual_property_tax(self, property_listing: PropertyListing) -> int:
        if property_listing.annual_property_tax is not None:
            return property_listing.annual_property_tax

        city = (property_listing.location.city or "").lower()
        tax_rate = MUNICIPAL_TAX_RATES.get(city, 0.0095)
        return round(property_listing.listing_price * tax_rate)

    def _annual_utilities(self, square_feet: int, property_age: int | None) -> int:
        monthly_base = 160
        size_adjustment = square_feet * 0.08
        age_adjustment = 0 if property_age is None else min(90, property_age * 1.5)
        return round((monthly_base + size_adjustment + age_adjustment) * 12)

    def _annual_insurance(
        self,
        property_listing: PropertyListing,
        property_age: int | None,
    ) -> int:
        property_type = (property_listing.property_type or "").lower()
        type_multiplier = PROPERTY_TYPE_INSURANCE_MULTIPLIERS.get(property_type, 1.0)
        age_multiplier = 1.0 if property_age is None else 1 + min(0.25, property_age * 0.004)
        value_component = property_listing.listing_price * 0.0018
        return round(max(1_200, value_component * type_multiplier * age_multiplier))

    def _annual_maintenance(
        self,
        listing_price: int,
        property_age: int | None,
        repair_risk_score: float,
    ) -> int:
        base_rate = 0.006

        if property_age is None:
            age_rate = 0.002
        elif property_age > 40:
            age_rate = 0.006
        elif property_age > 25:
            age_rate = 0.004
        elif property_age > 10:
            age_rate = 0.002
        else:
            age_rate = 0.001

        repair_risk_rate = (repair_risk_score / 100) * 0.006
        return round(listing_price * (base_rate + age_rate + repair_risk_rate))

    def _property_age(self, property_listing: PropertyListing) -> int | None:
        if property_listing.year_built is None:
            return None
        return max(0, CURRENT_YEAR - property_listing.year_built)

    def _confidence(
        self,
        property_listing: PropertyListing,
        property_intelligence: PropertyIntelligenceResult | None,
    ) -> float:
        confidence = 0.45

        if property_listing.location.city:
            confidence += 0.15
        if property_listing.square_feet:
            confidence += 0.15
        if property_listing.year_built:
            confidence += 0.1
        if property_intelligence is not None:
            confidence += 0.1

        return round(min(0.9, confidence), 2)

    def _explanation(
        self,
        city: str | None,
        square_feet: int,
        property_age: int | None,
        repair_risk_score: float,
    ) -> str:
        city_text = city or "the default Ontario municipal rate"
        age_text = "unknown age" if property_age is None else f"approximately {property_age} years old"

        return (
            f"Hidden cost estimate used {city_text} tax assumptions, {square_feet:,} square feet, "
            f"a property that is {age_text}, and a repair risk score of {repair_risk_score:.1f}."
        )
