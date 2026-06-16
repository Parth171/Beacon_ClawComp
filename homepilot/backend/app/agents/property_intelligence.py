from __future__ import annotations

import re

from pydantic import BaseModel

from app.agents.base import Agent
from app.core.config import get_settings
from app.models import BreakdownItem, CalcInput, PropertyIntelligenceResult, PropertyListing
from app.services.image_prep import PreparedImage, prepare_listing_images
from app.services.progress import report_subtask
from app.services.vision import analyze_property_images, vision_available


CURRENT_YEAR = 2026

POSITIVE_DESCRIPTION_SIGNALS = {
    "renovated",
    "updated",
    "new roof",
    "newer roof",
    "new windows",
    "newer windows",
    "well maintained",
    "turnkey",
    "move-in ready",
    "energy efficient",
}

NEGATIVE_DESCRIPTION_SIGNALS = {
    "as-is",
    "as is",
    "needs tlc",
    "fixer",
    "original condition",
    "dated",
    "water damage",
    "mold",
    "foundation",
    "leak",
    "old roof",
}

MAJOR_REPAIR_SIGNALS = {
    "roof": {"old roof", "roof repair", "roof replacement", "leaking roof"},
    "foundation": {"foundation", "structural", "settlement"},
    "water damage": {"water damage", "mold", "flood", "leak"},
    "windows": {"old windows", "window replacement"},
}


class PropertyIntelligenceInput(BaseModel):
    property: PropertyListing


