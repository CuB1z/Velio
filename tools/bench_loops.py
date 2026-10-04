"""Loop-quality benchmark over a fixed origin/distance/bike matrix, in-process
because the per-edge attributes it reports are not exposed by the HTTP API.

    python -m tools.bench_loops [--label before] [--compare bench-before.json]
"""

import argparse
import asyncio
import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from app.clients.valhalla import TRACE_COSTING, ValhallaClient
from app.core.exceptions import AppError
from app.engine.dem import DemSource
from app.schemas.loop import LoopCreateRequest
from app.services.loop_service import LoopService

# Contrasting terrain: dense city, town on the plain, foot of the sierra.
ORIGINS = {
    "madrid-usera": (40.3765, -3.7592),
    "algete": (40.5964, -3.6318),
    "manzanares-sierra": (40.7269, -3.8628),
}
DISTANCES = (30.0, 60.0)
BIKES_UNDER_TEST = ("road", "city", "gravel", "mtb")

# What counts as "proper cycling", as opposed to sharing a road with cars.
RIDEABLE_USES = frozenset(
    {"cycleway", "path", "track", "living_street", "footway", "pedestrian"}
)

VALHALLA_URL = "http://localhost:8002"
ELEVATION_DIR = "valhalla/elevation"


@dataclass
class Row:
    origin: str
    distance_km: float
    bike: str
    achieved_km: float = 0.0
    gain_m: float = 0.0
    overlap: float | None = None
    comfort: float | None = None
    paved_share: float | None = None
    safety: float | None = None
    total: float | None = None
    feasible: bool = False
    surface: float | None = None
    surface_mix: dict = field(default_factory=dict)
    use_mix: dict = field(default_factory=dict)
    class_mix: dict = field(default_factory=dict)


def share_by_length(edges, attribute: str) -> dict[str, float]:
    """Fraction of the route length spent on each value of `attribute`."""
    totals: Counter[str] = Counter()
    for edge in edges:
        value = getattr(edge, attribute) or "unknown"
        totals[str(value)] += edge.length_km
    length = sum(totals.values()) or 1.0
    return {key: round(km / length, 4) for key, km in totals.most_common(8)}


async def measure(service, client, origin_name, origin, distance_km, bike) -> Row:
    """One matrix cell, via the service so seed retries and fallbacks count."""
    row = Row(origin=origin_name, distance_km=distance_km, bike=bike)
    request = LoopCreateRequest.model_validate(
        {
            "origin": {"lat": origin[0], "lon": origin[1]},
            "distance_km": distance_km,
            "bike": bike,
        }
    )
    try:
        response = await service.generate(request)
    except AppError:
        return row

    row.achieved_km = round(response.distance_km, 2)
    row.gain_m = round(response.gain_m, 1)
    row.feasible = response.feasible
    row.overlap = response.overlap_ratio
    if response.score:
        row.comfort = round(response.score.comfort, 1)
        row.paved_share = round(response.score.paved_share, 3)
    if response.cycling_score:
        row.safety = round(response.cycling_score.safety, 2)
        row.surface = round(response.cycling_score.surface, 2)
        row.total = round(response.cycling_score.total, 2)

    # Not the bike's costing: it cannot match the dirt a relaxed fallback rode.
    edges = await client.trace_attributes(response.polyline, TRACE_COSTING)
    if edges:
        row.use_mix = share_by_length(edges, "use")
        row.surface_mix = share_by_length(edges, "surface")
        row.class_mix = share_by_length(edges, "road_class")
    return row


async def run() -> list[Row]:
    client = ValhallaClient(base_url=VALHALLA_URL)
    service = LoopService(client, DemSource(ELEVATION_DIR))
    rows: list[Row] = []
    try:
        for name, origin in ORIGINS.items():
            for distance in DISTANCES:
                for bike in BIKES_UNDER_TEST:
                    rows.append(
                        await measure(service, client, name, origin, distance, bike)
                    )
                    print(".", end="", flush=True)
    finally:
        await client.aclose()
    print()
    return rows


