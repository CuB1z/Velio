"""Standalone analysis use cases: score or profile an existing shape."""

from app.clients.valhalla import ValhallaClient, ValhallaError
from app.core.exceptions import ServiceUnavailableError, ValidationError
from app.engine.analysis import Analysis, analyze_edges
from app.engine.dem import DemSource
from app.engine.elevation import build_profile, cumulative_distances
from app.engine.polyline import decode
from app.schemas.analysis import AnalysisOut, ElevationOut, PolylineIn
from app.schemas.loop import CyclingScoreOut, ProfilePointOut, Quality


class RouteAnalysisService:
    """Scores and profiles arbitrary polylines without re-routing."""

    def __init__(self, valhalla: ValhallaClient, dem: DemSource):
        self.valhalla = valhalla
        self.dem = dem

    async def analyze(self, data: PolylineIn) -> AnalysisOut:
        coords = self._coords(data.polyline)
        distance_km = self._distance_km(coords)
        profile = build_profile(self.dem, coords)

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

        return AnalysisOut(
            distance_km=distance_km,
            gain_m=profile.gain_m,
            loss_m=profile.loss_m,
            score=self._comfort(analysis),
            overlap_ratio=(
                round(analysis.overlap, 4) if analysis.overlap is not None else None
            ),
            cycling_score=self._rating(analysis),
        )

    def elevation(self, data: PolylineIn) -> ElevationOut:
        coords = self._coords(data.polyline)
        profile = build_profile(self.dem, coords)
        return ElevationOut(
            distance_km=profile.distance_km,
            gain_m=profile.gain_m,
            loss_m=profile.loss_m,
            max_uphill_grade_pct=profile.max_uphill_grade_pct,
            max_downhill_grade_pct=profile.max_downhill_grade_pct,
            profile=[
                ProfilePointOut(**sample.to_dict()) for sample in profile.samples
            ],
        )

    @staticmethod
    def _coords(polyline: str) -> list[tuple[float, float]]:
        coords = decode(polyline)
        if len(coords) < 2:
            raise ValidationError("polyline must decode to at least two points")
        return coords

    @staticmethod
    def _distance_km(coords) -> float:
        return cumulative_distances(coords)[-1] / 1000.0

    @staticmethod
    def _comfort(analysis: Analysis) -> Quality | None:
        if analysis.comfort is None:
            return None
        c = analysis.comfort
        return Quality(
            comfort=c.comfort,
            paved_share=c.paved_share,
            surface_km=c.surface_km,
            climb_load_m=c.climb_load_m,
            max_grade_pct=c.max_grade_pct,
        )

    @staticmethod
    def _rating(analysis: Analysis) -> CyclingScoreOut | None:
        if analysis.rating is None:
            return None
        r = analysis.rating
        return CyclingScoreOut(
            distance=r.distance,
            safety=r.safety,
            elevation=r.elevation,
            overlap_penalty=r.overlap_penalty,
            total=r.total,
        )
