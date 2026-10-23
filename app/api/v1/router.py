from fastapi import APIRouter

from app.api.auth.route import router as auth_router
from app.api.v1.coverage.route import router as coverage_router
from app.api.v1.loops.route import router as loops_router
from app.api.v1.routes.route import router as routes_router

# One versioned router; every endpoint opts into authentication through
# its own Depends(get_current_user) parameter.
router = APIRouter(prefix="/v1")
router.include_router(auth_router)
router.include_router(coverage_router)
router.include_router(loops_router)
router.include_router(routes_router)
