"""Loop generation use case bridging the HTTP layer and the engine."""

from app.clients.valhalla import ValhallaClient, ValhallaError
from app.core.exceptions import ServiceUnavailableError
from app.engine.dem import DemSource
from app.engine.loop import GeneratedLoop, LoopRequest, generate_loop
from app.engine.polyline import encode
from app.engine.scoring import RouteScore, score_edges
from app.schemas.loop import LoopOut, LoopRequestIn, Quality


class LoopService:
    """Generates and scores loops; the only entry point used by routes."""

    def __init__(self, valhalla: ValhallaClient, dem: DemSource):
        self.valhalla = valhalla
        self.dem = dem

    async def generate(self, data: LoopRequestIn) -> LoopOut:
        try:
            loop = await generate_loop(
                self.valhalla,
                self.dem,
                self._to_engine_request(data),
            )
        except ValhallaError as exc:
            raise ServiceUnavailableError(f"Valhalla unavailable: {exc}") from exc
        return self._to_response(loop, await self._score(loop))

    async def _score(self, loop: GeneratedLoop) -> RouteScore | None:
        """Best-effort quality score; the loop stays valid without it."""
        if loop.infeasible or not loop.coords:
            return None
        try:
            edges = await self.valhalla.trace_attributes(encode(loop.coords))
            return score_edges(edges)
        except ValhallaError:
            return None

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
    def _to_response(loop: GeneratedLoop, score: RouteScore | None) -> LoopOut:
        return LoopOut(
            distance_km=loop.distance_km,
            gain_m=loop.gain_m,
            loss_m=loop.loss_m,
            feasible=loop.distance_ok and loop.gain_ok and not loop.infeasible,
            iterations=loop.iterations,
            polyline=encode(loop.coords),
            score=(
                Quality(
                    comfort=score.comfort,
                    paved_share=score.paved_share,
                    surface_km=score.surface_km,
                    climb_load_m=score.climb_load_m,
                    max_grade_pct=score.max_grade_pct,
                )
                if score
                else None
            ),
        )
