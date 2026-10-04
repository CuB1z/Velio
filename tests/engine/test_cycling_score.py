"""Unit tests for the multi-factor cycling score."""

import pytest

from app.engine.cycling_score import (
    elevation_score,
    cycling_score,
    distance_score,
    overlap_penalty,
    safety_score,
    surface_score,
)
from app.engine.edges import RouteEdge


def edge(km: float, **attrs) -> RouteEdge:
    return RouteEdge.from_trace({"length": km, **attrs})


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


class TestSurfaceScore:
    def test_tarmac_beats_dirt(self):
        assert surface_score([edge(5.0, surface="paved_smooth")]) == pytest.approx(10.0)
        assert surface_score([edge(5.0, surface="dirt")]) == pytest.approx(2.5)

    def test_unknown_surfaces_sit_in_the_middle(self):
        assert surface_score([edge(5.0, surface="brand_new")]) == pytest.approx(5.0)

    def test_length_weighted(self):
        edges = [edge(5.0, surface="paved_smooth"), edge(5.0, surface="dirt")]
        assert surface_score(edges) == pytest.approx(6.25)


class TestSafetyScore:
    def test_a_quiet_road_is_good_but_not_perfect(self):
        # Leaves headroom so real cycling infrastructure can score above it.
        edges = [edge(5.0, road_class="tertiary")]
        assert safety_score(edges) == pytest.approx(6.5)

    def test_big_roads_are_penalised(self):
        edges = [edge(5.0, road_class="primary")]
        assert safety_score(edges) == pytest.approx(1.5)

    def test_a_cycleway_beats_a_quiet_street(self):
        """Segregated infrastructure is the point of the score."""
        street = safety_score([edge(5.0, road_class="residential")])
        cycleway = safety_score([edge(5.0, road_class="residential", use="cycleway")])
        assert cycleway > street + 2.0

    def test_being_a_track_is_not_itself_a_traffic_problem(self):
        """Safety is about traffic; the dirt is the surface score's business."""
        road = safety_score([edge(5.0, road_class="residential", use="road")])
        track = safety_score([edge(5.0, road_class="residential", use="track")])
        assert track == pytest.approx(road)

    def test_a_route_closed_to_cars_scores_top_whatever_it_is_made_of(self):
        """The Casa de Campo case: dirt underfoot, but no cars on it."""
        edges = [edge(5.0, road_class="service_other", use="track", surface="dirt")]
        assert safety_score(edges, traffic_free_share=1.0) == pytest.approx(10.0)
        # And without the traffic hint it falls back to judging the edges.
        assert safety_score(edges) < 10.0

    def test_traffic_free_share_moves_the_score_proportionally(self):
        edges = [edge(5.0, road_class="residential", use="road")]
        plain = safety_score(edges)
        half = safety_score(edges, traffic_free_share=0.5)
        assert plain < half < 10.0

    def test_infrastructure_clamps_at_ten(self):
        edges = [
            edge(
                5.0,
                road_class="residential",
                use="cycleway",
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
        assert safety_score(edges) == pytest.approx(4.0)

    def test_unknown_attribute_names_degrade_neutrally(self):
        edges = [edge(5.0, cycle_lane="weird_future_value", use="unheard_of")]
        # Neutral 0.5: unknown values invent neither a bonus nor a penalty.
        assert safety_score(edges) == pytest.approx(5.0)

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
        # S_dist=10 (.4), S_safe=1.5 (.4), S_surf=5 unknown surface (.2).
        assert score.total == pytest.approx(0.4 * 10 + 0.4 * 1.5 + 0.2 * 5.0)

    def test_total_never_goes_negative(self):
        score = cycling_score(
            [edge(10.0, road_class="motorway", truck_route=True)],
            distance_km=100.0,
            target_km=50.0,
            overlap_ratio=0.9,
        )
        assert score.total == 0.0


class TestSurfaceScoreFollowsTheBike:
    """The same ground, judged by the bike that has to ride it."""

    def test_dirt_is_a_puncture_on_a_road_bike_and_the_point_on_a_gravel_one(self):
        dirt = [edge(5.0, surface="dirt")]
        assert surface_score(dirt, "road") == pytest.approx(1.0)
        assert surface_score(dirt, "gravel") == pytest.approx(8.5)
        assert surface_score(dirt, "mtb") == pytest.approx(10.0)

    def test_tarmac_ranks_the_other_way_round(self):
        tarmac = [edge(5.0, surface="paved_smooth")]
        assert surface_score(tarmac, "road") == pytest.approx(10.0)
        assert surface_score(tarmac, "mtb") == pytest.approx(5.0)

    def test_unknown_bike_falls_back_to_the_neutral_ranking(self):
        dirt = [edge(5.0, surface="dirt")]
        assert surface_score(dirt, "penny-farthing") == surface_score(dirt)

    def test_unknown_surface_stays_neutral_for_every_bike(self):
        mystery = [edge(5.0, surface="brand_new")]
        for bike in ("road", "gravel", "mtb", None):
            assert surface_score(mystery, bike) == pytest.approx(5.0)


class TestElevationScoreHonoursTheHillsPreference:
    """Without a target, `flat` rewards little climbing and `hilly` a lot."""

    def test_flat_and_hilly_are_mirror_images(self):
        # 12.5 m/km is halfway up the 25 m/km scale.
        flat = elevation_score(750.0, None, distance_km=60.0, hills="flat")
        hilly = elevation_score(750.0, None, distance_km=60.0, hills="hilly")
        assert flat == pytest.approx(5.0)
        assert hilly == pytest.approx(5.0)
        score = elevation_score(150.0, None, distance_km=60.0, hills="flat")
        assert score == pytest.approx(9.0)
        score = elevation_score(150.0, None, distance_km=60.0, hills="hilly")
        assert score == pytest.approx(1.0)

    def test_the_scale_saturates(self):
        score = elevation_score(3000.0, None, distance_km=60.0, hills="hilly")
        assert score == pytest.approx(10.0)
        score = elevation_score(3000.0, None, distance_km=60.0, hills="flat")
        assert score == pytest.approx(0.0)

    def test_an_explicit_target_wins_over_the_preference(self):
        on_target = elevation_score(600.0, 600.0, distance_km=60.0, hills="flat")
        assert on_target == pytest.approx(10.0)

    def test_rolling_or_no_preference_stays_neutral(self):
        score = elevation_score(3000.0, None, distance_km=60.0, hills="rolling")
        assert score == pytest.approx(10.0)
        assert elevation_score(3000.0, None, distance_km=60.0) == pytest.approx(10.0)
