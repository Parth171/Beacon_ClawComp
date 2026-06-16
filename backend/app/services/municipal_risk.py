"""Municipal risk engine (Agent 3 — Enhancement 3).

Turns normalized ``MunicipalRecords`` (NYC Open Data violations/permits/complaints)
into a transparent ``municipal_risk_score`` (0-100) plus the High/Medium/Low signals
that drove it, following the plan's scoring table:

    High    open DOB/ECB/HPD violations, stop-work orders, unsafe-structure notices,
            repeated open complaints
    Medium  multiple unresolved / expired permits
    Low     recent approved renovation permits, resolved violations (mitigants)

Scoring is additive and capped — every point is explained in the breakdown so the
result reads as evidence, not an opaque number.
"""

from __future__ import annotations

from datetime import date

from app.models.evidence import BreakdownItem, CalcInput, Evidence
from app.models.municipal import (
    MunicipalRecords,
    MunicipalRiskResult,
    MunicipalSignal,
    Permit,
    Violation,
)

# Words that mark a violation/complaint as a high-severity structural/safety issue.
HIGH_RISK_KEYWORDS = (
    "stop work",
    "unsafe",
    "vacate",
    "structural",
    "imminent",
    "hazardous",
    "egress",
    "illegal conversion",
    "collapse",
    "without a permit",
    "work without permit",
)

# Per-open-violation points by source/severity.
OPEN_VIOLATION_POINTS = {"hpd_c": 12, "ecb_dob": 8, "hpd_ab": 5, "default": 6}
OPEN_VIOLATION_CAP = 45
HIGH_KEYWORD_POINTS = 15
HIGH_KEYWORD_CAP = 30
OPEN_COMPLAINT_POINTS = 5
OPEN_COMPLAINT_CAP = 15
REPEATED_COMPLAINTS_THRESHOLD = 8
REPEATED_COMPLAINTS_POINTS = 8
EXPIRED_PERMIT_POINTS = 5
EXPIRED_PERMIT_CAP = 15
EXPIRED_PERMIT_MEDIUM_THRESHOLD = 2

# Mitigants (reduce score).
RESOLVED_VIOLATIONS_CREDIT = 6
RECENT_PERMIT_CREDIT = 8
RECENT_PERMIT_YEARS = 3

_CLOSED_PERMIT_STATUS = ("SIGNED-OFF", "SIGNED OFF", "COMPLETE", "WITHDRAWN", "REVOKED", "DENIED")


def _parse_iso(value: str | None) -> date | None:
    if not value:
        return None
    try:
        y, m, d = (int(p) for p in value[:10].split("-"))
        return date(y, m, d)
    except (ValueError, TypeError):
        return None


def _years_ago(d: date | None, today: date) -> float | None:
    if d is None:
        return None
    return (today - d).days / 365.25


def _text(*parts: str | None) -> str:
    return " ".join(p for p in parts if p).lower()


def _open_violation_points(v: Violation) -> int:
    sev = (v.severity or "").upper()
    if v.source == "HPD":
        return OPEN_VIOLATION_POINTS["hpd_c"] if "C" in sev else OPEN_VIOLATION_POINTS["hpd_ab"]
    if v.source in ("ECB/OATH", "DOB"):
        return OPEN_VIOLATION_POINTS["ecb_dob"]
    return OPEN_VIOLATION_POINTS["default"]


def _is_expired_permit(p: Permit, today: date) -> bool:
    status = (p.status or "").upper()
    if "EXPIRED" in status:
        return True
    if any(s in status for s in _CLOSED_PERMIT_STATUS):
        return False
    exp = _parse_iso(p.expiration_date)
    return exp is not None and exp < today


def _is_recent_approved_permit(p: Permit, today: date) -> bool:
    status = (p.status or "").upper()
    if not any(s in status for s in ("ISSUED", "SIGNED-OFF", "SIGNED OFF", "IN PROCESS", "COMPLETE")):
        return False
    age = _years_ago(_parse_iso(p.issue_date), today)
    return age is not None and 0 <= age <= RECENT_PERMIT_YEARS


