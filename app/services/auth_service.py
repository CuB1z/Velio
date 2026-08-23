"""Authentication use cases: register, login, refresh, revoke, OAuth and
email verification."""

from datetime import datetime, timedelta, timezone

import jwt

from app.clients.mail import MailSender, verification_email
from app.clients.oauth import (
    OAuthGateway,
    OAuthRejectedError,
    OAuthUnavailableError,
    ProviderNotConfiguredError,
)
from app.core.config import settings
from app.core.exceptions import (
    AccountSuspendedError,
    EmailNotVerifiedError,
    EmailVerificationError,
    OAuthError,
    ServiceUnavailableError,
)
from app.core.logging import get_logger
from app.core.security import (
    REFRESH_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    verify_password,
    verify_state_token,
)
from app.models import User, UserStatus
from app.repositories.refresh_token_repository import (
    InvalidRefreshTokenError,
    RefreshTokenRepository,
)
from app.repositories.user_repository import (
    EmailAlreadyRegisteredError,
    UserRepository,
)
from app.repositories.verification_code_repository import (
    VerificationCodeRepository,
)
from app.schemas.auth import AuthSession, TokenPair, UserOut

logger = get_logger("auth")

__all__ = [
    "AuthService",
    "EmailAlreadyRegisteredError",
    "InvalidCredentialsError",
    "InvalidRefreshTokenError",
]

EMAIL_VERIFY_PURPOSE = "email_verify"


class InvalidCredentialsError(Exception):
    """Wrong email/password."""


class UnknownProviderError(Exception):
    """The provider name is not one of the configured ones."""


