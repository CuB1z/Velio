"""Standalone analysis use cases: score or profile an existing shape."""

from app.clients.valhalla import ValhallaClient, ValhallaError
from app.core.exceptions import ServiceUnavailableError, ValidationError
from app.engine.analysis import analyze_edges
from app.engine.dem import DemSource
from app.engine.elevation import build_profile, cumulative_distances
from app.engine.polyline import decode
from app.mappers.analysis import AnalysisMapper
from app.schemas.analysis import AnalysisResponse, ElevationResponse, PolylineRequest


class RouteAnalysisService:
    """Scores and profiles arbitrary polylines without re-routing."""

    def __init__(self, valhalla: ValhallaClient, dem: DemSource):
        self.valhalla = valhalla
        self.dem = dem

    async def analyze(self, data: PolylineRequest) -> AnalysisResponse:
        coords = self._coords(data.polyline)
        distance_km = self._distance_km(coords)
        profile = self._profile(coords)

        try:
            edges = await self.valhalla.trace_attributes(data.polyline)
            analysis = analyze_edges(
                edges,
                distance_km=distance_km,
                target_km=data.target_km,
                gain_m=profile.gain_m,
                target_gain_m=data.target_gain_m,
            )
        except ValhallaError as exc:
            raise ServiceUnavailableError(
                f"Valhalla unavailable: {exc}"
            ) from exc

        return AnalysisResponse(
            distance_km=distance_km,
            gain_m=profile.gain_m,
            loss_m=profile.loss_m,
            score=AnalysisMapper.quality(analysis),
            overlap_ratio=AnalysisMapper.overlap_ratio(analysis),
            cycling_score=AnalysisMapper.cycling_score(analysis),
        )

    def elevation(self, data: PolylineRequest) -> ElevationResponse:
        coords = self._coords(data.polyline)
        profile = self._profile(coords)
        return ElevationResponse(
            distance_km=profile.distance_km,
            gain_m=profile.gain_m,
            loss_m=profile.loss_m,
            max_uphill_grade_pct=profile.max_uphill_grade_pct,
            max_downhill_grade_pct=profile.max_downhill_grade_pct,
            profile=AnalysisMapper.profile_points(profile),
        )

    @staticmethod
    def _coords(polyline: str) -> list[tuple[float, float]]:
        coords = decode(polyline)
        if len(coords) < 2:
            raise ValidationError("polyline must decode to at least two points")
        return coords

    def _profile(self, coords):
        try:
            return build_profile(self.dem, coords)
        except ValueError as exc:
            raise ValidationError(
                f"polyline has no usable DEM coverage: {exc}"
            ) from exc

    @staticmethod
    def _distance_km(coords) -> float:
        return cumulative_distances(coords)[-1] / 1000.0
