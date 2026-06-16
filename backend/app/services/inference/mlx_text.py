"""MLX-LM text client (Llama-3-8B 4-bit) with constrained JSON output.

Enforcement strategy, in order of preference:
  1. ``outlines`` JSON-schema-constrained generation (guarantees valid JSON).
  2. Fallback: plain MLX-LM generation with strong JSON prompting, then
     extract-and-coerce against the schema.

All heavy imports are lazy and the model is loaded once on first use, so importing
this module costs nothing when MLX is not installed.
"""

from __future__ import annotations

import asyncio
import importlib
import json
import logging
from typing import Any

from app.core.config import get_settings
from app.services.inference.base import (
    InferenceError,
    JSONSchema,
    TextClient,
    coerce_to_schema,
    extract_json,
)
from app.services.progress import report_subtask

logger = logging.getLogger(__name__)


def _mlx_lm_installed() -> bool:
    return importlib.util.find_spec("mlx_lm") is not None


class MLXTextClient(TextClient):
    name = "mlx-text"

    def __init__(self, model_id: str | None = None) -> None:
        settings = get_settings()
        self.model_id = model_id or settings.text_model
        self._model: Any = None
        self._tokenizer: Any = None

    def available(self) -> bool:
        return _mlx_lm_installed()

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        from mlx_lm import load  # lazy

        self._model, self._tokenizer = load(self.model_id)

    def _format_prompt(self, prompt: str, system: str | None) -> str:
        tokenizer = self._tokenizer
        apply = getattr(tokenizer, "apply_chat_template", None)
        if apply is None:
            return prompt if not system else f"{system}\n\n{prompt}"
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return apply(messages, tokenize=False, add_generation_prompt=True)

    def _generate_blocking(
        self,
        prompt: str,
        schema: JSONSchema,
        system: str | None,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        self._ensure_loaded()
        formatted = self._format_prompt(
            f"{prompt}\n\nReturn ONLY a JSON object matching this schema:\n"
            f"{json.dumps(schema)}",
            system,
        )

        # 1. Preferred: outlines constrained decoding.
        if importlib.util.find_spec("outlines") is not None:
            try:
                return self._generate_outlines(formatted, schema, max_tokens)
            except Exception as exc:  # noqa: BLE001 - fall back, don't fail the run
                logger.warning("outlines constrained decode failed, falling back: %s", exc)

        # 2. Fallback: plain generation + extract/coerce.
        from mlx_lm import generate  # lazy

        kwargs: dict[str, Any] = {"max_tokens": max_tokens, "verbose": False}
        sampler = self._maybe_sampler(temperature)
        if sampler is not None:
            kwargs["sampler"] = sampler
        text = generate(self._model, self._tokenizer, prompt=formatted, **kwargs)
        return coerce_to_schema(extract_json(text), schema)

    def _generate_outlines(
        self, formatted: str, schema: JSONSchema, max_tokens: int
    ) -> dict[str, Any]:
        import outlines  # lazy

        model = outlines.from_mlxlm(self._model, self._tokenizer)
        generator = outlines.Generator(model, json.dumps(schema))
        raw = generator(formatted, max_tokens=max_tokens)
        return json.loads(raw) if isinstance(raw, str) else raw

    def _maybe_sampler(self, temperature: float) -> Any:
        if temperature <= 0:
            return None
        try:
            from mlx_lm.sample_utils import make_sampler  # lazy

            return make_sampler(temp=temperature)
        except Exception:  # noqa: BLE001
            return None

    async def generate_json(
        self,
        prompt: str,
        schema: JSONSchema,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        if not self.available():
            raise InferenceError("mlx_lm is not installed")
        settings = get_settings()
        temp = settings.text_temperature if temperature is None else temperature
        tokens = settings.text_max_tokens if max_tokens is None else max_tokens
        await report_subtask("text_llm", f"Generating with {self.model_id}", skill="MLX-LM")
        try:
            result = await asyncio.to_thread(
                self._generate_blocking, prompt, schema, system, temp, tokens
            )
        except InferenceError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise InferenceError(f"MLX text generation failed: {exc}") from exc
        await report_subtask("text_llm", "Generation complete", skill="MLX-LM", status="done")
        return result
