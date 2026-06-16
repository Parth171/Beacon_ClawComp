"""Local inference layer (Apple Silicon / MLX).

Exposes two client protocols — text and vision — plus a registry that returns a
concrete backend (MLX when available, otherwise a deterministic stub so the rest of
the system runs and tests without multi-GB models present).
"""

from app.services.inference.base import (
    InferenceError,
    JSONSchema,
    TextClient,
    VisionClient,
    schema_default,
)
from app.services.inference.registry import get_text_client, get_vision_client

__all__ = [
    "InferenceError",
    "JSONSchema",
    "TextClient",
    "VisionClient",
    "schema_default",
    "get_text_client",
    "get_vision_client",
]
