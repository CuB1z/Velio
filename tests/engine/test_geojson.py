"""Unit tests for the GeoJSON exporter."""

from app.engine.cycling_score import CyclingScore
from app.engine.geojson import build_geojson

MADRID = (40.4168, -3.7038)
SEGOVIA = (40.9481, -4.1180)


def test_coordinates_are_lon_lat_ordered():
    doc = build_geojson([MADRID, SEGOVIA], name="r", distance_km=74.12)
    line = doc["features"][0]["geometry"]["coordinates"]
    assert line[0] == [-3.7038, 40.4168]
    assert line[1] == [-4.118, 40.9481]


def test_elevations_extend_points_when_given():
    doc = build_geojson(
        [MADRID, SEGOVIA],
        name="r",
        distance_km=1.0,
        elevations=[650.25, 1000.0],
    )
    assert doc["features"][0]["geometry"]["coordinates"][0] == [
        -3.7038,
        40.4168,
        650.2,
    ]


def test_properties_carry_metrics():
    score = CyclingScore(
        distance=10.0, safety=7.5, overlap_penalty=0.0, total=8.5
    )
    doc = build_geojson(
        [MADRID, SEGOVIA],
        name="test-route",
        distance_km=74.123,
        duration_min=187.44,
        gain_m=1053.6,
        loss_m=988.2,
        overlap_ratio=0.08123,
        cycling_score=score,
    )
    props = doc["features"][0]["properties"]
    assert props["name"] == "test-route"
    assert props["distance_km"] == 74.12
    assert props["duration_min"] == 187.4
    assert props["elevation_gain_m"] == 1054
    assert props["overlap_ratio"] == 0.0812
    assert props["cycling_score"]["total"] == 8.5


def test_optional_metrics_default_to_null():
    doc = build_geojson([MADRID, SEGOVIA], name="r", distance_km=1.0)
    props = doc["features"][0]["properties"]
    assert props["duration_min"] is None
    assert props["cycling_score"] is None
    assert props["overlap_ratio"] is None


def test_document_is_a_feature_collection():
    doc = build_geojson([MADRID, SEGOVIA], name="r", distance_km=1.0)
    assert doc["type"] == "FeatureCollection"
    feature = doc["features"][0]
    assert feature["type"] == "Feature"
    assert feature["geometry"]["type"] == "LineString"
