from fastapi import APIRouter

from app.api.v1.loops.route import router as loops_router
from app.api.v1.routes.route import router as routes_router

router = APIRouter(prefix="/v1")
router.include_router(loops_router)
router.include_router(routes_router)
