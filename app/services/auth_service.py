"""Authentication use case: register, login, refresh and revoke."""

from datetime import datetime, timezone

import jwt

from app.core.security import (
    REFRESH_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
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


class AuthService:
    """Issues and rotates JWT sessions on top of the user repositories."""

    def __init__(
        self,
        users: UserRepository,
        tokens: RefreshTokenRepository,
    ):
        self._users = users
        self._tokens = tokens

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
