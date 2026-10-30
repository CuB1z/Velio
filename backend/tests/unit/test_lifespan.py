"""Startup loading of the optional data files and shutdown of shared resources."""

import asyncio
import logging

from app.api.dependencies import get_valhalla_client, provide
from app.core.config import settings
from app.core.lifespan import lifespan
from app.engine.coverage import load_coverage
from app.main import app


def test_a_missing_coverage_file_accepts_every_point(tmp_path, caplog):
    with caplog.at_level(logging.WARNING, logger="app.engine.coverage"):
        coverage = load_coverage(tmp_path / "missing.geojson")
    assert coverage.contains(48.8566, 2.3522)
    assert coverage.regions == []
    assert any("coverage not loaded" in message for message in caplog.messages)


def test_the_shipped_coverage_file_loads_every_region():
    coverage = load_coverage(settings.coverage_path)
    assert [region.key for region in coverage.regions] == [
        "spain",
        "canary-islands",
        "portugal",
        "andorra",
    ]


class RecordingClient:
    def __init__(self):
        self.closed = False

    async def aclose(self):
        self.closed = True


def test_shutdown_closes_the_client_and_the_next_run_gets_a_fresh_one():
    client = RecordingClient()
    provide(valhalla=client)

    async def run() -> None:
        async with lifespan(app):
            assert get_valhalla_client() is client

    asyncio.run(run())

    assert client.closed
    assert get_valhalla_client() is not client
