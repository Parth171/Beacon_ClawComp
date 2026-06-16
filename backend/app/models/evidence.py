"""Evidence artifacts.

The core design principle of DealSense is that *evidence flows between agents* —
each agent emits structured artifacts (not just scores) that downstream agents and
the thesis agent reason over. These models are the shared artifact contracts.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Weight = Literal["high", "medium", "low"]


class Evidence(BaseModel):
    """A single typed evidence artifact emitted by an agent.

    ``type`` discriminates the artifact (e.g. ``price_reduction``, ``visual_flag``,
    ``context_signal``). Extra fields are permitted so each agent can attach its own
    structured detail (``imageIndex``, ``confidence``, ``location``, ...) without a
    rigid per-type model.
    """

    model_config = ConfigDict(extra="allow")

    type: str
    detail: str | None = None
    weight: Weight | None = None


class AgentEvidence(BaseModel):
    """The evidence bundle one agent contributes to synthesis."""

    agent: str
    evidence: list[Evidence] = Field(default_factory=list)


class CalcInput(BaseModel):
    """A labelled input to a calculation, with provenance."""

    label: str
    value: Any
    source: str | None = None
    note: str | None = None
    evidence_urls: list[str] = Field(default_factory=list)


class BreakdownItem(BaseModel):
    """An explained line item in an agent's reasoning (kept from HomePilot's
    explainable-output pattern)."""

    label: str
    value: Any
    formula: str | None = None
    inputs: list[CalcInput] = Field(default_factory=list)
    note: str | None = None
