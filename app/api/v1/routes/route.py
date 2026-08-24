"""Point-to-point routing and standalone analysis endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import (
    get_analysis_service,
    get_current_user,
    get_dem_source,
    get_route_service,
)
from app.api.v1.exports import export_response
from app.engine.dem import DemSource
from app.models import User
from app.schemas.analysis import AnalysisOut, ElevationOut, PolylineIn
from app.schemas.route import RouteOut, RouteRequestIn
from app.services.analysis_service import RouteAnalysisService
from app.services.route_service import RouteService

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post("", response_model=RouteOut)
async def create_route(
    data: RouteRequestIn,
    service: RouteService = Depends(get_route_service),
    _: User = Depends(get_current_user),
    dem: DemSource = Depends(get_dem_source),
    response_format: Literal["json", "gpx", "geojson"] = Query(
        default="json", alias="format"
    ),
):
    route_out = await service.generate(data)
    if response_format == "json":
        return route_out
    return export_response(route_out, dem, response_format, kind="route")


@router.post("/analyze", response_model=AnalysisOut)
async def analyze_route(
    data: PolylineIn,
    _: User = Depends(get_current_user),
    service: RouteAnalysisService = Depends(get_analysis_service),
):
    """Score an existing encoded polyline without re-routing it."""
    return await service.analyze(data)


@router.post("/elevation", response_model=ElevationOut)
async def route_elevation(
    data: PolylineIn,
    _: User = Depends(get_current_user),
    service: RouteAnalysisService = Depends(get_analysis_service),
):
    """DEM elevation profile for an existing encoded polyline."""
    return service.elevation(data)
