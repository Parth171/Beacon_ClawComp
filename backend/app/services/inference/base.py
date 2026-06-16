"""Inference client contracts and JSON-schema utilities.

Every agent that calls an LLM/VLM does so through one of these clients and *always*
gets back a dict validated against a caller-supplied JSON schema. Constrained
decoding (outlines / llguidance) is the preferred enforcement mechanism; backends
that cannot guarantee it fall back to parse-and-validate-with-retry.
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Any

JSONSchema = dict[str, Any]


class InferenceError(RuntimeError):
    """Raised when a model call fails or cannot produce schema-valid output."""


class TextClient(ABC):
    """A local text LLM that returns JSON conforming to a schema."""

    name: str

    @abstractmethod
    def available(self) -> bool:
        """True if this backend can actually serve requests right now."""

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        schema: JSONSchema,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        """Return a dict validated against ``schema``."""


class VisionClient(ABC):
    """A local vision LLM that reasons over images and returns schema JSON."""

    name: str

    @abstractmethod
    def available(self) -> bool:
        ...

    @abstractmethod
    async def analyze(
        self,
        images_base64: list[str],
        prompt: str,
        schema: JSONSchema,
        *,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        """Return a dict validated against ``schema`` for the given images."""


# --------------------------------------------------------------------------- #
# JSON-schema helpers shared by every backend.
# --------------------------------------------------------------------------- #

_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def extract_json(text: str) -> dict[str, Any]:
    """Best-effort extraction of a single JSON object from model text."""

    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = _JSON_OBJECT_RE.search(text)
    if not match:
        raise InferenceError(f"No JSON object found in model output: {text[:200]!r}")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise InferenceError(f"Model output was not valid JSON: {exc}") from exc


def schema_default(schema: JSONSchema) -> Any:
    """Produce a minimal value satisfying ``schema``'s required structure.

    Used by the stub backend and as a last-resort fallback so the pipeline can run
    end-to-end deterministically without a model. Honours ``default``, ``enum``,
    ``type``, ``properties``/``required``, and ``items``.
    """

    if "default" in schema:
        return schema["default"]
    if "enum" in schema and schema["enum"]:
        return schema["enum"][0]

    schema_type = schema.get("type")
    if isinstance(schema_type, list):
        schema_type = next((t for t in schema_type if t != "null"), schema_type[0])

    if schema_type == "object" or "properties" in schema:
        props: dict[str, JSONSchema] = schema.get("properties", {})
        required = schema.get("required", list(props.keys()))
        return {key: schema_default(props[key]) for key in required if key in props}
    if schema_type == "array":
        return []
    if schema_type == "string":
        return ""
    if schema_type == "integer":
        return 0
    if schema_type == "number":
        return 0.0
    if schema_type == "boolean":
        return False
    return None


def coerce_to_schema(data: dict[str, Any], schema: JSONSchema) -> dict[str, Any]:
    """Fill any missing required keys with schema defaults.

    A light guard so a model that omits a required field doesn't crash downstream;
    it does not deeply re-validate types (constrained decoding handles that when on).
    """

    if schema.get("type") != "object" and "properties" not in schema:
        return data
    props: dict[str, JSONSchema] = schema.get("properties", {})
    required = schema.get("required", [])
    for key in required:
        if key not in data and key in props:
            data[key] = schema_default(props[key])
    return data
