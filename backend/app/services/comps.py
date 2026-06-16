"""Comparable-listing acquisition for Agent 2 (Valuation).

Spawns the OpenClaw ``fetch-comps.js`` skill to pull live realtor.ca comparables
(same city, similar bedroom count) and returns them with computed $/sqft. The runner
is injectable so tests can supply fixtures without Node/network.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.services.progress import report_subtask

logger = logging.getLogger(__name__)

CompsRunner = Callable[[str, int, int], Awaitable[dict[str, Any]]]


@dataclass
class Comp:
    url: str
    price: int
    sqft: int
    ppsf: float
    bedrooms: int | None = None
    bathrooms: float | None = None
    address: str | None = None


def _skill_path() -> Path:
    return Path(os.path.expanduser(get_settings().openclaw_fetch_comps_path))


def parse_comps(payload: dict[str, Any]) -> list[Comp]:
    comps: list[Comp] = []
    for item in payload.get("comps") or []:
        price = item.get("price")
        sqft = item.get("sqft")
        if not price or not sqft:
            continue
        comps.append(
            Comp(
                url=item.get("url", ""),
                price=int(price),
                sqft=int(sqft),
                ppsf=round(price / sqft, 2),
                bedrooms=item.get("bedrooms"),
                bathrooms=item.get("bathrooms"),
                address=item.get("address"),
            )
        )
    return comps


async def fetch_comps(
    city: str,
    bedrooms: int,
    max_price: int,
    runner: CompsRunner | None = None,
) -> list[Comp]:
    """Return comparable listings for the area, or [] if unavailable."""

    command_runner = runner or run_fetch_comps_skill
    await report_subtask(
        "comps",
        f"Searching realtor.ca for {bedrooms}-bed comparables in {city}",
        skill="fetch-comps.js",
    )
    try:
        payload = await command_runner(city, bedrooms, max_price)
    except Exception as exc:  # noqa: BLE001 - comps are best-effort; fall back to baseline
        logger.warning("Comp fetch failed: %s", exc)
        await report_subtask("comps", "Comparable search failed", skill="fetch-comps.js", status="error")
        return []

    if payload.get("error"):
        logger.warning("fetch-comps.js error: %s", payload.get("message"))
        return []

    comps = parse_comps(payload)
    await report_subtask(
        "comps",
        f"Found {len(comps)} comparable listings",
        skill="fetch-comps.js",
        status="done",
        detail=f"{len(comps)} comps",
    )
    return comps


async def run_fetch_comps_skill(city: str, bedrooms: int, max_price: int) -> dict[str, Any]:
    settings = get_settings()
    skill = _skill_path()
    if not skill.exists():
        raise FileNotFoundError(f"fetch-comps skill not found: {skill}")

    args = json.dumps({"city": city, "bedrooms": bedrooms, "maxPrice": max_price})
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
    text = stdout.decode().strip()
    if not text:
        return {"comps": []}
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"fetch-comps returned non-JSON: {stderr.decode()[:120] or text[:120]}") from exc
