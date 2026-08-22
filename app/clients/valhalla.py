"""Valhalla HTTP client (httpx) shared by the service and the CLIs."""

from typing import NamedTuple

import httpx

from app.engine.polyline import decode

# Attributes every deployment is expected to provide.
BASE_TRACE_ATTRIBUTES = [
    "road_class",
    "surface",
    "unpaved",
    "use",
    "weighted_grade",
    "max_upward_grade",
    "max_downward_grade",
    "mean_elevation",
]

# Safety/overlap attributes; a server may reject unknown names, in which
# case calls degrade to the base set for the rest of the client's lifetime.
EXTRA_TRACE_ATTRIBUTES = [
    "way_id",
    "cycle_lane",
    "bicycle_network",
    "lane_count",
    "truck_route",
]

DEFAULT_BASE_URL = "http://localhost:8002"
DEFAULT_TIMEOUT_S = 120.0

# Named bicycle profiles applied on top of the raw costing options.
COSTING_PROFILES = {
    "road": {"bicycle_type": "Road", "use_roads": 1.0, "avoid_bad_surfaces": 1.0},
    "safe": {"bicycle_type": "Hybrid", "use_roads": 0.4, "avoid_bad_surfaces": 1.0},
    "relaxed": {
        "bicycle_type": "Hybrid",
        "use_hills": 0.2,
        "avoid_bad_surfaces": 1.0,
    },
}


class ValhallaError(RuntimeError):
    """A Valhalla HTTP call failed."""


class RouteError(ValhallaError):
    """Valhalla could not route through the requested waypoints."""


class RouteResult(NamedTuple):
    """Geometry and summary metrics of one routed path."""

    coords: list[tuple[float, float]]
    distance_km: float
    duration_s: float


def build_route_payload(
    locations: list[tuple[float, float]],
    costing_options: dict | None = None,
    avoid_locations: list[tuple[float, float]] | None = None,
) -> dict:
    """Assemble a Valhalla /route request payload."""
    payload: dict = {
        "locations": [
            {"lat": la, "lon": lo, "type": "break"} for la, lo in locations
        ],
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
        self._extra_attrs_ok = True

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
    ) -> RouteResult:
        """Bicycle route through locations."""
        data = await self.post_json(
            "/route", build_route_payload(locations, costing_options, avoid_locations)
        )
        return RouteResult(
            coords=self._stitch_legs(data),
            distance_km=float(data["trip"]["summary"]["length"]),
            duration_s=float(data["trip"]["summary"].get("time", 0.0)),
        )

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

    @staticmethod
    def _blames_extra_attribute(exc: RouteError) -> bool:
        """True when a 400 error text points at one of the extra attributes."""
        text = str(exc).lower()
        return any(name in text for name in EXTRA_TRACE_ATTRIBUTES)

    async def trace_attributes(
        self,
        encoded_polyline: str,
        costing_options: dict | None = None,
    ) -> list[dict]:
        """Per-edge attributes for a route shape, via /trace_attributes."""
        attrs = (
            BASE_TRACE_ATTRIBUTES + EXTRA_TRACE_ATTRIBUTES
            if self._extra_attrs_ok
            else BASE_TRACE_ATTRIBUTES
        )
        payload: dict = {
            "encoded_polyline": encoded_polyline,
            "costing": "bicycle",
            "attributes": attrs,
            "shape_format": "polyline6",
        }
        if costing_options:
            payload["costing_options"] = {"bicycle": dict(costing_options)}
        try:
            data = await self.post_json("/trace_attributes", payload)
        except RouteError as exc:
            if not (self._extra_attrs_ok and self._blames_extra_attribute(exc)):
                raise
            self._extra_attrs_ok = False
            return await self.trace_attributes(encoded_polyline, costing_options)
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
