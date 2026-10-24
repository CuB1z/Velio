"""Point-in-polygon and length-inside queries over restricted areas."""

import json

import pytest

from app.engine.geo import haversine_m
from app.engine.restricted import CELL_DEG, RestrictedAreas


def square(lon0: float, lat0: float, side: float) -> list[tuple[float, float]]:
    return [
        (lon0, lat0),
        (lon0 + side, lat0),
        (lon0 + side, lat0 + side),
        (lon0, lat0 + side),
        (lon0, lat0),
    ]


BASE = RestrictedAreas([[square(-3.80, 40.37, 0.02), square(-3.795, 40.375, 0.005)]])


def test_inside_outside_and_hole():
    assert BASE.contains(40.372, -3.798)
    assert not BASE.contains(40.36, -3.798)
    assert not BASE.contains(40.3775, -3.7925)


def test_polygon_spanning_several_grid_cells():
    big = RestrictedAreas([[square(-3.9, 40.3, CELL_DEG * 3)]])
    assert big.contains(40.3 + CELL_DEG * 2.5, -3.9 + CELL_DEG * 2.5)


def test_metres_inside_a_crossing_line():
    lat = 40.38
    line = [(lat, -3.81 + i * 0.0005) for i in range(81)]
    expected = haversine_m((lat, -3.80), (lat, -3.78))
    assert BASE.metres_inside(line) == pytest.approx(expected, rel=0.05)


def test_empty_areas_say_nothing():
    empty = RestrictedAreas()
    assert len(empty) == 0
    assert not empty.contains(40.37, -3.79)
    assert empty.metres_inside([(40.37, -3.79), (40.38, -3.78)]) == 0.0


def test_loads_polygons_and_multipolygons_from_geojson(tmp_path):
    path = tmp_path / "areas.geojson"
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {"geometry": {"type": "Polygon", "coordinates": [square(0, 0, 1)]}},
                    {
                        "geometry": {
                            "type": "MultiPolygon",
                            "coordinates": [[square(5, 5, 1)], [square(8, 8, 1)]],
                        }
                    },
                    {"geometry": {"type": "Point", "coordinates": [1, 1]}},
                ],
            }
        )
    )
    areas = RestrictedAreas.from_geojson(path)
    assert len(areas) == 3
    assert areas.contains(8.5, 8.5)
