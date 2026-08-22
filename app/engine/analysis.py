"""Single-pass quality analysis over traced route edges."""

from typing import Any, NamedTuple

from .cycling_score import CyclingScore, cycling_score
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
    edges: list[dict[str, Any]],
    *,
    distance_km: float,
    target_km: float | None = None,
) -> Analysis:
    """Comfort, overlap ratio and cycling rating for one edge list.

    `target_km` drives the distance factor of the rating; point-to-point
    routes pass their own length so it defaults to a perfect match.
    """
    ratio = overlap_ratio(edges)
    return Analysis(
        comfort=score_edges(edges),
        overlap=ratio,
        rating=cycling_score(
            edges,
            distance_km=distance_km,
            target_km=target_km if target_km is not None else distance_km,
            overlap_ratio=ratio,
        ),
    )
