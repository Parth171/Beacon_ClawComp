"""Canonical property schema produced by Agent 1 (Data Collection).

This is the single contract every downstream agent reads. Fields use snake_case
in Python but serialize to the camelCase shape defined in plan.md (``priceHistory``,
``daysOnMarket``, ``lotSize``, ...), so the scraper output and API payloads match
the spec while the code stays Pythonic.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class PriceHistoryEntry(_CamelModel):
    """One observed list-price point. The cadence of these is a first-order
    distress signal consumed by Agent 2 (Valuation)."""

    date: str
    price: int = Field(gt=0)


class CanonicalProperty(_CamelModel):
    """The canonical property + image set passed to all downstream agents."""

    listing_url: str | None = None
    source: str | None = None

    address: str | None = None
    price: int = Field(gt=0)
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: float | None = Field(default=None, ge=0)
    sqft: int | None = Field(default=None, gt=0)
    lot_size: int | None = Field(default=None, ge=0)
    year_built: int | None = Field(default=None, gt=1700)
    property_type: str | None = None
    description: str | None = None

    images: list[str] = Field(default_factory=list)

    days_on_market: int | None = Field(default=None, ge=0)
    price_history: list[PriceHistoryEntry] = Field(default_factory=list)

    # Convenience coordinates for Agent 4's 800m transit-distance checks.
    latitude: float | None = None
    longitude: float | None = None
    postal_code: str | None = None
