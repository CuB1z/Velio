"""Persistence for coverage requests; never commits (see DbTransactionMiddleware)."""

import uuid
from datetime import datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CoverageRequest, User


class CoverageRequestRepository:
    """One row per person and country; the unique indexes do the dedupe."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def add(
        self,
        *,
        country: str,
        user_id: uuid.UUID | None = None,
        email: str | None = None,
        note: str | None = None,
    ) -> bool:
        """Store the request; False when this person already asked for it."""
        try:
            async with self.db.begin_nested():
                self.db.add(
                    CoverageRequest(
                        country=country, user_id=user_id, email=email, note=note
                    )
                )
        except IntegrityError:
            return False
        return True

    async def delete_for_person(self, user_id: uuid.UUID, email: str) -> int:
        """Every request of an account: signed in, or anonymous with its email."""
        result = await self.db.execute(
            delete(CoverageRequest)
            .where(
                or_(
                    CoverageRequest.user_id == user_id,
                    CoverageRequest.email == email.lower(),
                )
            )
            .returning(CoverageRequest.id)
            .execution_options(synchronize_session=False)
        )
        return len(result.all())

    async def ranking(self) -> list[tuple[str, int, datetime]]:
        """(country, distinct people, latest request), most asked first.

        A person who asked anonymously and again signed in counts once:
        people are keyed by email, the account's when there is one.
        """
        person = func.coalesce(func.lower(User.email), CoverageRequest.email)
        people = func.count(func.distinct(person))
        latest = func.max(CoverageRequest.created_at)
        result = await self.db.execute(
            select(CoverageRequest.country, people, latest)
            .outerjoin(User, User.id == CoverageRequest.user_id)
            .group_by(CoverageRequest.country)
            .order_by(people.desc(), latest.desc())
        )
        return [(country, count, at) for country, count, at in result.all()]