def score_municipal(records: MunicipalRecords, *, today: date | None = None) -> MunicipalRiskResult:
    """Score one address's municipal records into a risk result."""

    today = today or date.today()
    signals: list[MunicipalSignal] = []
    breakdown: list[BreakdownItem] = []
    evidence: list[Evidence] = []
    score = 0

    open_violations = [v for v in records.violations if v.is_open]
    resolved_count = len(records.violations) - len(open_violations)

    # --- High: open violations -------------------------------------------------
    if open_violations:
        pts = min(OPEN_VIOLATION_CAP, sum(_open_violation_points(v) for v in open_violations))
        score += pts
        by_source: dict[str, int] = {}
        for v in open_violations:
            by_source[v.source] = by_source.get(v.source, 0) + 1
        detail = ", ".join(f"{n} {src}" for src, n in sorted(by_source.items()))
        signals.append(
            MunicipalSignal(
                level="high",
                label="Open violations",
                detail=detail,
                count=len(open_violations),
                points=pts,
            )
        )
        breakdown.append(
            BreakdownItem(
                label="Open violations",
                value=pts,
                formula="sum(per-violation points), capped",
                inputs=[CalcInput(label=src, value=n) for src, n in sorted(by_source.items())],
            )
        )
        for v in sorted(open_violations, key=lambda x: x.date_issued or "", reverse=True)[:6]:
            evidence.append(
                Evidence(
                    type="municipal_violation",
                    detail=f"Open {v.source} violation: {v.type}",
                    weight="high",
                    source=v.source,
                    severity=v.severity,
                    status=v.status,
                    dateIssued=v.date_issued,
                )
            )

    # --- High: stop-work / unsafe / structural keywords ------------------------
    keyword_hits = []
    for v in records.violations:
        blob = _text(v.type, v.description, v.status)
        for kw in HIGH_RISK_KEYWORDS:
            if kw in blob:
                keyword_hits.append((kw, v))
                break
    if keyword_hits:
        unique_kw = sorted({kw for kw, _ in keyword_hits})
        pts = min(HIGH_KEYWORD_CAP, HIGH_KEYWORD_POINTS * len(unique_kw))
        score += pts
        signals.append(
            MunicipalSignal(
                level="high",
                label="Stop-work / unsafe-structure notices",
                detail=", ".join(unique_kw),
                count=len(keyword_hits),
                points=pts,
            )
        )
        breakdown.append(
            BreakdownItem(
                label="Stop-work / unsafe notices",
                value=pts,
                formula=f"{HIGH_KEYWORD_POINTS} x distinct keyword, capped",
                note=", ".join(unique_kw),
            )
        )
        for kw, v in keyword_hits[:4]:
            evidence.append(
                Evidence(
                    type="municipal_flag",
                    detail=f"{v.source}: {v.type}",
                    weight="high",
                    keyword=kw,
                    status=v.status,
                )
            )

    # --- High: repeated open complaints ----------------------------------------
    open_complaints = [c for c in records.complaints if c.is_open]
    if open_complaints:
        pts = min(OPEN_COMPLAINT_CAP, OPEN_COMPLAINT_POINTS * len(open_complaints))
        score += pts
        level = "high" if len(open_complaints) >= 3 else "medium"
        signals.append(
            MunicipalSignal(
                level=level,
                label="Open complaints",
                detail=f"{len(open_complaints)} active DOB complaint(s)",
                count=len(open_complaints),
                points=pts,
            )
        )
        breakdown.append(
            BreakdownItem(label="Open complaints", value=pts, formula=f"{OPEN_COMPLAINT_POINTS} each, capped")
        )
    if len(records.complaints) >= REPEATED_COMPLAINTS_THRESHOLD:
        score += REPEATED_COMPLAINTS_POINTS
        signals.append(
            MunicipalSignal(
                level="medium",
                label="Repeated complaints",
                detail=f"{len(records.complaints)} complaints on record",
                count=len(records.complaints),
                points=REPEATED_COMPLAINTS_POINTS,
            )
        )
        breakdown.append(
            BreakdownItem(
                label="Repeated complaints",
                value=REPEATED_COMPLAINTS_POINTS,
                formula=f">= {REPEATED_COMPLAINTS_THRESHOLD} complaints on record",
            )
        )

    # --- Medium: expired / unresolved permits ----------------------------------
    expired = [p for p in records.permits if _is_expired_permit(p, today)]
    if len(expired) >= EXPIRED_PERMIT_MEDIUM_THRESHOLD:
        pts = min(EXPIRED_PERMIT_CAP, EXPIRED_PERMIT_POINTS * len(expired))
        score += pts
        signals.append(
            MunicipalSignal(
                level="medium",
                label="Expired / unresolved permits",
                detail=f"{len(expired)} expired or lapsed permit(s)",
                count=len(expired),
                points=pts,
            )
        )
        breakdown.append(
            BreakdownItem(label="Expired permits", value=pts, formula=f"{EXPIRED_PERMIT_POINTS} each, capped")
        )

    # --- Low: mitigants --------------------------------------------------------
    if records.violations and not open_violations:
        score -= RESOLVED_VIOLATIONS_CREDIT
        signals.append(
            MunicipalSignal(
                level="low",
                label="Violations resolved",
                detail=f"all {resolved_count} violation(s) closed/resolved",
                count=resolved_count,
                points=-RESOLVED_VIOLATIONS_CREDIT,
            )
        )
        breakdown.append(
            BreakdownItem(label="Credit: violations resolved", value=-RESOLVED_VIOLATIONS_CREDIT)
        )
    recent_permits = [p for p in records.permits if _is_recent_approved_permit(p, today)]
    if recent_permits:
        score -= RECENT_PERMIT_CREDIT
        signals.append(
            MunicipalSignal(
                level="low",
                label="Recent approved permits",
                detail=f"{len(recent_permits)} permit(s) issued in last {RECENT_PERMIT_YEARS}y",
                count=len(recent_permits),
                points=-RECENT_PERMIT_CREDIT,
            )
        )
        breakdown.append(
            BreakdownItem(label="Credit: recent approved permits", value=-RECENT_PERMIT_CREDIT)
        )

    score = max(0, min(100, score))

    # Overall level: a present High/Medium signal floors the level; score breaks ties.
    levels = {s.level for s in signals}
    if "high" in levels or score >= 60:
        risk_level = "High"
    elif "medium" in levels or score >= 25:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    summary = _summarize(risk_level, score, signals, records)
    breakdown.insert(
        0,
        BreakdownItem(
            label="Municipal risk score",
            value=score,
            formula="sum(risk signals) - mitigants, clamped 0..100",
            note=risk_level,
        ),
    )

    return MunicipalRiskResult(
        municipal_risk_score=score,
        risk_level=risk_level,
        summary=summary,
        signals=signals,
        evidence=evidence,
        breakdown=breakdown,
    )


def _summarize(
    risk_level: str, score: int, signals: list[MunicipalSignal], records: MunicipalRecords
) -> str:
    risk_signals = [s for s in signals if s.level in ("high", "medium")]
    if not risk_signals:
        return (
            f"{risk_level} municipal risk ({score}/100): no open violations or expired "
            f"permits on record."
        )
    parts = [f"{s.label.lower()} ({s.count})" for s in risk_signals[:3]]
    return f"{risk_level} municipal risk ({score}/100): " + "; ".join(parts) + "."
