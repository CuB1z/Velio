"""Authentication endpoints: local register/login plus refresh/logout.

OAuth providers (Google/Strava) will reuse the same session issuance
through `UserRepository.get_or_create_oauth` once app credentials exist.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_auth_service, get_current_user
from app.services.auth_service import AuthService
from app.repositories.user_repository import EmailAlreadyRegisteredError
from app.schemas.auth import AuthSession, LoginIn, RefreshIn, RegisterIn, UserOut
from app.services.auth_service import InvalidCredentialsError, InvalidRefreshTokenError

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
