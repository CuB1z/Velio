"""Single-pass quality analysis over traced route edges."""

from typing import NamedTuple

from .cycling_score import BALANCED_WEIGHTS, CyclingScore, Weights, cycling_score
from .edges import RouteEdge
from .overlap import overlap_ratio, spur_intervals
from .scoring import RouteScore, score_edges


class Analysis(NamedTuple):
    """Quality metrics derived from one /trace_attributes edge list."""

    comfort: RouteScore | None
    overlap: float | None
    rating: CyclingScore | None
    # Out-and-back stretches as (start, end) metres along the route, from a
    # road's first visit to its repeat. Empty when unknown.
    spurs_m: tuple[tuple[float, float], ...] = ()

    @classmethod
    def unavailable(cls) -> "Analysis":
        """Empty analysis for when tracing failed and metadata is optional."""
        return cls(None, None, None)


def analyze_edges(
    edges: list[RouteEdge],
    *,
    distance_km: float,
    target_km: float | None = None,
    gain_m: float | None = None,
    target_gain_m: float | None = None,
    weights: Weights = BALANCED_WEIGHTS,
    traffic_free_share: float | None = None,
    bike: str | None = None,
    hills: str | None = None,
) -> Analysis:
    """Comfort, overlap ratio and cycling rating for one edge list.

    `target_km`/`target_gain_m` drive the matching factors of the rating;
    point-to-point routes without targets default to a perfect match.
    """
    ratio = overlap_ratio(edges)
    return Analysis(
        comfort=score_edges(edges),
        overlap=ratio,
        spurs_m=tuple(spur_intervals(edges)),
        rating=cycling_score(
            edges,
            distance_km=distance_km,
            gain_m=gain_m,
            target_km=target_km,
            target_gain_m=target_gain_m,
            overlap_ratio=ratio,
            weights=weights,
            traffic_free_share=traffic_free_share,
            bike=bike,
            hills=hills,
        ),
    )
