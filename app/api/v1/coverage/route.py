"""Covered regions endpoint."""

from fastapi import APIRouter, Depends

from app.api.dependencies import allow_public_caching, get_coverage
from app.engine.coverage import Coverage
from app.mappers.coverage import CoverageMapper
from app.schemas.coverage import CoverageResponse

router = APIRouter(prefix="/coverage", tags=["coverage"])


@router.get("", response_model=CoverageResponse)
async def read_coverage(
    coverage: Coverage = Depends(get_coverage),
    _cache: None = Depends(allow_public_caching),
) -> CoverageResponse:
    return CoverageMapper.out(coverage)
