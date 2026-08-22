"""Valhalla HTTP client (httpx) shared by the service and the CLIs."""

import httpx

from app.engine.polyline import decode

TRACE_ATTRIBUTES = [
    "road_class",
    "surface",
    "unpaved",
    "use",
    "weighted_grade",
    "max_upward_grade",
    "max_downward_grade",
    "mean_elevation",
]

DEFAULT_BASE_URL = "http://localhost:8002"
DEFAULT_TIMEOUT_S = 120.0


class ValhallaError(RuntimeError):
    """A Valhalla HTTP call failed."""


class RouteError(ValhallaError):
    """Valhalla could not route through the requested waypoints."""


def build_route_payload(
    locations: list[tuple[float, float]],
    costing_options: dict | None = None,
    avoid_locations: list[tuple[float, float]] | None = None,
) -> dict:
    """Assemble a Valhalla /route request payload."""
    payload: dict = {
        "locations": [{"lat": la, "lon": lo} for la, lo in locations],
        "costing": "bicycle",
    }
    if costing_options:
        payload["costing_options"] = {"bicycle": dict(costing_options)}
    if avoid_locations:
        payload["avoid_locations"] = [
            {"lat": la, "lon": lo} for la, lo in avoid_locations
        ]
    return payload


class ValhallaClient:
    """Async access to the routing, tracing and height endpoints."""

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout_s: float = DEFAULT_TIMEOUT_S,
    ):
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"), timeout=timeout_s
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def post_json(self, path: str, payload: dict) -> dict:
        try:
            resp = await self._http.post(path, json=payload)
        except httpx.HTTPError as exc:
            raise ValhallaError(f"cannot reach Valhalla: {exc}") from exc
        if resp.status_code >= 400:
            raise RouteError(f"HTTP {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    @staticmethod
    def _stitch_legs(data: dict) -> list[tuple[float, float]]:
        """Decode all leg shapes into one coordinate list."""
        coords: list[tuple[float, float]] = []
        for leg in data["trip"]["legs"]:
            leg_coords = decode(leg["shape"])
            if coords and leg_coords and leg_coords[0] == coords[-1]:
                leg_coords = leg_coords[1:]
            coords.extend(leg_coords)
        return coords

    async def route(
        self,
        locations: list[tuple[float, float]],
        costing_options: dict | None = None,
        avoid_locations: list[tuple[float, float]] | None = None,
    ) -> tuple[list[tuple[float, float]], float]:
        """Bicycle route through locations: (coords, distance_km)."""
        data = await self.post_json(
            "/route", build_route_payload(locations, costing_options, avoid_locations)
        )
        return self._stitch_legs(data), float(data["trip"]["summary"]["length"])

    async def route_shape(
        self,
        locations: list[tuple[float, float]],
        costing_options: dict | None = None,
        avoid_locations: list[tuple[float, float]] | None = None,
    ) -> str:
        """Bicycle route through locations: encoded polyline of leg one."""
        data = await self.post_json(
            "/route", build_route_payload(locations, costing_options, avoid_locations)
        )
        return data["trip"]["legs"][0]["shape"]

    async def trace_attributes(
        self,
        encoded_polyline: str,
        costing_options: dict | None = None,
    ) -> list[dict]:
        """Per-edge attributes for a route shape, via /trace_attributes."""
        payload: dict = {
            "encoded_polyline": encoded_polyline,
            "costing": "bicycle",
            "attributes": TRACE_ATTRIBUTES,
            "shape_format": "polyline6",
        }
        if costing_options:
            payload["costing_options"] = {"bicycle": dict(costing_options)}
        data = await self.post_json("/trace_attributes", payload)
        return [e for e in data["edges"] if e.get("length") is not None]

    async def heights(
        self, lats: list[float], lons: list[float], chunk_size: int = 500
    ) -> list[float | None]:
        """Query /height for every point, in chunks."""
        heights: list[float | None] = []
        for start in range(0, len(lats), chunk_size):
            chunk_lats = lats[start : start + chunk_size]
            chunk_lons = lons[start : start + chunk_size]
            data = await self.post_json(
                "/height",
                {
                    "shape": [
                        {"lat": la, "lon": lo}
                        for la, lo in zip(chunk_lats, chunk_lons)
                    ]
                },
            )
            heights.extend(data["height"])
        return heights
