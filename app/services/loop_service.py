"""Loop generation use case bridging the HTTP layer and the engine."""

import logging
from collections.abc import Callable
from dataclasses import replace
from typing import Any

from app.clients.valhalla import (
    TRACE_COSTING,
    RouteError,
    ValhallaClient,
    ValhallaError,
)
from app.core.exceptions import RoutingError, ServiceUnavailableError
from app.engine.analysis import Analysis, analyze_edges
from app.engine.cycling_score import BALANCED_WEIGHTS
from app.engine.dem import DemSource
from app.engine.geo import initial_bearing_deg
from app.engine.elevation import build_profile
from app.engine.loop import (
    GOLDEN_ANGLE_DEG,
    GeneratedLoop,
    LoopRequest,
    climb_anchors,
    generate_loop,
    spur_waypoints,
)
from app.engine.polyline import encode
from app.engine.restricted import RestrictedAreas
from app.engine.bikes import (
    CITY_MAX_LOOSE_SHARE,
    CITY_URBAN_COSTING,
    LOOSE_SURFACES,
    RIDING_WEIGHTS,
    costing_options_for,
    relax_surface,
)
from app.services.traffic_free import traffic_free_share
from app.mappers.analysis import AnalysisMapper
from app.schemas.loop import LoopCreateRequest, LoopResponse


# Repeated-road share above which a loop is repaired; below it the score's own
# penalty is enough.
OVERLAP_REPAIR_THRESHOLD = 0.15
# A rejected repair round still seeds the next one.
OVERLAP_REPAIR_ROUNDS = 3
# Waypoints blamed per round, and how many the ring must keep to stay a ring.
SPUR_WAYPOINTS_PER_ROUND = 2
MIN_RING_WAYPOINTS = 4
# Loops gathered when the rider prefers flat or hilly, to choose between.
HILLS_CANDIDATES = 3
# Absorbs polygon edge noise and roads along a boundary.
RESTRICTED_TOLERANCE_M = 50.0

EventSink = Callable[[str, dict[str, Any]], None]


