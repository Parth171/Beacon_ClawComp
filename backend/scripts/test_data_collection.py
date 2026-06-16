"""Run Agent 1 (Data Collection) on a real listing URL.

Fetches listing details + photo URLs via the OpenClaw fetch-listings skill and
prints the canonical property schema.

Usage:
    cd backend
    python scripts/test_data_collection.py "<realtor.ca listing url>"

Example:
    python scripts/test_data_collection.py \\
        "https://www.realtor.ca/real-estate/29867678/18-535-windflower-crescent-kitchener"
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

DEFAULT_URL = (
    "https://www.realtor.ca/real-estate/29867678/"
    "18-535-windflower-crescent-kitchener"
)


async def main(url: str) -> None:
    from app.agents.data_collection import DataCollectionAgent, DataCollectionInput

    print(f"Fetching listing: {url}")
    agent = DataCollectionAgent()
    result = await agent.run(DataCollectionInput(listing_url=url))

    print(
        f"\nAddress: {result.address or '(unknown)'}\n"
        f"Price: ${result.price:,}\n"
        f"Bedrooms: {result.bedrooms} | Bathrooms: {result.bathrooms}\n"
        f"Sqft: {result.sqft} | Year built: {result.year_built}\n"
        f"Days on market: {result.days_on_market}\n"
        f"Photos: {len(result.images)}\n"
        f"Price history entries: {len(result.price_history)}"
    )
    print("\nFull canonical schema (camelCase JSON):")
    print(result.model_dump_json(by_alias=True, indent=2))


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    asyncio.run(main(target))
