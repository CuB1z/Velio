"""Point-to-point routing use case bridging the HTTP layer and Valhalla."""

from app.clients.valhalla import RouteError, ValhallaClient, ValhallaError
from app.core.exceptions import RoutingError, ServiceUnavailableError
from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from app.engine.polyline import encode
from app.engine.scoring import RouteScore, score_edges
from app.schemas.loop import Quality
from app.schemas.route import RouteOut, RouteRequestIn


class RouteService:
    """Routes between waypoints and scores the resulting path."""

    def __init__(self, valhalla: ValhallaClient, dem: DemSource):
        self.valhalla = valhalla
        self.dem = dem

    async def generate(self, data: RouteRequestIn) -> RouteOut:
        locations = [(w.lat, w.lon) for w in data.waypoints]
        try:
            coords, distance_km = await self.valhalla.route(locations)
        except RouteError as exc:
            raise RoutingError(f"No route found: {exc}") from exc
        except ValhallaError as exc:
            raise ServiceUnavailableError(f"Valhalla unavailable: {exc}") from exc

        profile = build_profile(self.dem, coords)
        return self._to_response(
            coords,
            distance_km,
            profile.gain_m,
            profile.loss_m,
            await self._score(coords),
        )

    async def _score(self, coords) -> RouteScore | None:
        """Best-effort quality score; the route stays valid without it."""
        try:
            edges = await self.valhalla.trace_attributes(encode(coords))
            return score_edges(edges)
        except ValhallaError:
            return None

    @staticmethod
    def _to_response(
        coords: list[tuple[float, float]],
        distance_km: float,
        gain_m: float,
        loss_m: float,
        score: RouteScore | None,
    ) -> RouteOut:
        return RouteOut(
            distance_km=distance_km,
            gain_m=gain_m,
            loss_m=loss_m,
            polyline=encode(coords),
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
