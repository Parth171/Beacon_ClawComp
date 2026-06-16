"""NYC municipal records lookup (Agent 3 — municipal risk signals).

Spawns the local OpenClaw Node skill (``fetch-municipal.js``) to geocode an address
and pull violations, permits, and complaints from NYC Open Data (the same public
datasets regwatch.nyc aggregates — DOB/ECB/HPD violations, DOB BIS + DOB NOW
permits, DOB complaints), then validates the payload into ``MunicipalRecords``.

Mirrors ``openclaw.py``: an injectable runner spawns Node and returns the raw
payload; tests can supply a fixture without Node or the network.
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.core.config import get_settings
from app.models.municipal import MunicipalRecords
from app.services.progress import report_subtask

# A runner takes an address and returns the raw fetch-municipal payload.
MunicipalRunner = Callable[[str], Awaitable[dict[str, Any]]]


class MunicipalLookupError(RuntimeError):
    """Raised when municipal lookup or mapping fails."""


def _skill_path() -> Path:
    return Path(os.path.expanduser(get_settings().openclaw_fetch_municipal_path))


def map_payload_to_records(payload: dict[str, Any]) -> MunicipalRecords:
    """Validate a ``fetch-municipal`` payload into ``MunicipalRecords``."""

    if not isinstance(payload, dict) or "query" not in payload:
        raise MunicipalLookupError('Municipal payload is missing a "query" object.')
    try:
        return MunicipalRecords.model_validate(payload)
    except ValidationError as exc:
        raise MunicipalLookupError(
            f"Municipal payload could not be mapped to schema: {exc}"
        ) from exc


async def fetch_municipal(
    address: str,
    runner: MunicipalRunner | None = None,
) -> MunicipalRecords:
    """Look up an address's NYC municipal records through OpenClaw."""

    command_runner = runner or run_fetch_municipal_skill
    await report_subtask(
        "municipal_lookup",
        f"Looking up NYC violations & permits for {address}",
        skill="fetch-municipal.js",
    )
    payload = await command_runner(address)
    records = map_payload_to_records(payload)
    counts = records.counts
    await report_subtask(
        "municipal_lookup",
        f"Found {counts.get('violations', 0)} violations "
        f"({counts.get('openViolations', 0)} open), {counts.get('permits', 0)} permits, "
        f"{counts.get('complaints', 0)} complaints",
        skill="fetch-municipal.js",
        status="done",
        data={
            "resolved": records.query.resolved,
            "bbl": records.query.bbl,
            "counts": counts,
        },
    )
    return records


async def run_fetch_municipal_skill(address: str) -> dict[str, Any]:
    """Default runner: invoke the Node skill for one address."""

    settings = get_settings()
    skill = _skill_path()
    if not skill.exists():
        raise MunicipalLookupError(f"OpenClaw fetch-municipal skill not found: {skill}")

    args = json.dumps({"address": address})
    try:
        process = await asyncio.create_subprocess_exec(
            settings.openclaw_node_bin,
            str(skill),
            args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            process.communicate(), timeout=settings.openclaw_timeout_seconds
        )
    except asyncio.TimeoutError as exc:
        raise MunicipalLookupError(
            f"Municipal lookup timed out after {settings.openclaw_timeout_seconds}s "
            f"for {address}"
        ) from exc
    except FileNotFoundError as exc:
        raise MunicipalLookupError(
            f"Node binary '{settings.openclaw_node_bin}' not found on PATH"
        ) from exc

    stdout_text = stdout.decode().strip()
    stderr_text = stderr.decode().strip()
    try:
        payload = json.loads(stdout_text)
    except json.JSONDecodeError as exc:
        detail = stderr_text or stdout_text or "no output"
        raise MunicipalLookupError(
            f"Municipal lookup returned invalid JSON for {address}: {detail}"
        ) from exc

    if process.returncode != 0 or payload.get("error"):
        message = payload.get("message") or stderr_text or "unknown error"
        raise MunicipalLookupError(f"Municipal lookup failed for {address}: {message}")

    return payload
