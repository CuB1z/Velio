"""Coverage requests: who wants which country next, and who asked to hear when it ships.

Usage (from the repo root, or inside the API container):
    python -m tools.coverage_requests
    python -m tools.coverage_requests recipients FR [--mark-notified] > fr.csv
"""

import argparse
import asyncio
import csv
import sys
from collections.abc import Sequence
from datetime import datetime

from app.core.countries import ISO_COUNTRIES
from app.core.database import SessionLocal
from app.repositories.coverage_request_repository import (
    CoverageRequestRepository,
    NotifyRecipient,
)


async def ranking() -> list[tuple[str, int, datetime]]:
    async with SessionLocal() as db:
        return await CoverageRequestRepository(db).ranking()


async def recipients(country: str, mark_notified: bool) -> list[NotifyRecipient]:
    async with SessionLocal() as db:
        requests = CoverageRequestRepository(db)
        people = await requests.pending_notifications(country)
        if mark_notified and people:
            ids = tuple(
                request_id for person in people for request_id in person.request_ids
            )
            await requests.mark_notified(ids)
            await db.commit()
        return people


def print_ranking() -> None:
    rows = asyncio.run(ranking())
    if not rows:
        print("no coverage requests yet")
        return
    print(" · ".join(f"{country} {people}" for country, people, _ in rows))
    for country, people, latest in rows:
        print(f"{country}  {people:>5}  latest {latest:%Y-%m-%d}")


def print_recipients(country: str, mark_notified: bool) -> None:
    people = asyncio.run(recipients(country, mark_notified))
    writer = csv.writer(sys.stdout)
    writer.writerow(["email", "language", "requested_at"])
    for person in people:
        when = person.requested_at.isoformat()
        writer.writerow([person.email, person.language, when])
    marked = ", marked as notified" if mark_notified and people else ""
    print(f"{country}: {len(people)} to notify{marked}", file=sys.stderr)


def main(argv: Sequence[str] = ()) -> None:
    parser = argparse.ArgumentParser(prog="python -m tools.coverage_requests")
    commands = parser.add_subparsers(dest="command")
    listing = commands.add_parser(
        "recipients", help="CSV of the people who asked to hear when COUNTRY ships"
    )
    listing.add_argument("country", type=str.upper, help="ISO 3166-1 alpha-2 code")
    listing.add_argument(
        "--mark-notified",
        action="store_true",
        help="mark exactly the listed people as notified, so the next run skips them",
    )
    args = parser.parse_args(list(argv))

    if args.command == "recipients":
        if args.country not in ISO_COUNTRIES:
            parser.error(f"{args.country} is not an ISO 3166-1 alpha-2 country code")
        print_recipients(args.country, args.mark_notified)
    else:
        print_ranking()


if __name__ == "__main__":
    main(sys.argv[1:])
