"""Deterministic stub clients.

Returns schema-shaped output without any model, so the full agent graph can be
developed, wired, and tested before the MLX models are pulled. Every result carries
``_stub: True`` so callers/tests can tell real inference from placeholder output.
"""

from __future__ import annotations

from typing import Any

from app.services.inference.base import (
    JSONSchema,
    TextClient,
    VisionClient,
    schema_default,
)


def _shaped(schema: JSONSchema) -> dict[str, Any]:
    value = schema_default(schema)
    if not isinstance(value, dict):
        value = {"value": value}
    value["_stub"] = True
    return value


class StubTextClient(TextClient):
    name = "stub-text"

    def available(self) -> bool:
        return True

    async def generate_json(
        self,
        prompt: str,
        schema: JSONSchema,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        return _shaped(schema)


class StubVisionClient(VisionClient):
    name = "stub-vision"

    def available(self) -> bool:
        return True

    async def analyze(
        self,
        images_base64: list[str],
        prompt: str,
        schema: JSONSchema,
        *,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        result = _shaped(schema)
        result["_image_count"] = len(images_base64)
        return result
