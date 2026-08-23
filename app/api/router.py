from fastapi import APIRouter

from app.api.auth.route import router as auth_router
from app.api.health.route import router as health_router
from app.api.v1.router import public_router, router as v1_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
# Auth lives under /v1 but outside the JWT-protected sub-router.
public_router.include_router(auth_router)
api_router.include_router(public_router)
api_router.include_router(v1_router)
