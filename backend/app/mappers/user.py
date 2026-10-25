"""User model -> auth HTTP schemas."""

import logging

from app.models import AuthProvider, User
from app.schemas.auth import UserResponse

logger = logging.getLogger(__name__)


class UserMapper:
    """Encapsulates every translation from the User model."""

    @staticmethod
    def out(user: User) -> UserResponse:
        status = getattr(user.status, "value", user.status)
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            status=status,
            providers=UserMapper.providers(user),
        )

    @staticmethod
    def providers(user: User) -> list[AuthProvider]:
        known: set[AuthProvider] = set()
        for identity in user.identities:
            try:
                known.add(AuthProvider(identity.provider))
            except ValueError:
                logger.warning(
                    f"user {user.id} has an unknown provider {identity.provider!r}"
                )
        return sorted(known)
