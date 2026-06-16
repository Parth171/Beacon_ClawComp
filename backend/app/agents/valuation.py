"""Agent 2 — Valuation & Mispricing Engine.

Runs SECOND in the chain, consuming Agent 3's inspection result. Determines whether
the property is fairly priced and why:

  Signal A (historical value): live realtor.ca comparables -> median $/sqft -> base
    value, adjusted for condition using the inspection output. (XGBoost/LightGBM is
    deferred until MLS training data exists; comps is the shipping estimator.)
  Signal B (listing context): the text LLM reads the description + price-reduction
    cadence + days-on-market to score seller urgency and distress.

Emits mispricing, seller urgency, distress signals, and evidence artifacts for the
Trajectory and Thesis agents.
"""

from __future__ import annotations

import logging
import statistics
from collections.abc import Awaitable, Callable

from pydantic import BaseModel

from app.agents.base import Agent
from app.models.evidence import BreakdownItem, CalcInput, Evidence
from app.models.inspection import InspectionResult
from app.models.property import CanonicalProperty
from app.models.valuation import (
    LISTING_CONTEXT_SCHEMA,
    ListingContextSignal,
    ValuationResult,
)
from app.services.comps import Comp, fetch_comps
from app.services.inference.base import TextClient
from app.services.progress import report_subtask

logger = logging.getLogger(__name__)

DEFAULT_SQFT = 1800
MIN_COMPS_FOR_LIVE = 3

CITY_BASELINE_PPSF: dict[str, int] = {
    "toronto": 760,
    "mississauga": 680,
    "waterloo": 540,
    "kitchener": 510,
    "ottawa": 560,
}
DEFAULT_BASELINE_PPSF = 600

CompsProvider = Callable[[str, int, int], Awaitable[list[Comp]]]


class ValuationInput(BaseModel):
    property: CanonicalProperty
    inspection: InspectionResult | None = None


class ValuationAgent(Agent[ValuationInput, ValuationResult]):
    name = "valuation"

    def __init__(
        self,
        text_client: TextClient | None = None,
        comps_provider: CompsProvider | None = None,
    ) -> None:
        self._text = text_client
        self._comps_provider = comps_provider

    async def run(self, payload: ValuationInput) -> ValuationResult:
        prop = payload.property
        insp = payload.inspection
        asking = prop.price
        sqft = prop.sqft or DEFAULT_SQFT
        city = (prop.city or "").strip()
        beds = prop.bedrooms or 3
        notes: list[str] = []

        # --- Signal A: comps -> median $/sqft ---
        comps = await self._fetch_comps(city, beds, asking) if city else []
        using_live = len(comps) >= MIN_COMPS_FOR_LIVE
        if using_live:
            median_ppsf = float(statistics.median(c.ppsf for c in comps))
        else:
            median_ppsf = float(CITY_BASELINE_PPSF.get(city.lower(), DEFAULT_BASELINE_PPSF))
            notes.append(
                "Used city baseline $/sqft — fewer than 3 live comps available."
                if city
                else "No city on listing; used default baseline $/sqft."
            )

        base_value = sqft * median_ppsf
        condition_adj = _condition_adjustment(insp)
        estimated_value = round(base_value * condition_adj)
        mispricing = estimated_value - asking
        mispricing_pct = round(mispricing / asking, 4) if asking else 0.0

        # --- price-reduction cadence (deterministic) ---
        reduction_count, reduction_total = _price_reductions(prop)

        # --- Signal B: listing-context LLM ---
        signal = await self._listing_context(prop, reduction_count, reduction_total)
        seller_urgency = _blend_urgency(signal.seller_urgency, reduction_count, prop.days_on_market)
        distress_sale = signal.distress_sale or reduction_count >= 2
        urgency_modifier = -round(0.05 * seller_urgency, 4)

        evidence = self._build_evidence(
            reduction_count, reduction_total, prop, signal, mispricing_pct
        )
        breakdown = _build_breakdown(
            comps, using_live, median_ppsf, sqft, base_value, condition_adj,
            estimated_value, asking, mispricing, mispricing_pct, insp,
        )

        return ValuationResult(
            asking_price=asking,
            estimated_value=estimated_value,
            mispricing=mispricing,
            mispricing_pct=mispricing_pct,
            seller_urgency=round(seller_urgency, 3),
            distress_sale=distress_sale,
            urgency_modifier=urgency_modifier,
            price_reduction_count=reduction_count,
            price_reduction_total=reduction_total,
            days_on_market=prop.days_on_market,
            median_ppsf=round(median_ppsf, 2),
            comparable_count=len(comps),
            using_live_comps=using_live,
            model=getattr(self._text, "name", None) or "unknown",
            evidence=evidence,
            breakdown=breakdown,
            notes=notes,
        )

    # --- signals -----------------------------------------------------------

    async def _fetch_comps(self, city: str, beds: int, asking: int) -> list[Comp]:
        provider = self._comps_provider or fetch_comps
        try:
            return await provider(city, beds, int(asking * 1.4))
        except Exception as exc:  # noqa: BLE001
            logger.warning("comps provider failed: %s", exc)
            return []

    async def _listing_context(
        self, prop: CanonicalProperty, reduction_count: int, reduction_total: int
    ) -> ListingContextSignal:
        client = self._text or self._default_text_client()
        dom = prop.days_on_market
        price_behaviour = (
            f"{reduction_count} price reduction(s) totalling ${reduction_total:,}"
            if reduction_count
            else "no price reductions on record"
        )
        prompt = (
            "You are a real estate analyst judging how motivated the seller is, from the "
            "listing only.\n\n"
            f"Listing description:\n{(prop.description or '(none provided)').strip()}\n\n"
            f"Price behaviour: {price_behaviour}. "
            f"Days on market: {dom if dom is not None else 'unknown'}.\n\n"
            "Assess sellerUrgency from 0.0 (no urgency) to 1.0 (highly motivated / "
            "distressed). Set distressSale true only if the listing genuinely reads as a "
            "distress/forced sale. List concrete distress signals you actually find "
            "(e.g. 'motivated seller', 'sold as-is', 'estate sale', 'must sell', "
            "'price reduced'). If the listing is neutral, return low urgency and no signals."
        )
        await report_subtask("valuation", "Reading listing context with the text model")
        try:
            raw = await client.generate_json(
                prompt,
                LISTING_CONTEXT_SCHEMA,
                system="You are a precise real estate analyst. Return strict JSON only.",
            )
            return ListingContextSignal(
                seller_urgency=_clamp01(raw.get("sellerUrgency", 0.0)),
                distress_sale=bool(raw.get("distressSale", False)),
                signals=[str(s) for s in (raw.get("signals") or []) if s],
            )
        except Exception as exc:  # noqa: BLE001 - degrade to neutral, never fail the run
            logger.warning("listing-context signal failed: %s", exc)
            return ListingContextSignal()

    def _default_text_client(self) -> TextClient:
        from app.services.inference import get_text_client

        return get_text_client()

    # --- evidence ----------------------------------------------------------

    def _build_evidence(
        self,
        reduction_count: int,
        reduction_total: int,
        prop: CanonicalProperty,
        signal: ListingContextSignal,
        mispricing_pct: float,
    ) -> list[Evidence]:
        evidence: list[Evidence] = []
        if reduction_count:
            span = _history_span_days(prop)
            detail = f"{reduction_count} reduction(s) totalling ${reduction_total:,}"
            if span:
                detail += f" over {span} days"
            evidence.append(
                Evidence(
                    type="price_reduction",
                    detail=detail,
                    weight="high" if reduction_count >= 2 else "medium",
                    count=reduction_count,
                    total=reduction_total,
                )
            )
        if signal.signals:
            evidence.append(
                Evidence(
                    type="context_signal",
                    detail="Listing language: " + ", ".join(signal.signals[:6]),
                    weight="medium",
                    signals=signal.signals[:6],
                )
            )
        if mispricing_pct >= 0.05:
            evidence.append(
                Evidence(
                    type="mispricing",
                    detail=f"Asking is {mispricing_pct:.1%} below estimated fair value",
                    weight="high" if mispricing_pct >= 0.08 else "medium",
                )
            )
        return evidence


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _condition_adjustment(insp: InspectionResult | None) -> float:
    if insp is None:
        return 1.0
    quality_adj = (insp.renovation_score - 70) * 0.0015
    repair_adj = -max(0, insp.repair_risk - 40) * 0.0015
    return max(0.85, min(1.12, 1.0 + quality_adj + repair_adj))


