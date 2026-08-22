"""Loop generation endpoints."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_loop_service
from app.schemas.loop import LoopOut, LoopRequestIn
from app.services.loop_service import LoopService

router = APIRouter(prefix="/loops", tags=["loops"])


@router.post("", response_model=LoopOut)
async def create_loop(
    data: LoopRequestIn,
    service: LoopService = Depends(get_loop_service),
):
    return await service.generate(data)
