from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.api.v1.loops.route import router as loops_router
from app.api.v1.routes.route import router as routes_router

# Business endpoints demand a valid JWT...
router = APIRouter(prefix="/v1", dependencies=[Depends(get_current_user)])
router.include_router(loops_router)
router.include_router(routes_router)

# ...while authentication itself must stay reachable without one.
public_router = APIRouter(prefix="/v1")
