"""Repeated-road detection from Valhalla trace_attributes edges.

A way is "repeated" when the route rides disjoint stretches of it, not when
Valhalla simply splits it into consecutive edges. The first and last
kilometres near the origin are excluded: leaving a place by the only sane
road forces some repetition that is not the loop's fault.
"""

from .edges import RouteEdge

# Urban exit/approach length ignored at both ends of the loop.
OVERLAP_EXCLUSION_M = 1500.0

# Consecutive edges of one way may differ by a hair due to rounding; treat
# spans closer than this as the same visit to the road.
ADJACENT_EPS_M = 1.0


def overlap_ratio(
    edges: list[RouteEdge], exclusion_m: float = OVERLAP_EXCLUSION_M
) -> float:
    """Fraction [0-1] of in-window length ridden on already-used ways.

    Edges without a way id cannot be identified, so they never count as
    repetition. Within each way, only visits beyond the first count: a road
    split into several consecutive edges is ridden once, but returning to
    it later repeats it.
    """
    lengths_m = [float(e.length_km) * 1000.0 for e in edges]
    total_m = sum(lengths_m)
    lo, hi = exclusion_m, total_m - exclusion_m
    if hi <= lo:
        return 0.0

    intervals: dict[int, list[tuple[float, float]]] = {}
    offset = 0.0
    for edge, length_m in zip(edges, lengths_m, strict=True):
        start, end = offset, offset + length_m
        offset = end
        inside_lo = max(start, lo)
        inside_hi = min(end, hi)
        if inside_hi <= inside_lo:
            continue
        if edge.way_id is None:
            continue
        intervals.setdefault(edge.way_id, []).append((inside_lo, inside_hi))

    window_km = (hi - lo) / 1000.0
    repeated_km = 0.0
    for spans in intervals.values():
        spans.sort()
        merged: list[list[float]] = []
        for start, end in spans:
            if merged and start <= merged[-1][1] + ADJACENT_EPS_M:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        repeated_km += sum(end - start for start, end in merged[1:]) / 1000.0

    return min(1.0, repeated_km / window_km)
