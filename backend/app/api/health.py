"""Health + capability endpoint.

Reports which inference backend resolved (MLX vs. stub) so you can confirm the
local models are wired before running a real underwrite.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.services.inference import get_text_client, get_vision_client

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    text = get_text_client()
    vision = get_vision_client()
    return {
        "status": "ok",
        "app": settings.app_name,
        "inference": {
            "backend": settings.inference_backend,
            "text": {"client": text.name, "model": settings.text_model},
            "vision": {"client": vision.name, "model": settings.vision_model},
        },
    }
