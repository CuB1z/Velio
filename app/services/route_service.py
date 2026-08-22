"""Point-to-point routing use case bridging the HTTP layer and Valhalla."""

from app.clients.valhalla import RouteError, ValhallaClient, ValhallaError
from app.core.exceptions import RoutingError, ServiceUnavailableError
from app.engine.analysis import Analysis, analyze_edges
from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from app.engine.polyline import encode
from app.schemas.loop import CyclingScoreOut, ProfilePointOut, Quality
from app.schemas.route import RouteOut, RouteRequestIn


class RouteService:
    """Routes between waypoints and scores the resulting path."""

    def __init__(self, valhalla: ValhallaClient, dem: DemSource):
        self.valhalla = valhalla
        self.dem = dem

    async def generate(self, data: RouteRequestIn) -> RouteOut:
        locations = [(w.lat, w.lon) for w in data.waypoints]
        try:
            result = await self.valhalla.route(locations)
        except RouteError as exc:
            raise RoutingError(f"No route found: {exc}") from exc
        except ValhallaError as exc:
            raise ServiceUnavailableError(f"Valhalla unavailable: {exc}") from exc

        coords = result.coords
        profile = build_profile(self.dem, coords)
        analysis = await self._analyze(coords, result.distance_km)

        response = RouteOut(
            distance_km=result.distance_km,
            gain_m=profile.gain_m,
            loss_m=profile.loss_m,
            polyline=encode(coords),
            duration_min=result.duration_s / 60.0,
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
            overlap_ratio=(
                round(analysis.overlap, 4) if analysis.overlap is not None else None
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
        if data.include_profile:
            response.profile = [
                ProfilePointOut(**sample.to_dict()) for sample in profile.samples
            ]
        return response

    async def _analyze(self, coords, distance_km: float) -> Analysis:
        """One pass over trace edges; optional metadata on failure."""
        try:
            edges = await self.valhalla.trace_attributes(encode(coords))
        except ValhallaError:
            return Analysis.unavailable()
        return analyze_edges(edges, distance_km=distance_km)
