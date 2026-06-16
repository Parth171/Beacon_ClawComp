"""mlx-vlm vision client (Qwen2.5-VL 7B 4-bit).

Decodes the base64 JPEGs produced by ``image_prep``, runs the local VLM, and
returns schema-validated JSON. mlx-vlm does not expose constrained decoding as
cleanly as text, so output is parsed and coerced against the schema (with the
prompt instructing strict JSON). All MLX imports are lazy.
"""

from __future__ import annotations

import asyncio
import base64
import importlib
import json
import logging
from typing import Any

from app.core.config import get_settings
from app.services.inference.base import (
    InferenceError,
    JSONSchema,
    VisionClient,
    coerce_to_schema,
    extract_json,
)
from app.services.progress import report_subtask

logger = logging.getLogger(__name__)


def _mlx_vlm_installed() -> bool:
    return importlib.util.find_spec("mlx_vlm") is not None


class MLXVisionClient(VisionClient):
    name = "mlx-vision"

    def __init__(self, model_id: str | None = None) -> None:
        settings = get_settings()
        self.model_id = model_id or settings.vision_model
        self._model: Any = None
        self._processor: Any = None
        self._config: Any = None

    def available(self) -> bool:
        return _mlx_vlm_installed()

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        from mlx_vlm import load  # lazy
        from mlx_vlm.utils import load_config  # lazy

        self._model, self._processor = load(self.model_id)
        self._config = load_config(self.model_id)

    def _decode_images(self, images_base64: list[str]) -> list[Any]:
        # The VLM processor consumes PIL images (or ndarrays) directly; raw byte
        # streams are not auto-loaded by generate(), so decode to PIL here.
        from io import BytesIO

        from PIL import Image  # lazy

        return [
            Image.open(BytesIO(base64.b64decode(b64))).convert("RGB")
            for b64 in images_base64
        ]

    def _analyze_blocking(
        self,
        images_base64: list[str],
        prompt: str,
        schema: JSONSchema,
        temperature: float,
    ) -> dict[str, Any]:
        self._ensure_loaded()
        from mlx_vlm import generate  # lazy
        from mlx_vlm.prompt_utils import apply_chat_template  # lazy

        images = self._decode_images(images_base64)
        full_prompt = (
            f"{prompt}\n\nReturn ONLY a JSON object matching this schema:\n"
            f"{json.dumps(schema)}"
        )
        formatted = apply_chat_template(
            self._processor, self._config, full_prompt, num_images=len(images)
        )
        result = generate(
            self._model,
            self._processor,
            formatted,
            image=images,
            temperature=temperature,
            verbose=False,
        )
        # mlx_vlm 0.6.x returns a GenerationResult(.text); older returns str/tuple.
        text = getattr(result, "text", result)
        if isinstance(text, tuple):
            text = text[0]
        return coerce_to_schema(extract_json(text), schema)

    async def analyze(
        self,
        images_base64: list[str],
        prompt: str,
        schema: JSONSchema,
        *,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        if not self.available():
            raise InferenceError("mlx_vlm is not installed")
        if not images_base64:
            raise InferenceError("no images supplied to vision client")
        settings = get_settings()
        temp = settings.vision_temperature if temperature is None else temperature
        await report_subtask(
            "vision_llm",
            f"Running {self.model_id} over {len(images_base64)} photos",
            skill="mlx-vlm",
        )
        try:
            result = await asyncio.to_thread(
                self._analyze_blocking, images_base64, prompt, schema, temp
            )
        except InferenceError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise InferenceError(f"MLX vision generation failed: {exc}") from exc
        result["_image_count"] = len(images_base64)
        await report_subtask("vision_llm", "Vision analysis complete", skill="mlx-vlm", status="done")
        return result