def _price_reductions(prop: CanonicalProperty) -> tuple[int, int]:
    count = 0
    total = 0
    history = prop.price_history
    for prev, cur in zip(history, history[1:]):
        if cur.price < prev.price:
            count += 1
            total += prev.price - cur.price
    return count, total


def _history_span_days(prop: CanonicalProperty) -> int | None:
    from datetime import date

    dates = []
    for entry in prop.price_history:
        try:
            dates.append(date.fromisoformat(entry.date))
        except (ValueError, TypeError):
            return None
    if len(dates) < 2:
        return None
    return (max(dates) - min(dates)).days


def _blend_urgency(llm_urgency: float, reduction_count: int, dom: int | None) -> float:
    floor = 0.0
    if reduction_count >= 2:
        floor = 0.6
    elif reduction_count == 1:
        floor = 0.4
    if dom is not None and dom >= 45:
        floor = max(floor, 0.35)
    return max(0.0, min(1.0, max(llm_urgency, floor)))


def _build_breakdown(
    comps, using_live, median_ppsf, sqft, base_value, condition_adj,
    estimated_value, asking, mispricing, mispricing_pct, insp,
) -> list[BreakdownItem]:
    items: list[BreakdownItem] = []
    if using_live:
        items.append(
            BreakdownItem(
                label="Median price per sqft",
                value=round(median_ppsf, 2),
                formula="median($/sqft across live comps)",
                inputs=[CalcInput(label=f"{len(comps)} comps", value=len(comps), source="market")],
            )
        )
    else:
        items.append(
            BreakdownItem(
                label="Baseline price per sqft",
                value=round(median_ppsf, 2),
                formula="city baseline (no live comps)",
                note="Live comparables unavailable; used a city baseline.",
            )
        )
    items.append(
        BreakdownItem(
            label="Base value",
            value=round(base_value),
            formula=f"{sqft:,} sqft × ${median_ppsf:,.0f}/sqft",
        )
    )
    if abs(condition_adj - 1.0) > 1e-6:
        items.append(
            BreakdownItem(
                label="Condition adjustment",
                value=round(condition_adj, 3),
                formula="from inspection renovationScore & repairRisk",
                inputs=[
                    CalcInput(label="renovationScore", value=insp.renovation_score if insp else None),
                    CalcInput(label="repairRisk", value=insp.repair_risk if insp else None),
                ],
            )
        )
    items.append(
        BreakdownItem(
            label="Estimated fair value vs asking",
            value=f"${estimated_value:,} vs ${asking:,}",
            formula=f"asking is {mispricing_pct:+.1%} vs fair value",
            inputs=[CalcInput(label="mispricing", value=mispricing)],
        )
    )
    return items


def _clamp01(value) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0
