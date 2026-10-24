"""Loop generation endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.api.dependencies import (
    allow_public_caching,
    get_current_user,
    get_dem_source,
    get_loop_service,
)
from app.api.streaming import SSE_HEADERS, event_stream, unless_disconnected
from app.api.v1.exports import export_response
from app.engine.dem import DemSource
from app.models import User
from app.schemas.loop import LoopCreateRequest, LoopResponse
from app.services.loop_service import LoopService

router = APIRouter(prefix="/loops", tags=["loops"])


@router.post("", response_model=LoopResponse)
async def create_loop(
    data: LoopCreateRequest,
    request: Request,
    service: LoopService = Depends(get_loop_service),
    dem: DemSource = Depends(get_dem_source),
    _: User = Depends(get_current_user),
    _cache: None = Depends(allow_public_caching),
    response_format: Literal["json", "gpx", "geojson"] = Query(
        default="json", alias="format"
    ),
):
    loop_out = await unless_disconnected(request, service.generate(data))
    if response_format == "json":
        return loop_out
    return export_response(loop_out, dem, response_format, kind="loop")


@router.post(
    "/stream",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def stream_loop(
    data: LoopCreateRequest,
    service: LoopService = Depends(get_loop_service),
    _: User = Depends(get_current_user),
) -> StreamingResponse:
    """Progress and loops as Server-Sent Events, then the ranked `result`."""
    return StreamingResponse(
        event_stream(lambda emit: service.generate(data, emit)),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
