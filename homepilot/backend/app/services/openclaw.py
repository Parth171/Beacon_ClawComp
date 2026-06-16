from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from pydantic import HttpUrl, ValidationError

from app.models import PropertyListing
from app.models.property import PropertyLocation
from app.services.progress import report_subtask

OPENCLAW_FETCH_LISTINGS_PATH = Path(
    "/Users/account_clawteam7/.openclaw/workspace/skills/fetch-listings.js"
)

OpenClawCommandRunner = Callable[[str], Awaitable[dict[str, Any]]]


class OpenClawError(RuntimeError):
    """Raised when OpenClaw listing acquisition or mapping fails."""


def map_openclaw_listing_to_property(payload: dict[str, Any]) -> PropertyListing:
    """Map fetch-listings output into the HomePilot property contract."""

    listing = payload.get("listing")
    if not isinstance(listing, dict):
        raise OpenClawError('OpenClaw output is missing a "listing" object.')

    address = listing.get("address") or {}
    if not isinstance(address, dict):
        address = {}

    property_type = listing.get("propertyType") or listing.get("buildingType")

    try:
        return PropertyListing(
            id=str(listing.get("id") or listing.get("mlsNumber") or payload.get("url") or ""),
            url=listing.get("url") or payload.get("url"),
            mls_number=listing.get("mlsNumber"),
            listing_price=listing.get("listingPrice"),
            location=PropertyLocation(
                address=address.get("text"),
                city=address.get("city"),
                province=address.get("province"),
                postal_code=address.get("postalCode"),
                latitude=address.get("latitude"),
                longitude=address.get("longitude"),
            ),
            description=listing.get("description"),
            photo_urls=listing.get("photoUrls") or [],
            bedrooms=listing.get("bedrooms"),
            bathrooms=listing.get("bathrooms"),
            square_feet=listing.get("squareFeet"),
            year_built=listing.get("yearBuilt"),
            property_type=property_type,
            annual_property_tax=listing.get("annualPropertyTax"),
            maintenance_fees=listing.get("maintenanceFees"),
        )
    except ValidationError as exc:
        raise OpenClawError(f"OpenClaw listing could not be mapped: {exc}") from exc


async def fetch_openclaw_listings(
    listing_urls: list[HttpUrl],
    runner: OpenClawCommandRunner | None = None,
) -> list[PropertyListing]:
    """Fetch listing URLs through OpenClaw and return backend-ready properties."""

    command_runner = runner or run_fetch_listings_skill
    properties = []

    for index, listing_url in enumerate(listing_urls, start=1):
        await report_subtask(
            "fetch_listing",
            f"Fetching listing {index} of {len(listing_urls)} from realtor.ca",
            skill="fetch-listings.js",
        )
        payload = await command_runner(str(listing_url))
        prop = map_openclaw_listing_to_property(payload)
        properties.append(prop)
        await report_subtask(
            "fetch_listing",
            f"Loaded {prop.location.address or prop.location.city or 'listing'}",
            skill="fetch-listings.js",
            status="done",
        )

    return properties


async def run_fetch_listings_skill(listing_url: str) -> dict[str, Any]:
    if not OPENCLAW_FETCH_LISTINGS_PATH.exists():
        raise OpenClawError(f"OpenClaw fetch-listings skill not found: {OPENCLAW_FETCH_LISTINGS_PATH}")

    args = json.dumps({"url": listing_url})
    process = await asyncio.create_subprocess_exec(
        "node",
        str(OPENCLAW_FETCH_LISTINGS_PATH),
        args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
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