class PropertyIntelligenceAgent(
    Agent[PropertyIntelligenceInput, PropertyIntelligenceResult]
):
    """Analyzes listing condition and repair risk.

    Primary path is computer vision: OpenCV preprocesses the listing photos and
    a local Qwen2.5-VL model assesses condition. Falls back to a deterministic
    description/age heuristic when vision is disabled or unavailable.
    """

    name = "property_intelligence"

    def __init__(self, use_vision: bool | None = None) -> None:
        self.use_vision = (
            use_vision if use_vision is not None else get_settings().vision_enabled
        )

    async def run(
        self,
        payload: PropertyIntelligenceInput,
    ) -> PropertyIntelligenceResult:
        property_listing = payload.property

        if self.use_vision and property_listing.photo_urls:
            vision_result = await self._vision_result(property_listing)
            if vision_result is not None:
                return vision_result

        await report_subtask(
            "heuristic",
            "Vision unavailable - analyzing description and listing facts",
            status="done",
        )
        return self._heuristic_result(property_listing)

    async def _vision_result(
        self,
        property_listing: PropertyListing,
    ) -> PropertyIntelligenceResult | None:
        if not await vision_available():
            return None

        settings = get_settings()
        images = await prepare_listing_images(
            [str(url) for url in property_listing.photo_urls],
            max_images=settings.vision_max_images,
            max_side=settings.vision_image_max_side,
        )
        if not images:
            return None

        findings = await analyze_property_images(images, property_listing.description)
        if not findings:
            return None

        observations = findings.get("observations") or []
        repairs = findings.get("estimated_major_repairs") or []
        image_count = findings.get("_image_count", len(images))
        return PropertyIntelligenceResult(
            property_quality_score=self._clamp(findings.get("property_quality_score", 60)),
            repair_risk_score=self._clamp(findings.get("repair_risk_score", 40)),
            roof_condition=findings.get("roof_condition", "unknown"),
            water_damage_risk=findings.get("water_damage_risk", "low"),
            estimated_major_repairs=list(repairs),
            explanation=self._vision_explanation(
                image_count=image_count,
                renovation_quality=findings.get("renovation_quality", "unknown"),
                observations=observations,
            ),
            confidence=self._vision_confidence(findings),
            breakdown=self._vision_breakdown(findings, observations, repairs, images),
        )

    def _vision_breakdown(
        self,
        findings: dict,
        observations: list[str],
        repairs: list[str],
        images: list[PreparedImage],
    ) -> list[BreakdownItem]:
        image_count = len(images)
        evidence_inputs = self._vision_evidence_inputs(findings, images)
        items: list[BreakdownItem] = [
            BreakdownItem(
                label="Photos inspected",
                value=f"{image_count} photos",
                formula="OpenCV selected the sharpest, most informative photos",
                inputs=[
                    CalcInput(
                        label="Vision model",
                        value="Qwen2.5-VL (local)",
                        source="model",
                        note="An open-source vision model analyzed the actual images.",
                    )
                ],
            ),
            BreakdownItem(
                label="Property quality",
                value=f"{self._clamp(findings.get('property_quality_score', 60)):.0f}/100",
                formula="Visual assessment of finishes, condition, and upkeep",
                inputs=[
                    CalcInput(
                        label="Renovation quality",
                        value=str(findings.get("renovation_quality", "unknown")),
                        source="model",
                    )
                ],
            ),
            BreakdownItem(
                label="Repair risk",
                value=f"{self._clamp(findings.get('repair_risk_score', 40)):.0f}/100",
                formula="Visible wear, damage, and aging signals",
                inputs=[
                    CalcInput(
                        label="Roof condition",
                        value=str(findings.get("roof_condition", "unknown")),
                        source="model",
                    ),
                    CalcInput(
                        label="Water damage risk",
                        value=str(findings.get("water_damage_risk", "low")),
                        source="model",
                    ),
                ],
            ),
        ]

        if observations or evidence_inputs:
            items.append(
                BreakdownItem(
                    label="What the model saw",
                    value=f"{len(evidence_inputs) or len(observations)} observations",
                    inputs=evidence_inputs
                    or [
                        CalcInput(label=f"Observation {i + 1}", value=obs, source="model")
                        for i, obs in enumerate(observations[:6])
                    ],
                    note="Concrete visual evidence behind the scores above.",
                )
            )

        if repairs:
            items.append(
                BreakdownItem(
                    label="Flagged potential repairs",
                    value=", ".join(repairs[:4]),
                    inputs=[
                        CalcInput(
                            label=r,
                            value="flagged",
                            source="model",
                            evidence_urls=self._matching_evidence_urls(r, evidence_inputs),
                        )
                        for r in repairs[:6]
                    ],
                    note="Items a buyer should budget for or inspect closely.",
                )
            )

        return items

    def _vision_evidence_inputs(
        self, findings: dict, images: list[PreparedImage]
    ) -> list[CalcInput]:
        evidence = findings.get("evidence") or []
        if not isinstance(evidence, list):
            return []

        inputs: list[CalcInput] = []
        for index, item in enumerate(evidence[:6]):
            if not isinstance(item, dict):
                continue

            finding = str(item.get("finding") or "").strip()
            if not finding:
                continue

            evidence_urls = self._evidence_urls(item.get("photo_indexes"), images)
            inputs.append(
                CalcInput(
                    label=f"Visible concern {index + 1}",
                    value=finding,
                    source="model",
                    evidence_urls=evidence_urls,
                )
            )

        return inputs

    def _evidence_urls(
        self, photo_indexes: object, images: list[PreparedImage]
    ) -> list[str]:
        if not isinstance(photo_indexes, list):
            return []

        urls: list[str] = []
        for raw_index in photo_indexes:
            try:
                photo_index = int(raw_index)
            except (TypeError, ValueError):
                continue

            image_position = photo_index - 1
            if 0 <= image_position < len(images):
                urls.append(str(images[image_position].url))

        return urls

    def _matching_evidence_urls(self, repair: str, evidence_inputs: list[CalcInput]) -> list[str]:
        repair_words = set(re.findall(r"\w+", repair.lower()))
        urls: list[str] = []
        for evidence in evidence_inputs:
            finding_words = set(re.findall(r"\w+", evidence.value.lower()))
            if repair_words & finding_words:
                urls.extend(evidence.evidence_urls)

        return list(dict.fromkeys(urls))

    def _vision_explanation(
        self,
        image_count: int,
        renovation_quality: str,
        observations: list[str],
    ) -> str:
        evidence = "; ".join(observations[:4]) if observations else "no specific concerns noted"
        return (
            f"Computer vision (Qwen2.5-VL) inspected {image_count} listing photos. "
            f"Renovation quality assessed as {renovation_quality}. Key observations: {evidence}."
        )

    def _vision_confidence(self, findings: dict) -> float:
        confidence = findings.get("confidence")
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            confidence = 0.6
        return round(min(0.95, max(0.1, confidence)), 2)

    def _heuristic_result(
        self,
        property_listing: PropertyListing,
    ) -> PropertyIntelligenceResult:
        description = (property_listing.description or "").lower()
        property_age = self._property_age(property_listing)
        positive_signals = self._matched_signals(description, POSITIVE_DESCRIPTION_SIGNALS)
        negative_signals = self._matched_signals(description, NEGATIVE_DESCRIPTION_SIGNALS)
        estimated_repairs = self._estimated_repairs(description, property_age)

        quality_score = self._quality_score(
            property_age=property_age,
            photo_count=len(property_listing.photo_urls),
            positive_signal_count=len(positive_signals),
            negative_signal_count=len(negative_signals),
        )
        repair_risk_score = self._repair_risk_score(
            property_age=property_age,
            negative_signal_count=len(negative_signals),
            estimated_repair_count=len(estimated_repairs),
        )

        return PropertyIntelligenceResult(
            property_quality_score=quality_score,
            repair_risk_score=repair_risk_score,
            roof_condition=self._roof_condition(description, property_age),
            water_damage_risk=self._water_damage_risk(description),
            estimated_major_repairs=estimated_repairs,
            explanation=self._explanation(
                property_age=property_age,
                positive_signals=positive_signals,
                negative_signals=negative_signals,
                photo_count=len(property_listing.photo_urls),
            ),
            confidence=self._confidence(property_listing),
            breakdown=self._heuristic_breakdown(
                property_listing=property_listing,
                property_age=property_age,
                positive_signals=positive_signals,
                negative_signals=negative_signals,
                estimated_repairs=estimated_repairs,
                quality_score=quality_score,
                repair_risk_score=repair_risk_score,
            ),
        )

    def _heuristic_breakdown(
        self,
        property_listing: PropertyListing,
        property_age: int | None,
        positive_signals: list[str],
        negative_signals: list[str],
        estimated_repairs: list[str],
        quality_score: float,
        repair_risk_score: float,
    ) -> list[BreakdownItem]:
        age_value = "unknown" if property_age is None else f"{property_age} yrs"
        age_source = "computed" if property_age is not None else "assumption"
        items: list[BreakdownItem] = [
            BreakdownItem(
                label="Analysis method",
                value="Description + metadata heuristics",
                note="No photo analysis available — based on listing text and facts only.",
                inputs=[
                    CalcInput(
                        label="Property age",
                        value=age_value,
                        source=age_source,
                        note=None
                        if property_age is not None
                        else "Listing had no year built.",
                    ),
                    CalcInput(
                        label="Photos on listing",
                        value=str(len(property_listing.photo_urls)),
                        source="listing",
                    ),
                ],
            ),
            BreakdownItem(
                label="Property quality",
                value=f"{quality_score:.0f}/100",
                formula="Base 72, adjusted by age, photos, and description signals",
                inputs=(
                    [CalcInput(label="Positive signal", value=s, source="listing") for s in positive_signals]
                    or [CalcInput(label="Positive signals", value="none found", source="computed")]
                ),
            ),
            BreakdownItem(
                label="Repair risk",
                value=f"{repair_risk_score:.0f}/100",
                formula="Base 32, raised by age and concern signals",
                inputs=(
                    [CalcInput(label="Concern signal", value=s, source="listing") for s in negative_signals]
                    or [CalcInput(label="Concern signals", value="none found", source="computed")]
                ),
            ),
        ]

        if estimated_repairs:
            items.append(
                BreakdownItem(
                    label="Flagged potential repairs",
                    value=", ".join(estimated_repairs[:4]),
                    inputs=[
                        CalcInput(label=r, value="flagged", source="computed")
                        for r in estimated_repairs[:6]
                    ],
                )
            )

        return items

    def _property_age(self, property_listing: PropertyListing) -> int | None:
        if property_listing.year_built is None:
            return None
        return max(0, CURRENT_YEAR - property_listing.year_built)

    def _quality_score(
        self,
        property_age: int | None,
        photo_count: int,
        positive_signal_count: int,
        negative_signal_count: int,
    ) -> float:
        score = 72

        if property_age is None:
            score -= 4
        elif property_age <= 10:
            score += 12
        elif property_age <= 25:
            score += 6
        elif property_age > 60:
            score -= 12
        elif property_age > 40:
            score -= 6

        if photo_count == 0:
            score -= 5
        elif photo_count >= 8:
            score += 5
        elif photo_count >= 3:
            score += 2

        score += positive_signal_count * 3
        score -= negative_signal_count * 6
        return self._clamp(score)

    def _repair_risk_score(
        self,
        property_age: int | None,
        negative_signal_count: int,
        estimated_repair_count: int,
    ) -> float:
        score = 32

        if property_age is None:
            score += 6
        elif property_age > 60:
            score += 24
        elif property_age > 40:
            score += 16
        elif property_age > 25:
            score += 8
        elif property_age <= 10:
            score -= 8

        score += negative_signal_count * 7
        score += estimated_repair_count * 6
        return self._clamp(score)

    def _roof_condition(self, description: str, property_age: int | None) -> str:
        if "new roof" in description or "newer roof" in description:
            return "good"
        if "old roof" in description or "leaking roof" in description:
            return "poor"
        if property_age is None:
            return "unknown"
        if property_age <= 15:
            return "good"
        if property_age <= 30:
            return "fair"
        return "unknown"

    def _water_damage_risk(self, description: str) -> str:
        high_risk_terms = {"water damage", "mold", "flood"}
        medium_risk_terms = {"leak", "damp", "moisture"}

        if any(term in description for term in high_risk_terms):
            return "high"
        if any(term in description for term in medium_risk_terms):
            return "medium"
        return "low"

    def _estimated_repairs(self, description: str, property_age: int | None) -> list[str]:
        repairs = []

        for repair_name, signals in MAJOR_REPAIR_SIGNALS.items():
            if any(self._contains_signal(description, signal) for signal in signals):
                repairs.append(repair_name)

        if property_age is not None and property_age > 25 and "roof" not in repairs:
            repairs.append("roof inspection")
        if property_age is not None and property_age > 35 and "windows" not in repairs:
            repairs.append("window assessment")

        return repairs

    def _confidence(self, property_listing: PropertyListing) -> float:
        confidence = 0.45

        if property_listing.description:
            confidence += 0.2
        if property_listing.year_built:
            confidence += 0.15
        if property_listing.photo_urls:
            confidence += min(0.2, len(property_listing.photo_urls) * 0.025)

        return round(min(0.9, confidence), 2)

    def _explanation(
        self,
        property_age: int | None,
        positive_signals: list[str],
        negative_signals: list[str],
        photo_count: int,
    ) -> str:
        age_text = "unknown age" if property_age is None else f"approximately {property_age} years old"
        positive_text = ", ".join(positive_signals) if positive_signals else "no strong upgrade signals"
        negative_text = ", ".join(negative_signals) if negative_signals else "no major concern signals"

        return (
            f"Property intelligence used listing metadata, {photo_count} photo URLs, and description "
            f"signals. The home is {age_text}, with {positive_text} and {negative_text}."
        )

    def _matched_signals(self, description: str, signals: set[str]) -> list[str]:
        return sorted(signal for signal in signals if self._contains_signal(description, signal))

    def _contains_signal(self, description: str, signal: str) -> bool:
        return re.search(rf"(?<!\w){re.escape(signal)}(?!\w)", description) is not None

    def _clamp(self, score: float) -> float:
        return round(min(100, max(0, score)), 2)
