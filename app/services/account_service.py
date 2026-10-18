"""Account lifecycle: registration, email OTP verification and local
credential management (change / forgot / reset)."""

import logging
import uuid
from datetime import datetime, timedelta, UTC

from app.clients.mail import (
    MailSender,
    account_delete_email,
    password_reset_email,
    verification_email,
)
from app.core.config import settings
from app.core.exceptions import (
    AccountDeletionError,
    AccountSuspendedError,
    EmailNotVerifiedError,
    EmailVerificationError,
    InvalidCredentialsError,
    NoLocalPasswordError,
    NotFoundError,
    PasswordResetError,
)
from app.core.security import (
    generate_otp,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.models import User, UserStatus
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.repositories.verification_code_repository import (
    VerificationCodeRepository,
)

logger = logging.getLogger(__name__)

__all__ = ["AccountService", "ensure_active", "register_brevo_contact", "status_of"]

EMAIL_VERIFY_PURPOSE = "email_verify"
PASSWORD_RESET_PURPOSE = "password_reset"
ACCOUNT_DELETE_PURPOSE = "account_delete"


def ensure_active(user) -> User:
    """ACTIVE-only gate shared by auth flows and bearer dependencies.

    Raises the envelope errors: 403 for pending or suspended accounts.
    """
    status = status_of(user)
    if status is UserStatus.PENDING:
        raise EmailNotVerifiedError
    if status is UserStatus.SUSPENDED:
        raise AccountSuspendedError
    return user


def status_of(user) -> UserStatus:
    """Normalize the row value into the enum."""
    return UserStatus(getattr(user.status, "value", user.status))


async def register_brevo_contact(mail: MailSender | None, user) -> None:
    """File the verified rider into the Brevo list; never fatal."""
    try:
        if mail is not None:
            await mail.add_contact(user.email, user.full_name)
    except Exception as exc:  # noqa: BLE001 - CRM sync must not fail auth
        logger.warning(f"contact sync for {user.email} failed: {exc}")


class AccountService:
    """Owns everything that verifies or rotates an account's secrets."""

    def __init__(
        self,
        users: UserRepository,
        codes: VerificationCodeRepository,
        tokens: RefreshTokenRepository,
        mail: MailSender | None = None,
    ):
        self._users = users
        self._codes = codes
        self._tokens = tokens
        self._mail = mail

    async def register(
        self, *, email: str, password: str, full_name: str = ""
    ) -> User:
        """Create a pending account and deliver its verification code.

        No session is issued: the account activates once the emailed
        code is confirmed. Mail failures are logged, never raised.
        """
        user = await self._users.create_local(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
        )
        await self._send_verification_code(user)
        return user

    async def verify_email(self, *, email: str, code: str) -> User:
        """Confirm the emailed code and activate the account."""
        user = await self._users.get_by_email(email)
        if user is None:
            raise EmailVerificationError
        if status_of(user) is UserStatus.ACTIVE:
            return user  # Already confirmed: keep the endpoint idempotent.
        if status_of(user) is UserStatus.SUSPENDED:
            raise AccountSuspendedError

        stored = await self._codes.find_active(user.id, purpose=EMAIL_VERIFY_PURPOSE)
        if stored is None or stored.attempts >= settings.otp_max_attempts:
            raise EmailVerificationError
        if not settings.otp_test_mode_active and not verify_password(
            code, stored.code_hash
        ):
            await self._codes.register_attempt(stored)
            raise EmailVerificationError

        await self._codes.consume(stored)
        user = await self._users.mark_active(user)
        await register_brevo_contact(self._mail, user)
        return user

    async def resend_verification(self, *, email: str) -> bool:
        """Re-issue and send a code; report whether one was actually sent.

        Callers answer 202 regardless so the endpoint cannot probe which
        emails are registered.
        """
        user = await self._users.get_by_email(email)
        if user is None or status_of(user) is not UserStatus.PENDING:
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
            or status_of(user) is not UserStatus.ACTIVE
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
        if status_of(user) is UserStatus.SUSPENDED:
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
        await self._users.set_password(
            user, hashed_password=hash_password(new_password)
        )
        await self._tokens.revoke_all_for_user(user.id)

    async def update_profile(self, user_id: uuid.UUID, *, full_name: str) -> User:
        """Change the display name; the schema has already tidied it."""
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")
        ensure_active(user)
        await self._users.set_full_name(user, full_name=full_name)
        return user

    # GDPR deletion ------------------------------------------------------------

    async def request_account_deletion(self, user) -> None:
        """Issue a deletion code via email.

        Always sends an OTP regardless of login method (password or OAuth).
        This ensures account deletion always requires email access, protecting
        against credential theft. Mail failures are swallowed.
        """
        await self._deliver_code(
            user,
            purpose=ACCOUNT_DELETE_PURPOSE,
            compose=lambda code: account_delete_email(
                user.email, code, settings.otp_expire_minutes
            ),
        )

    async def confirm_account_deletion(self, user, *, code: str) -> None:
        """Validate the deletion code and hard-delete the account.

        Revokes all sessions, removes the Brevo contact, then deletes the
        user row (cascades to identities, tokens, codes and saved routes).
        """
        stored = await self._codes.find_active(
            user.id, purpose=ACCOUNT_DELETE_PURPOSE
        )
        if stored is None or stored.attempts >= settings.otp_max_attempts:
            raise AccountDeletionError
        if not settings.otp_test_mode_active and not verify_password(
            code, stored.code_hash
        ):
            await self._codes.register_attempt(stored)
            raise AccountDeletionError

        await self._codes.consume(stored)
        await self._tokens.revoke_all_for_user(user.id)
        try:
            if self._mail is not None:
                await self._mail.delete_contact(user.email)
        except Exception as exc:  # noqa: BLE001 - CRM failure must not block deletion
            logger.warning(f"contact deletion for {user.email} failed: {exc}")
        await self._users.delete(user)

    # Internals --------------------------------------------------------------

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
        expires_at = datetime.now(UTC) + timedelta(
            minutes=settings.otp_expire_minutes
        )
        await self._codes.issue(
            user.id,
            purpose=purpose,
            code_hash=hash_password(code),
            expires_at=expires_at,
        )

        if settings.otp_test_mode_active:
            # Codes exist but are never delivered; any value verifies.
            logger.info(f"{purpose} test-mode code for {user.email}: {code}")
            return

        try:
            if self._mail is not None:
                await self._mail.send(compose(code))
        except Exception as exc:  # noqa: BLE001 - delivery must not fail auth
            logger.warning(f"{purpose} email to {user.email} failed: {exc}")