class LoopService:
    """Generates and scores loops; the only entry point used by routes."""

    logger = logging.getLogger(__name__)

    def __init__(
        self,
        valhalla: ValhallaClient,
        dem: DemSource,
        restricted: RestrictedAreas | None = None,
    ):
        self.valhalla = valhalla
        self.dem = dem
        self.restricted = restricted or RestrictedAreas()

    async def generate(
        self, data: LoopCreateRequest, emit: EventSink | None = None
    ) -> LoopResponse:
        costing_options = costing_options_for(data.bike, data.hills, data.costing)
        self.logger.info(
            "generating loops",
            extra={
                "extra_data": {
                    "origin": [data.origin.lat, data.origin.lon],
                    "distance_km": data.distance_km,
                    "gain_m": data.gain_m,
                    "bike": data.bike,
                    "hills": data.hills,
                    "requested_routes": data.routes,
                }
            },
        )

        # City bike: urban costing first, kept only if it stayed off loose
        # ground. An explicit bicycle_type in the raw costing skips this pass.
        explicit_type = (
            data.costing is not None and data.costing.bicycle_type is not None
        )
        if data.bike == "city" and not explicit_type:
            urban = {**(costing_options or {}), **CITY_URBAN_COSTING}
            collected, _ = await self._collect(data, urban, emit, announce=False)
            firm = [
                pair
                for pair in collected
                if self._loose_share(pair[1]) <= CITY_MAX_LOOSE_SHARE
            ]
            if firm:
                for loop, analysis in firm:
                    self._announce(emit, data, loop, analysis)
                return self._respond(data, firm, None)
            self.logger.info(
                "urban pass went onto loose ground; answering with asphalt only",
                extra={"extra_data": {"candidates": len(collected)}},
            )

        collected, fallback = await self._collect(data, costing_options, emit)

        # The strict surface constraint can make every seed unroutable; relax
        # it only where that happens.
        if not collected and fallback is None and costing_options:
            relaxed = relax_surface(costing_options)
            if relaxed != costing_options:
                self.logger.info(
                    "no paved loop from this origin; relaxing the surface",
                    extra={"extra_data": {"bike": data.bike}},
                )
                collected, fallback = await self._collect(data, relaxed, emit)
                costing_options = relaxed

        return self._respond(data, collected, fallback)

    async def _collect(
        self,
        data: LoopCreateRequest,
        costing_options: dict | None,
        emit: EventSink | None = None,
        announce: bool = True,
    ) -> tuple[
        list[tuple[GeneratedLoop, Analysis]],
        tuple[GeneratedLoop, Analysis] | None,
    ]:
        """Run the seed attempts and gather the loops that came back."""
        # Each additional route bans the climbs used by the previous ones.
        avoided: list[tuple[float, float]] = []
        collected: list[tuple[GeneratedLoop, Analysis]] = []
        fallback: tuple[GeneratedLoop, Analysis] | None = None
        wanted = self._candidates_wanted(data)
        # An unroutable seed is cheap and says nothing about the next one.
        max_attempts = max(wanted * 3, 6)
        for attempt in range(max_attempts):
            if len(collected) >= wanted:
                break
            request = self._to_engine_request(
                data, seed_offset=GOLDEN_ANGLE_DEG * attempt
            )
            progress = None
            if emit is not None:
                emit("progress", self._progress(attempt, max_attempts))

                def progress(attempt_loop, seed=attempt, sink=emit):
                    sink("progress", self._progress(seed, max_attempts, attempt_loop))

            try:
                loop = await generate_loop(
                    self.valhalla,
                    self.dem,
                    request,
                    costing_options=costing_options,
                    avoid_locations=avoided or None,
                    progress=progress,
                    restricted=self.restricted,
                )
            except RouteError:
                continue  # this seed cannot be routed; try the next one
            except ValhallaError as exc:
                raise ServiceUnavailableError(
                    f"Valhalla unavailable: {exc}"
                ) from exc

            analysis = await self._analyze(
                loop,
                data.distance_km,
                data.gain_m,
                costing_options,
                data.bike,
                data.hills,
            )
            loop, analysis = await self._repair_overlap(
                loop, analysis, request, data, costing_options, avoided
            )
            inside_m = self.restricted.metres_inside(loop.coords)
            if inside_m > RESTRICTED_TOLERANCE_M:
                self.logger.info(
                    "loop enters a restricted area; trying the next seed",
                    extra={"extra_data": {"inside_m": round(inside_m)}},
                )
                continue
            if fallback is None:
                fallback = (loop, analysis)  # best effort if nothing succeeds
            if loop.infeasible or not (loop.distance_ok and loop.gain_ok):
                continue
            avoided.extend(climb_anchors(self.dem, loop.coords))
            collected.append((loop, analysis))
            if announce:
                self._announce(emit, data, loop, analysis)

        return collected, fallback

    async def _repair_overlap(
        self,
        loop: GeneratedLoop,
        analysis: Analysis,
        request: LoopRequest,
        data: LoopCreateRequest,
        costing_options: dict | None,
        avoided: list[tuple[float, float]],
    ) -> tuple[GeneratedLoop, Analysis]:
        """Drop the waypoints that made the loop double back and regenerate.

        Their ring sectors are banned by bearing. A repair is kept only when it
        repeats less and loses no ground on the targets.
        """
        original = loop
        best, best_analysis = loop, analysis
        # The newest ring, accepted or not, names the next culprit.
        probe, probe_analysis = loop, analysis
        banned = list(request.banned_bearings)
        for _ in range(OVERLAP_REPAIR_ROUNDS):
            # Judge by the loop we would answer with, not by the probe.
            if (
                best_analysis.overlap is None
                or best_analysis.overlap <= OVERLAP_REPAIR_THRESHOLD
            ):
                break
            if probe_analysis.overlap is None:
                break
            culprits = spur_waypoints(
                probe.coords,
                probe.waypoints,
                probe_analysis.spurs_m,
                request.via_points,
            )[:SPUR_WAYPOINTS_PER_ROUND]
            if not culprits:
                break
            if (
                len(banned) + len(culprits)
                > request.waypoint_count - MIN_RING_WAYPOINTS
            ):
                break  # any fewer sectors and it stops being a loop
            banned.extend(initial_bearing_deg(request.origin, c) for c in culprits)
            try:
                repaired = await generate_loop(
                    self.valhalla,
                    self.dem,
                    replace(request, banned_bearings=tuple(banned)),
                    costing_options=costing_options,
                    avoid_locations=avoided or None,
                    restricted=self.restricted,
                )
            except RouteError:
                break  # the reduced ring cannot be routed; keep what we have

            repaired_analysis = await self._analyze(
                repaired,
                data.distance_km,
                data.gain_m,
                costing_options,
                data.bike,
                data.hills,
            )
            probe, probe_analysis = repaired, repaired_analysis
            self.logger.debug(
                "overlap repair round",
                extra={
                    "extra_data": {
                        "distance_km": round(repaired.distance_km, 1),
                        "distance_ok": repaired.distance_ok,
                        "gain_ok": repaired.gain_ok,
                        "overlap": round(repaired_analysis.overlap or 0.0, 3),
                        "sectors_banned": len(banned),
                    }
                },
            )
            if self._is_better_repair(
                original,
                best,
                best_analysis,
                repaired,
                repaired_analysis,
                request.target_km,
                request.target_gain_m,
            ):
                self.logger.info(
                    "overlap repaired",
                    extra={
                        "extra_data": {
                            "before": round(best_analysis.overlap or 0.0, 3),
                            "after": round(repaired_analysis.overlap or 0.0, 3),
                            "sectors_banned": len(banned),
                        }
                    },
                )
                best, best_analysis = repaired, repaired_analysis
        return best, best_analysis

    @staticmethod
    def _is_better_repair(
        original: GeneratedLoop,
        best: GeneratedLoop,
        best_analysis: Analysis,
        candidate: GeneratedLoop,
        candidate_analysis: Analysis,
        target_km: float,
        target_gain_m: float | None,
    ) -> bool:
        """Less repetition, and no ground lost on the targets.

        Against the original: a met target stays met, a missed one is not
        missed by more.
        """
        if candidate_analysis.overlap is None or best_analysis.overlap is None:
            return False
        if candidate_analysis.overlap >= best_analysis.overlap:
            return False
        if original.distance_ok and not candidate.distance_ok:
            return False
        if original.gain_ok and not candidate.gain_ok:
            return False
        if not original.distance_ok and abs(candidate.distance_km - target_km) > abs(
            original.distance_km - target_km
        ):
            return False
        if (
            target_gain_m
            and not original.gain_ok
            and abs(candidate.gain_m - target_gain_m)
            > abs(original.gain_m - target_gain_m)
        ):
            return False
        return True

    def _respond(
        self,
        data: LoopCreateRequest,
        collected: list[tuple[GeneratedLoop, Analysis]],
        fallback: tuple[GeneratedLoop, Analysis] | None,
    ) -> LoopResponse:
        """Rank what was collected and shape the response."""
        if not collected:
            if fallback is None:
                # No seed was routable: a fact about the request (422), not the service.
                raise RoutingError("No loop could be built from this origin")
            loop, analysis = fallback
            self.logger.info(
                "loop generation fell back to best effort",
                extra={"extra_data": {"distance_km": loop.distance_km}},
            )
            return self._finalize(loop, analysis, data.include_profile)

        # Rank by cycling score: the best loop is the primary response.
        collected.sort(
            key=lambda pair: pair[1].rating.total if pair[1].rating else -1.0,
            reverse=True,
        )
        responses = [
            self._finalize(loop, analysis, data.include_profile)
            for loop, analysis in collected[: data.routes]
        ]
        primary = responses[0]
        primary.alternatives = responses[1:] or None
        self.logger.info(
            "loops generated",
            extra={
                "extra_data": {
                    "returned": len(responses),
                    "distance_km": primary.distance_km,
                    "cycling_score": (
                        round(primary.cycling_score.total, 2)
                        if primary.cycling_score
                        else None
                    ),
                }
            },
        )
        return primary

    async def _analyze(
        self,
        loop: GeneratedLoop,
        target_km: float | None,
        target_gain_m: float | None,
        costing_options: dict | None,
        bike: str | None,
        hills: str | None = None,
    ) -> Analysis:
        """One pass over trace edges -> comfort, overlap and rating."""
        # Infeasible loops are still scored: they are returned as best effort.
        if not loop.coords:
            return Analysis.unavailable()
        # TRACE_COSTING, not the bike's: a strict costing cannot match the dirt
        # a relaxed fallback rode and would report it clean.
        try:
            edges = await self.valhalla.trace_attributes(
                encode(loop.coords), TRACE_COSTING
            )
        except ValhallaError:
            # Quality metadata is optional; the loop stays valid without it.
            return Analysis.unavailable()

        try:
            car_free = await traffic_free_share(
                self.valhalla, loop.coords, TRACE_COSTING
            )
        except ValhallaError:
            car_free = None

        return analyze_edges(
            edges,
            traffic_free_share=car_free,
            distance_km=loop.distance_km,
            target_km=target_km,
            gain_m=loop.gain_m,
            target_gain_m=target_gain_m,
            weights=RIDING_WEIGHTS if bike else BALANCED_WEIGHTS,
            bike=bike,
            hills=hills,
        )

    @staticmethod
    def _progress(
        attempt: int, seeds: int, loop: GeneratedLoop | None = None
    ) -> dict[str, Any]:
        return {
            "seed": attempt + 1,
            "seeds": seeds,
            "iteration": loop.iterations if loop else 0,
            "distance_km": round(loop.distance_km, 1) if loop else None,
        }

    def _announce(
        self,
        emit: EventSink | None,
        data: LoopCreateRequest,
        loop: GeneratedLoop,
        analysis: Analysis,
    ) -> None:
        if emit is not None:
            response = self._finalize(loop, analysis, data.include_profile)
            emit("loop", response.model_dump(mode="json"))

    def _finalize(
        self,
        loop: GeneratedLoop,
        analysis: Analysis,
        include_profile: bool,
    ) -> LoopResponse:
        response = self._to_response(loop, analysis)
        if include_profile and loop.coords:
            profile = build_profile(self.dem, loop.coords)
            response.profile = AnalysisMapper.profile_points(profile)
        return response

    @staticmethod
    def _loose_share(analysis: Analysis) -> float:
        """Share of the loop on gravel, dirt, path or sand; unknown is loose."""
        comfort = analysis.comfort
        if comfort is None or comfort.total_km <= 0.0:
            return 1.0
        loose_km = sum(
            km
            for surface, km in comfort.surface_km.items()
            if surface in LOOSE_SURFACES
        )
        return loose_km / comfort.total_km

    @staticmethod
    def _candidates_wanted(data: LoopCreateRequest) -> int:
        """How many good loops to gather before ranking.

        Flat/hilly cannot be routed for, only chosen: gather a few loops and
        let the score's climbing axis pick.
        """
        prefers = data.hills in ("flat", "hilly") and data.gain_m is None
        return max(data.routes, HILLS_CANDIDATES if prefers else data.routes)

    @staticmethod
    def _to_engine_request(
        data: LoopCreateRequest, seed_offset: float = 0.0
    ) -> LoopRequest:
        return LoopRequest(
            origin=(data.origin.lat, data.origin.lon),
            target_km=data.distance_km,
            target_gain_m=data.gain_m,
            tolerance=data.tolerance,
            gain_tolerance=data.gain_tolerance,
            waypoint_count=data.waypoint_count,
            max_iterations=data.max_iterations,
            via_points=tuple((v.lat, v.lon) for v in data.via),
            seed_offset_deg=seed_offset,
        )

    @staticmethod
    def _to_response(loop: GeneratedLoop, analysis: Analysis) -> LoopResponse:
        return LoopResponse(
            distance_km=loop.distance_km,
            gain_m=loop.gain_m,
            loss_m=loop.loss_m,
            feasible=loop.distance_ok and loop.gain_ok and not loop.infeasible,
            iterations=loop.iterations,
            polyline=encode(loop.coords),
            duration_min=loop.duration_s / 60.0,
            overlap_ratio=AnalysisMapper.overlap_ratio(analysis),
            score=AnalysisMapper.quality(analysis),
            cycling_score=AnalysisMapper.cycling_score(analysis),
        )
