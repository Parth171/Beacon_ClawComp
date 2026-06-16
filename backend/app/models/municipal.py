"""NYC municipal records models (Agent 3 — municipal risk signals).

The ``fetch-municipal`` OpenClaw skill geocodes an address and pulls violations,
permits, and complaints from NYC Open Data. These models are the normalized,
camelCase-aliased contract for that payload; the municipal risk engine scores them
and the inspection agent surfaces them as evidence.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.models.evidence import BreakdownItem, Evidence
from app.models.property import _CamelModel


class Permit(_CamelModel):
    source: str  # "DOB BIS" | "DOB NOW"
    type: str
    status: str
    description: str | None = None
    issue_date: str | None = None  # ISO YYYY-MM-DD (null when the source omits it)
    expiration_date: str | None = None
    job_number: str | None = None


class Violation(_CamelModel):
    source: str  # "DOB" | "ECB/OATH" | "HPD"
    type: str
    severity: str | None = None  # ECB "CLASS - n" / HPD "Class A/B/C"
    status: str
    is_open: bool = False
    date_issued: str | None = None
    description: str | None = None
    penalty_imposed: float | None = None
    balance_due: float | None = None


class Complaint(_CamelModel):
    source: str
    category: str
    status: str
    is_open: bool = False
    date: str | None = None
    disposition_date: str | None = None


class MunicipalQuery(_CamelModel):
    address: str
    resolved: str | None = None
    bbl: str | None = None
    bin: str | None = None
    boro: str | None = None
    block: str | None = None
    lot: str | None = None


class MunicipalRecords(_CamelModel):
    """The full normalized municipal lookup for one address."""

    query: MunicipalQuery
    permits: list[Permit] = Field(default_factory=list)
    violations: list[Violation] = Field(default_factory=list)
    complaints: list[Complaint] = Field(default_factory=list)
    counts: dict[str, int] = Field(default_factory=dict)


class MunicipalSignal(_CamelModel):
    """One scored municipal risk signal (High/Medium/Low) with provenance."""

    level: Literal["high", "medium", "low"]
    label: str
    detail: str | None = None
    count: int = 1
    points: int = 0


class MunicipalRiskResult(_CamelModel):
    """Output of the municipal risk engine for one address."""

    municipal_risk_score: int = Field(ge=0, le=100)
    risk_level: Literal["Low", "Medium", "High"]
    summary: str
    signals: list[MunicipalSignal] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    breakdown: list[BreakdownItem] = Field(default_factory=list)
