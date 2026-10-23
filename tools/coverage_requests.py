"""Coverage requests per country, most asked first: who wants which country next.

Usage (from the repo root, or inside the API container):
    python -m tools.coverage_requests
"""

import asyncio
from datetime import datetime

from app.core.database import SessionLocal
from app.repositories.coverage_request_repository import CoverageRequestRepository


async def ranking() -> list[tuple[str, int, datetime]]:
    async with SessionLocal() as db:
        return await CoverageRequestRepository(db).ranking()


def main() -> None:
    rows = asyncio.run(ranking())
    if not rows:
        print("no coverage requests yet")
        return
    print(" · ".join(f"{country} {people}" for country, people, _ in rows))
    for country, people, latest in rows:
        print(f"{country}  {people:>5}  latest {latest:%Y-%m-%d}")


if __name__ == "__main__":
    main()
