import pytest

from app.engine.polyline import decode, encode


def approx_points(points, **tolerance):
    return [pytest.approx(point, **tolerance) for point in points]


def test_decode_known_polyline5_vector():
    coords = decode("_p~iF~ps|U_ulLnnqC_mqNvxq`@", precision=100_000)
    assert coords == approx_points(
        [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
    )


def test_encode_known_polyline5_vector():
    encoded = encode(
        [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)], precision=100_000
    )
    assert encoded == "_p~iF~ps|U_ulLnnqC_mqNvxq`@"


def test_roundtrip_default_precision():
    coords = [
        (40.416775, -3.703790),
        (40.420000, -3.690000),
        (40.931497, -4.050000),
        (40.355600, -3.900123),
    ]
    assert decode(encode(coords)) == approx_points(coords, abs=1e-6)


def test_negative_and_zero_deltas():
    coords = [(0.0, 0.0), (-10.0, 10.0), (0.0, 0.0), (10.0, -10.0)]
    assert decode(encode(coords)) == approx_points(coords, abs=1e-6)
