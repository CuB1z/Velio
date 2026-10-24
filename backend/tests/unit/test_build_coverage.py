from tools.build_coverage import build, parse_poly, simplify

POLY = """region
1
   0.0 0.0
   4.0 0.0
   4.0 4.0
   0.0 4.0
END
!2
   1.0 1.0
   2.0 1.0
   2.0 2.0
   1.0 1.0
END
3
   10.0 10.0
   11.0 10.0
   11.0 11.0
END
END
"""


def test_outer_rings_start_polygons_and_bang_rings_are_their_holes():
    polygons = parse_poly(POLY)
    assert len(polygons) == 2
    assert len(polygons[0]) == 2
    assert len(polygons[1]) == 1
    assert all(ring[0] == ring[-1] for polygon in polygons for ring in polygon)


def test_simplify_drops_collinear_points_and_keeps_the_ring_closed():
    ring = [
        (0.0, 0.0),
        (1.0, 0.0),
        (2.0, 0.0),
        (2.0, 2.0),
        (1.0, 2.001),
        (0.0, 2.0),
        (0.0, 0.0),
    ]
    simplified = simplify(ring, tolerance=0.01)
    assert simplified == [(0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0), (0.0, 0.0)]


def test_simplify_never_collapses_a_small_ring():
    ring = [(0.0, 0.0), (0.0001, 0.0), (0.0001, 0.0001), (0.0, 0.0)]
    assert simplify(ring, tolerance=1.0) == ring


def test_build_writes_one_feature_per_region_with_its_iso_code(tmp_path):
    (tmp_path / "isle.poly").write_text(POLY)
    regions = {"isle": {"name": "Isle", "iso": "IS", "url": "x", "poly": "y"}}
    collection = build(["isle"], regions, tmp_path, tolerance=0.001)
    [feature] = collection["features"]
    assert feature["properties"] == {"key": "isle", "name": "Isle", "iso": "IS"}
    assert feature["geometry"]["type"] == "MultiPolygon"
    assert len(feature["geometry"]["coordinates"]) == 2
