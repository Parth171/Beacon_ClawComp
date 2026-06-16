from pydantic import BaseModel, Field, HttpUrl, model_validator

from app.models.property import PropertyListing
from app.models.user import BuyerProfile


class RecommendationRequest(BaseModel):
    """Request body for ranking candidate homes for a buyer."""

    buyer: BuyerProfile
    properties: list[PropertyListing] = Field(default_factory=list)
    listing_urls: list[HttpUrl] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_properties_or_listing_urls(self) -> "RecommendationRequest":
        if not self.properties and not self.listing_urls:
            raise ValueError("Provide at least one property or listing URL.")
        return self
