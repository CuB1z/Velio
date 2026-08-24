"""OAuth round trips: authorize redirect and callback login."""

import logging

import jwt

from app.clients.mail import MailSender
from app.clients.oauth import (
    OAuthGateway,
    OAuthRejectedError,
    OAuthUnavailableError,
    ProviderNotConfiguredError,
)
from app.core.exceptions import (
    OAuthError,
    ServiceUnavailableError,
    UnknownProviderError,
)
from app.core.security import verify_state_token
from app.models import UserStatus
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthSession

from .account_service import register_brevo_contact, status_of
from .session_service import SessionService

logger = logging.getLogger(__name__)

__all__ = ["OAuthService"]


class OAuthService:
    """Completes provider round trips and opens (or reuses) accounts."""

    def __init__(
        self,
        users: UserRepository,
        sessions: SessionService,
        mail: MailSender | None = None,
        oauth: OAuthGateway | None = None,
    ):
        self._users = users
        self._sessions = sessions
        self._mail = mail
        self._oauth = oauth or OAuthGateway()

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
        if status_of(user) is UserStatus.PENDING:
            user = await self._users.mark_active(user)
            activated = True
        # Contact filing happens once, when the account is born or
        # activated — never on routine logins.
        if not existed or activated:
            await register_brevo_contact(self._mail, user)
        return await self._sessions.open_session(user, user_agent=user_agent)
