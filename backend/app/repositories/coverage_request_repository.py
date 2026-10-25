"""Persistence for coverage requests; never commits (see DbTransactionMiddleware)."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CoverageRequest, User


@dataclass(frozen=True)
class NotifyRecipient:
    email: str
    language: str
    requested_at: datetime
    request_ids: tuple[uuid.UUID, ...]


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
        notify: bool = False,
        language: str = "en",
    ) -> bool:
        """Store the request; False when this person already asked for it."""
        try:
            async with self.db.begin_nested():
                self.db.add(
                    CoverageRequest(
                        country=country,
                        user_id=user_id,
                        email=email,
                        note=note,
                        notify=notify,
                        language=language,
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

    async def enable_notify(
        self,
        *,
        country: str,
        language: str,
        user_id: uuid.UUID | None = None,
        email: str | None = None,
    ) -> None:
        owner = (
            CoverageRequest.user_id == user_id
            if user_id is not None
            else CoverageRequest.email == email
        )
        await self.db.execute(
            update(CoverageRequest)
            .where(CoverageRequest.country == country, owner)
            .values(notify=True, language=language)
            .execution_options(synchronize_session=False)
        )

    async def pending_notifications(self, country: str) -> list[NotifyRecipient]:
        person = func.coalesce(func.lower(User.email), CoverageRequest.email)
        result = await self.db.execute(
            select(
                person,
                CoverageRequest.language,
                CoverageRequest.created_at,
                CoverageRequest.id,
            )
            .outerjoin(User, User.id == CoverageRequest.user_id)
            .where(
                CoverageRequest.country == country,
                CoverageRequest.notify.is_(True),
                CoverageRequest.notified_at.is_(None),
            )
            .order_by(CoverageRequest.created_at)
        )
        people: dict[str, NotifyRecipient] = {}
        for email, language, requested_at, request_id in result.all():
            earlier = people.get(email)
            people[email] = NotifyRecipient(
                email=email,
                language=language,
                requested_at=earlier.requested_at if earlier else requested_at,
                request_ids=(*(earlier.request_ids if earlier else ()), request_id),
            )
        return list(people.values())

    async def mark_notified(self, request_ids: tuple[uuid.UUID, ...]) -> None:
        await self.db.execute(
            update(CoverageRequest)
            .where(CoverageRequest.id.in_(request_ids))
            .values(notified_at=func.now())
            .execution_options(synchronize_session=False)
        )
