"""OpenClaw listing acquisition (Agent 1's data source).

Spawns the local OpenClaw Node skill (``fetch-listings.js``) to fetch a single
listing — full property fields plus every photo CDN URL — and maps the result into
the canonical property schema all downstream agents read.

This is the only place a listing URL is turned into structured data; everything
after it reasons over the ``CanonicalProperty`` produced here.
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
from app.models.property import CanonicalProperty, PriceHistoryEntry
from app.services.progress import report_subtask

# A runner takes a listing URL and returns the raw fetch-listings payload. Injectable
# so tests can supply a fixture without spawning Node or hitting the network.
ListingRunner = Callable[[str], Awaitable[dict[str, Any]]]


class OpenClawError(RuntimeError):
    """Raised when listing acquisition or mapping fails."""


def _skill_path() -> Path:
    return Path(os.path.expanduser(get_settings().openclaw_fetch_listings_path))


def map_listing_to_canonical(payload: dict[str, Any]) -> CanonicalProperty:
    """Map a ``fetch-listings`` detail payload into ``CanonicalProperty``."""

    listing = payload.get("listing")
    if not isinstance(listing, dict):
        raise OpenClawError('OpenClaw output is missing a "listing" object.')

    price = listing.get("listingPrice")
    if not price or price <= 0:
        raise OpenClawError(
            "Listing has no usable price; cannot underwrite. The reader proxy may "
            "have returned a challenge page or an unexpected layout."
        )

    address = listing.get("address") or {}
    if not isinstance(address, dict):
        address = {}

    price_history = []
    for entry in listing.get("priceHistory") or []:
        if isinstance(entry, dict) and entry.get("date") and entry.get("price"):
            try:
                price_history.append(
                    PriceHistoryEntry(date=str(entry["date"]), price=int(entry["price"]))
                )
            except (ValueError, ValidationError):
                continue

    try:
        return CanonicalProperty(
            listing_url=listing.get("url") or payload.get("url"),
            source=listing.get("source") or payload.get("source"),
            address=address.get("text"),
            price=int(price),
            bedrooms=listing.get("bedrooms"),
            bathrooms=listing.get("bathrooms"),
            sqft=listing.get("squareFeet"),
            lot_size=listing.get("lotSize"),
            year_built=listing.get("yearBuilt"),
            property_type=listing.get("propertyType") or listing.get("buildingType"),
            description=listing.get("description"),
            images=[str(u) for u in (listing.get("photoUrls") or [])],
            days_on_market=listing.get("daysOnMarket"),
            price_history=price_history,
            latitude=address.get("latitude"),
            longitude=address.get("longitude"),
            postal_code=address.get("postalCode"),
        )
    except ValidationError as exc:
        raise OpenClawError(f"Listing could not be mapped to canonical schema: {exc}") from exc


async def fetch_listing(
    listing_url: str,
    runner: ListingRunner | None = None,
) -> CanonicalProperty:
    """Fetch one listing through OpenClaw and return a canonical property."""

    command_runner = runner or run_fetch_listings_skill
    await report_subtask(
        "fetch_listing",
        "Fetching listing from realtor.ca via OpenClaw",
        skill="fetch-listings.js",
    )
    payload = await command_runner(listing_url)
    prop = map_listing_to_canonical(payload)
    await report_subtask(
        "fetch_listing",
        f"Loaded {prop.address or prop.listing_url or 'listing'} "
        f"({len(prop.images)} photos)",
        skill="fetch-listings.js",
        status="done",
    )
    return prop


async def run_fetch_listings_skill(listing_url: str) -> dict[str, Any]:
    """Default runner: invoke the Node skill in detail mode for one URL."""

    settings = get_settings()
    skill = _skill_path()
    if not skill.exists():
        raise OpenClawError(f"OpenClaw fetch-listings skill not found: {skill}")

    args = json.dumps({"url": listing_url})
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
        raise OpenClawError(
            f"OpenClaw timed out after {settings.openclaw_timeout_seconds}s for {listing_url}"
        ) from exc
    except FileNotFoundError as exc:
        raise OpenClawError(
            f"Node binary '{settings.openclaw_node_bin}' not found on PATH"
        ) from exc

    stdout_text = stdout.decode().strip()
    stderr_text = stderr.decode().strip()
    try:
        payload = json.loads(stdout_text)
    except json.JSONDecodeError as exc:
        detail = stderr_text or stdout_text or "no output"
        raise OpenClawError(f"OpenClaw returned invalid JSON for {listing_url}: {detail}") from exc

    if process.returncode != 0 or payload.get("error"):
        message = payload.get("message") or stderr_text or "unknown OpenClaw error"
        raise OpenClawError(f"OpenClaw failed to fetch {listing_url}: {message}")

    return payload
