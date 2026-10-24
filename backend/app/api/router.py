from fastapi import APIRouter, Depends

from app.api.dependencies import rate_limit_guard
from app.api.health.route import router as health_router
from app.api.v1.router import router as v1_router

api_router = APIRouter(prefix="/api", dependencies=[Depends(rate_limit_guard)])
api_router.include_router(health_router)
api_router.include_router(v1_router)
