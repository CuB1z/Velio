"""Valhalla helpers shared by the development CLIs, over the production client."""

from app.engine.client import post_json
from app.engine.loop import build_route_payload


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
