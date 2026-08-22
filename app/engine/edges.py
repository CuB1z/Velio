"""Typed normalization of Valhalla /trace_attributes edges.

The client translates raw payloads into these frozen dataclasses so the
rest of the engine never touches dictionaries. Attributes absent from a
particular deployment degrade to None/False instead of failing.

Per-edge elevations are deliberately not part of this model: heights come
from the DEM pipeline (see terrain.elevation), not from the routing graph.
"""

from dataclasses import dataclass
from typing import Any


def flag(value: Any) -> bool:
    """Interpret Valhalla attribute values as on/off flags."""
    if value is None or isinstance(value, bool):
        return bool(value)
    text = str(value).strip().lower()
    return text not in ("", "0", "false", "none", "no")


def _text(value: Any) -> str:
    return "" if value is None else str(value)


@dataclass(frozen=True)
class RouteEdge:
    """One traced edge with its road, safety and traffic attributes."""

    id: int | None
    way_id: int | None

    length_km: float

    road_class: str
    use: str
    surface: str
    weighted_grade_pct: float | None
    max_upward_grade_pct: float | None
    max_downward_grade_pct: float | None

    speed_kmh: float | None
    lane_count: int | None
    density: int | None

    cycle_lane: str
    bicycle_network: bool
    sidewalk: str
    shoulder: bool

    truck_route: bool
    bridge: bool
    tunnel: bool
    roundabout: bool
    traffic_signal: bool
    toll: bool
    traversability: str

    @classmethod
    def from_trace(cls, edge: dict[str, Any]) -> "RouteEdge":
        """Normalize one raw /trace_attributes edge."""
        return cls(
            id=edge.get("id"),
            way_id=edge.get("way_id"),
            length_km=float(edge["length"]),
            road_class=_text(edge.get("road_class")).lower(),
            use=_text(edge.get("use")).lower(),
            surface=_text(edge.get("surface")).lower(),
            weighted_grade_pct=_optional_float(edge.get("weighted_grade")),
            max_upward_grade_pct=_optional_float(edge.get("max_upward_grade")),
            max_downward_grade_pct=_optional_float(edge.get("max_downward_grade")),
            speed_kmh=_optional_float(edge.get("speed")),
            lane_count=_optional_int(edge.get("lane_count")),
            density=_optional_int(edge.get("density")),
            cycle_lane=_text(edge.get("cycle_lane")).lower(),
            bicycle_network=flag(edge.get("bicycle_network")),
            sidewalk=_text(edge.get("sidewalk")).lower(),
            shoulder=flag(edge.get("shoulder")),
            truck_route=flag(edge.get("truck_route")),
            bridge=flag(edge.get("bridge")),
            tunnel=flag(edge.get("tunnel")),
            roundabout=flag(edge.get("roundabout")),
            traffic_signal=flag(edge.get("traffic_signal")),
            toll=flag(edge.get("toll")),
            traversability=_text(edge.get("traversability")).lower(),
        )


def _optional_float(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _optional_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
