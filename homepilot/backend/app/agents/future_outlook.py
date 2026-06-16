from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.agents.base import Agent
from app.models import BreakdownItem, CalcInput, FutureOutlookResult, PropertyListing


AREA_SIGNALS_PATH = Path(__file__).resolve().parents[1] / "data" / "area_signals.json"

# Bonuses layered on top of an area's base appreciation score.
SIGNAL_BONUSES = {
    "new_transit_line": 8,
    "major_development": 5,
    "tech_employment_growth": 6,
}
POPULATION_GROWTH_BONUS = {"high": 6, "moderate": 2, "low": -2}


def load_area_signals(path: Path | None = None) -> dict[str, Any]:
    """Load the curated area-signal knowledge base."""

    signals_path = path or AREA_SIGNALS_PATH
    with signals_path.open() as file:
        return json.load(file)


class FutureOutlookInput(BaseModel):
    property: PropertyListing


class FutureOutlookAgent(Agent[FutureOutlookInput, FutureOutlookResult]):
    """Scores the long-term appreciation outlook for a listing's area."""

    name = "future_outlook"

    def __init__(self, area_signals: dict[str, Any] | None = None) -> None:
        self.area_signals = area_signals if area_signals is not None else load_area_signals()

    async def run(self, payload: FutureOutlookInput) -> FutureOutlookResult:
        property_listing = payload.property
        city = (property_listing.location.city or "").lower()
        area = self.area_signals.get(city)
        matched = area is not None
        if area is None:
            area = self.area_signals.get("_default", {"base_score": 60, "signals": {}, "reasons": []})

        signals: dict[str, Any] = dict(area.get("signals", {}))
        base_score = float(area.get("base_score", 60))
        reasons = list(area.get("reasons", []))

        score = base_score
        for signal_key, bonus in SIGNAL_BONUSES.items():
            if signals.get(signal_key):
                score += bonus

        growth = signals.get("population_growth")
        if isinstance(growth, str):
            score += POPULATION_GROWTH_BONUS.get(growth, 0)

        future_score = round(min(100, max(0, score)), 2)

        return FutureOutlookResult(
            future_score=future_score,
            reasons=reasons,
            signals=signals,
            explanation=self._explanation(property_listing, matched, future_score),
            confidence=0.7 if matched else 0.4,
            breakdown=self._breakdown(
                property_listing=property_listing,
                matched=matched,
                base_score=base_score,
                signals=signals,
                future_score=future_score,
            ),
        )

    def _breakdown(
        self,
        property_listing: PropertyListing,
        matched: bool,
        base_score: float,
        signals: dict[str, Any],
        future_score: float,
    ) -> list[BreakdownItem]:
        city = property_listing.location.city or "this area"
        base_source = "market" if matched else "assumption"
        items: list[BreakdownItem] = [
            BreakdownItem(
                label="Base area score",
                value=f"{base_score:.0f}/100",
                formula=f"Curated planning baseline for {city}"
                if matched
                else "Neutral baseline (no curated data for this area)",
                inputs=[
                    CalcInput(
                        label=f"{city} baseline",
                        value=f"{base_score:.0f}",
                        source=base_source,
                        note=None if matched else "Add area data to sharpen this estimate.",
                    )
                ],
            )
        ]

        contributions: list[CalcInput] = []
        for key, bonus in SIGNAL_BONUSES.items():
            if signals.get(key):
                detail = signals.get(key)
                label = key.replace("_", " ").title()
                value = f"+{bonus}"
                note = None
                if key == "new_transit_line" and signals.get("transit_project"):
                    note = f"{signals['transit_project']} (~{signals.get('opening_year', 'TBD')})"
                contributions.append(
                    CalcInput(label=label, value=value, source="market", note=note)
                )

        growth = signals.get("population_growth")
        if isinstance(growth, str):
            growth_bonus = POPULATION_GROWTH_BONUS.get(growth, 0)
            contributions.append(
                CalcInput(
                    label=f"Population growth ({growth})",
                    value=f"{growth_bonus:+d}",
                    source="market",
                )
            )

        if contributions:
            items.append(
                BreakdownItem(
                    label="Planning & growth signals",
                    value=f"{len(contributions)} signals",
                    formula="Each signal adds or subtracts from the base score",
                    inputs=contributions,
                    note="Forward-looking factors a listing page never shows you.",
                )
            )

        items.append(
            BreakdownItem(
                label="Future outlook score",
                value=f"{future_score:.0f}/100",
                formula="Base score + planning & growth signals (capped at 100)",
                inputs=[
                    CalcInput(label="Final score", value=f"{future_score:.0f}/100", source="computed")
                ],
            )
        )

        return items

    def _explanation(
        self,
        property_listing: PropertyListing,
        matched: bool,
        future_score: float,
    ) -> str:
        city = property_listing.location.city or "this area"
        if not matched:
            return (
                f"No curated planning signals for {city}; used a neutral baseline outlook "
                f"of {future_score:.0f}. Add area data to sharpen this estimate."
            )
        return (
            f"Future outlook for {city} scored {future_score:.0f} from curated planning, "
            f"transit, development, and population-growth signals."
        )
