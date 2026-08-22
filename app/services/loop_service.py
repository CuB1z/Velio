"""Loop generation use case bridging the HTTP layer and the engine."""


from typing import NamedTuple

from app.clients.valhalla import COSTING_PROFILES, ValhallaClient, ValhallaError
from app.core.exceptions import ServiceUnavailableError
from app.engine.cycling_score import CyclingScore, cycling_score
from app.engine.dem import DemSource
from app.engine.loop import GeneratedLoop, LoopRequest, generate_loop
from app.engine.overlap import overlap_ratio
from app.engine.polyline import encode
from app.engine.scoring import RouteScore, score_edges
from app.schemas.loop import CyclingScoreOut, LoopOut, LoopRequestIn, Quality


class Analysis(NamedTuple):
    """Quality metrics derived from one /trace_attributes pass."""

    comfort: RouteScore | None
    overlap: float | None
    rating: CyclingScore | None


class LoopService:
    """Generates and scores loops; the only entry point used by routes."""

    def __init__(self, valhalla: ValhallaClient, dem: DemSource):
        self.valhalla = valhalla
        self.dem = dem

    async def generate(self, data: LoopRequestIn) -> LoopOut:
        costing_options = (
            dict(COSTING_PROFILES[data.profile]) if data.profile else None
        )
        try:
            loop = await generate_loop(
                self.valhalla,
                self.dem,
                self._to_engine_request(data),
                costing_options=costing_options,
            )
        except ValhallaError as exc:
            raise ServiceUnavailableError(f"Valhalla unavailable: {exc}") from exc

        analysis = await self._analyze(loop, data.distance_km, costing_options)
        return self._to_response(loop, analysis)

    async def _analyze(
        self,
        loop: GeneratedLoop,
        target_km: float,
        costing_options: dict | None,
    ) -> Analysis:
        """One pass over trace edges -> comfort, overlap and rating."""
        if loop.infeasible or not loop.coords:
            return Analysis(None, None, None)
        try:
            edges = await self.valhalla.trace_attributes(
                encode(loop.coords), costing_options
            )
        except ValhallaError:
            # Quality metadata is optional; the loop stays valid without it.
            return Analysis(None, None, None)

        ratio = overlap_ratio(edges)
        return Analysis(
            comfort=score_edges(edges),
            overlap=ratio,
            rating=cycling_score(
                edges,
                distance_km=loop.distance_km,
                target_km=target_km,
                overlap_ratio=ratio,
            ),
        )

    @staticmethod
    def _to_engine_request(data: LoopRequestIn) -> LoopRequest:
        return LoopRequest(
            origin=(data.origin.lat, data.origin.lon),
            target_km=data.distance_km,
            target_gain_m=data.gain_m,
            tolerance=data.tolerance,
            gain_tolerance=data.gain_tolerance,
            waypoint_count=data.waypoint_count,
            max_iterations=data.max_iterations,
            via_points=tuple((v.lat, v.lon) for v in data.via),
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
                    overlap_penalty=analysis.rating.overlap_penalty,
                    total=analysis.rating.total,
                )
                if analysis.rating
                else None
            ),
        )
