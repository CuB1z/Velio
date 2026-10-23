"""Covered regions: point queries, bbox and the shipped coverage file."""

import json
from pathlib import Path

import pytest

from app.engine.coverage import WORLD_BBOX, Coverage

from tests.engine.test_restricted import square

COVERAGE_FILE = Path(__file__).resolve().parents[2] / "data" / "coverage.geojson"


def feature(key: str, iso: str, polygons: list) -> dict:
    return {
        "type": "Feature",
        "properties": {"key": key, "name": key.title(), "iso": iso},
        "geometry": {"type": "MultiPolygon", "coordinates": polygons},
    }


@pytest.fixture
def mainland_and_island(tmp_path) -> Coverage:
    mainland = [square(-4.0, 40.0, 1.0), square(-3.6, 40.4, 0.2)]
    island = [square(2.0, 39.0, 0.5)]
    path = tmp_path / "coverage.geojson"
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    feature("mainland", "ES", [mainland]),
                    feature("island", "ES", [island]),
                    feature("neighbour", "PT", [[square(-8.0, 40.0, 1.0)]]),
                ],
            }
        )
    )
    return Coverage.from_geojson(path)


def test_points_on_the_mainland_and_the_island_are_covered(mainland_and_island):
    assert mainland_and_island.contains(40.2, -3.8)
    assert mainland_and_island.contains(39.2, 2.2)


def test_the_sea_and_a_hole_are_not_covered(mainland_and_island):
    assert not mainland_and_island.contains(39.5, 0.0)
    assert not mainland_and_island.contains(40.5, -3.5)


def test_outside_lists_the_indexes_of_uncovered_points(mainland_and_island):
    points = [(40.2, -3.8), (48.85, 2.35), (39.2, 2.2), (31.6, -7.98)]
    assert mainland_and_island.outside(points) == [1, 3]


def test_regions_bbox_and_isos(mainland_and_island):
    assert [region.key for region in mainland_and_island.regions] == [
        "mainland",
        "island",
        "neighbour",
    ]
    assert mainland_and_island.bbox == (-8.0, 39.0, 2.5, 41.0)
    assert mainland_and_island.isos == ["ES", "PT"]


def test_everywhere_covers_any_point():
    coverage = Coverage.everywhere()
    assert coverage.contains(48.85, 2.35)
    assert coverage.outside([(48.85, 2.35), (-33.9, 151.2)]) == []
    assert coverage.regions == []
    assert coverage.bbox == WORLD_BBOX


@pytest.mark.parametrize(
    ("lat", "lon", "covered"),
    [
        pytest.param(40.4168, -3.7038, True, id="Madrid"),
        pytest.param(38.7223, -9.1393, True, id="Lisbon"),
        pytest.param(28.1235, -15.4363, True, id="Las Palmas"),
        pytest.param(32.6669, -16.9241, True, id="Funchal"),
        pytest.param(37.7412, -25.6756, True, id="Ponta Delgada"),
        pytest.param(42.5063, 1.5218, True, id="Andorra la Vella"),
        pytest.param(48.8566, 2.3522, False, id="Paris"),
        pytest.param(31.6295, -7.9811, False, id="Marrakesh"),
        pytest.param(35.7595, -5.8340, False, id="Tangier"),
        pytest.param(42.6887, 2.8948, False, id="Perpignan"),
    ],
)
def test_the_shipped_coverage_file(lat, lon, covered):
    assert Coverage.from_geojson(COVERAGE_FILE).contains(lat, lon) is covered
