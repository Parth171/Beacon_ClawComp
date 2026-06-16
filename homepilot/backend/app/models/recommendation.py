from pydantic import BaseModel, Field

from app.models.agent_outputs import (
    FamilyFitResult,
    FutureOutlookResult,
    HiddenCostResult,
    PropertyIntelligenceResult,
    PropertyValueResult,
)
from app.models.property import PropertyListing


class PropertyRecommendation(BaseModel):
    """Final per-property recommendation assembled by the CEO agent."""

    rank: int = Field(ge=1)
    property: PropertyListing
    overall_score: float = Field(ge=0, le=100)
    property_intelligence: PropertyIntelligenceResult
    hidden_cost: HiddenCostResult
    family_fit: FamilyFitResult
    property_value: PropertyValueResult
    future_outlook: FutureOutlookResult
    recommendation_summary: str
    tradeoffs: list[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    recommendations: list[PropertyRecommendation]
