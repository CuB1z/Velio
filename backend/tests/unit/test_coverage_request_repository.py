"""Repository tests for coverage requests: dedupe, email purge, ranking."""

import asyncio
import uuid

from app.core.countries import ISO_COUNTRIES
from app.core.database import SessionLocal
from app.models import User, UserStatus
from app.repositories.coverage_request_repository import CoverageRequestRepository


def unique_email() -> str:
    return f"cr-{uuid.uuid4().hex}@rider.dev"


def seed_user(db, email: str) -> User:
    user = User(email=email, hashed_password="irrelevant", status=UserStatus.ACTIVE)
    db.add(user)
    return user


def counts(ranking) -> dict[str, int]:
    return {country: people for country, people, _ in ranking}


def test_one_row_per_person_and_country():
    async def scenario():
        async with SessionLocal() as db:
            user = seed_user(db, unique_email())
            await db.commit()
            repo = CoverageRequestRepository(db)
            email = unique_email()

            assert await repo.add(country="TV", email=email)
            assert not await repo.add(country="TV", email=email)
            assert await repo.add(country="NR", email=email)
            assert await repo.add(country="TV", user_id=user.id)
            assert not await repo.add(country="TV", user_id=user.id)
            await db.commit()

            assert await repo.delete_for_person(user.id, email.upper()) == 3
            await db.commit()

    asyncio.run(scenario())


def test_ranking_counts_people_once_across_accounts_and_emails():
    async def scenario():
        async with SessionLocal() as db:
            repo = CoverageRequestRepository(db)
            before = counts(await repo.ranking())
            email = unique_email()
            user = seed_user(db, email)
            await db.commit()

            await repo.add(country="TV", email=email)
            await repo.add(country="TV", user_id=user.id)
            await repo.add(country="TV", email=unique_email())
            await db.commit()

            after = counts(await repo.ranking())
            assert after["TV"] - before.get("TV", 0) == 2
            await repo.delete_for_person(user.id, email)
            await db.delete(user)
            await db.commit()

    asyncio.run(scenario())


def test_the_country_list_holds_every_assigned_code():
    assert len(ISO_COUNTRIES) == 249
    assert {"ES", "PT", "AD", "FR", "MA", "GI"} <= ISO_COUNTRIES
    assert "XX" not in ISO_COUNTRIES


def test_people_who_opted_in_are_listed_once_until_marked():
    async def scenario():
        async with SessionLocal() as db:
            email = unique_email()
            user = seed_user(db, email.upper())
            await db.commit()
            repo = CoverageRequestRepository(db)
            quiet = unique_email()

            assert await repo.add(country="KI", email=email, notify=True, language="es")
            assert await repo.add(
                country="KI", user_id=user.id, notify=True, language="en"
            )
            assert await repo.add(country="KI", email=quiet)
            await db.commit()

            pending = {p.email: p for p in await repo.pending_notifications("KI")}
            assert quiet not in pending
            person = pending[email]
            assert person.language == "en"
            assert len(person.request_ids) == 2

            await repo.mark_notified(person.request_ids)
            await db.commit()
            emails = {p.email for p in await repo.pending_notifications("KI")}
            assert email not in emails

    asyncio.run(scenario())


def test_asking_again_with_notify_switches_it_on():
    async def scenario():
        async with SessionLocal() as db:
            repo = CoverageRequestRepository(db)
            email = unique_email()
            assert await repo.add(country="FJ", email=email)
            await db.commit()
            before = await repo.pending_notifications("FJ")
            assert email not in {p.email for p in before}

            await repo.enable_notify(country="FJ", email=email, language="es")
            await db.commit()
            pending = {p.email: p for p in await repo.pending_notifications("FJ")}
            assert pending[email].language == "es"

    asyncio.run(scenario())
