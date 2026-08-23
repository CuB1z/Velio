"""Loop generation use case bridging the HTTP layer and the engine."""

import logging

from app.clients.valhalla import RouteError, ValhallaClient, ValhallaError
from app.core.exceptions import ServiceUnavailableError
from app.engine.analysis import Analysis, analyze_edges
from app.engine.cycling_score import BALANCED_WEIGHTS, Weights
from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from app.engine.loop import (
    GOLDEN_ANGLE_DEG,
    GeneratedLoop,
    LoopRequest,
    climb_anchors,
    generate_loop,
)
from app.engine.polyline import encode
from app.engine.profiles import RIDING_PROFILES
from app.schemas.loop import (
    CyclingScoreOut,
    LoopOut,
    LoopRequestIn,
    ProfilePointOut,
    Quality,
)


class LoopService:
    """Generates and scores loops; the only entry point used by routes."""

    logger = logging.getLogger(__name__)

    def __init__(self, valhalla: ValhallaClient, dem: DemSource):
        self.valhalla = valhalla
        self.dem = dem

    async def generate(self, data: LoopRequestIn) -> LoopOut:
        costing_options = self._costing_options(data)
        weights = (
            RIDING_PROFILES[data.profile].weights if data.profile else BALANCED_WEIGHTS
        )
        self.logger.info(
            "generating loops",
            extra={
                "extra_data": {
                    "origin": [data.origin.lat, data.origin.lon],
                    "distance_km": data.distance_km,
                    "gain_m": data.gain_m,
                    "profile": data.profile,
                    "requested_routes": data.routes,
                }
            },
        )

        # Each additional route bans the climbs used by the previous ones.
        avoided: list[tuple[float, float]] = []
        collected: list[tuple[GeneratedLoop, Analysis]] = []
        fallback: tuple[GeneratedLoop, Analysis] | None = None
        max_attempts = max(data.routes * 3, 3)
        for attempt in range(max_attempts):
            if len(collected) >= data.routes:
                break
            request = self._to_engine_request(
                data, seed_offset=GOLDEN_ANGLE_DEG * attempt
            )
            try:
                loop = await generate_loop(
                    self.valhalla,
                    self.dem,
                    request,
                    costing_options=costing_options,
                    avoid_locations=avoided or None,
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
                weights,
            )
            if fallback is None:
                fallback = (loop, analysis)  # best effort if nothing succeeds
            if loop.infeasible or not (loop.distance_ok and loop.gain_ok):
                continue
            avoided.extend(climb_anchors(self.dem, loop.coords))
            collected.append((loop, analysis))

        if not collected:
            if fallback is None:
                raise ServiceUnavailableError("Valhalla produced no usable loop")
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
        weights: Weights,
    ) -> Analysis:
        """One pass over trace edges -> comfort, overlap and rating."""
        if loop.infeasible or not loop.coords:
            return Analysis.unavailable()
        try:
            edges = await self.valhalla.trace_attributes(
                encode(loop.coords), costing_options
            )
        except ValhallaError:
            # Quality metadata is optional; the loop stays valid without it.
            return Analysis.unavailable()
        return analyze_edges(
            edges,
            distance_km=loop.distance_km,
            target_km=target_km,
            gain_m=loop.gain_m,
            target_gain_m=target_gain_m,
            weights=weights,
        )

    def _finalize(
        self,
        loop: GeneratedLoop,
        analysis: Analysis,
        include_profile: bool,
    ) -> LoopOut:
        response = self._to_response(loop, analysis)
        if include_profile and loop.coords:
            profile = build_profile(self.dem, loop.coords)
            response.profile = [
                ProfilePointOut(**sample.to_dict()) for sample in profile.samples
            ]
        return response

    @staticmethod
    def _costing_options(data: LoopRequestIn) -> dict | None:
        """Named riding profile as base, explicit costing options on top."""
        options: dict = {}
        if data.profile:
            options.update(RIDING_PROFILES[data.profile].costing)
        if data.costing:
            options.update(
                {
                    key: value
                    for key, value in data.costing.model_dump().items()
                    if value is not None
                }
            )
        return options or None

    @staticmethod
    def _to_engine_request(
        data: LoopRequestIn, seed_offset: float = 0.0
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
    def _to_response(loop: GeneratedLoop, analysis: Analysis) -> LoopOut:
        return LoopOut(
            distance_km=loop.distance_km,
            gain_m=loop.gain_m,
            loss_m=loop.loss_m,
            feasible=loop.distance_ok and loop.gain_ok and not loop.infeasible,
            iterations=loop.iterations,
            polyline=encode(loop.coords),
            duration_min=loop.duration_s / 60.0,
            overlap_ratio=(
                round(analysis.overlap, 4) if analysis.overlap is not None else None
            ),
            score=(
                Quality(
                    comfort=analysis.comfort.comfort,
                    paved_share=analysis.comfort.paved_share,
                    surface_km=analysis.comfort.surface_km,
                    climb_load_m=analysis.comfort.climb_load_m,
                    max_grade_pct=analysis.comfort.max_grade_pct,
                )
                if analysis.comfort
                else None
            ),
            cycling_score=(
                CyclingScoreOut(
                    distance=analysis.rating.distance,
                    safety=analysis.rating.safety,
                    elevation=analysis.rating.elevation,
                    overlap_penalty=analysis.rating.overlap_penalty,
                    total=analysis.rating.total,
                )
                if analysis.rating
                else None
            ),
        )
