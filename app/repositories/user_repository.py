"""User and identity persistence.

Repositories never commit: the request-scoped session in
`app.core.database.get_db` commits (or rolls back) the whole use case.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    EmailAlreadyRegisteredError,
)
from app.models import User, UserIdentity, UserStatus


class UserRepository:
    """Every read/write on users and their login identities."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return await self.db.get(User, user_id)

    async def find_identity_user_id(
        self, provider: str, provider_user_id: str
    ) -> uuid.UUID | None:
        result = await self.db.execute(
            select(UserIdentity.user_id).where(
                UserIdentity.provider == provider,
                UserIdentity.provider_user_id == provider_user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create_local(
        self, *, email: str, hashed_password: str, full_name: str = ""
    ) -> User:
        if await self.get_by_email(email):
            raise EmailAlreadyRegisteredError(email)

        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            status=UserStatus.PENDING,
        )
        user.identities.append(UserIdentity(provider="local", provider_user_id=email))
        self.db.add(user)
        try:
            await self.db.flush()
        except IntegrityError as exc:
            # Lost the unique race: answer the conflict.
            raise EmailAlreadyRegisteredError(email) from exc
        await self.db.refresh(user)
        return user

    async def get_or_create_oauth(
        self,
        *,
        provider: str,
        provider_user_id: str,
        email: str,
        full_name: str = "",
    ) -> User:
        """Find the account behind an external identity or create one.

        Existing emails are linked to the incoming provider so the same
        person can log in through several channels with a single account.
        """
        user_id = await self.find_identity_user_id(provider, provider_user_id)
        if user_id is not None:
            user = await self.get_by_id(user_id)
            # Keep stale profiles fresh when the provider shares a name.
            if full_name and user and not user.full_name:
                user.full_name = full_name
            return user

        user = await self.get_by_email(email)
        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                # The provider already validated this mailbox.
                status=UserStatus.ACTIVE,
            )
            # A brand-new aggregate may build its identities collection.
            user.identities.append(
                UserIdentity(provider=provider, provider_user_id=provider_user_id)
            )
            self.db.add(user)
        else:
            # Fetched instances must not trigger lazy loads: insert straight.
            self.db.add(
                UserIdentity(
                    user_id=user.id,
                    provider=provider,
                    provider_user_id=provider_user_id,
                )
            )
        try:
            await self.db.flush()
        except IntegrityError as exc:
            # Lost a unique race: conflict, caller retries.
            raise ConflictError from exc
        return user

    async def mark_active(self, user: User) -> User:
        """Promote a pending account to active once its email is verified."""
        user.status = UserStatus.ACTIVE
        return user

    async def set_password(self, user: User, *, hashed_password: str) -> None:
        """Attach a new local credential hash (persisted with the request)."""
        user.hashed_password = hashed_password
