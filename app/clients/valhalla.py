"""Valhalla HTTP client (httpx) shared by the service and the CLIs."""

from typing import NamedTuple

import httpx

from app.engine.edges import RouteEdge
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
    "id",
    "speed",
    "density",
    "cycle_lane",
    "bicycle_network",
    "lane_count",
    "sidewalk",
    "shoulder",
    "truck_route",
    "bridge",
    "tunnel",
    "roundabout",
    "traffic_signal",
    "toll",
    "traversability",
]

DEFAULT_BASE_URL = "http://localhost:8002"
DEFAULT_TIMEOUT_S = 120.0


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
    alternatives: int | None = None,
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
    if alternatives:
        payload["alternatives"] = alternatives
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
    def _stitch_trip(trip: dict) -> list[tuple[float, float]]:
        """Decode all leg shapes of one trip into a coordinate list."""
        coords: list[tuple[float, float]] = []
        for leg in trip["legs"]:
            leg_coords = decode(leg["shape"])
            if coords and leg_coords and leg_coords[0] == coords[-1]:
                leg_coords = leg_coords[1:]
            coords.extend(leg_coords)
        return coords

    @classmethod
    def _stitch_legs(cls, data: dict) -> list[tuple[float, float]]:
        """Decode the main trip of a route response."""
        return cls._stitch_trip(data["trip"])

    @staticmethod
    def _to_result(trip: dict) -> RouteResult:
        summary = trip["summary"]
        return RouteResult(
            coords=ValhallaClient._stitch_trip(trip),
            distance_km=float(summary["length"]),
            duration_s=float(summary.get("time", 0.0)),
        )

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
        return self._to_result(data["trip"])

    async def route_alternatives(
        self,
        locations: list[tuple[float, float]],
        count: int = 1,
        costing_options: dict | None = None,
        avoid_locations: list[tuple[float, float]] | None = None,
    ) -> list[RouteResult]:
        """Bicycle route plus up to `count` Valhalla alternatives.

        Servers without alternative support simply answer with the primary
        trip, which degrades to a single-element list.
        """
        data = await self.post_json(
            "/route",
            build_route_payload(
                locations, costing_options, avoid_locations, alternatives=count
            ),
        )
        trips = [data["trip"], *data.get("alternatives", [])]
        return [self._to_result(trip) for trip in trips]

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
        return [
            RouteEdge.from_trace(edge)
            for edge in data["edges"]
            if edge.get("length") is not None
        ]

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
