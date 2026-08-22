"""GPX 1.1 export for engine-computed routes.

The track points come straight from the elevation profile samples, so the
file carries the same DEM elevations the engine reported as gain/loss.
"""

from datetime import datetime, timezone
from xml.etree.ElementTree import Element, SubElement, tostring

from .models import ProfileSample

GPX_NS = "http://www.topografix.com/GPX/1/1"


def build_gpx(
    samples: list[ProfileSample],
    *,
    name: str,
    description: str | None = None,
    creator: str = "cycling-router",
) -> str:
    """Render profile samples as a GPX 1.1 document with elevation data."""
    if not samples:
        raise ValueError("cannot build GPX without samples")

    gpx = Element("gpx", {"version": "1.1", "creator": creator, "xmlns": GPX_NS})
    metadata = SubElement(gpx, "metadata")
    SubElement(metadata, "time").text = (
        datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    )

    trk = SubElement(gpx, "trk")
    SubElement(trk, "name").text = name
    if description is not None:
        SubElement(trk, "desc").text = description
    segment = SubElement(trk, "trkseg")
    for sample in samples:
        point = SubElement(
            segment,
            "trkpt",
            {
                "lat": f"{sample.lat:.6f}",
                "lon": f"{sample.lon:.6f}",
            },
        )
        SubElement(point, "ele").text = f"{sample.elevation_m:.1f}"

    return tostring(gpx, encoding="unicode", xml_declaration=True)
