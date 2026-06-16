"""Qwen2.5-VL vision provider via Ollama.

Sends the OpenCV-prepared listing photos to a local Qwen2.5-VL model and gets
back a structured property-condition assessment. Uses Ollama's JSON-schema
structured output so the response is always valid JSON.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.image_prep import PreparedImage
from app.services.progress import report_subtask

logger = logging.getLogger(__name__)


# Ollama enforces this JSON schema on the model's output.
VISION_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "property_quality_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "repair_risk_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "renovation_quality": {
            "type": "string",
            "enum": ["high", "medium", "low", "unknown"],
        },
        "roof_condition": {
            "type": "string",
            "enum": ["good", "fair", "poor", "unknown"],
        },
        "water_damage_risk": {"type": "string", "enum": ["low", "medium", "high"]},
        "estimated_major_repairs": {"type": "array", "items": {"type": "string"}},
        "observations": {"type": "array", "items": {"type": "string"}},
        "evidence": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "finding": {"type": "string"},
                    "photo_indexes": {
                        "type": "array",
                        "items": {"type": "integer", "minimum": 1},
                    },
                },
                "required": ["finding", "photo_indexes"],
            },
        },
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": [
        "property_quality_score",
        "repair_risk_score",
        "renovation_quality",
        "roof_condition",
        "water_damage_risk",
        "estimated_major_repairs",
        "observations",
        "evidence",
        "confidence",
    ],
}

PROMPT = (
    "You are an experienced home inspector reviewing a real-estate listing's photos. "
    "Assess the property's true condition from what is visible. Look for: renovation "
    "quality, signs of a cosmetic flip, roof and exterior wear, flooring condition, "
    "kitchen and bathroom age, water damage or mold, and foundation or structural "
    "concerns.\n\n"
    "Scoring guidance:\n"
    "- property_quality_score: 0 (poor) to 100 (excellent, move-in ready).\n"
    "- repair_risk_score: 0 (no concerns) to 100 (major repairs likely).\n"
    "- Only report findings you can actually see. If something is not visible, do not "
    "invent it; reflect the uncertainty in your confidence.\n"
    "- estimated_major_repairs: short items (e.g. 'roof replacement', 'kitchen reno').\n"
    "- observations: brief, concrete visual evidence for your scores.\n"
    "- evidence: each visible concern paired with the 1-based indexes of the photos "
    "that show it. Include old paint, water leakage, stains, cracks, roof wear, or "
    "other issues only when directly visible.\n"
    "Return ONLY the JSON object."
)


async def analyze_property_images(
    images: list[PreparedImage],
    description: str | None = None,
) -> dict[str, Any] | None:
    """Run Qwen2.5-VL over prepared photos; return structured findings or None."""

    if not images:
        return None

    settings = get_settings()
    content = (
        f"{PROMPT}\n\n"
        f"The attached photos are numbered 1 through {len(images)} in the order provided."
    )
    if description:
        content += f"\n\nListing description (context, may be marketing):\n{description.strip()}"

    payload = {
        "model": settings.vision_model,
        "messages": [
            {
                "role": "user",
                "content": content,
                "images": [image.jpeg_base64 for image in images],
            }
        ],
        "format": VISION_OUTPUT_SCHEMA,
        "stream": False,
        "options": {"temperature": 0},
    }

    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    await report_subtask(
        "vision",
        f"Running {settings.vision_model} over {len(images)} photos",
        skill="Qwen2.5-VL",
    )
    try:
        async with httpx.AsyncClient(timeout=settings.vision_timeout_seconds) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            body = response.json()
    except Exception as exc:
        logger.warning("Qwen2.5-VL vision call failed: %s", exc)
        await report_subtask("vision", "Vision model unavailable", skill="Qwen2.5-VL", status="error")
        return None

    raw = (body.get("message") or {}).get("content")
    if not raw:
        return None

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Qwen2.5-VL returned non-JSON content")
        return None

    parsed["_image_count"] = len(images)
    await report_subtask(
        "vision",
        "Vision analysis complete",
        skill="Qwen2.5-VL",
        status="done",
    )
    return parsed


async def vision_available() -> bool:
    """Return True if the Ollama server and the vision model are reachable."""

    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            models = [m.get("name", "") for m in response.json().get("models", [])]
    except Exception:
        return False
    return any(name.startswith(settings.vision_model.split(":")[0]) for name in models)
