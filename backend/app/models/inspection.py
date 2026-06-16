"""Agent 3 (Inspection) output models.

Per-image assessments come back from the VLM against ``PER_IMAGE_SCHEMA``; the agent
aggregates them into a property-level ``InspectionResult`` with evidence artifacts the
downstream chain (Valuation -> Trajectory -> Thesis) consumes.
"""

from __future__ import annotations

from pydantic import Field

from app.models.evidence import BreakdownItem, Evidence
from app.models.property import _CamelModel


class VisualFlag(_CamelModel):
    """One condition concern the VLM saw in a specific photo."""

    image_index: int
    issue: str
    location: str | None = None
    reason: str | None = None
    confidence: float = Field(ge=0, le=1)


class PerImageAssessment(_CamelModel):
    """The VLM's per-photo risk read. Risks are 0..1; renovation score 0..100."""

    image_index: int = 0
    image_url: str | None = None
    roof_risk: float = Field(default=0.0, ge=0, le=1)
    water_risk: float = Field(default=0.0, ge=0, le=1)
    foundation_risk: float = Field(default=0.0, ge=0, le=1)
    electrical_risk: float = Field(default=0.0, ge=0, le=1)
    renovation_score: int = Field(default=0, ge=0, le=100)
    flags: list[VisualFlag] = Field(default_factory=list)


class InspectionResult(_CamelModel):
    """Property-level inspection output (Agent 3)."""

    repair_risk: int = Field(ge=0, le=100)
    renovation_score: int = Field(ge=0, le=100)
    estimated_repair_cost: int = Field(ge=0)
    image_count: int = 0
    model: str = "unknown"
    per_image: list[PerImageAssessment] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    breakdown: list[BreakdownItem] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


# JSON schema handed to the VLM for EACH image. Deliberately hand-written (no $defs)
# so the model reads it cleanly. imageIndex is attached by the agent, not the model.
PER_IMAGE_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "roofRisk": {"type": "number", "minimum": 0, "maximum": 1},
        "waterRisk": {"type": "number", "minimum": 0, "maximum": 1},
        "foundationRisk": {"type": "number", "minimum": 0, "maximum": 1},
        "electricalRisk": {"type": "number", "minimum": 0, "maximum": 1},
        "renovationScore": {"type": "integer", "minimum": 0, "maximum": 100},
        "flags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "issue": {"type": "string"},
                    "location": {"type": "string"},
                    "reason": {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["issue", "confidence"],
            },
        },
    },
    "required": [
        "roofRisk",
        "waterRisk",
        "foundationRisk",
        "electricalRisk",
        "renovationScore",
        "flags",
    ],
}
