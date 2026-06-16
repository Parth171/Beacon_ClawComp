import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.agents import CEOAgent
from app.models import RecommendationRequest, RecommendationResponse
from app.services.openclaw import OpenClawError, fetch_openclaw_listings
from app.services.progress import stream_with_subtasks

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def _sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _prepare_request(request: RecommendationRequest) -> RecommendationRequest:
    if not request.listing_urls:
        return request

    fetched_properties = await fetch_openclaw_listings(request.listing_urls)
    return request.model_copy(
        update={
            "properties": [*request.properties, *fetched_properties],
            "listing_urls": [],
        }
    )


async def _recommendation_event_stream(
    request: RecommendationRequest,
) -> AsyncIterator[str]:
    try:
        if request.listing_urls:
            yield _sse_event(
                {
                    "type": "stage",
                    "stage": "fetching_listings",
                    "message": "Fetching listing details from OpenClaw",
                    "listing_count": len(request.listing_urls),
                }
            )

            prepared_request: RecommendationRequest | None = None
            async for kind, value in stream_with_subtasks(
                _prepare_request(request),
                agent="intake",
            ):
                if kind == "sub_task":
                    yield _sse_event(value)
                else:
                    prepared_request = value
            assert prepared_request is not None
        else:
            prepared_request = await _prepare_request(request)

        if request.listing_urls:
            yield _sse_event(
                {
                    "type": "stage",
                    "stage": "listings_ready",
                    "message": f"Loaded {len(prepared_request.properties)} properties for analysis",
                    "property_total": len(prepared_request.properties),
                }
            )

        ceo_agent = CEOAgent()
        async for event in ceo_agent.run_stream(prepared_request):
            yield _sse_event(event)
    except OpenClawError as exc:
        yield _sse_event({"type": "error", "message": str(exc), "status": 502})
    except NotImplementedError as exc:
        yield _sse_event({"type": "error", "message": str(exc), "status": 501})
    except Exception as exc:  # pragma: no cover - safety net for stream clients
        yield _sse_event({"type": "error", "message": str(exc), "status": 500})


@router.post("", response_model=RecommendationResponse)
async def create_recommendation(
    request: RecommendationRequest,
) -> RecommendationResponse:
    ceo_agent = CEOAgent()

    try:
        prepared_request = await _prepare_request(request)
        return await ceo_agent.run(prepared_request)
    except OpenClawError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc),
        ) from exc


@router.post("/stream")
async def create_recommendation_stream(
    request: RecommendationRequest,
) -> StreamingResponse:
    return StreamingResponse(
        _recommendation_event_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
