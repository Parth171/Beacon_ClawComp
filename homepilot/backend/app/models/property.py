from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl


class PropertyLocation(BaseModel):
    """Location metadata for a candidate property."""

    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class PropertyListing(BaseModel):
    """Candidate listing submitted for HomePilot evaluation."""

    id: str
    url: HttpUrl | None = None
    mls_number: str | None = None
    listing_price: int = Field(gt=0)
    location: PropertyLocation = Field(default_factory=PropertyLocation)
    description: str | None = None
    photo_urls: list[HttpUrl] = Field(default_factory=list)
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: float | None = Field(default=None, ge=0)
    square_feet: int | None = Field(default=None, gt=0)
    year_built: int | None = Field(default=None, gt=1700)
    property_type: str | None = None
    school_score: float | None = Field(default=None, ge=0, le=100)
    safety_score: float | None = Field(default=None, ge=0, le=100)
    park_distance_meters: int | None = Field(default=None, ge=0)
    commute_minutes: int | None = Field(default=None, ge=0)
    annual_property_tax: int | None = Field(default=None, ge=0)
    maintenance_fees: str | None = None
