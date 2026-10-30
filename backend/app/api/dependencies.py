"""FastAPI dependency providers."""

import uuid
from collections.abc import Callable
from typing import Any

import jwt
from fastapi import Depends, Header, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.mail import MailSender, build_mail_sender
from app.clients.oauth import OAuthGateway
from app.clients.valhalla import ValhallaClient
from app.core.config import settings
from app.core.database import lookup_session
from app.core.exceptions import (
    AccountSuspendedError,
    EmailNotVerifiedError,
    InvalidCredentialsError,
    UnauthorizedError,
)
from app.core.i18n import Language, negotiate_language
from app.core.ratelimit import RULES, client_ip, enforce, match_rule
from app.core.security import ACCESS_TYPE, decode_token
from app.engine.coverage import Coverage, load_coverage
from app.engine.dem import DemSource
from app.engine.restricted import RestrictedAreas, load_restricted_areas
from app.models import User
from app.repositories.coverage_request_repository import CoverageRequestRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.saved_route_repository import SavedRouteRepository
from app.repositories.user_repository import UserRepository
from app.repositories.verification_code_repository import VerificationCodeRepository
from app.services.account_service import AccountService, ensure_active
from app.services.analysis_service import RouteAnalysisService
from app.services.coverage_request_service import CoverageRequestService
from app.services.loop_service import LoopService
from app.services.oauth_service import OAuthService
from app.services.route_service import RouteService
from app.services.saved_route_service import SavedRouteService
from app.services.session_service import SessionService

_bearer = HTTPBearer(auto_error=False)


# Shared singletons ----------------------------------------------------------

_shared: dict[str, Any] = {}


def provide(**resources: Any) -> None:
    """Install shared resources ahead of their getters (tests, tooling)."""
    _shared.update(resources)


def reset() -> None:
    """Drop every shared resource; the next getter call builds it again."""
    _shared.clear()


def _shared_resource[T](name: str, build: Callable[[], T]) -> T:
    if name not in _shared:
        _shared[name] = build()
    return _shared[name]


def get_valhalla_client() -> ValhallaClient:
    """Shared Valhalla client, built on first use."""
    return _shared_resource(
        "valhalla",
        lambda: ValhallaClient(
            base_url=settings.valhalla_url, timeout_s=settings.valhalla_timeout_s
        ),
    )


def get_dem_source() -> DemSource:
    """Shared DEM source, built on first use."""
    return _shared_resource("dem", lambda: DemSource(settings.elevation_dir))


def get_restricted_areas() -> RestrictedAreas:
    """Restricted areas, loaded on first use."""
    return _shared_resource(
        "restricted", lambda: load_restricted_areas(settings.restricted_areas_path)
    )


def get_coverage() -> Coverage:
    """Covered regions, loaded on first use."""
    return _shared_resource("coverage", lambda: load_coverage(settings.coverage_path))


def get_mail_sender() -> MailSender:
    """Shared mail adapter, built on first use."""
    return _shared_resource("mail", build_mail_sender)


# Repositories ---------------------------------------------------------------


def get_db(request: Request) -> AsyncSession:
    """Request-scoped session opened by DbTransactionMiddleware."""
    return request.state.db


def get_user_repository(db: AsyncSession = Depends(get_db)) -> UserRepository:
    """Provide a UserRepository bound to the request-scoped session."""
    return UserRepository(db)


def get_refresh_token_repository(
    db: AsyncSession = Depends(get_db),
) -> RefreshTokenRepository:
    """Provide a RefreshTokenRepository bound to the request session."""
    return RefreshTokenRepository(db)


def get_coverage_request_repository(
    db: AsyncSession = Depends(get_db),
) -> CoverageRequestRepository:
    """Provide a CoverageRequestRepository bound to the request session."""
    return CoverageRequestRepository(db)


def get_verification_code_repository(
    db: AsyncSession = Depends(get_db),
) -> VerificationCodeRepository:
    """Provide a VerificationCodeRepository bound to the request session."""
    return VerificationCodeRepository(db)


def get_saved_route_repository(
    db: AsyncSession = Depends(get_db),
) -> SavedRouteRepository:
    """Provide a SavedRouteRepository bound to the request session."""
    return SavedRouteRepository(db)


# Services -------------------------------------------------------------------


def get_oauth_gateway() -> OAuthGateway:
    """Gateway performing the OAuth provider round trips."""
    return OAuthGateway()


def get_account_service(
    users: UserRepository = Depends(get_user_repository),
    codes: VerificationCodeRepository = Depends(get_verification_code_repository),
    tokens: RefreshTokenRepository = Depends(get_refresh_token_repository),
    mail: MailSender = Depends(get_mail_sender),
    coverage_requests: CoverageRequestRepository = Depends(
        get_coverage_request_repository
    ),
) -> AccountService:
    """Compose the account lifecycle service (OTP + credentials)."""
    return AccountService(
        users=users,
        codes=codes,
        tokens=tokens,
        mail=mail,
        coverage_requests=coverage_requests,
    )


