"""How much of a route is closed to cars.

Edge attributes cannot tell a car-free park road from a farm track; only
/locate exposes access flags, so the route is sampled and each sample located.
"""

from app.clients.valhalla import ValhallaClient

# One /locate call, about 200 ms.
MAX_SAMPLES = 120


def sample_evenly(
    coords: list[tuple[float, float]], count: int = MAX_SAMPLES
) -> list[tuple[float, float]]:
    """Evenly spaced points along the coordinate list, ends included."""
    if len(coords) <= count:
        return list(coords)
    step = (len(coords) - 1) / (count - 1)
    return [coords[round(i * step)] for i in range(count)]


async def traffic_free_share(
    client: ValhallaClient,
    coords: list[tuple[float, float]],
    costing_options: dict | None = None,
) -> float | None:
    """Fraction of the route where cars are not allowed, or None if unknown.

    None, not 0.0: an unknown share must not mark the route down.
    """
    if len(coords) < 2:
        return None
    if not hasattr(client, "locate"):
        return None

    points = sample_evenly(coords)
    snapped = await client.locate(points, costing_options)
    usable = [edge for edge in snapped if edge.reachable]
    if not usable:
        return None
    return sum(1 for edge in usable if edge.car_free) / len(usable)
