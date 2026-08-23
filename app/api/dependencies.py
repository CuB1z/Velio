"""FastAPI dependency providers."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.mail import MailSender, build_mail_sender
from app.clients.oauth import OAuthGateway
from app.clients.valhalla import ValhallaClient
from app.core.database import get_db
from app.core.exceptions import AccountSuspendedError, EmailNotVerifiedError
from app.core.exceptions import InvalidCredentialsError
from app.core.security import ACCESS_TYPE, decode_token
from app.engine.dem import DemSource
from app.models import User
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.repositories.verification_code_repository import (
    VerificationCodeRepository,
)
from app.services.analysis_service import RouteAnalysisService
from app.services.auth_service import AuthService
from app.services.loop_service import LoopService
from app.services.route_service import RouteService

_bearer = HTTPBearer(auto_error=False)


# Shared singletons ----------------------------------------------------------


def get_valhalla_client(request: Request) -> ValhallaClient:
    """Shared Valhalla client created at startup."""
    return request.app.state.valhalla


def get_dem_source(request: Request) -> DemSource:
    """Shared DEM source created at startup."""
    return request.app.state.dem


# Repositories ---------------------------------------------------------------


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


def get_mail_sender(request: Request) -> MailSender:
    """Shared mail adapter; built lazily when lifespan has not run."""
    if not hasattr(request.app.state, "mail"):
        request.app.state.mail = build_mail_sender()
    return request.app.state.mail


# Services -------------------------------------------------------------------


def get_oauth_gateway() -> OAuthGateway:
    """Gateway performing the OAuth provider round trips."""
    return OAuthGateway()


def get_auth_service(
    users: UserRepository = Depends(get_user_repository),
    tokens: RefreshTokenRepository = Depends(get_refresh_token_repository),
    codes: VerificationCodeRepository = Depends(get_verification_code_repository),
    oauth: OAuthGateway = Depends(get_oauth_gateway),
    mail: MailSender = Depends(get_mail_sender),
) -> AuthService:
    """Compose the auth service on top of its repositories and gateways."""
    return AuthService(
        users=users, tokens=tokens, codes=codes, oauth=oauth, mail=mail
    )


def get_loop_service(
    valhalla: ValhallaClient = Depends(get_valhalla_client),
    dem: DemSource = Depends(get_dem_source),
) -> LoopService:
    """Compose the shared client and DEM source into the loop service."""
    return LoopService(valhalla=valhalla, dem=dem)


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


# Authentication -------------------------------------------------------------


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    auth: AuthService = Depends(get_auth_service),
) -> User:
    """Resolve the user behind a valid Bearer access token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(credentials.credentials, ACCESS_TYPE)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    try:
        return await auth.get_active_user(int(payload["sub"]))
    except (
        InvalidCredentialsError,
        EmailNotVerifiedError,
        AccountSuspendedError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
