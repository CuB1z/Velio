"""Engine analysis results -> route/loop HTTP schemas."""

from app.engine.analysis import Analysis
from app.schemas.loop import CyclingScore, ProfilePoint, Quality


class AnalysisMapper:
    """Encapsulates every translation from an engine Analysis."""

    @staticmethod
    def quality(analysis: Analysis) -> Quality | None:
        comfort = analysis.comfort
        if comfort is None:
            return None
        return Quality(
            comfort=comfort.comfort,
            paved_share=comfort.paved_share,
            surface_km=comfort.surface_km,
            climb_load_m=comfort.climb_load_m,
            max_grade_pct=comfort.max_grade_pct,
        )

    @staticmethod
    def cycling_score(analysis: Analysis) -> CyclingScore | None:
        rating = analysis.rating
        if rating is None:
            return None
        return CyclingScore(
            distance=rating.distance,
            surface=round(rating.surface, 2),
            safety=rating.safety,
            elevation=rating.elevation,
            overlap_penalty=rating.overlap_penalty,
            total=rating.total,
        )

    @staticmethod
    def overlap_ratio(analysis: Analysis) -> float | None:
        return round(analysis.overlap, 4) if analysis.overlap is not None else None

    @staticmethod
    def profile_points(profile) -> list[ProfilePoint]:
        return [ProfilePoint(**sample.to_dict()) for sample in profile.samples]
