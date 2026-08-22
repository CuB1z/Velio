import pytest

from app.engine.edges import RouteEdge
from app.engine.scoring import RouteScore, score_edges


def edge(km, surface, grade, max_up=None):
    raw = {"length": km, "surface": surface, "weighted_grade": grade}
    if max_up is not None:
        raw["max_upward_grade"] = max_up
    return RouteEdge.from_trace(raw)


def test_comfort_is_distance_weighted_surface_quality():
    edges = [
        edge(10.0, "paved_smooth", 0.0),   # 10 x 1.00
        edge(10.0, "compacted", 0.0),      # 10 x 0.65
    ]
    score = score_edges(edges)
    assert score.total_km == pytest.approx(20.0)
    assert score.comfort == pytest.approx(82.5)


def test_climb_load_accumulates_positive_grades_only():
    edges = [
        edge(2.0, "paved", 6.0),     # 2 km x 6% -> 120 m
        edge(1.0, "paved", -5.0),    # downhill ignored
        edge(1.0, "paved", 3.5),     # 35 m
    ]
    score = score_edges(edges)
    assert score.climb_load_m == pytest.approx(155.0)


def test_max_grade_uses_max_upward_grade():
    score = score_edges([edge(1.0, "paved", 4.0, max_up=11.9)])
    assert score.max_grade_pct == pytest.approx(11.9)


def test_unknown_surface_falls_back_to_default_factor():
    score = score_edges([edge(1.0, "alien_new_surface", 0.0)])
    assert score.comfort == pytest.approx(50.0)
    assert "alien_new_surface" in score.surface_km


def test_missing_optional_attributes_are_tolerated():
    score = score_edges([
        RouteEdge.from_trace({"length": 5.0, "surface": "gravel"}),
        RouteEdge.from_trace({"length": 5.0}),
    ])
    # gravel 0.45 + default 0.50
    assert score.comfort == pytest.approx(47.5)
    assert score.climb_load_m == pytest.approx(0.0)
    assert score.max_grade_pct == 0.0


def test_paved_share_counts_paved_family():
    score: RouteScore = score_edges([
        edge(6.0, "paved_smooth", 0.0),
        edge(2.0, "concrete", 0.0),
        edge(2.0, "dirt", 0.0),
    ])
    assert score.paved_km == pytest.approx(8.0)
    assert score.paved_share == pytest.approx(0.8)


def test_empty_edges_raise():
    with pytest.raises(ValueError):
        score_edges([])


def test_zero_length_edges_raise():
    with pytest.raises(ValueError):
        score_edges([RouteEdge.from_trace({"length": 0.0})])
