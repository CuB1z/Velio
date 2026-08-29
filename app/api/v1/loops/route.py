"""Loop generation endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user, get_dem_source, get_loop_service
from app.api.v1.exports import export_response
from app.engine.dem import DemSource
from app.models import User
from app.schemas.loop import LoopCreateRequest, LoopResponse
from app.services.loop_service import LoopService

router = APIRouter(prefix="/loops", tags=["loops"])


@router.post("", response_model=LoopResponse)
async def create_loop(
    data: LoopCreateRequest,
    service: LoopService = Depends(get_loop_service),
    dem: DemSource = Depends(get_dem_source),
    _: User = Depends(get_current_user),
    response_format: Literal["json", "gpx", "geojson"] = Query(
        default="json", alias="format"
    ),
):
    loop_out = await service.generate(data)
    if response_format == "json":
        return loop_out
    return export_response(loop_out, dem, response_format, kind="loop")
