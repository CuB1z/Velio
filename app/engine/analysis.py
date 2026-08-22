"""Single-pass quality analysis over traced route edges."""

from typing import NamedTuple

from .cycling_score import BALANCED_WEIGHTS, CyclingScore, Weights, cycling_score
from .edges import RouteEdge
from .overlap import overlap_ratio
from .scoring import RouteScore, score_edges


class Analysis(NamedTuple):
    """Quality metrics derived from one /trace_attributes edge list."""

    comfort: RouteScore | None
    overlap: float | None
    rating: CyclingScore | None

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
) -> Analysis:
    """Comfort, overlap ratio and cycling rating for one edge list.

    `target_km`/`target_gain_m` drive the matching factors of the rating;
    point-to-point routes without targets default to a perfect match.
    """
    ratio = overlap_ratio(edges)
    return Analysis(
        comfort=score_edges(edges),
        overlap=ratio,
        rating=cycling_score(
            edges,
            distance_km=distance_km,
            gain_m=gain_m,
            target_km=target_km,
            target_gain_m=target_gain_m,
            overlap_ratio=ratio,
            weights=weights,
        ),
    )
