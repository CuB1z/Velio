"""Data models for the elevation pipeline."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProfileSample:
    """One point of the elevation profile."""

    lat: float
    lon: float
    distance_m: float
    elevation_m: float
    grade_pct: float | None = None

    def to_dict(self) -> dict:
        return {
            "lat": round(self.lat, 6),
            "lon": round(self.lon, 6),
            "distance_m": round(self.distance_m, 1),
            "elevation_m": round(self.elevation_m, 1),
            "grade_pct": (
                round(self.grade_pct, 2) if self.grade_pct is not None else None
            ),
        }


@dataclass(frozen=True)
class ElevationProfile:
    """Aggregated elevation metrics for a route."""

    distance_km: float
    gain_m: float
    loss_m: float
    max_uphill_grade_pct: float
    max_downhill_grade_pct: float
    samples: list[ProfileSample] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "distance_km": round(self.distance_km, 3),
            "gain_m": round(self.gain_m, 1),
            "loss_m": round(self.loss_m, 1),
            "max_uphill_grade_pct": round(self.max_uphill_grade_pct, 2),
            "max_downhill_grade_pct": round(self.max_downhill_grade_pct, 2),
            "samples": len(self.samples),
        }
