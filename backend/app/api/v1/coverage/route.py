"""Covered regions endpoint."""

from fastapi import APIRouter, Depends

from app.api.dependencies import (
    allow_public_caching,
    get_coverage,
    get_coverage_request_service,
    get_language,
    get_optional_user,
)
from app.core.i18n import Language
from app.engine.coverage import Coverage
from app.mappers.coverage import CoverageMapper
from app.models import User
from app.schemas.coverage import (
    CoverageRequestCreateRequest,
    CoverageRequestResponse,
    CoverageResponse,
)
from app.services.coverage_request_service import CoverageRequestService

router = APIRouter(prefix="/coverage", tags=["coverage"])


@router.get("", response_model=CoverageResponse)
async def read_coverage(
    coverage: Coverage = Depends(get_coverage),
    _cache: None = Depends(allow_public_caching),
) -> CoverageResponse:
    return CoverageMapper.out(coverage)


@router.post("/requests", status_code=202, response_model=CoverageRequestResponse)
async def request_coverage(
    data: CoverageRequestCreateRequest,
    service: CoverageRequestService = Depends(get_coverage_request_service),
    user: User | None = Depends(get_optional_user),
    language: Language = Depends(get_language),
) -> CoverageRequestResponse:
    recorded = await service.record(data, user, language)
    return CoverageMapper.request_out(data.country, recorded)
