"""Auth endpoints: local credentials, email verification, OAuth and sessions.

Errors reach the central handler untranslated, except in the OAuth callback.
"""


from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import RedirectResponse

from app.core.config import settings

from app.api.dependencies import (
    get_account_service,
    get_current_user,
    get_oauth_service,
    get_session_service,
    get_session_sid,
)
from app.core.exceptions import AppError, NotFoundError
from app.mappers.user import UserMapper
from app.schemas.auth import (
    AuthSession,
    ChangePasswordRequest,
    DeleteAccountRequest,
    DeleteRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SessionResponse,
    UserResponse,
    VerifyRequest,
)
from app.services.account_service import AccountService
from app.services.oauth_service import OAuthService
from app.services.session_service import SessionService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    data: RegisterRequest,
    service: AccountService = Depends(get_account_service),
) -> UserResponse:
    """Create a pending account; the verification code arrives by email."""
    user = await service.register(
        email=data.email, password=data.password, full_name=data.full_name
    )
    return UserMapper.out(user)


@router.post("/verify", response_model=UserResponse)
async def verify_email(
    data: VerifyRequest, service: AccountService = Depends(get_account_service)
) -> UserResponse:
    """Confirm the emailed code and activate the account."""
    user = await service.verify_email(email=data.email, code=data.code)
    return UserMapper.out(user)


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
async def resend_verification(
    data: ResendVerificationRequest,
    service: AccountService = Depends(get_account_service),
) -> dict:
    """Always 202 so the endpoint cannot probe registered emails."""
    await service.resend_verification(email=data.email)
    return {"detail": "If the account is pending, a new code was sent"}


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    data: ForgotPasswordRequest, service: AccountService = Depends(get_account_service)
) -> dict:
    """Always 202 so the endpoint cannot probe registered emails."""
    await service.forgot_password(email=data.email)
    return {"detail": "If the account exists, a reset code was sent"}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    data: ResetPasswordRequest, service: AccountService = Depends(get_account_service)
) -> None:
    """Swap the credential for a new one; every live session is revoked."""
    await service.reset_password(
        email=data.email, code=data.code, new_password=data.new_password
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    service: AccountService = Depends(get_account_service),
) -> None:
    """Rotate the local credential; every live session is revoked."""
    await service.change_password(
        current_user.id,
        current_password=data.current_password,
        new_password=data.new_password,
    )


@router.post("/login", response_model=AuthSession)
async def login(
    data: LoginRequest,
    request: Request,
    service: SessionService = Depends(get_session_service),
) -> AuthSession:
    return await service.login(
        email=data.email,
        password=data.password,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/refresh", response_model=AuthSession)
async def refresh_tokens(
    data: RefreshRequest,
    request: Request,
    service: SessionService = Depends(get_session_service),
) -> AuthSession:
    return await service.refresh(
        data.refresh_token, user_agent=request.headers.get("user-agent")
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    data: RefreshRequest, service: SessionService = Depends(get_session_service)
) -> None:
    await service.logout(data.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)) -> UserResponse:
    return UserMapper.out(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdateRequest,
    current_user=Depends(get_current_user),
    service: AccountService = Depends(get_account_service),
) -> UserResponse:
    user = await service.update_profile(current_user.id, full_name=data.full_name)
    return UserMapper.out(user)


@router.post("/me/delete-request", status_code=status.HTTP_202_ACCEPTED)
async def request_account_deletion(
    _body: DeleteRequest,
    current_user=Depends(get_current_user),
    service: AccountService = Depends(get_account_service),
) -> None:
    """Issue a deletion code via email; always 202."""
    await service.request_account_deletion(current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    data: DeleteAccountRequest,
    current_user=Depends(get_current_user),
    service: AccountService = Depends(get_account_service),
) -> None:
    """Confirm the deletion code and permanently remove the account."""
    await service.confirm_account_deletion(current_user, code=data.code)


# OAuth round trips ----------------------------------------------------------


@router.get("/{provider}/authorize")
async def oauth_authorize(
    provider: str,
    service: OAuthService = Depends(get_oauth_service),
) -> RedirectResponse:
    """Send the client to the provider consent screen."""
    url, _ = service.authorize_url(provider)
    return RedirectResponse(url, status_code=307)


def _spa_redirect(target: str, params: dict[str, str]) -> RedirectResponse:
    """Hand the outcome to a browser app through the URL fragment.

    Fragments never reach a server, so tokens stay out of logs and Referer.
    """
    return RedirectResponse(f"{target}#{urlencode(params)}", status_code=303)


@router.get("/{provider}/callback", response_model=AuthSession)
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    request: Request,
    service: OAuthService = Depends(get_oauth_service),
) -> AuthSession | RedirectResponse:
    """Exchange the authorization code for this app's session tokens.

    With OAUTH_SUCCESS_REDIRECT set, redirects there with the outcome in the
    fragment (an SPA cannot read a JSON body it navigated to); otherwise
    returns the session as JSON.
    """
    target = settings.oauth_success_redirect
    user_agent = request.headers.get("user-agent")

    try:
        session = await service.oauth_login(
            provider, code, state, user_agent=user_agent
        )
    except AppError as exc:
        # A browser mid-navigation would be stranded on the raw JSON envelope.
        if not target:
            raise
        return _spa_redirect(target, {"error": exc.error_code, "message": str(exc)})

    if not target:
        return session

    return _spa_redirect(
        target,
        {
            "access_token": session.tokens.access_token,
            "refresh_token": session.tokens.refresh_token,
            "token_type": "bearer",
        },
    )


# Session management ---------------------------------------------------------


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    current_user=Depends(get_current_user),
    sid: str | None = Depends(get_session_sid),
    service: SessionService = Depends(get_session_service),
) -> list[SessionResponse]:
    """Live sessions of the account; `current` marks the caller's own."""
    return await service.list_sessions(current_user.id, sid)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user=Depends(get_current_user),
    service: SessionService = Depends(get_session_service),
) -> None:
    """Revoke one live session of the account."""
    if not await service.revoke_session(current_user.id, session_id):
        raise NotFoundError("Session not found")


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT)
async def delete_other_sessions(
    current_user=Depends(get_current_user),
    sid: str | None = Depends(get_session_sid),
    service: SessionService = Depends(get_session_service),
) -> None:
    """Log out everywhere except the device making the call."""
    await service.revoke_other_sessions(current_user.id, sid)
