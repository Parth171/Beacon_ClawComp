"""Run + agent record models for the SQLite ledger.

Every property URL becomes one *run*. Each agent in the graph persists exactly one
record per run, so the ledger is the source of truth for partial-signal fallback
and failure recovery (no silent skips).
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    # Finished, but one or more agents fell back to partial signal.
    PARTIAL = "partial"


class AgentName(str, Enum):
    """Execution order is the chain Inspection -> Valuation -> Trajectory.
    Numbers are retained from plan.md for traceability only."""

    DATA_COLLECTION = "data_collection"  # Agent 1
    INSPECTION = "inspection"  # Agent 3 (runs first in the analysis chain)
    VALUATION = "valuation"  # Agent 2 (consumes inspection)
    TRAJECTORY = "trajectory"  # Agent 4 (consumes inspection + valuation)
    SYNTHESIS = "synthesis"  # Cross-agent evidence synthesis
    THESIS = "thesis"  # Agent 5
    PANDADOC = "pandadoc"  # Agent 6


class AgentRecord(BaseModel):
    """One agent's persisted output within a run."""

    run_id: str
    agent: AgentName
    status: RunStatus = RunStatus.PENDING
    output: dict[str, Any] | None = None
    error: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class RunRecord(BaseModel):
    """Top-level record for a single property underwriting run."""

    run_id: str
    listing_url: str | None = None
    address: str | None = None
    status: RunStatus = RunStatus.PENDING
    recommendation: str | None = None
    next_step: str | None = None
    error: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    agents: list[AgentRecord] = Field(default_factory=list)