class AuthService:
    """Issues and rotates JWT sessions on top of the user repositories."""

    def __init__(
        self,
        users: UserRepository,
        tokens: RefreshTokenRepository,
        codes: VerificationCodeRepository,
        oauth: OAuthGateway | None = None,
        mail: MailSender | None = None,
    ):
        self._users = users
        self._tokens = tokens
        self._codes = codes
        self._oauth = oauth or OAuthGateway()
        self._mail = mail

    async def register(
        self, *, email: str, password: str, full_name: str = ""
    ) -> User:
        """Create a pending account and deliver its verification code.

        No session is issued: the account activates once the emailed
        code is confirmed. Mail failures are logged, never raised.
        """
        try:
            user = await self._users.create_local(
                email=email, password=password, full_name=full_name
            )
        except EmailAlreadyRegisteredError:
            raise
        await self._send_verification_code(user)
        return user

    async def login(self, *, email: str, password: str) -> AuthSession:
        user = await self._users.get_by_email(email)
        if (
            user is None
            or not user.hashed_password
            or not verify_password(password, user.hashed_password)
        ):
            raise InvalidCredentialsError(email)
        self._require_active(user)
        return await self._start_session(user)

    async def verify_email(self, *, email: str, code: str) -> User:
        """Confirm the emailed code and activate the account."""
        user = await self._users.get_by_email(email)
        if user is None:
            raise EmailVerificationError
        status = self._status_of(user)
        if status is UserStatus.ACTIVE:
            return user  # Already confirmed: keep the endpoint idempotent.
        if status is UserStatus.SUSPENDED:
            raise AccountSuspendedError

        stored = await self._codes.find_active(user.id, purpose=EMAIL_VERIFY_PURPOSE)
        if stored is None or stored.attempts >= settings.otp_max_attempts:
            raise EmailVerificationError
        if not verify_password(code, stored.code_hash):
            await self._codes.register_attempt(stored)
            raise EmailVerificationError

        await self._codes.consume(stored)
        return await self._users.mark_active(user)

    async def resend_verification(self, *, email: str) -> bool:
        """Re-issue and send a code; report whether one was actually sent.

        Callers answer 202 regardless so the endpoint cannot probe which
        emails are registered.
        """
        user = await self._users.get_by_email(email)
        if user is None or self._status_of(user) is not UserStatus.PENDING:
            return False
        await self._send_verification_code(user)
        return True

    async def refresh(self, raw_token: str) -> AuthSession:
        payload = self._decode_refresh(raw_token)
        stored = await self._tokens.find_active_by_jti(payload["jti"])
        if stored is None:
            raise InvalidRefreshTokenError

        user = await self.get_active_user(int(payload["sub"]))

        # Rotation: the used token dies with its row; a new pair is issued.
        await self._tokens.revoke(stored)
        return await self._start_session(user)

    async def logout(self, raw_token: str) -> None:
        payload = self._decode_refresh(raw_token)
        stored = await self._tokens.find_any_by_jti(payload["jti"])
        if stored is None:
            raise InvalidRefreshTokenError
        await self._tokens.revoke(stored)

    # OAuth ------------------------------------------------------------------

    def authorize_url(self, provider: str) -> tuple[str, str]:
        """Return (authorize_url, state) for the provider round trip."""
        try:
            return self._oauth.authorize_url(provider)
        except KeyError as exc:
            raise UnknownProviderError(provider) from exc
        except ProviderNotConfiguredError as exc:
            raise ServiceUnavailableError(str(exc)) from exc

    async def oauth_login(
        self, provider: str, code: str, state: str
    ) -> AuthSession:
        """Complete the round trip and open (or reuse) the account."""
        try:
            verify_state_token(state, provider)
        except jwt.PyJWTError as exc:
            raise OAuthError("invalid or expired state") from exc

        redirect_uri = self._oauth.redirect_uri(provider)
        try:
            identity = await self._oauth.exchange(
                provider, code, redirect_uri
            )
        except OAuthRejectedError as exc:
            raise OAuthError(str(exc)) from exc
        except OAuthUnavailableError as exc:
            raise ServiceUnavailableError(f"{provider} unavailable: {exc}") from exc

        user = await self._users.get_or_create_oauth(
            provider=identity.provider,
            provider_user_id=identity.provider_user_id,
            email=identity.email,
            full_name=identity.full_name,
        )
        # A provider-validated mailbox proves ownership of a pending
        # local account created with the same address.
        if self._status_of(user) is UserStatus.PENDING:
            user = await self._users.mark_active(user)
        return await self._start_session(user)

    async def get_active_user(self, user_id: int):
        """Resolve an existing active account or fail with 401 semantics."""
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise InvalidCredentialsError(user_id)
        self._require_active(user)
        return user

    # Internals --------------------------------------------------------------

    @staticmethod
    def _status_of(user) -> UserStatus:
        return UserStatus(getattr(user.status, "value", user.status))

    def _require_active(self, user) -> None:
        """Only ACTIVE accounts may open or refresh sessions."""
        status = self._status_of(user)
        if status is UserStatus.PENDING:
            raise EmailNotVerifiedError
        if status is UserStatus.SUSPENDED:
            raise AccountSuspendedError

    async def _send_verification_code(self, user) -> None:
        """Store a fresh hashed OTP and hand the raw code to the sender.

        Delivery problems are logged and swallowed: the account exists
        and the client can always ask for a resend.
        """
        code = generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.otp_expire_minutes
        )
        await self._codes.issue(
            user.id, purpose=EMAIL_VERIFY_PURPOSE, code=code, expires_at=expires_at
        )

        message = verification_email(user.email, code, settings.otp_expire_minutes)
        try:
            if self._mail is not None:
                await self._mail.send(message)
        except Exception as exc:  # noqa: BLE001 - delivery must not fail auth
            logger.warning(f"verification email to {user.email} failed: {exc}")

    async def _start_session(self, user) -> AuthSession:
        access = create_access_token(user.id, user.email)
        refresh, jti = create_refresh_token(user.id)

        payload = decode_token(refresh, REFRESH_TYPE)
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        await self._tokens.store(user.id, jti, expires_at)

        return AuthSession(
            user=UserOut.from_model(user),
            tokens=TokenPair(access_token=access, refresh_token=refresh),
        )

    def _decode_refresh(self, raw_token: str) -> dict:
        try:
            return decode_token(raw_token, REFRESH_TYPE)
        except jwt.PyJWTError as exc:
            raise InvalidRefreshTokenError from exc
