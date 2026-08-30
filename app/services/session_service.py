"""Session lifecycle: login, refresh rotation with theft detection,
logout and per-device session management."""

import logging
import uuid
from datetime import datetime, UTC

import jwt

from app.core.exceptions import (
    InvalidCredentialsError,
    InvalidRefreshTokenError,
)
from app.core.security import (
    REFRESH_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.mappers.user import UserMapper
from app.repositories.refresh_token_repository import (
    RefreshTokenRepository,
    jti_digest,
)
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthSession, SessionResponse, TokenPair

from .account_service import ensure_active

logger = logging.getLogger(__name__)

__all__ = ["SessionService"]


class SessionService:
    """Everything that mints, rotates or revokes a token pair."""

    def __init__(
        self,
        users: UserRepository,
        tokens: RefreshTokenRepository,
    ):
        self._users = users
        self._tokens = tokens

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
        ensure_active(user)
        return await self.open_session(user, user_agent=user_agent)

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
        user = await self._users.get_by_id(subject)
        if user is None:
            raise InvalidCredentialsError(str(subject))
        ensure_active(user)

        # Rotation: the used token dies with its row; a new pair is issued.
        await self._tokens.revoke(stored)
        return await self.open_session(user, user_agent=user_agent)

    async def logout(self, raw_token: str) -> None:
        payload = self._decode_refresh(raw_token)
        stored = await self._tokens.find_any_by_jti(payload["jti"])
        if stored is None:
            raise InvalidRefreshTokenError
        await self._tokens.revoke(stored)

    # Session management -----------------------------------------------------

    async def list_sessions(
        self, user_id: uuid.UUID, sid: str | None = None
    ) -> list[SessionResponse]:
        """Live sessions of the account, flagging the caller's own (`sid`)."""
        current_hash = jti_digest(sid) if sid else None
        return [
            SessionResponse(
                id=token.id,
                created_at=token.created_at,
                user_agent=token.user_agent,
                current=bool(current_hash) and token.jti_hash == current_hash,
            )
            for token in await self._tokens.list_live_for_user(user_id)
        ]

    async def revoke_session(self, user_id: uuid.UUID, session_id: int) -> bool:
        """Revoke one live session; False when it does not belong here."""
        return await self._tokens.revoke_by_id(user_id, session_id)

    async def revoke_other_sessions(
        self, user_id: uuid.UUID, sid: str | None = None
    ) -> None:
        """Revoke every live session except the caller's; all of them when
        no live row matches the caller's `sid` (e.g. rotated away)."""
        live = await self._tokens.list_live_for_user(user_id)
        keep = next(
            (token.id for token in live if sid and token.jti_hash == jti_digest(sid)),
            None,
        )
        if keep is None:
            await self._tokens.revoke_all_for_user(user_id)
        else:
            await self._tokens.revoke_all_for_user_except(user_id, keep_id=keep)

    # Internals --------------------------------------------------------------

    async def open_session(
        self, user, user_agent: str | None = None
    ) -> AuthSession:
        """Issue a token pair (also the entry point for OAuth logins); the
        access token carries the refresh's jti as `sid` so endpoints can
        tell the caller's session apart."""
        # Refresh first: its jti becomes the access token's session id.
        refresh, jti = create_refresh_token(user.id)
        access = create_access_token(user.id, user.email, sid=jti)

        payload = decode_token(refresh, REFRESH_TYPE)
        expires_at = datetime.fromtimestamp(payload["exp"], tz=UTC)
        await self._tokens.store(
            user.id,
            jti,
            expires_at,
            user_agent=user_agent[:256] if user_agent else None,
        )

        return AuthSession(
            user=UserMapper.out(user),
            tokens=TokenPair(access_token=access, refresh_token=refresh),
        )

    def _decode_refresh(self, raw_token: str) -> dict:
        try:
            return decode_token(raw_token, REFRESH_TYPE)
        except jwt.PyJWTError as exc:
            raise InvalidRefreshTokenError from exc
