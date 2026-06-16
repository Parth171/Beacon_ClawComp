"""Property Value Agent.

Answers: is this property worth the asking price?

Phase 1 pipeline:
  1. Fetch real comparable listings from realtor.ca (same city, ± bedroom count).
  2. Compute median price-per-sqft from those comps.
  3. Derive base estimated value: subject_sqft * median_ppsf.
  4. Adjust for condition (from Property Intelligence repair risk / quality).
  5. Apply area development premium (from area_signals.json used by Future Outlook).
  6. Produce recommendation, positive/negative factors, and a summary.

Falls back to a hardcoded city baseline when live comps are unavailable.
"""

from __future__ import annotations

import json
import logging
import statistics
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.agents.base import Agent
from app.models import (
    BreakdownItem,
    CalcInput,
    PropertyIntelligenceResult,
    PropertyListing,
    PropertyValueResult,
)
from app.services.comps import Comp, fetch_comps

logger = logging.getLogger(__name__)

CURRENT_YEAR = 2026
DEFAULT_SQFT = 1_800
MIN_COMPS_FOR_LIVE = 3

AREA_SIGNALS_PATH = Path(__file__).resolve().parents[1] / "data" / "area_signals.json"

# Fallback city baselines (CAD/sqft) for when live comps are unavailable.
CITY_BASELINE_PPSF: dict[str, int] = {
    "toronto": 760,
    "mississauga": 680,
    "waterloo": 540,
    "kitchener": 510,
    "ottawa": 560,
}
DEFAULT_BASELINE_PPSF = 600


def _load_area_signals() -> dict[str, Any]:
    try:
        with AREA_SIGNALS_PATH.open() as f:
            return json.load(f)
    except Exception:
        return {}


class PropertyValueInput(BaseModel):
    property: PropertyListing
    property_intelligence: PropertyIntelligenceResult | None = None


