"""Authentication endpoints: local credentials plus OAuth round trips."""


from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from app.api.dependencies import get_auth_service, get_current_user
from app.core.exceptions import ServiceUnavailableError
from app.core.exceptions import OAuthError
from app.repositories.user_repository import EmailAlreadyRegisteredError
from app.schemas.auth import AuthSession, LoginIn, RefreshIn, RegisterIn, UserOut
from app.services.auth_service import (
    AuthService,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    OAuthError,
    UnknownProviderError,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register", response_model=AuthSession, status_code=status.HTTP_201_CREATED
)
async def register(data: RegisterIn, service: AuthService = Depends(get_auth_service)) -> AuthSession:
    try:
        return await service.register(
            email=data.email, password=data.password, full_name=data.full_name
        )
    except EmailAlreadyRegisteredError:
        raise HTTPException(status_code=409, detail="Email already registered")


@router.post("/login", response_model=AuthSession)
async def login(data: LoginIn, service: AuthService = Depends(get_auth_service)) -> AuthSession:
    try:
        return await service.login(email=data.email, password=data.password)
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/refresh", response_model=AuthSession)
async def refresh_tokens(data: RefreshIn, service: AuthService = Depends(get_auth_service)) -> AuthSession:
    try:
        return await service.refresh(data.refresh_token)
    except InvalidRefreshTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: RefreshIn, service: AuthService = Depends(get_auth_service)) -> None:
    try:
        await service.logout(data.refresh_token)
    except InvalidRefreshTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.get("/me", response_model=UserOut)
async def me(current_user=Depends(get_current_user)) -> UserOut:
    return UserOut.from_model(current_user)


# OAuth round trips ----------------------------------------------------------


@router.get("/{provider}/authorize")
async def oauth_authorize(
    provider: str,
    service: AuthService = Depends(get_auth_service),
) -> RedirectResponse:
    """Send the client to the provider consent screen."""
    try:
        url, _ = service.authorize_url(provider)
    except UnknownProviderError as exc:
        raise HTTPException(status_code=404, detail="Unknown provider") from exc
    return RedirectResponse(url, status_code=307)


@router.get("/{provider}/callback", response_model=AuthSession)
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    service: AuthService = Depends(get_auth_service),
) -> AuthSession:
    """Exchange the authorization code for this app's session tokens."""
    try:
        return await service.oauth_login(provider, code, state)
    except UnknownProviderError:
        raise HTTPException(status_code=404, detail="Unknown provider")
    except OAuthError:
        raise
    except ServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc.detail or exc.message))
