"""Minimal production Valhalla HTTP client."""

import json
from urllib import request as url_request
from urllib.error import HTTPError

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


class ValhallaError(RuntimeError):
    """A Valhalla HTTP call failed."""


class RouteError(ValhallaError):
    """Valhalla could not route through the requested waypoints."""


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


def fetch_trace_attributes(
    base_url: str,
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
    data = post_json(f"{base_url}/trace_attributes", payload)
    return [e for e in data["edges"] if e.get("length") is not None]
