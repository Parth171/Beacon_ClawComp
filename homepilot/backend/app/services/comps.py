"""Fetch real comparable listings via the OpenClaw fetch-comps Node skill."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.progress import report_subtask

logger = logging.getLogger(__name__)

FETCH_COMPS_SKILL = Path(
    "/Users/account_clawteam7/.openclaw/workspace/skills/fetch-comps.js"
)


@dataclass
class Comp:
    url: str
    price: int
    sqft: int
    ppsf: float
    bedrooms: int | None = None
    bathrooms: float | None = None
    address: str | None = None


async def fetch_comps(
    city: str,
    bedrooms: int,
    max_price: int,
) -> list[Comp]:
    """Return real market comps from realtor.ca for the given area + bedroom count."""

    if not FETCH_COMPS_SKILL.exists():
        logger.warning("fetch-comps.js skill not found; returning empty comps.")
        return []

    await report_subtask(
        "comps",
        f"Searching realtor.ca for {bedrooms}-bed comparables in {city}",
        skill="fetch-comps.js",
    )

    args = json.dumps({"city": city, "bedrooms": bedrooms, "maxPrice": max_price})
    try:
        process = await asyncio.create_subprocess_exec(
            "node",
            str(FETCH_COMPS_SKILL),
            args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=120.0)
    except asyncio.TimeoutError:
        logger.warning("fetch-comps.js timed out for %s", city)
        await report_subtask("comps", "Comparable search timed out", skill="fetch-comps.js", status="error")
        return []
    except Exception as exc:
        logger.warning("fetch-comps.js failed: %s", exc)
        await report_subtask("comps", "Comparable search failed", skill="fetch-comps.js", status="error")
        return []

    text = stdout.decode().strip()
    if not text:
        await report_subtask("comps", "No comparables returned", skill="fetch-comps.js", status="done")
        return []

    try:
        payload: dict[str, Any] = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("fetch-comps.js returned non-JSON: %.120s", text)
        return []

    if payload.get("error"):
        logger.warning("fetch-comps.js error: %s", payload.get("message"))
        return []

    comps = []
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

    await report_subtask(
        "comps",
        f"Found {len(comps)} comparable listings on realtor.ca",
        skill="fetch-comps.js",
        status="done",
        detail=f"{len(comps)} comps",
    )
    return comps
