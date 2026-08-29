"""User model -> auth HTTP schemas."""

from app.models import User
from app.schemas.auth import UserResponse


class UserMapper:
    """Encapsulates every translation from the User model."""

    @staticmethod
    def out(user: User) -> UserResponse:
        status = getattr(user.status, "value", user.status)
        return UserResponse(
            id=user.id, email=user.email, full_name=user.full_name, status=status
        )
