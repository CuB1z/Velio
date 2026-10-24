"""Acceptance rule of the overlap repair, and the hills preference as a target."""

from app.engine.analysis import Analysis
from app.engine.loop import GeneratedLoop
from app.schemas.loop import LoopCreateRequest
from app.services.loop_service import LoopService


def loop(
    km: float, distance_ok: bool, gain_m: float = 0.0, gain_ok: bool = True
) -> GeneratedLoop:
    return GeneratedLoop(
        coords=[(40.0, -3.7), (40.1, -3.7)],
        distance_km=km, gain_m=gain_m, loss_m=gain_m, radius_m=1.0,
        hilliness=0.0, stretch=0.0, summit_used=False, iterations=1,
        distance_ok=distance_ok, gain_ok=gain_ok,
    )


def analysis(overlap: float) -> Analysis:
    return Analysis(comfort=None, overlap=overlap, rating=None)


better = LoopService._is_better_repair


def test_a_repair_must_repeat_less():
    original = loop(50.0, True)
    assert not better(
        original, original, analysis(0.30), loop(50.0, True), analysis(0.30), 50.0, None
    )
    assert better(
        original, original, analysis(0.30), loop(50.0, True), analysis(0.10), 50.0, None
    )


def test_a_loop_that_met_the_distance_may_not_lose_it():
    original = loop(50.0, True)
    assert not better(
        original, original, analysis(0.30),
        loop(58.0, False), analysis(0.05),
        50.0, None,
    )


def test_a_best_effort_loop_may_not_drift_further_from_the_target():
    """Guards the "116 km hole": a missed target must not let any repair through."""
    original = loop(56.0, False)  # missed 50 km by 6
    assert not better(
        original, original, analysis(0.30),
        loop(116.0, False), analysis(0.02),
        50.0, None,
    )
    assert better(
        original, original, analysis(0.30),
        loop(53.0, False), analysis(0.02),
        50.0, None,
    )


def test_the_same_rule_applies_to_a_gain_target():
    original = loop(50.0, True, gain_m=200.0, gain_ok=False)  # 400 short of 600
    drifted = loop(50.0, True, gain_m=100.0, gain_ok=False)  # 500 short
    closer = loop(50.0, True, gain_m=450.0, gain_ok=False)
    assert not better(
        original, original, analysis(0.30), drifted, analysis(0.02), 50.0, 600.0
    )
    assert better(
        original, original, analysis(0.30), closer, analysis(0.02), 50.0, 600.0
    )


def test_hills_never_sets_a_gain_target():
    """The preference is honoured by scoring and choosing, never as a target."""
    data = LoopCreateRequest.model_validate(
        {"origin": {"lat": 40.0, "lon": -3.7}, "distance_km": 60, "hills": "flat"}
    )
    request = LoopService._to_engine_request(data)
    assert request.target_gain_m is None


def test_a_climbing_preference_gathers_several_candidates_to_choose_from():
    def wanted(**fields):
        return LoopService._candidates_wanted(
            LoopCreateRequest.model_validate(
                {"origin": {"lat": 40.0, "lon": -3.7}, "distance_km": 60, **fields}
            )
        )

    assert wanted() == 1
    assert wanted(hills="rolling") == 1
    assert wanted(hills="flat") == 3
    assert wanted(hills="hilly") == 3
    # An exact target makes the preference moot: the controller does the work.
    assert wanted(hills="flat", gain_m=400) == 1
    # Never fewer than the routes the rider asked for.
    assert wanted(hills="flat", routes=5) == 5


def test_loose_share_ignores_compacted_and_treats_unknown_as_loose():
    from app.engine.scoring import RouteScore

    def with_surfaces(**km):
        return Analysis(
            comfort=RouteScore(
                total_km=sum(km.values()),
                comfort=0.0,
                surface_km=km,
                climb_load_m=0.0,
                max_grade_pct=0.0,
            ),
            overlap=None,
            rating=None,
        )

    assert LoopService._loose_share(with_surfaces(paved=8.0, compacted=2.0)) == 0.0
    assert LoopService._loose_share(with_surfaces(paved=8.0, dirt=2.0)) == 0.2
    assert LoopService._loose_share(Analysis.unavailable()) == 1.0
