"""Live underwriting endpoint — streams Agent 1 -> Agent 3 over SSE.

A single ``POST /analyze/stream`` runs the production agent chain on one listing
URL and streams every step to the browser as Server-Sent Events: the high-level
``agent_started``/``agent_completed`` lifecycle plus the fine-grained ``sub_task``
events the agents already emit (``fetch_listing``, per-photo ``inspection_image``
with the flags found on each image, ``municipal_lookup``, ...). The terminal
``complete`` event carries the assembled, camelCase report.

Only Agent 1 (data collection) and Agent 3 (inspection) are wired here; valuation
and the rest of the chain land in a later pass.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.agents.data_collection import DataCollectionAgent, DataCollectionInput
from app.agents.inspection import InspectionAgent, InspectionInput
from app.models.inspection import InspectionResult
from app.models.property import CanonicalProperty
from app.services.progress import stream_with_subtasks

logger = logging.getLogger(__name__)

router = APIRouter()

# MLX text + vision generations are pinned to ONE shared worker thread
# (services/inference/_executor.py, max_workers=1). Two analyses running at once
# would drive that single thread concurrently and corrupt its Metal buffers, so we
# admit one run at a time and fast-fail the rest with a clear "busy" event.
_analysis_lock = asyncio.Semaphore(1)

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    # Disable proxy/reverse-proxy buffering so events flush to the client live.
    "X-Accel-Buffering": "no",
}


class AnalyzeRequest(BaseModel):
    # Accept either ``listingUrl`` (browser/JSON) or ``listing_url``.
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    listing_url: str


def _sse(payload: dict[str, Any]) -> str:
    """Frame one event as an SSE ``data:`` record."""

    return f"data: {json.dumps(payload)}\n\n"


def _camel(model: BaseModel) -> dict[str, Any]:
    """Serialize a pydantic model to its camelCase JSON shape (as a dict)."""

    return json.loads(model.model_dump_json(by_alias=True))


async def _analyze_events(listing_url: str) -> AsyncIterator[str]:
    """Run data collection then inspection, yielding SSE frames as work happens."""

    run_id = uuid4().hex
    yield _sse({"type": "run_started", "runId": run_id, "listingUrl": listing_url})

    # --- Agent 1: data collection (scrape the listing) ----------------------
    yield _sse({"type": "agent_started", "agent": "data_collection", "runId": run_id})
    prop: CanonicalProperty | None = None
    async for kind, value in stream_with_subtasks(
        DataCollectionAgent().run(DataCollectionInput(listing_url=listing_url)),
        agent="data_collection",
        run_id=run_id,
    ):
        if kind == "sub_task":
            yield _sse(value)  # already {type:"sub_task", ...}
        else:  # ("result", CanonicalProperty)
            prop = value

    if prop is None:  # pragma: no cover - fetch_listing always returns or raises
        raise RuntimeError("Data collection produced no property.")

    yield _sse(
        {
            "type": "agent_completed",
            "agent": "data_collection",
            "runId": run_id,
            "property": _camel(prop),
        }
    )

    # --- Agent 3: inspection (photos + NYC municipal) -----------------------
    yield _sse({"type": "agent_started", "agent": "inspection", "runId": run_id})
    result: InspectionResult | None = None
    async for kind, value in stream_with_subtasks(
        InspectionAgent(enable_municipal=True).run(InspectionInput(property=prop)),
        agent="inspection",
        run_id=run_id,
    ):
        if kind == "sub_task":
            yield _sse(value)
        else:  # ("result", InspectionResult)
            result = value

    if result is None:  # pragma: no cover - _run_visual always returns a result
        raise RuntimeError("Inspection produced no result.")

    yield _sse({"type": "agent_completed", "agent": "inspection", "runId": run_id})

    # --- Final report -------------------------------------------------------
    yield _sse(
        {
            "type": "complete",
            "result": {"property": _camel(prop), "inspection": _camel(result)},
        }
    )


async def _guarded_stream(listing_url: str) -> AsyncIterator[str]:
    """Admit one analysis at a time; turn any failure into a terminal event."""

    # In single-threaded asyncio there is no await between this check and the
    # acquire below, so a free semaphore is acquired without blocking — concurrent
    # requests reliably fast-fail here instead of queueing a live connection.
    if _analysis_lock.locked():
        yield _sse(
            {
                "type": "error",
                "message": (
                    "An analysis is already running. The local model handles one "
                    "listing at a time — please retry in a moment."
                ),
                "status": 409,
            }
        )
        return

    async with _analysis_lock:
        try:
            async for chunk in _analyze_events(listing_url):
                yield chunk
        except Exception as exc:  # noqa: BLE001 - surface any failure to the client
            logger.exception("analyze stream failed for %s", listing_url)
            yield _sse({"type": "error", "message": str(exc), "status": 500})


@router.post("/analyze/stream")
async def analyze_stream(request: AnalyzeRequest) -> StreamingResponse:
    """Stream the Agent 1 -> Agent 3 pipeline for one listing URL as SSE."""

    return StreamingResponse(
        _guarded_stream(request.listing_url),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
