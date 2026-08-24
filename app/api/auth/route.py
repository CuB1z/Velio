"""Authentication endpoints: local credentials, email verification and
OAuth round trips."""


from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app.api.dependencies import (
    get_auth_service,
    get_current_user,
    get_session_sid,
)
from app.core.exceptions import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    NoLocalPasswordError,
    OAuthError,
    ServiceUnavailableError,
    UnknownProviderError,
)
from app.schemas.auth import (
    AuthSession,
    ChangePasswordIn,
    ForgotPasswordIn,
    LoginIn,
    RefreshIn,
    RegisterIn,
    ResendVerificationIn,
    ResetPasswordIn,
    SessionOut,
    UserOut,
    VerifyIn,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register", response_model=UserOut, status_code=status.HTTP_201_CREATED
)
async def register(data: RegisterIn, service: AuthService = Depends(get_auth_service)) -> UserOut:
    """Create a pending account; the verification code arrives by email."""
    try:
        user = await service.register(
            email=data.email, password=data.password, full_name=data.full_name
        )
    except EmailAlreadyRegisteredError:
        raise HTTPException(status_code=409, detail="Email already registered")
    return UserOut.from_model(user)


@router.post("/verify", response_model=UserOut)
async def verify_email(
    data: VerifyIn, service: AuthService = Depends(get_auth_service)
) -> UserOut:
    """Confirm the emailed code and activate the account."""
    user = await service.verify_email(email=data.email, code=data.code)
    return UserOut.from_model(user)


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
async def resend_verification(
    data: ResendVerificationIn, service: AuthService = Depends(get_auth_service)
) -> dict:
    """Always 202 so the endpoint cannot probe registered emails."""
    await service.resend_verification(email=data.email)
    return {"detail": "If the account is pending, a new code was sent"}


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    data: ForgotPasswordIn, service: AuthService = Depends(get_auth_service)
) -> dict:
    """Always 202 so the endpoint cannot probe registered emails."""
    await service.forgot_password(email=data.email)
    return {"detail": "If the account exists, a reset code was sent"}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    data: ResetPasswordIn, service: AuthService = Depends(get_auth_service)
) -> None:
    """Swap the credential for a new one; every live session is revoked."""
    await service.reset_password(
        email=data.email, code=data.code, new_password=data.new_password
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: ChangePasswordIn,
    current_user=Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> None:
    """Rotate the local credential; every live session is revoked."""
    try:
        await service.change_password(
            current_user.id,
            current_password=data.current_password,
            new_password=data.new_password,
        )
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    except NoLocalPasswordError:
        raise HTTPException(status_code=400, detail="This account has no local password")


@router.post("/login", response_model=AuthSession)
async def login(
    data: LoginIn, request: Request, service: AuthService = Depends(get_auth_service)
) -> AuthSession:
    try:
        return await service.login(
            email=data.email,
            password=data.password,
            user_agent=request.headers.get("user-agent"),
        )
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/refresh", response_model=AuthSession)
async def refresh_tokens(
    data: RefreshIn, request: Request, service: AuthService = Depends(get_auth_service)
) -> AuthSession:
    try:
        return await service.refresh(
            data.refresh_token, user_agent=request.headers.get("user-agent")
        )
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
    request: Request,
    service: AuthService = Depends(get_auth_service),
) -> AuthSession:
    """Exchange the authorization code for this app's session tokens."""
    try:
        return await service.oauth_login(
            provider, code, state, user_agent=request.headers.get("user-agent")
        )
    except UnknownProviderError:
        raise HTTPException(status_code=404, detail="Unknown provider")
    except OAuthError:
        raise
    except ServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc.detail or exc.message))


# Session management ---------------------------------------------------------


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    current_user=Depends(get_current_user),
    sid: str | None = Depends(get_session_sid),
    service: AuthService = Depends(get_auth_service),
) -> list[SessionOut]:
    """Live sessions of the account; `current` marks the caller's own."""
    return await service.list_sessions(current_user.id, sid)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user=Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> None:
    """Revoke one live session of the account."""
    if not await service.revoke_session(current_user.id, session_id):
        raise HTTPException(status_code=404, detail="Session not found")


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT)
async def delete_other_sessions(
    current_user=Depends(get_current_user),
    sid: str | None = Depends(get_session_sid),
    service: AuthService = Depends(get_auth_service),
) -> None:
    """Log out everywhere except the device making the call."""
    await service.revoke_other_sessions(current_user.id, sid)
