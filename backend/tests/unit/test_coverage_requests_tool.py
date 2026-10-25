"""The operator ranking of coverage requests."""

import asyncio
import uuid

from app.core.database import SessionLocal
from app.repositories.coverage_request_repository import CoverageRequestRepository
from tools import coverage_requests


def test_prints_each_country_with_its_people(capsys):
    async def seed():
        async with SessionLocal() as db:
            repo = CoverageRequestRepository(db)
            for _ in range(2):
                await repo.add(country="SM", email=f"t-{uuid.uuid4().hex}@rider.dev")
            await db.commit()

    asyncio.run(seed())
    coverage_requests.main()

    lines = capsys.readouterr().out.splitlines()
    assert "SM " in lines[0]
    assert any(line.startswith("SM ") and "latest " in line for line in lines[1:])


def test_lists_the_people_to_notify_and_marks_them_on_request(capsys):
    email = f"t-{uuid.uuid4().hex}@rider.dev"

    async def seed():
        async with SessionLocal() as db:
            repo = CoverageRequestRepository(db)
            await repo.add(country="TO", email=email, notify=True, language="es")
            await db.commit()

    asyncio.run(seed())

    coverage_requests.main(["recipients", "to"])
    listed = capsys.readouterr()
    assert listed.out.splitlines()[0] == "email,language,requested_at"
    assert f"{email},es," in listed.out
    assert listed.err.startswith("TO: ")

    coverage_requests.main(["recipients", "TO", "--mark-notified"])
    assert "marked as notified" in capsys.readouterr().err

    coverage_requests.main(["recipients", "TO"])
    assert email not in capsys.readouterr().out
