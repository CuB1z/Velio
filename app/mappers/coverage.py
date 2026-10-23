"""Engine coverage -> covered-regions HTTP schema."""

from app.engine.coverage import Coverage
from app.schemas.coverage import CoverageGeometry, CoverageRegion, CoverageResponse


class CoverageMapper:
    """Encapsulates the translation of the covered regions."""

    @staticmethod
    def out(coverage: Coverage) -> CoverageResponse:
        return CoverageResponse(
            regions=[
                CoverageRegion(key=region.key, name=region.name, iso=region.iso)
                for region in coverage.regions
            ],
            bbox=coverage.bbox,
            geometry=(
                CoverageGeometry(coordinates=coverage.polygons)
                if coverage.polygons
                else None
            ),
        )
