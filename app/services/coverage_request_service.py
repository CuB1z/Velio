"""Coverage requests: riders asking for their country to be routed."""

from app.core.exceptions import CountryAlreadyCoveredError, ValidationError
from app.engine.coverage import Coverage
from app.models import User
from app.repositories.coverage_request_repository import CoverageRequestRepository
from app.schemas.coverage import CoverageRequestCreateRequest


class CoverageRequestService:
    """Records one request per person and country; repeats are not errors."""

    def __init__(self, requests: CoverageRequestRepository, coverage: Coverage):
        self._requests = requests
        self._coverage = coverage

    async def record(
        self, data: CoverageRequestCreateRequest, user: User | None
    ) -> bool:
        """True when stored, False when this person had already asked."""
        if data.country in self._coverage.isos:
            raise CountryAlreadyCoveredError(data.country)
        note = (data.note or "").strip() or None
        if user is not None:
            return await self._requests.add(
                country=data.country, user_id=user.id, note=note
            )
        if data.email is None:
            raise ValidationError(
                "An email is required to ask without signing in",
                details={"field": "email"},
            )
        return await self._requests.add(
            country=data.country, email=data.email.lower(), note=note
        )
