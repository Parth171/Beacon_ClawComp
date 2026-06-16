"""Agent 3 — Inspection Intelligence Engine.

Runs FIRST in the analysis chain, on the listing photos alone (pure visual evidence,
no upstream agent input — see BUILD_PLAN.md). Each prepared photo is assessed by the
VLM against a fixed per-image schema; the agent aggregates those reads into a
property-level repair risk, renovation score, and a heuristic repair-cost estimate,
plus visual-flag evidence artifacts for the rest of the chain.

The base Qwen2.5-VL model is used with structured prompting (no LoRA). A specialized
defect/inspection dataset can be added later as a LoRA adapter without changing this
agent's contract.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from pydantic import BaseModel

from app.agents.base import Agent
from app.models.evidence import BreakdownItem, CalcInput, Evidence
from app.models.inspection import (
    PER_IMAGE_SCHEMA,
    InspectionResult,
    PerImageAssessment,
    VisualFlag,
)
from app.models.property import CanonicalProperty
from app.services.inference.base import VisionClient
from app.services.progress import report_subtask

logger = logging.getLogger(__name__)

# Below this confidence a flag is noise and is not surfaced as evidence. (Inspection
# runs before Valuation, so there is no seller-urgency signal to modulate this; that
# calibration now lives in cross-agent synthesis.)
FLAG_EVIDENCE_THRESHOLD = 0.40

# Severity weights per risk dimension — how much a unit of risk matters to overall
# repair exposure (foundation/water are costlier and more structural than roof/elec).
DIMENSION_WEIGHTS = {
    "foundation": 1.00,
    "water": 0.85,
    "roof": 0.70,
    "electrical": 0.60,
}

# Mid-point repair-cost bands (CAD) by issue category. Heuristic and intentionally
# transparent — surfaced in the result breakdown, not presented as an appraisal.
COST_BANDS = {
    "foundation": 25000,
    "water": 6000,
    "mold": 5000,
    "roof": 9000,
    "electrical": 4500,
    "plumbing": 5000,
    "hvac": 6000,
    "kitchen": 15000,
    "bathroom": 8000,
    "flooring": 5000,
    "windows": 7000,
    "general": 2500,
}

# Keyword -> category, checked against the flag's issue + reason text.
_CATEGORY_KEYWORDS = {
    "foundation": ("foundation", "structural", "settling", "crack in wall", "cracks in wall"),
    "water": ("water", "leak", "moisture", "stain", "damp", "flood"),
    "mold": ("mold", "mould", "mildew"),
    "roof": ("roof", "shingle", "soffit", "gutter", "eaves"),
    "electrical": ("electrical", "wiring", "panel", "knob and tube", "outlet"),
    "plumbing": ("plumb", "pipe", "drain", "sewer"),
    "hvac": ("hvac", "furnace", "heating", "ac ", "air condition", "boiler"),
    "kitchen": ("kitchen",),
    "bathroom": ("bathroom", "washroom", "shower", "tub", "toilet"),
    "flooring": ("floor", "subfloor", "hardwood", "tile"),
    "windows": ("window",),
}

PROMPT = (
    "You are an experienced home inspector reviewing ONE photo from a real-estate "
    "listing. Assess only what is visible in this image.\n\n"
    "Score each risk from 0.0 (no concern) to 1.0 (severe, visible problem):\n"
    "- roofRisk: roof/exterior wear — curling or missing shingles, sagging, damaged soffits.\n"
    "- waterRisk: water damage — ceiling/wall staining, mold, damp, leak evidence.\n"
    "- foundationRisk: structural — wall/floor cracks, settling, uneven floors.\n"
    "- electricalRisk: visible wiring/panel hazards, knob-and-tube, overloaded outlets.\n"
    "- renovationScore: 0 (dated/poor) to 100 (high-quality, move-in ready finishes).\n\n"
    "For every concern you can actually SEE, add a flag with: issue (short), location "
    "(where in the photo), reason (the visible evidence), confidence (0.0-1.0). Do not "
    "invent issues that are not visible — if the photo is a clean, well-kept space, "
    "return empty flags and low risks. Many listing photos show good condition; say so."
)

# A function that turns image URLs into base64 JPEGs (image_prep). Injectable for tests.
ImagePreparer = Callable[[list[str]], Awaitable[list[Any]]]


class InspectionInput(BaseModel):
    property: CanonicalProperty


class InspectionAgent(Agent[InspectionInput, InspectionResult]):
    name = "inspection"

    def __init__(
        self,
        vision_client: VisionClient | None = None,
        image_preparer: ImagePreparer | None = None,
        flag_threshold: float = FLAG_EVIDENCE_THRESHOLD,
    ) -> None:
        self._vision = vision_client
        self._prepare = image_preparer
        self._flag_threshold = flag_threshold

    async def run(self, payload: InspectionInput) -> InspectionResult:
        prop = payload.property
        prepared = await self._prepare_images(prop.images)
        if not prepared:
            return self._empty_result("No usable listing photos to analyze.")

        client = self._vision or self._default_vision_client()
        await report_subtask(
            "inspection", f"Assessing {len(prepared)} photos with the vision model"
        )

        assessments: list[PerImageAssessment] = []
        for index, image in enumerate(prepared):
            b64 = getattr(image, "jpeg_base64", image)
            url = getattr(image, "url", None)
            try:
                raw = await client.analyze([b64], PROMPT, PER_IMAGE_SCHEMA)
            except Exception as exc:  # noqa: BLE001 - one bad image must not kill the run
                logger.warning("Vision call failed on image %s: %s", index, exc)
                continue
            assessments.append(_assessment_from_vlm(raw, index, url))

        if not assessments:
            return self._empty_result("Vision model returned no usable assessments.")

        return self._aggregate(assessments, model=getattr(client, "name", "unknown"))

    # --- image acquisition --------------------------------------------------

    async def _prepare_images(self, image_urls: list[str]) -> list[Any]:
        if self._prepare is not None:
            return await self._prepare(image_urls)
        # Lazy import so cv2/httpx are only required when actually preparing images.
        from app.core.config import get_settings
        from app.services.image_prep import prepare_listing_images

        settings = get_settings()
        return await prepare_listing_images(
            image_urls,
            max_images=settings.vision_max_images,
            max_side=settings.vision_image_max_side,
        )

    def _default_vision_client(self) -> VisionClient:
        from app.services.inference import get_vision_client

        return get_vision_client()

    # --- aggregation --------------------------------------------------------

    def _aggregate(self, assessments: list[PerImageAssessment], *, model: str) -> InspectionResult:
        # Property-level risk per dimension = worst credible reading across photos.
        dim_max = {
            "roof": max(a.roof_risk for a in assessments),
            "water": max(a.water_risk for a in assessments),
            "foundation": max(a.foundation_risk for a in assessments),
            "electrical": max(a.electrical_risk for a in assessments),
        }
        # Severity-adjusted contributions; repair risk is driven by the single worst
        # dimension, elevated by corroborating secondary risks.
        contributions = {d: dim_max[d] * DIMENSION_WEIGHTS[d] for d in dim_max}
        top = max(contributions.values()) if contributions else 0.0
        others = sorted(contributions.values(), reverse=True)[1:]
        repair_risk = round(100 * min(1.0, top + 0.4 * sum(others)))

        renovation_score = round(
            sum(a.renovation_score for a in assessments) / len(assessments)
        )

        flags = [f for a in assessments for f in a.flags]
        estimated_cost, cost_breakdown = self._estimate_cost(flags, dim_max)
        evidence = self._build_evidence(flags)

        breakdown = [
            BreakdownItem(
                label="Repair risk",
                value=repair_risk,
                formula="100 * min(1, max(weighted_dim) + 0.4*sum(other weighted_dims))",
                inputs=[
                    CalcInput(label=f"{d} risk (max across photos)", value=round(dim_max[d], 2))
                    for d in dim_max
                ],
            ),
            BreakdownItem(
                label="Renovation score",
                value=renovation_score,
                formula="mean(per-image renovationScore)",
                note=f"averaged over {len(assessments)} photos",
            ),
            *cost_breakdown,
        ]

        return InspectionResult(
            repair_risk=repair_risk,
            renovation_score=renovation_score,
            estimated_repair_cost=estimated_cost,
            image_count=len(assessments),
            model=model,
            per_image=assessments,
            evidence=evidence,
            breakdown=breakdown,
        )

    def _estimate_cost(
        self, flags: list[VisualFlag], dim_max: dict[str, float]
    ) -> tuple[int, list[BreakdownItem]]:
        # Highest-confidence flag per category drives that category's cost.
        per_category: dict[str, float] = {}
        for flag in flags:
            category = _categorize(f"{flag.issue} {flag.reason or ''}")
            if category is None:
                category = "general"
            per_category[category] = max(per_category.get(category, 0.0), flag.confidence)

        # Structural dimensions with high risk but no explicit flag still cost money.
        for dim in ("foundation", "water", "roof", "electrical"):
            if dim_max[dim] >= 0.6 and dim_max[dim] > per_category.get(dim, 0.0):
                per_category[dim] = dim_max[dim]

        total = 0
        items: list[BreakdownItem] = []
        for category, confidence in sorted(per_category.items()):
            if confidence < 0.5:
                continue
            band = COST_BANDS.get(category, COST_BANDS["general"])
            scale = 0.5 + 0.5 * confidence  # 0.5 conf -> 0.75x, 1.0 conf -> 1.0x
            cost = int(round(band * scale / 500.0)) * 500
            total += cost
            items.append(
                BreakdownItem(
                    label=f"Repair allowance: {category}",
                    value=cost,
                    formula="band * (0.5 + 0.5*confidence), rounded to $500",
                    inputs=[
                        CalcInput(label="band", value=band),
                        CalcInput(label="confidence", value=round(confidence, 2)),
                    ],
                )
            )
        return total, items

    def _build_evidence(self, flags: list[VisualFlag]) -> list[Evidence]:
        surfaced = [f for f in flags if f.confidence >= self._flag_threshold]
        surfaced.sort(key=lambda f: f.confidence, reverse=True)
        evidence: list[Evidence] = []
        for flag in surfaced[:12]:
            evidence.append(
                Evidence(
                    type="visual_flag",
                    detail=flag.reason or flag.issue,
                    weight=_weight_for(flag.confidence),
                    issue=flag.issue,
                    location=flag.location,
                    imageIndex=flag.image_index,
                    confidence=round(flag.confidence, 2),
                )
            )
        return evidence

    def _empty_result(self, note: str) -> InspectionResult:
        return InspectionResult(
            repair_risk=0,
            renovation_score=50,  # unknown -> neutral
            estimated_repair_cost=0,
            image_count=0,
            model=getattr(self._vision, "name", "none"),
            notes=[note],
        )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _assessment_from_vlm(raw: dict, index: int, url: str | None) -> PerImageAssessment:
    """Leniently parse one VLM response into a PerImageAssessment."""

    flags = []
    for item in raw.get("flags") or []:
        if not isinstance(item, dict) or not item.get("issue"):
            continue
        try:
            flags.append(
                VisualFlag(
                    image_index=index,
                    issue=str(item["issue"]),
                    location=item.get("location"),
                    reason=item.get("reason"),
                    confidence=_clamp01(item.get("confidence", 0.0)),
                )
            )
        except Exception:  # noqa: BLE001
            continue
    return PerImageAssessment(
        image_index=index,
        image_url=url,
        roof_risk=_clamp01(raw.get("roofRisk", 0.0)),
        water_risk=_clamp01(raw.get("waterRisk", 0.0)),
        foundation_risk=_clamp01(raw.get("foundationRisk", 0.0)),
        electrical_risk=_clamp01(raw.get("electricalRisk", 0.0)),
        renovation_score=_clamp_int(raw.get("renovationScore", 0), 0, 100),
        flags=flags,
    )


def _categorize(text: str) -> str | None:
    lowered = text.lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in lowered for kw in keywords):
            return category
    return None


def _weight_for(confidence: float) -> str:
    if confidence >= 0.75:
        return "high"
    if confidence >= 0.55:
        return "medium"
    return "low"


def _clamp01(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _clamp_int(value: Any, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(round(float(value)))))
    except (TypeError, ValueError):
        return lo
