"""Point-to-point routing endpoints."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_route_service
from app.schemas.route import RouteOut, RouteRequestIn
from app.services.route_service import RouteService

router = APIRouter(prefix="/routes", tags=["routes"])


@router.post("", response_model=RouteOut)
async def create_route(
    data: RouteRequestIn,
    service: RouteService = Depends(get_route_service),
):
    return await service.generate(data)
