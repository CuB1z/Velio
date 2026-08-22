"""Unit tests for the multi-factor cycling score."""

import pytest

from app.engine.cycling_score import (
    cycling_score,
    distance_score,
    overlap_penalty,
    safety_score,
)


def edge(km: float, **attrs) -> dict:
    return {"length": km, **attrs}


class TestDistanceScore:
    def test_on_target_is_perfect(self):
        assert distance_score(50.0, 50.0) == 10.0

    def test_twenty_percent_off_is_zero(self):
        assert distance_score(60.0, 50.0) == 0.0
        assert distance_score(40.0, 50.0) == 0.0

    def test_ten_percent_off_is_half(self):
        assert distance_score(55.0, 50.0) == pytest.approx(5.0)

    def test_beyond_tolerance_stays_zero(self):
        assert distance_score(100.0, 50.0) == 0.0

    def test_zero_target_scores_zero(self):
        assert distance_score(10.0, 0.0) == 0.0


class TestSafetyScore:
    def test_quiet_roads_get_full_marks(self):
        edges = [edge(5.0, road_class="tertiary")]
        assert safety_score(edges) == pytest.approx(10.0)

    def test_big_roads_are_penalised(self):
        edges = [edge(5.0, road_class="primary")]
        assert safety_score(edges) == pytest.approx(4.0)

    def test_infrastructure_clamps_at_ten(self):
        edges = [
            edge(
                5.0,
                road_class="residential",
                cycle_lane="dedicated",
                bicycle_network="lcn",
            )
        ]
        assert safety_score(edges) == pytest.approx(10.0)

    def test_lanes_and_trucks_stack_penalty(self):
        edges = [
            edge(5.0, road_class="primary", lane_count=3, truck_route=True)
        ]
        assert safety_score(edges) == 0.0

    def test_length_weighted_mixture(self):
        edges = [
            edge(5.0, road_class="tertiary"),
            edge(5.0, road_class="primary"),
        ]
        assert safety_score(edges) == pytest.approx(7.0)

    def test_unknown_attribute_names_degrade_neutrally(self):
        edges = [edge(5.0, cycle_lane="weird_future_value")]
        # Baseline 0.8: the unknown cycle lane adds nothing but hurts nothing.
        assert safety_score(edges) == pytest.approx(8.0)

    def test_empty_edges_are_rejected(self):
        with pytest.raises(ValueError):
            safety_score([])


class TestOverlapPenalty:
    def test_no_penalty_up_to_five_percent(self):
        assert overlap_penalty(0.0) == 0.0
        assert overlap_penalty(0.05) == 0.0

    def test_linear_ramp_to_the_cap(self):
        assert overlap_penalty(0.175) == pytest.approx(2.5)
        assert overlap_penalty(0.30) == pytest.approx(5.0)

    def test_capped_beyond_thirty_percent(self):
        assert overlap_penalty(0.90) == pytest.approx(5.0)


class TestCyclingScore:
    def test_weights_apply_to_total(self):
        score = cycling_score(
            [edge(10.0, road_class="primary")],
            distance_km=50.0,
            target_km=50.0,
            overlap_ratio=0.0,
        )
        # S_dist=10 (weight 0.4), S_safe=4 (weight 0.6), no penalty.
        assert score.total == pytest.approx(0.4 * 10 + 0.6 * 4)

    def test_total_never_goes_negative(self):
        score = cycling_score(
            [edge(10.0, road_class="motorway", truck_route=True)],
            distance_km=100.0,
            target_km=50.0,
            overlap_ratio=0.9,
        )
        assert score.total == 0.0
