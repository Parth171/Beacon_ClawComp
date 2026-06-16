"""Run the Property Intelligence agent on a real listing URL end-to-end.

Fetches the listing (photos + details) via the OpenClaw fetch-listings skill,
preprocesses the photos with OpenCV, and runs Qwen2.5-VL for the assessment.

Usage:
    python3 scripts/inspect_listing.py "<realtor.ca listing url>"
"""

import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

DEFAULT_URL = "https://www.realtor.ca/real-estate/29867678/18-535-windflower-crescent-kitchener"


async def main(url: str) -> None:
    from app.agents.property_intelligence import (
        PropertyIntelligenceAgent,
        PropertyIntelligenceInput,
    )
    from app.services.openclaw import fetch_openclaw_listings

    print(f"Fetching listing: {url}")
    properties = await fetch_openclaw_listings([url])
    listing = properties[0]
    print(
        f"Address: {listing.location.address} | price: ${listing.listing_price:,} | "
        f"photos: {len(listing.photo_urls)}"
    )

    print("Running Property Intelligence (OpenCV preprocess -> Qwen2.5-VL)...")
    agent = PropertyIntelligenceAgent(use_vision=True)
    result = await agent.run(PropertyIntelligenceInput(property=listing))
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    asyncio.run(main(target))