def render(rows: list[Row]) -> None:
    header = (
        f"{'origin/bike':24} {'asked':>7} {'got':>7}"
        f" {'comfort':>7} {'surf':>6} {'safety':>6} {'score':>6}"
        f" {'unpaved':>7} {'rideable':>9}"
    )
    print(header)
    print("-" * len(header))
    for row in rows:
        rideable = sum(
            share
            for key, share in row.use_mix.items()
            if key in RIDEABLE_USES
        )
        # Off-tarmac share: the number the bike filter has to move.
        unpaved = sum(
            share
            for key, share in row.surface_mix.items()
            if key not in ("paved_smooth", "paved", "paved_rough")
        )
        name = f"{row.origin}/{row.bike}"
        print(
            f"{name:24} {row.distance_km:6.0f} {row.achieved_km:7.1f}"
            f" {row.comfort or 0:7.0f} {row.surface or 0:6.2f}"
            f" {row.safety or 0:6.2f} {row.total or 0:6.2f}"
            f" {unpaved:6.1%} {rideable:8.1%}"
        )

    print()
    print("per bike (mean):    surf   unpaved     safety")
    for bike in BIKES_UNDER_TEST:
        picked = [r for r in rows if r.bike == bike and r.safety is not None]
        if not picked:
            print(f"  {bike:10} —")
            continue

        def mean(values):
            return sum(values) / len(values)

        unpaved = [
            sum(
                share
                for key, share in r.surface_mix.items()
                if key not in ("paved_smooth", "paved", "paved_rough")
            )
            for r in picked
        ]
        print(
            f"  {bike:10} {mean([r.surface or 0 for r in picked]):9.2f}"
            f" {mean(unpaved):8.1%} {mean([r.safety or 0 for r in picked]):11.2f}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", help="save the result as bench-LABEL.json")
    parser.add_argument("--compare", help="compare against a saved result file")
    args = parser.parse_args()

    rows = asyncio.run(run())
    render(rows)

    if args.label:
        target = Path(f"bench-{args.label}.json")
        target.write_text(json.dumps([vars(r) for r in rows], indent=2))
        print(f"\nsaved to {target}")

    if args.compare:
        before = {
            (r["origin"], r["distance_km"], r["bike"]): r
            for r in json.loads(Path(args.compare).read_text())
        }
        print(f"\nchanges against {args.compare}:")
        for row in rows:
            old = before.get((row.origin, row.distance_km, row.bike))
            if not old or row.total is None or old.get("total") is None:
                continue
            name = f"{row.origin}/{row.bike} {row.distance_km:.0f} km"
            parts = []
            d_total = row.total - old["total"]
            if abs(d_total) >= 0.1:
                parts.append(
                    f"score {old['total']:.2f} → {row.total:.2f} ({d_total:+.2f})"
                )
            if row.overlap is not None and old.get("overlap") is not None:
                d_ov = row.overlap - old["overlap"]
                if abs(d_ov) >= 0.02:
                    parts.append(f"overlap {old['overlap']:.0%} → {row.overlap:.0%}")
            d_km = row.achieved_km - old.get("achieved_km", row.achieved_km)
            if abs(d_km) >= 1.0:
                parts.append(f"km {old['achieved_km']:.1f} → {row.achieved_km:.1f}")
            if parts:
                print(f"  {name}: " + " · ".join(parts))
        # The number that matters most, in one line.
        paired = [
            (row.total, before[(row.origin, row.distance_km, row.bike)]["total"])
            for row in rows
            if row.total is not None
            and before.get((row.origin, row.distance_km, row.bike), {}).get("total")
            is not None
        ]
        if paired:
            now = sum(a for a, _ in paired) / len(paired)
            was = sum(b for _, b in paired) / len(paired)
            print(
                f"\n  mean score: {was:.2f} → {now:.2f} ({now - was:+.2f})"
                f" over {len(paired)} cells"
            )


if __name__ == "__main__":
    main()
