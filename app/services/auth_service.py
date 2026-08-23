"""Authentication use case: register, login, refresh, revoke and OAuth."""

from datetime import datetime, timezone

import jwt

from app.clients.oauth import (
    OAuthGateway,
    OAuthRejectedError,
    OAuthUnavailableError,
    ProviderNotConfiguredError,
)
from app.core.exceptions import OAuthError, ServiceUnavailableError
from app.core.security import (
    REFRESH_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    verify_state_token,
)
from app.repositories.refresh_token_repository import (
    InvalidRefreshTokenError,
    RefreshTokenRepository,
)
from app.repositories.user_repository import (
    EmailAlreadyRegisteredError,
    UserRepository,
)
from app.schemas.auth import AuthSession, TokenPair, UserOut

__all__ = [
    "AuthService",
    "EmailAlreadyRegisteredError",
    "InvalidCredentialsError",
    "InvalidRefreshTokenError",
]


class InvalidCredentialsError(Exception):
    """Wrong email/password or inactive account."""


class UnknownProviderError(Exception):
    """The provider name is not one of the configured ones."""


class AuthService:
    """Issues and rotates JWT sessions on top of the user repositories."""

    def __init__(
        self,
        users: UserRepository,
        tokens: RefreshTokenRepository,
        oauth: OAuthGateway | None = None,
    ):
        self._users = users
        self._tokens = tokens
        self._oauth = oauth or OAuthGateway()

    async def register(
        self, *, email: str, password: str, full_name: str = ""
    ) -> AuthSession:
        try:
            user = await self._users.create_local(
                email=email, password=password, full_name=full_name
            )
        except EmailAlreadyRegisteredError:
            raise
        return await self._start_session(user)

    async def login(self, *, email: str, password: str) -> AuthSession:
        user = await self._users.get_by_email(email)
        if (
            user is None
            or not user.hashed_password
            or not verify_password(password, user.hashed_password)
            or not user.is_active
        ):
            raise InvalidCredentialsError(email)
        return await self._start_session(user)

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
        return await self._start_session(user)

    async def get_active_user(self, user_id: int):
        """Resolve an existing active account or fail with 401 semantics."""
        user = await self._users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise InvalidCredentialsError(user_id)
        return user

    # Internals --------------------------------------------------------------

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
