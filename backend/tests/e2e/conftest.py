"""Shared setup for end-to-end tests: live Valhalla + local DEM tiles."""

import os
import urllib.request
from pathlib import Path

import pytest

BASE_URL = os.environ.get("VALHALLA_URL", "http://localhost:8002")
REPO_ROOT = Path(__file__).resolve().parents[2]
ELEVATION_DIR = Path(
    os.environ.get("VALHALLA_ELEVATION_DIR", REPO_ROOT / "valhalla" / "elevation")
)


@pytest.fixture(scope="session")
def base_url():
    try:
        with urllib.request.urlopen(f"{BASE_URL}/status", timeout=5):
            pass
    except OSError:
        pytest.skip(f"Valhalla service not reachable at {BASE_URL}")
    return BASE_URL


@pytest.fixture(scope="session")
def elevation_dir():
    if not ELEVATION_DIR.exists():
        pytest.skip(f"elevation tiles not present at {ELEVATION_DIR}")
    return ELEVATION_DIR
