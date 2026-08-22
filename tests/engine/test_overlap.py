"""Unit tests for repeated-way detection on trace edges."""

from app.engine.overlap import overlap_ratio


def edge(km: float, way: str | None = None) -> dict:
    e = {"length": km}
    if way is not None:
        e["way_id"] = way
    return e


def test_consecutive_segments_of_one_way_are_not_repetition():
    # A single road split into several trace edges, ridden once.
    edges = [edge(4.0, "A"), edge(3.0, "A"), edge(5.0, "B")]
    assert overlap_ratio(edges) == 0.0


def test_out_and_back_counts_repeated_way():
    # A(10 km), B(10 km), back over A(10 km): the return leg repeats.
    edges = [edge(10.0, "A"), edge(10.0, "B"), edge(10.0, "A")]
    ratio = overlap_ratio(edges)
    window_km = 30.0 - 2 * 1.5
    assert ratio == (8.5 / window_km)


def test_exclusion_zone_shields_short_loops():
    # Total 2 km: everything falls inside the urban exit/approach window.
    edges = [edge(1.0, "A"), edge(1.0, "B"), edge(1.0 - 0.001, "A"), edge(0.001, "C")]
    assert overlap_ratio(edges) == 0.0


def test_edges_without_way_id_never_count():
    edges = [edge(10.0), edge(10.0), edge(10.0)]
    assert overlap_ratio(edges) == 0.0


def test_ratio_is_capped_at_one():
    edges = [edge(30.0 / 7, f"W{i % 2}") for i in range(7)]
    assert overlap_ratio(edges) <= 1.0


def test_partial_repeat_inside_window_only():
    # Repeat confined to the excluded tail does not count.
    edges = [edge(10.0, "A"), edge(10.0, "B"), edge(9.0, "C"), edge(1.0, "A")]
    assert overlap_ratio(edges) == 0.0
