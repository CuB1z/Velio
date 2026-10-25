"""Coverage requests: riders asking for their country to be routed."""

from app.core.exceptions import CountryAlreadyCoveredError, ValidationError
from app.core.i18n import DEFAULT_LANGUAGE, Language
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
        self,
        data: CoverageRequestCreateRequest,
        user: User | None,
        language: Language = DEFAULT_LANGUAGE,
    ) -> bool:
        """True when stored, False when this person had already asked.

        Asking again with notify on switches the email on for the stored
        request.
        """
        if data.country in self._coverage.isos:
            raise CountryAlreadyCoveredError(data.country)
        if user is None and data.email is None:
            raise ValidationError(
                "An email is required to ask without signing in",
                details={"field": "email"},
            )
        owner = (
            {"user_id": user.id}
            if user is not None
            else {"email": data.email.lower()}
        )
        stored = await self._requests.add(
            country=data.country,
            note=(data.note or "").strip() or None,
            notify=data.notify,
            language=language,
            **owner,
        )
        if not stored and data.notify:
            await self._requests.enable_notify(
                country=data.country, language=language, **owner
            )
        return stored
