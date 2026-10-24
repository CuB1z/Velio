from xml.etree.ElementTree import fromstring

import pytest

from app.engine.gpx import build_gpx
from app.engine.models import ProfileSample

NS = {"g": "http://www.topografix.com/GPX/1/1"}


def samples():
    return [
        ProfileSample(40.0, -3.0, 0.0, 650.0),
        ProfileSample(40.001, -3.001, 150.0, 655.5),
        ProfileSample(40.002, -3.002, 300.0, 661.25),
    ]


def test_gpx_is_valid_gpx11_with_track_points():
    root = fromstring(build_gpx(samples(), name="Loop"))
    assert root.tag == "{http://www.topografix.com/GPX/1/1}gpx"
    assert root.attrib["version"] == "1.1"
    points = root.findall(".//g:trkpt", NS)
    assert len(points) == 3
    assert points[0].attrib["lat"] == "40.000000"
    assert points[0].attrib["lon"] == "-3.000000"


def test_gpx_elevations_match_samples():
    root = fromstring(build_gpx(samples(), name="Loop"))
    elevations = [e.text for e in root.findall(".//g:ele", NS)]
    assert elevations == ["650.0", "655.5", "661.2"]


def test_gpx_includes_name_and_description():
    root = fromstring(build_gpx(samples(), name="My Loop", description="70 km"))
    trk = root.find("g:trk", NS)
    assert trk.findtext("g:name", namespaces=NS) == "My Loop"
    assert trk.findtext("g:desc", namespaces=NS) == "70 km"


def test_gpx_description_is_optional():
    root = fromstring(build_gpx(samples(), name="My Loop"))
    assert root.find(".//g:trk/g:desc", NS) is None


def test_gpx_has_metadata_time():
    root = fromstring(build_gpx(samples(), name="Loop"))
    timestamp = root.findtext(".//g:metadata/g:time", namespaces=NS)
    assert timestamp is not None and timestamp.endswith("Z")


def test_empty_samples_raise():
    with pytest.raises(ValueError):
        build_gpx([], name="Empty")
