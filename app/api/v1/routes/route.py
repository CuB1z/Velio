"""Point-to-point routing endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_dem_source, get_route_service
from app.api.v1.exports import export_response
from app.schemas.route import RouteOut, RouteRequestIn
from app.services.route_service import RouteService

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post("", response_model=RouteOut)
async def create_route(
    data: RouteRequestIn,
    service: RouteService = Depends(get_route_service),
    dem: object = Depends(get_dem_source),
    response_format: Literal["json", "gpx", "geojson"] = Query(
        default="json", alias="format"
    ),
):
    route_out = await service.generate(data)
    if response_format == "json":
        return route_out
    return export_response(
        route_out.polyline,
        dem,
        response_format,
        name=f"route-{route_out.distance_km:.1f}km",
        distance_km=route_out.distance_km,
        gain_m=route_out.gain_m,
        loss_m=route_out.loss_m,
        duration_min=route_out.duration_min,
        overlap_ratio=route_out.overlap_ratio,
        cycling_score=route_out.cycling_score,
    )
