import json
from pathlib import Path

from app.models import RecommendationRequest

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DEMO_RECOMMENDATION_REQUEST_PATH = DATA_DIR / "demo_recommendation_request.json"


def load_demo_recommendation_request() -> RecommendationRequest:
    """Load the deterministic demo request used by local demos and tests."""

    with DEMO_RECOMMENDATION_REQUEST_PATH.open() as file:
        payload = json.load(file)

    return RecommendationRequest.model_validate(payload)
