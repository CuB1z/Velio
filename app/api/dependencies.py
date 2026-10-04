"""FastAPI dependency providers."""

import uuid

import jwt
from fastapi import Depends, Request, Response
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
from app.core.ratelimit import RULES, client_ip, enforce, match_rule
from app.core.security import ACCESS_TYPE, decode_token
from app.engine.dem import DemSource
from app.engine.restricted import RestrictedAreas
from app.models import User
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.saved_route_repository import SavedRouteRepository
from app.repositories.user_repository import UserRepository
from app.repositories.verification_code_repository import VerificationCodeRepository
from app.services.account_service import AccountService, ensure_active
from app.services.analysis_service import RouteAnalysisService
from app.services.loop_service import LoopService
from app.services.oauth_service import OAuthService
from app.services.route_service import RouteService
from app.services.saved_route_service import SavedRouteService
from app.services.session_service import SessionService

_bearer = HTTPBearer(auto_error=False)


# Shared singletons ----------------------------------------------------------


def get_valhalla_client(request: Request) -> ValhallaClient:
    """Shared Valhalla client created at startup."""
    return request.app.state.valhalla


def get_dem_source(request: Request) -> DemSource:
    """Shared DEM source created at startup."""
    return request.app.state.dem


def get_restricted_areas(request: Request) -> RestrictedAreas:
    """Restricted areas loaded at startup."""
    return request.app.state.restricted


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


def get_mail_sender(request: Request) -> MailSender:
    """Shared mail adapter; built lazily when lifespan has not run."""
    if not hasattr(request.app.state, "mail"):
        request.app.state.mail = build_mail_sender()
    return request.app.state.mail


# Services -------------------------------------------------------------------


def get_oauth_gateway() -> OAuthGateway:
    """Gateway performing the OAuth provider round trips."""
    return OAuthGateway()


def get_account_service(
    users: UserRepository = Depends(get_user_repository),
    codes: VerificationCodeRepository = Depends(get_verification_code_repository),
    tokens: RefreshTokenRepository = Depends(get_refresh_token_repository),
    mail: MailSender = Depends(get_mail_sender),
) -> AccountService:
    """Compose the account lifecycle service (OTP + credentials)."""
    return AccountService(users=users, codes=codes, tokens=tokens, mail=mail)


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
) -> LoopService:
    """Compose the shared client, DEM source and restricted areas."""
    return LoopService(valhalla=valhalla, dem=dem, restricted=restricted)


def get_route_service(
    valhalla: ValhallaClient = Depends(get_valhalla_client),
    dem: DemSource = Depends(get_dem_source),
) -> RouteService:
    """Compose the shared client and DEM source into the route service."""
    return RouteService(valhalla=valhalla, dem=dem)


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
