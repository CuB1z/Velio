"""Route quality scoring from Valhalla /trace_attributes edge data.

Two orthogonal metrics, mirroring how the generator's knobs work:

- comfort (0-100): how much of the ride is on high-quality surface.
  Weighted mean of a per-surface quality factor over distance.
- climb load (m): distance-weighted positive grade as vertical-equivalent
  meters (sum of km x grade%). For moderate grades it approximates D+;
  steep short ramps push it above the DEM gain, which is informative on
  its own (how punchy the ride is).

Surface factors are relative to smooth asphalt (1.0). Unknown surfaces
fall back to a neutral-poor default so new Valhalla values degrade
gracefully instead of crashing.
"""

from dataclasses import dataclass

from .edges import RouteEdge

SURFACE_QUALITY = {
    "paved_smooth": 1.00,
    "paved": 0.90,
    "pavement": 0.90,
    "concrete": 0.85,
    "compacted": 0.65,
    "cobblestone": 0.55,
    "gravel": 0.45,
    "dirt": 0.35,
    "path": 0.25,
    "impassable": 0.0,
}
DEFAULT_SURFACE_QUALITY = 0.50

PAVED_SURFACES = frozenset({"paved_smooth", "paved", "pavement", "concrete"})


@dataclass(frozen=True)
class RouteScore:
    """Quality metrics for one route."""

    total_km: float
    comfort: float
    surface_km: dict[str, float]
    climb_load_m: float
    max_grade_pct: float

    @property
    def paved_km(self) -> float:
        return sum(
            km for s, km in self.surface_km.items() if s in PAVED_SURFACES
        )

    @property
    def paved_share(self) -> float:
        if self.total_km == 0.0:
            return 0.0
        return self.paved_km / self.total_km


def score_edges(edges: list[RouteEdge]) -> RouteScore:
    """Score traced edges (lengths in km, grades in %)."""
    if not edges:
        raise ValueError("cannot score an empty edge list")

    surface_km: dict[str, float] = {}
    weighted_quality = 0.0
    climb_load_m = 0.0
    max_grade_pct = -180.0

    for edge in edges:
        km = float(edge.length_km)
        quality = SURFACE_QUALITY.get(edge.surface, DEFAULT_SURFACE_QUALITY)
        surface_km[edge.surface] = surface_km.get(edge.surface, 0.0) + km
        weighted_quality += km * quality

        if edge.weighted_grade_pct is not None:
            climb_load_m += km * max(0.0, float(edge.weighted_grade_pct)) * 10.0
            if edge.max_upward_grade_pct is not None:
                max_grade_pct = max(max_grade_pct, float(edge.max_upward_grade_pct))

    total_km = sum(surface_km.values())
    if total_km == 0.0:
        raise ValueError("edges carry no length")
    comfort = 100.0 * weighted_quality / total_km
    return RouteScore(
        total_km=total_km,
        comfort=comfort,
        surface_km=surface_km,
        climb_load_m=climb_load_m,
        max_grade_pct=max_grade_pct if max_grade_pct > -180.0 else 0.0,
    )
