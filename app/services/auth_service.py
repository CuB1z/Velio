"""Authentication use cases: register, login, refresh, revoke, OAuth and
email verification."""

import logging
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.clients.mail import (
    MailSender,
    password_reset_email,
    verification_email,
)
from app.clients.oauth import (
    OAuthGateway,
    OAuthRejectedError,
    OAuthUnavailableError,
    ProviderNotConfiguredError,
)
from app.core.config import settings
from app.core.exceptions import (
    AccountSuspendedError,
    EmailAlreadyRegisteredError,
    EmailNotVerifiedError,
    EmailVerificationError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    NoLocalPasswordError,
    OAuthError,
    PasswordResetError,
    ServiceUnavailableError,
    UnknownProviderError,
)
from app.core.security import (
    REFRESH_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    hash_password,
    validate_password_strength,
    verify_password,
    verify_state_token,
)
from app.models import User, UserStatus
from app.repositories.refresh_token_repository import (
    RefreshTokenRepository,
    jti_digest,
)
from app.repositories.user_repository import UserRepository
from app.repositories.verification_code_repository import (
    VerificationCodeRepository,
)
from app.schemas.auth import AuthSession, TokenPair, UserOut

logger = logging.getLogger(__name__)

__all__ = ["AuthService"]

EMAIL_VERIFY_PURPOSE = "email_verify"
PASSWORD_RESET_PURPOSE = "password_reset"


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

    async def login(
        self, *, email: str, password: str, user_agent: str | None = None
    ) -> AuthSession:
        user = await self._users.get_by_email(email)
        if (
            user is None
            or not user.hashed_password
            or not verify_password(password, user.hashed_password)
        ):
            raise InvalidCredentialsError(email)
        self._require_active(user)
        return await self._start_session(user, user_agent=user_agent)

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
        user = await self._users.mark_active(user)
        await self._register_contact(user)
        return user

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

    async def forgot_password(self, *, email: str) -> bool:
        """Send a reset code to active accounts with a local credential.

        Returns whether anything was actually sent; callers answer 202
        regardless so the endpoint cannot probe registered emails.
        Pending accounts verify through the signup flow and OAuth-only
        accounts have no local credential to reset.
        """
        user = await self._users.get_by_email(email)
        if (
            user is None
            or not user.hashed_password
            or self._status_of(user) is not UserStatus.ACTIVE
        ):
            return False
        if await self._codes.find_active(
            user.id, purpose=PASSWORD_RESET_PURPOSE
        ):
            # A code is already in flight: re-sending would turn the
            # endpoint into a mail-bombing vector. The 202 stays identical.
            return False
        await self._deliver_code(
            user,
            purpose=PASSWORD_RESET_PURPOSE,
            compose=lambda code: password_reset_email(
                user.email, code, settings.otp_expire_minutes
            ),
        )
        return True

    async def reset_password(
        self, *, email: str, code: str, new_password: str
    ) -> None:
        """Confirm the emailed code, rotate the credential and force
        re-login everywhere."""
        user = await self._users.get_by_email(email)
        if user is None:
            raise PasswordResetError
        if self._status_of(user) is UserStatus.SUSPENDED:
            raise AccountSuspendedError

        stored = await self._codes.find_active(
            user.id, purpose=PASSWORD_RESET_PURPOSE
        )
        if stored is None or stored.attempts >= settings.otp_max_attempts:
            raise PasswordResetError
        if not verify_password(code, stored.code_hash):
            await self._codes.register_attempt(stored)
            raise PasswordResetError

        validate_password_strength(new_password, email=user.email)
        await self._codes.consume(stored)
        await self._users.set_password(
            user, hashed_password=hash_password(new_password)
        )
        await self._tokens.revoke_all_for_user(user.id)

    async def refresh(
        self, raw_token: str, user_agent: str | None = None
    ) -> AuthSession:
        payload = self._decode_refresh(raw_token)
        stored = await self._tokens.find_active_by_jti(payload["jti"])
        if stored is None:
            # A known-but-dead token coming back means a rotated or revoked
            # refresh was replayed — treat it as theft and kill the account's
            # live sessions. Unknown tokens just fail.
            replayed = await self._tokens.find_any_by_jti(payload["jti"])
            if replayed is not None:
                logger.warning(f"refresh replay detected for user {replayed.user_id}")
                await self._tokens.revoke_all_for_user(replayed.user_id)
            raise InvalidRefreshTokenError

        try:
            subject = uuid.UUID(payload["sub"])
        except (KeyError, ValueError) as exc:
            raise InvalidRefreshTokenError from exc
        user = await self.get_active_user(subject)

        # Rotation: the used token dies with its row; a new pair is issued.
        await self._tokens.revoke(stored)
        return await self._start_session(user, user_agent=user_agent)

    async def change_password(
        self, user_id: uuid.UUID, *, current_password: str, new_password: str
    ) -> None:
        """Rotate the local credential and force re-login everywhere.

        Every live refresh token dies with the change; access tokens
        simply run out within their short lifetime.
        """
        user = await self._users.get_by_id(user_id)
        if user is None or not user.hashed_password:
            raise NoLocalPasswordError
        if not verify_password(current_password, user.hashed_password):
            raise InvalidCredentialsError(user.email)

        validate_password_strength(new_password, email=user.email)
        await self._users.set_password(user, hashed_password=hash_password(new_password))
        await self._tokens.revoke_all_for_user(user.id)

    async def logout(self, raw_token: str) -> None:
        payload = self._decode_refresh(raw_token)
        stored = await self._tokens.find_any_by_jti(payload["jti"])
        if stored is None:
            raise InvalidRefreshTokenError
        await self._tokens.revoke(stored)

    # Sessions ---------------------------------------------------------------

    async def list_sessions(
        self, user_id: uuid.UUID, sid: str | None = None
    ) -> list[dict]:
        """Live sessions of the account, flagging the caller's own (`sid`)."""
        current_hash = jti_digest(sid) if sid else None
        return [
            {
                "id": token.id,
                "created_at": token.created_at,
                "user_agent": token.user_agent,
                "current": bool(current_hash) and token.jti_hash == current_hash,
            }
            for token in await self._tokens.list_live_for_user(user_id)
        ]

    async def revoke_session(self, user_id: uuid.UUID, session_id: int) -> bool:
        """Revoke one live session; False when it does not belong here."""
        return await self._tokens.revoke_by_id(user_id, session_id)

    async def revoke_other_sessions(
        self, user_id: uuid.UUID, sid: str | None = None
    ) -> int:
        """Revoke every live session except the caller's; all when the `sid`
        no longer matches a live row (e.g. rotated away)."""
        if sid:
            for token in await self._tokens.list_live_for_user(user_id):
                if token.jti_hash == jti_digest(sid):
                    return await self._tokens.revoke_all_for_user_except(
                        user_id, keep_id=token.id
                    )
        await self._tokens.revoke_all_for_user(user_id)
        return 0

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
        self, provider: str, code: str, state: str, user_agent: str | None = None
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

        existed = (
            await self._users.find_identity_user_id(
                identity.provider, identity.provider_user_id
            )
            is not None
        )
        user = await self._users.get_or_create_oauth(
            provider=identity.provider,
            provider_user_id=identity.provider_user_id,
            email=identity.email,
            full_name=identity.full_name,
        )
        # A provider-validated mailbox proves ownership of a pending
        # local account created with the same address.
        activated = False
        if self._status_of(user) is UserStatus.PENDING:
            user = await self._users.mark_active(user)
            activated = True
        # Contact filing happens once, when the account is born or
        # activated — never on routine logins.
        if not existed or activated:
            await self._register_contact(user)
        return await self._start_session(user, user_agent=user_agent)

    async def get_active_user(self, user_id: uuid.UUID):
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
        await self._deliver_code(
            user,
            purpose=EMAIL_VERIFY_PURPOSE,
            compose=lambda code: verification_email(
                user.email, code, settings.otp_expire_minutes
            ),
        )

    async def _deliver_code(self, user, *, purpose: str, compose) -> None:
        """Store a fresh hashed OTP and hand the composed message to the
        sender.

        Delivery problems are logged and swallowed: the account exists
        and the client can always ask for a resend.
        """
        code = generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.otp_expire_minutes
        )
        await self._codes.issue(
            user.id, purpose=purpose, code=code, expires_at=expires_at
        )

        try:
            if self._mail is not None:
                await self._mail.send(compose(code))
        except Exception as exc:  # noqa: BLE001 - delivery must not fail auth
            logger.warning(f"{purpose} email to {user.email} failed: {exc}")

    async def _register_contact(self, user) -> None:
        """File the verified rider into the Brevo list; never fatal."""
        try:
            if self._mail is not None:
                await self._mail.add_contact(user.email, user.full_name)
        except Exception as exc:  # noqa: BLE001 - CRM sync must not fail auth
            logger.warning(f"contact sync for {user.email} failed: {exc}")

    async def _start_session(
        self, user, user_agent: str | None = None
    ) -> AuthSession:
        """Issue a token pair; the access token carries the refresh's jti as
        `sid` so endpoints can tell the caller's session apart."""
        # Refresh first: its jti becomes the access token's session id.
        refresh, jti = create_refresh_token(user.id)
        access = create_access_token(user.id, user.email, sid=jti)

        payload = decode_token(refresh, REFRESH_TYPE)
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        await self._tokens.store(
            user.id,
            jti,
            expires_at,
            user_agent=user_agent[:256] if user_agent else None,
        )

        return AuthSession(
            user=UserOut.from_model(user),
            tokens=TokenPair(access_token=access, refresh_token=refresh),
        )

    def _decode_refresh(self, raw_token: str) -> dict:
        try:
            return decode_token(raw_token, REFRESH_TYPE)
        except jwt.PyJWTError as exc:
            raise InvalidRefreshTokenError from exc
