"""Backend selection.

Resolves the configured ``inference_backend`` into concrete clients:

  - ``mlx``  : require MLX; raise if unavailable.
  - ``stub`` : always the deterministic stub.
  - ``auto`` : MLX when importable, else stub (with a loud warning).

Clients are cached so models load at most once per process.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from app.core.config import get_settings
from app.services.inference.base import InferenceError, TextClient, VisionClient
from app.services.inference.mlx_text import MLXTextClient
from app.services.inference.mlx_vision import MLXVisionClient
from app.services.inference.stub import StubTextClient, StubVisionClient

logger = logging.getLogger(__name__)


@lru_cache
def get_text_client() -> TextClient:
    backend = get_settings().inference_backend
    if backend == "stub":
        return StubTextClient()
    mlx = MLXTextClient()
    if mlx.available():
        return mlx
    if backend == "mlx":
        raise InferenceError("inference_backend='mlx' but mlx_lm is not installed")
    logger.warning("MLX text backend unavailable; using deterministic stub client")
    return StubTextClient()


@lru_cache
def get_vision_client() -> VisionClient:
    backend = get_settings().inference_backend
    if backend == "stub":
        return StubVisionClient()
    mlx = MLXVisionClient()
    if mlx.available():
        return mlx
    if backend == "mlx":
        raise InferenceError("inference_backend='mlx' but mlx_vlm is not installed")
    logger.warning("MLX vision backend unavailable; using deterministic stub client")
    return StubVisionClient()
