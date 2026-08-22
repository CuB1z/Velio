"""Loop generation endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_dem_source, get_loop_service
from app.api.v1.exports import export_response
from app.schemas.loop import LoopOut, LoopRequestIn
from app.services.loop_service import LoopService

router = APIRouter(prefix="/loops", tags=["loops"])


@router.post("", response_model=LoopOut)
async def create_loop(
    data: LoopRequestIn,
    service: LoopService = Depends(get_loop_service),
    dem: object = Depends(get_dem_source),
    response_format: Literal["json", "gpx", "geojson"] = Query(
        default="json", alias="format"
    ),
):
    loop_out = await service.generate(data)
    if response_format == "json":
        return loop_out
    return export_response(
        loop_out.polyline,
        dem,
        response_format,
        name=f"loop-{loop_out.distance_km:.1f}km",
        distance_km=loop_out.distance_km,
        gain_m=loop_out.gain_m,
        loss_m=loop_out.loss_m,
        duration_min=loop_out.duration_min,
        overlap_ratio=loop_out.overlap_ratio,
        cycling_score=loop_out.cycling_score,
    )