class PropertyValueAgent(Agent[PropertyValueInput, PropertyValueResult]):
    """Estimates fair market value from real comparable sales."""

    name = "property_value"

    def __init__(self, area_signals: dict[str, Any] | None = None) -> None:
        self._area_signals = area_signals  # injected in tests; loaded lazily otherwise

    @property
    def area_signals(self) -> dict[str, Any]:
        if self._area_signals is None:
            self._area_signals = _load_area_signals()
        return self._area_signals

    async def run(self, payload: PropertyValueInput) -> PropertyValueResult:
        listing = payload.property
        pi = payload.property_intelligence
        asking = listing.listing_price
        sqft = listing.square_feet or DEFAULT_SQFT
        city = (listing.location.city or "").strip()
        beds = listing.bedrooms or 3

        # --- 1. Fetch live comps ---
        comps: list[Comp] = []
        if city:
            try:
                comps = await fetch_comps(city=city, bedrooms=beds, max_price=int(asking * 1.4))
            except Exception as exc:
                logger.warning("Comp fetch failed: %s", exc)

        # --- 2. Compute median $/sqft ---
        using_live_comps = len(comps) >= MIN_COMPS_FOR_LIVE
        if using_live_comps:
            median_ppsf = statistics.median(c.ppsf for c in comps)
        else:
            city_key = city.lower()
            median_ppsf = CITY_BASELINE_PPSF.get(city_key, DEFAULT_BASELINE_PPSF)
            logger.info("Using hardcoded baseline for %s (%.0f $/sqft)", city, median_ppsf)

        # --- 3. Base estimated value ---
        base_value = sqft * median_ppsf

        # --- 4. Condition adjustment from PI ---
        condition_adj = self._condition_adjustment(pi)

        # --- 5. Development premium from area_signals ---
        dev_adj, dev_reasons = self._development_adjustment(city)

        estimated_value = round(base_value * condition_adj * dev_adj)

        # --- 6. Value gap ---
        value_gap = estimated_value - asking
        value_gap_pct = round(value_gap / asking, 4) if asking else 0.0
        deal_score = self._deal_score(value_gap_pct)
        recommendation = self._recommendation(value_gap_pct)

        # --- 7. Factors ---
        positive, negative = self._build_factors(
            listing=listing,
            pi=pi,
            comps=comps,
            using_live_comps=using_live_comps,
            value_gap_pct=value_gap_pct,
            dev_reasons=dev_reasons,
        )

        summary = self._build_summary(
            listing=listing,
            comps=comps,
            using_live_comps=using_live_comps,
            median_ppsf=median_ppsf,
            estimated_value=estimated_value,
            asking=asking,
            value_gap_pct=value_gap_pct,
            recommendation=recommendation,
        )

        return PropertyValueResult(
            asking_price=asking,
            estimated_value=estimated_value,
            value_gap=value_gap,
            value_gap_pct=value_gap_pct,
            deal_score=deal_score,
            recommendation=recommendation,
            comparable_count=len(comps),
            median_ppsf=round(float(median_ppsf), 2),
            positive_factors=positive,
            negative_factors=negative,
            explanation=summary,
            confidence=self._confidence(comps, listing, pi),
            breakdown=self._breakdown(
                listing=listing,
                comps=comps,
                using_live_comps=using_live_comps,
                median_ppsf=median_ppsf,
                sqft=sqft,
                base_value=base_value,
                condition_adj=condition_adj,
                dev_adj=dev_adj,
                dev_reasons=dev_reasons,
                estimated_value=estimated_value,
                asking=asking,
                value_gap=value_gap,
                value_gap_pct=value_gap_pct,
                pi=pi,
            ),
        )

    def _breakdown(
        self,
        listing: PropertyListing,
        comps: list[Comp],
        using_live_comps: bool,
        median_ppsf: float,
        sqft: int,
        base_value: float,
        condition_adj: float,
        dev_adj: float,
        dev_reasons: list[str],
        estimated_value: int,
        asking: int,
        value_gap: int,
        value_gap_pct: float,
        pi: PropertyIntelligenceResult | None,
    ) -> list[BreakdownItem]:
        city = listing.location.city or "the area"
        sqft_is_listed = listing.square_feet is not None
        items: list[BreakdownItem] = []

        # --- Comparable sales evidence ---
        if using_live_comps:
            comp_inputs = [
                CalcInput(
                    label=comp.address or comp.url or f"Comp {i + 1}",
                    value=f"${comp.price:,} · {comp.sqft:,} sqft · ${comp.ppsf:,.0f}/sqft",
                    source="market",
                    note=comp.url or None,
                )
                for i, comp in enumerate(comps)
            ]
            items.append(
                BreakdownItem(
                    label="Comparable listings",
                    value=f"{len(comps)} comps in {city}",
                    formula="Live realtor.ca listings, same city and bedroom range",
                    inputs=comp_inputs,
                    note="Real homes currently competing with this one on the market.",
                )
            )
            items.append(
                BreakdownItem(
                    label="Median price per sqft",
                    value=f"${median_ppsf:,.0f}/sqft",
                    formula="Median of the comparable listings' $/sqft",
                    inputs=[
                        CalcInput(
                            label="Comp $/sqft range",
                            value=f"${min(c.ppsf for c in comps):,.0f} – ${max(c.ppsf for c in comps):,.0f}",
                            source="market",
                        )
                    ],
                    note="Median resists outliers better than a simple average.",
                )
            )
        else:
            items.append(
                BreakdownItem(
                    label="Market baseline",
                    value=f"${median_ppsf:,.0f}/sqft",
                    formula=f"{city} fallback baseline (no live comps found)",
                    inputs=[
                        CalcInput(
                            label=f"{city} baseline $/sqft",
                            value=f"${median_ppsf:,.0f}",
                            source="assumption",
                        )
                    ],
                    note="Could not fetch live comparables, so a city baseline was used.",
                )
            )

        # --- Base value ---
        items.append(
            BreakdownItem(
                label="Base estimated value",
                value=f"${round(base_value):,}",
                formula=f"{sqft:,} sqft × ${median_ppsf:,.0f}/sqft",
                inputs=[
                    CalcInput(
                        label="Subject square footage",
                        value=f"{sqft:,} sqft",
                        source="listing" if sqft_is_listed else "assumption",
                        note=None if sqft_is_listed else "No sqft on listing; used 1,800 default.",
                    ),
                    CalcInput(label="Median $/sqft", value=f"${median_ppsf:,.0f}", source="computed"),
                ],
            )
        )

        # --- Condition adjustment ---
        if pi is not None and abs(condition_adj - 1.0) > 0.0001:
            items.append(
                BreakdownItem(
                    label="Condition adjustment",
                    value=f"×{condition_adj:.3f}",
                    formula="From Property Intelligence quality and repair risk",
                    inputs=[
                        CalcInput(
                            label="Property quality",
                            value=f"{pi.property_quality_score:.0f}/100",
                            source="model",
                        ),
                        CalcInput(
                            label="Repair risk",
                            value=f"{pi.repair_risk_score:.0f}/100",
                            source="model",
                        ),
                    ],
                    note="A home in better-than-average condition is worth a premium.",
                )
            )

        # --- Development premium ---
        if dev_reasons and abs(dev_adj - 1.0) > 0.0001:
            items.append(
                BreakdownItem(
                    label="Area development premium",
                    value=f"×{dev_adj:.3f}",
                    formula="Transit, development, and growth signals for the area",
                    inputs=[
                        CalcInput(label=reason, value="+", source="market") for reason in dev_reasons
                    ],
                    note="Planned infrastructure tends to lift nearby values.",
                )
            )

        # --- Final estimate vs asking ---
        items.append(
            BreakdownItem(
                label="Estimated fair value vs asking",
                value=f"${estimated_value:,} vs ${asking:,}",
                formula=f"Asking is {value_gap_pct:+.1%} vs fair value",
                inputs=[
                    CalcInput(label="Estimated fair value", value=f"${estimated_value:,}", source="computed"),
                    CalcInput(label="Asking price", value=f"${asking:,}", source="listing"),
                    CalcInput(
                        label="Gap",
                        value=f"${value_gap:+,}",
                        source="computed",
                        note="Positive means priced below our estimate.",
                    ),
                ],
            )
        )

        return items

    # ------------------------------------------------------------------ helpers

    def _condition_adjustment(self, pi: PropertyIntelligenceResult | None) -> float:
        if pi is None:
            return 1.0
        quality_adj = (pi.property_quality_score - 70) * 0.0015
        repair_adj = -max(0.0, pi.repair_risk_score - 40) * 0.0015
        return max(0.85, min(1.12, 1.0 + quality_adj + repair_adj))

    def _development_adjustment(self, city: str) -> tuple[float, list[str]]:
        city_key = city.lower()
        area = self.area_signals.get(city_key, self.area_signals.get("_default", {}))
        signals = area.get("signals", {})
        reasons = []
        adj = 1.0
        if signals.get("new_transit_line"):
            adj += 0.02
            reasons.append(f"Upcoming transit: {signals.get('transit_project', 'expansion')}")
        if signals.get("major_development"):
            adj += 0.01
            reasons.append("Active major development nearby")
        growth = signals.get("population_growth", "")
        if growth == "high":
            adj += 0.01
            reasons.append("High population growth area")
        return min(1.05, adj), reasons

    def _deal_score(self, value_gap_pct: float) -> float:
        score = 50 + value_gap_pct * 250
        return round(min(100.0, max(0.0, score)), 2)

    def _recommendation(self, value_gap_pct: float) -> str:
        if value_gap_pct > 0.03:
            return "UNDERVALUED"
        if value_gap_pct < -0.03:
            return "OVERVALUED"
        return "FAIRLY_VALUED"

    def _build_factors(
        self,
        listing: PropertyListing,
        pi: PropertyIntelligenceResult | None,
        comps: list[Comp],
        using_live_comps: bool,
        value_gap_pct: float,
        dev_reasons: list[str],
    ) -> tuple[list[str], list[str]]:
        positive: list[str] = []
        negative: list[str] = []

        if using_live_comps:
            positive.append(f"Valuation grounded in {len(comps)} real market comparables")
        if value_gap_pct > 0.05:
            positive.append(f"Asking price is {value_gap_pct:.0%} below estimated fair value")
        if pi and pi.property_quality_score >= 80:
            positive.append(f"High property quality score ({pi.property_quality_score:.0f}/100)")
        if pi and pi.repair_risk_score <= 25:
            positive.append("Low repair risk — likely move-in ready")
        positive.extend(dev_reasons)

        if value_gap_pct < -0.05:
            negative.append(f"Asking price is {abs(value_gap_pct):.0%} above estimated fair value")
        if pi and pi.repair_risk_score >= 60:
            negative.append(f"High repair risk ({pi.repair_risk_score:.0f}/100)")
        if pi and pi.estimated_major_repairs:
            repairs = ", ".join(pi.estimated_major_repairs[:3])
            negative.append(f"Potential repairs flagged: {repairs}")
        if not using_live_comps:
            negative.append("Valuation uses market baseline — live comps unavailable for this area")

        return positive, negative

    def _build_summary(
        self,
        listing: PropertyListing,
        comps: list[Comp],
        using_live_comps: bool,
        median_ppsf: float,
        estimated_value: int,
        asking: int,
        value_gap_pct: float,
        recommendation: str,
    ) -> str:
        city = listing.location.city or "the area"
        comp_text = (
            f"We analyzed {len(comps)} comparable listings in {city}"
            if using_live_comps
            else f"No live comps were available; we used a {city} market baseline"
        )
        verdict = {
            "UNDERVALUED": "appears undervalued relative to the market",
            "OVERVALUED": "appears overvalued relative to comparable properties",
            "FAIRLY_VALUED": "appears fairly priced for its market",
        }[recommendation]
        gap_text = (
            f"${abs(int(estimated_value - asking)):,} {'below' if value_gap_pct > 0 else 'above'} "
            f"our estimated fair value of ${estimated_value:,}"
        )
        return (
            f"{comp_text} (median ${median_ppsf:.0f}/sqft). "
            f"The asking price of ${asking:,} is {gap_text}. "
            f"This property {verdict} ({value_gap_pct:+.1%}). "
            f"Recommendation: {recommendation.replace('_', ' ')}."
        )

    def _confidence(
        self,
        comps: list[Comp],
        listing: PropertyListing,
        pi: PropertyIntelligenceResult | None,
    ) -> float:
        score = 0.35
        if len(comps) >= MIN_COMPS_FOR_LIVE:
            score += min(0.35, len(comps) * 0.04)
        if listing.square_feet:
            score += 0.1
        if listing.location.city:
            score += 0.05
        if pi is not None:
            score += 0.05
        return round(min(0.9, score), 2)
