"""Minimal Valhalla HTTP client shared by the development CLIs."""

import json
from urllib import request as url_request
from urllib.error import HTTPError

from app.engine.loop import RouteError, build_route_payload


def post_json(url: str, payload: dict) -> dict:
    req = url_request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with url_request.urlopen(req, timeout=120) as resp:
            return json.load(resp)
    except HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:200]
        raise RouteError(f"HTTP {exc.code}: {detail}") from exc


def fetch_route_shape(
    base_url: str,
    locations: list[tuple[float, float]],
    costing_options: dict | None = None,
    avoid_locations: list[tuple[float, float]] | None = None,
) -> str:
    """Request a bicycle route and return its encoded polyline."""
    data = post_json(
        f"{base_url}/route",
        build_route_payload(locations, costing_options, avoid_locations),
    )
    return data["trip"]["legs"][0]["shape"]


def fetch_heights(
    base_url: str, lats: list[float], lons: list[float], chunk_size: int = 500
) -> list[float | None]:
    """Query /height for every point, in chunks."""
    heights: list[float | None] = []
    for start in range(0, len(lats), chunk_size):
        chunk_lats = lats[start : start + chunk_size]
        chunk_lons = lons[start : start + chunk_size]
        data = post_json(
            f"{base_url}/height",
            {"shape": [{"lat": la, "lon": lo} for la, lo in zip(chunk_lats, chunk_lons)]},
        )
        heights.extend(data["height"])
    return heights
