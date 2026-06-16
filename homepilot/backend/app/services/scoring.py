from typing import Protocol

from app.models import PropertyRecommendation


class RecommendationScorer(Protocol):
    """Protocol for ranking recommendations once agent outputs exist."""

    def score(self, recommendation: PropertyRecommendation) -> float:
        """Return the normalized recommendation score."""
