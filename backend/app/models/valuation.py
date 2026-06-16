"""Agent 2 (Valuation & Mispricing) output models."""

from __future__ import annotations

from pydantic import Field

from app.models.evidence import BreakdownItem, Evidence
from app.models.property import _CamelModel


class ListingContextSignal(_CamelModel):
    """The text LLM's read of the listing language + price behaviour (Signal B)."""

    seller_urgency: float = Field(default=0.0, ge=0, le=1)
    distress_sale: bool = False
    signals: list[str] = Field(default_factory=list)


# JSON schema handed to the text LLM for the listing-context signal.
LISTING_CONTEXT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "sellerUrgency": {"type": "number", "minimum": 0, "maximum": 1},
        "distressSale": {"type": "boolean"},
        "signals": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["sellerUrgency", "distressSale", "signals"],
}


class ValuationResult(_CamelModel):
    """Property-level valuation output (Agent 2)."""

    asking_price: int
    estimated_value: int
    mispricing: int          # estimated_value - asking_price (positive => underpriced)
    mispricing_pct: float
    seller_urgency: float = Field(ge=0, le=1)
    distress_sale: bool = False
    urgency_modifier: float = 0.0

    price_reduction_count: int = 0
    price_reduction_total: int = 0
    days_on_market: int | None = None

    median_ppsf: float = 0.0
    comparable_count: int = 0
    using_live_comps: bool = False

    model: str = "unknown"
    evidence: list[Evidence] = Field(default_factory=list)
    breakdown: list[BreakdownItem] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
