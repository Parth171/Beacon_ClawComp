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

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def extract_json(text: str) -> dict[str, Any]:
    """Extract the first complete JSON object from model text.

    Unconstrained models often wrap JSON in ``` fences or trail commentary/extra
    objects after it. We strip fences, then scan for the first *balanced* brace span
    that parses — robust to trailing prose and repeated objects (a greedy ``{.*}``
    regex would swallow both and fail).
    """

    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    fence = _FENCE_RE.search(text)
    if fence:
        try:
            return json.loads(fence.group(1).strip())
        except json.JSONDecodeError:
            text = fence.group(1).strip()

    start = text.find("{")
    while start != -1:
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            elif ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break  # malformed; try next opening brace
        start = text.find("{", start + 1)

    raise InferenceError(f"No parseable JSON object in model output: {text[:200]!r}")


def schema_hint(schema: JSONSchema) -> Any:
    """Build an example-shaped value with typed placeholders for prompting.

    Unconstrained models echo a raw JSON Schema (``type``/``properties``/``required``)
    back at you. Showing them the *output shape* instead — e.g.
    ``{"sellerUrgency": "<number>", "signals": ["<string>"]}`` — yields clean results.
    """

    if "enum" in schema and schema["enum"]:
        return "<one of: " + " | ".join(str(e) for e in schema["enum"]) + ">"

    schema_type = schema.get("type")
    if isinstance(schema_type, list):
        schema_type = next((t for t in schema_type if t != "null"), schema_type[0])

    if schema_type == "object" or "properties" in schema:
        props: dict[str, JSONSchema] = schema.get("properties", {})
        return {key: schema_hint(sub) for key, sub in props.items()}
    if schema_type == "array":
        return [schema_hint(schema.get("items", {}))]
    if schema_type in ("integer", "number", "string", "boolean"):
        return f"<{schema_type}>"
    return "<value>"


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
