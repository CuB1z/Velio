"""Repeated-road detection from Valhalla trace_attributes edges.

A way is "repeated" when the route rides disjoint stretches of it, not when
Valhalla simply splits it into consecutive edges. The first and last
kilometres near the origin are excluded: leaving a place by the only sane
road forces some repetition that is not the loop's fault.
"""

from .edges import RouteEdge

# Urban exit/approach length ignored at both ends of the loop.
OVERLAP_EXCLUSION_M = 1500.0

# Rounding gap between consecutive edges of one visit.
ADJACENT_EPS_M = 1.0


def _visits_by_way(
    edges: list[RouteEdge], exclusion_m: float
) -> dict[int, list[list[float]]]:
    """Merged [start, end) intervals along the route, per way, inside the window."""
    lengths_m = [float(e.length_km) * 1000.0 for e in edges]
    total_m = sum(lengths_m)
    lo, hi = exclusion_m, total_m - exclusion_m
    if hi <= lo:
        return {}

    intervals: dict[int, list[tuple[float, float]]] = {}
    offset = 0.0
    for edge, length_m in zip(edges, lengths_m, strict=True):
        start, end = offset, offset + length_m
        offset = end
        inside_lo = max(start, lo)
        inside_hi = min(end, hi)
        if inside_hi <= inside_lo or edge.way_id is None:
            continue
        intervals.setdefault(edge.way_id, []).append((inside_lo, inside_hi))

    visits: dict[int, list[list[float]]] = {}
    for way_id, spans in intervals.items():
        spans.sort()
        merged: list[list[float]] = []
        for start, end in spans:
            if merged and start <= merged[-1][1] + ADJACENT_EPS_M:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        visits[way_id] = merged
    return visits


def repeated_spans(
    edges: list[RouteEdge], exclusion_m: float = OVERLAP_EXCLUSION_M
) -> list[tuple[float, float]]:
    """Where along the route a way is ridden for the second time or later.

    Metres from the start, one interval per repeated visit, inside the
    window that ignores the first and last `exclusion_m`.
    """
    repeated: list[tuple[float, float]] = []
    for visits in _visits_by_way(edges, exclusion_m).values():
        repeated.extend((start, end) for start, end in visits[1:])
    return repeated


def spur_intervals(
    edges: list[RouteEdge], exclusion_m: float = OVERLAP_EXCLUSION_M
) -> list[tuple[float, float]]:
    """The stretches of route between two visits to the same way.

    The waypoint inside a spur is what made the loop double back. Nested
    spurs produce nested intervals.
    """
    spurs: list[tuple[float, float]] = []
    for visits in _visits_by_way(edges, exclusion_m).values():
        for previous, current in zip(visits, visits[1:], strict=False):
            spurs.append((previous[1], current[0]))
    return spurs


def overlap_ratio(
    edges: list[RouteEdge], exclusion_m: float = OVERLAP_EXCLUSION_M
) -> float:
    """Fraction [0-1] of in-window length ridden on already-used ways.

    Only visits after the first count; edges without a way id never do.
    """
    total_m = sum(float(e.length_km) * 1000.0 for e in edges)
    window_m = total_m - 2.0 * exclusion_m
    if window_m <= 0.0:
        return 0.0
    repeated_m = sum(end - start for start, end in repeated_spans(edges, exclusion_m))
    return min(1.0, repeated_m / window_m)
