"""Startup loading of the optional data files."""

import logging

from app.core.config import settings
from app.core.lifespan import load_coverage


def test_a_missing_coverage_file_accepts_every_point(tmp_path, caplog):
    with caplog.at_level(logging.WARNING, logger="app.core.lifespan"):
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