def get_session_service(
    users: UserRepository = Depends(get_user_repository),
    tokens: RefreshTokenRepository = Depends(get_refresh_token_repository),
) -> SessionService:
    """Compose the session lifecycle service (mint / rotate / revoke)."""
    return SessionService(users=users, tokens=tokens)


def get_oauth_service(
    users: UserRepository = Depends(get_user_repository),
    sessions: SessionService = Depends(get_session_service),
    mail: MailSender = Depends(get_mail_sender),
    oauth: OAuthGateway = Depends(get_oauth_gateway),
) -> OAuthService:
    """Compose the OAuth round trips; token issuance comes from sessions."""
    return OAuthService(users=users, sessions=sessions, mail=mail, oauth=oauth)


def get_loop_service(
    valhalla: ValhallaClient = Depends(get_valhalla_client),
    dem: DemSource = Depends(get_dem_source),
    restricted: RestrictedAreas = Depends(get_restricted_areas),
    coverage: Coverage = Depends(get_coverage),
) -> LoopService:
    """Compose the shared client, DEM source, restricted areas and coverage."""
    return LoopService(
        valhalla=valhalla, dem=dem, restricted=restricted, coverage=coverage
    )


def get_coverage_request_service(
    requests: CoverageRequestRepository = Depends(get_coverage_request_repository),
    coverage: Coverage = Depends(get_coverage),
) -> CoverageRequestService:
    """Compose the request store and the covered regions."""
    return CoverageRequestService(requests=requests, coverage=coverage)


def get_route_service(
    valhalla: ValhallaClient = Depends(get_valhalla_client),
    dem: DemSource = Depends(get_dem_source),
    coverage: Coverage = Depends(get_coverage),
) -> RouteService:
    """Compose the shared client, DEM source and coverage into the route service."""
    return RouteService(valhalla=valhalla, dem=dem, coverage=coverage)


def get_analysis_service(
    valhalla: ValhallaClient = Depends(get_valhalla_client),
    dem: DemSource = Depends(get_dem_source),
) -> RouteAnalysisService:
    """Compose the shared client and DEM source into the analysis service."""
    return RouteAnalysisService(valhalla=valhalla, dem=dem)


def get_saved_route_service(
    routes: SavedRouteRepository = Depends(get_saved_route_repository),
) -> SavedRouteService:
    """Compose the saved-route service over its repository."""
    return SavedRouteService(routes=routes)


# Authentication -------------------------------------------------------------


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User:
    """Resolve the user behind a valid Bearer access token.

    Runs on its own short-lived session: the read opens, lands and
    releases the connection in milliseconds, so handlers spending
    seconds inside Valhalla pin nothing.
    """
    if credentials is None:
        raise UnauthorizedError()

    try:
        payload = decode_token(credentials.credentials, ACCESS_TYPE)
        subject = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError) as exc:
        raise UnauthorizedError("Invalid or expired token") from exc

    # Session-management endpoints read this instead of re-decoding.
    request.state.session_sid = payload.get("sid")

    async with lookup_session() as db:
        user = await UserRepository(db).get_by_id(subject)
        if user is None:
            raise InvalidCredentialsError(str(subject))
        return ensure_active(user)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User | None:
    """Best-effort identity for rate limiting; None when anonymous.

    Same ephemeral-session discipline as get_current_user.
    """
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials, ACCESS_TYPE)
        subject = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        return None

    async with lookup_session() as db:
        user = await UserRepository(db).get_by_id(subject)
        if user is None:
            return None
        try:
            return ensure_active(user)
        except (
            EmailNotVerifiedError,
            AccountSuspendedError,
        ):
            # Any rejection means "no attributable caller" for budgets.
            return None


def allow_public_caching(response: Response) -> None:
    """Mark deterministic public responses as CDN/proxy-cacheable.

    Only safe for endpoints whose bodies carry no caller-specific data."""
    response.headers["Cache-Control"] = (
        f"public, max-age={settings.cache_control_max_age}"
    )


def get_language(accept_language: str | None = Header(default=None)) -> Language:
    return negotiate_language(accept_language)


def get_session_sid(request: Request) -> str | None:
    """`sid` claim of the caller's access token, stashed by
    get_current_user (declare it after in the signature); None for
    anonymous callers or tokens predating the claim."""
    return getattr(request.state, "session_sid", None)


async def rate_limit_guard(
    request: Request,
    user: User | None = Depends(get_optional_user),
) -> None:
    """Enforce the RULES entry matching the requested path, if any.

    Router-level dependency covering every endpoint at once: the ip side
    always applies, the user side once a Bearer identifies the caller.
    Endpoints without a rule fall back to the global ceiling alone.
    """
    if not settings.rate_limit_enabled:
        return
    path = match_rule(request.url.path)
    if path is None:
        return
    if RULES[path]["ip"] is not None:
        await enforce(path, "ip", client_ip(request) or "unknown")
    if user is not None and RULES[path]["user"] is not None:
        await enforce(path, "user", str(user.id))
