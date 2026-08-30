"""Encode/decode Valhalla encoded polylines.

Valhalla defaults to 1e6 precision (polyline6); the algorithm is identical to
Google's polyline5, only the coordinate multiplier differs.
"""

DEFAULT_PRECISION = 1_000_000


def decode(
    encoded: str, precision: int = DEFAULT_PRECISION
) -> list[tuple[float, float]]:
    """Decode an encoded polyline into (lat, lon) tuples."""
    coords: list[tuple[float, float]] = []
    index = 0
    lat = 0
    lon = 0
    length = len(encoded)
    while index < length:
        lat, index = _decode_value(encoded, index, lat)
        lon, index = _decode_value(encoded, index, lon)
        coords.append((lat / precision, lon / precision))
    return coords


def encode(
    coords: list[tuple[float, float]], precision: int = DEFAULT_PRECISION
) -> str:
    """Encode (lat, lon) tuples into an encoded polyline."""
    parts: list[str] = []
    prev_lat = 0
    prev_lon = 0
    for lat, lon in coords:
        ilat = round(lat * precision)
        ilon = round(lon * precision)
        parts.append(_encode_value(ilat - prev_lat))
        parts.append(_encode_value(ilon - prev_lon))
        prev_lat = ilat
        prev_lon = ilon
    return "".join(parts)


def _decode_value(encoded: str, index: int, prev: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        byte = ord(encoded[index]) - 63
        index += 1
        result |= (byte & 0x1F) << shift
        shift += 5
        if byte < 0x20:
            break
    if result & 1:
        delta = ~(result >> 1)
    else:
        delta = result >> 1
    return prev + delta, index


def _encode_value(value: int) -> str:
    value = ~(value << 1) if value < 0 else value << 1
    chunks: list[str] = []
    while value >= 0x20:
        chunks.append(chr((0x20 | (value & 0x1F)) + 63))
        value >>= 5
    chunks.append(chr(value + 63))
    return "".join(chunks)
