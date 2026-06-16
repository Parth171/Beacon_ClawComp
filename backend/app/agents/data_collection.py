"""Agent 1 — Data Collection.

Converts a listing URL into the canonical property schema + image set that every
downstream agent consumes. Thin wrapper over the OpenClaw service: the agent owns
the contract (input/output), the service owns the acquisition mechanism.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.agents.base import Agent
from app.models.property import CanonicalProperty
from app.services.openclaw import ListingRunner, fetch_listing


class DataCollectionInput(BaseModel):
    listing_url: str


class DataCollectionAgent(Agent[DataCollectionInput, CanonicalProperty]):
    name = "data_collection"

    def __init__(self, runner: ListingRunner | None = None) -> None:
        # Injectable acquisition runner. Defaults (None) to spawning the Node skill;
        # tests/orchestrator can pass a fake to avoid network/subprocess.
        self._runner = runner

    async def run(self, payload: DataCollectionInput) -> CanonicalProperty:
        return await fetch_listing(payload.listing_url, runner=self._runner)
