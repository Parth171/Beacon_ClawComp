from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

# Where a number came from. Drives the color-coded badges in the UI so a buyer
# can instantly tell a hard listing fact from a HomePilot assumption.
InputSource = Literal["listing", "assumption", "market", "model", "computed"]


class CalcInput(BaseModel):
    """A single labeled input that feeds a breakdown line item."""

    label: str
    value: str
    source: InputSource = "computed"
    note: str | None = None
    evidence_urls: list[str] = Field(default_factory=list)


class BreakdownItem(BaseModel):
    """One transparent, defensible line of an agent's reasoning.

    Captures not just the final number but the formula and the source-tagged
    inputs behind it, so the buyer can see exactly where it came from.
    """

    label: str
    value: str
    formula: str | None = None
    inputs: list[CalcInput] = Field(default_factory=list)
    note: str | None = None


class AgentOutputBase(BaseModel):
    """Base shape shared by all agent outputs."""

    explanation: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    breakdown: list[BreakdownItem] = Field(default_factory=list)


class PropertyIntelligenceResult(AgentOutputBase):
    property_quality_score: float = Field(ge=0, le=100)
    repair_risk_score: float = Field(ge=0, le=100)
    roof_condition: str | None = None
    water_damage_risk: str | None = None
    estimated_major_repairs: list[str] = Field(default_factory=list)


class HiddenCostResult(AgentOutputBase):
    annual_property_tax: int = Field(ge=0)
    annual_utilities: int = Field(ge=0)
    annual_insurance: int = Field(ge=0)
    annual_maintenance: int = Field(ge=0)
    true_annual_cost: int = Field(ge=0)


class FamilyFitResult(AgentOutputBase):
    family_fit_score: float = Field(ge=0, le=100)
    school_score: float | None = Field(default=None, ge=0, le=100)
    commute_score: float | None = Field(default=None, ge=0, le=100)
    safety_score: float | None = Field(default=None, ge=0, le=100)
    park_score: float | None = Field(default=None, ge=0, le=100)


class PropertyValueResult(AgentOutputBase):
    """Is the home actually worth the asking price?"""

    asking_price: int = Field(ge=0)
    estimated_value: int = Field(ge=0)
    value_gap: int
    value_gap_pct: float
    deal_score: float = Field(ge=0, le=100)
    recommendation: str = "FAIRLY_VALUED"  # UNDERVALUED | FAIRLY_VALUED | OVERVALUED
    comparable_count: int = Field(default=0, ge=0)
    median_ppsf: float | None = None
    positive_factors: list[str] = Field(default_factory=list)
    negative_factors: list[str] = Field(default_factory=list)


class FutureOutlookResult(AgentOutputBase):
    """Will the area become more valuable over time?"""

    future_score: float = Field(ge=0, le=100)
    reasons: list[str] = Field(default_factory=list)
    signals: dict[str, Any] = Field(default_factory=dict)
