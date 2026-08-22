from fastapi import APIRouter

from app.api.v1.loops.route import router as loops_router

router = APIRouter(prefix="/v1")
router.include_router(loops_router)
