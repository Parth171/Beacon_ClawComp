"""Shared API and agent data contracts."""

from app.models.agent_outputs import (
    AgentOutputBase,
    BreakdownItem,
    CalcInput,
    FamilyFitResult,
    FutureOutlookResult,
    HiddenCostResult,
    PropertyIntelligenceResult,
    PropertyValueResult,
)
from app.models.property import PropertyListing
from app.models.recommendation import PropertyRecommendation, RecommendationResponse
from app.models.request import RecommendationRequest
from app.models.user import BuyerProfile

__all__ = [
    "AgentOutputBase",
    "BreakdownItem",
    "BuyerProfile",
    "CalcInput",
    "FamilyFitResult",
    "FutureOutlookResult",
    "HiddenCostResult",
    "PropertyIntelligenceResult",
    "PropertyValueResult",
    "PropertyListing",
    "PropertyRecommendation",
    "RecommendationRequest",
    "RecommendationResponse",
]
