"""Point-to-point routing use case bridging the HTTP layer and Valhalla."""

from app.clients.valhalla import RouteError, ValhallaClient, ValhallaError
from app.core.exceptions import RoutingError, ServiceUnavailableError
from app.engine.analysis import Analysis, analyze_edges
from app.engine.dem import DemSource
from app.engine.elevation import build_profile
from app.engine.polyline import encode
from app.mappers.analysis import AnalysisMapper
from app.schemas.route import RouteCreateRequest, RouteResponse


class RouteService:
    """Routes between waypoints and scores the resulting path."""

    def __init__(self, valhalla: ValhallaClient, dem: DemSource):
        self.valhalla = valhalla
        self.dem = dem

    async def generate(self, data: RouteCreateRequest) -> RouteResponse:
        locations = [(w.lat, w.lon) for w in data.waypoints]
        try:
            if data.alternatives:
                results = await self.valhalla.route_alternatives(
                    locations, count=data.alternatives
                )
            else:
                results = [await self.valhalla.route(locations)]
        except RouteError as exc:
            raise RoutingError(f"No route found: {exc}") from exc
        except ValhallaError as exc:
            raise ServiceUnavailableError(f"Valhalla unavailable: {exc}") from exc

        routes = [
            await self._finalize(result, data.include_profile) for result in results
        ]
        primary = routes[0]
        primary.alternatives = routes[1:] or None
        return primary

    async def _finalize(
        self, result, include_profile: bool
    ) -> RouteResponse:
        profile = build_profile(self.dem, result.coords)
        analysis = await self._analyze(result.coords, result.distance_km)

        response = RouteResponse(
            distance_km=result.distance_km,
            gain_m=profile.gain_m,
            loss_m=profile.loss_m,
            polyline=encode(result.coords),
            duration_min=result.duration_s / 60.0,
            overlap_ratio=AnalysisMapper.overlap_ratio(analysis),
            score=AnalysisMapper.quality(analysis),
            cycling_score=AnalysisMapper.cycling_score(analysis),
        )
        if include_profile:
            response.profile = AnalysisMapper.profile_points(profile)
        return response

    async def _analyze(self, coords, distance_km: float) -> Analysis:
        """One pass over trace edges; optional metadata on failure."""
        try:
            edges = await self.valhalla.trace_attributes(encode(coords))
        except ValhallaError:
            return Analysis.unavailable()
        return analyze_edges(edges, distance_km=distance_km)
