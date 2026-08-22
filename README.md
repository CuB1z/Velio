# Cycling Router

Self-hosted cycling route engine built on [Valhalla](https://github.com/valhalla/valhalla)
and OpenStreetMap data. Goal: point-to-point and circular cycling routes,
scored by road quality, surface, cycling infrastructure and elevation —
starting with full Spain coverage.

## Status

Working today:

- Valhalla bicycle routing over a full-Spain graph (~2.1 GB tiles, built from
  the Geofabrik Spain extract in ~8 minutes)
- Per-edge road attributes via `/trace_attributes` (road class, surface,
  cycle lanes, etc.)
- Elevation lookups via `/height` backed by Copernicus DEM GLO-30 tiles
  (~1 GB, decoupled from the routing graph)
- Elevation engine (`app/engine/`): elevation profiles, gain/loss and grades
  computed from the same DEM tiles — validated against `/height` with
  MAE 0.62 m on a 74 km mountain route

- Route quality scoring (`app/engine/scoring.py`): comfort (surface-weighted,
  0-100), climb load and surface breakdown per generated loop, from
  `/trace_attributes` edge data
- GPX export with DEM elevation data (`--gpx PREFIX`): the generated tracks
  carry per-point elevation computed by the engine

Planned next: FastAPI service. See [docs/data.md](docs/data.md)
and the project spec for details.

## Architecture

```
OpenStreetMap PBF ──> build_tiles.sh ──> Valhalla tiles ──> valhalla_service (Docker :8002)
Geofabrik catalog  ──> download_osm.sh
Copernicus DEM     ──> download_elevation.sh ──> .hgt.gz tiles ──> /height + app/engine
```

The routing graph carries baked-in elevation (`mjolnir.use_elevation`), so
slope weighs on route calculation through the bicycle costing options (e.g.
`use_hills`). The Python elevation engine (`app/engine/`) reads the same DEM
tiles directly for high-resolution profiles and metrics. Details in
[docs/elevation.md](docs/elevation.md).

## Requirements

- Docker + Docker Compose
- `curl` and `jq`
- Python 3.12+ (elevation engine and tests)
- ~5 GB free disk for the Spain dataset (PBF + tiles + elevation)

## Quick start

```bash
# One command from a fresh clone: downloads Spain OSM data, builds routing
# tiles, downloads elevation, starts the container and validates endpoints
./scripts/setup_valhalla.sh --region spain

# Verify
./scripts/smoke_test_height.sh
```

Useful requests once the service is up (`http://localhost:8002`):

```bash
# Elevation for arbitrary points
curl -X POST localhost:8002/height -H 'Content-Type: application/json' \
  -d '{"shape":[{"lat":40.4168,"lon":-3.7038}]}'

# Bicycle route
curl -X POST localhost:8002/route -H 'Content-Type: application/json' \
  -d '{"shape":[{"lat":40.4168,"lon":-3.7038},{"lat":40.8570,"lon":-3.9863}],"costing":"bicycle"}'
```

## Elevation engine

```bash
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt

# Tests (unit + end-to-end, E2E skip automatically when service is down)
.venv/bin/python -m pytest tests/ -q

# Profile + validation for a route (Madrid -> Navacerrada Port)
.venv/bin/python -m tools.elevation_cli 40.4168 -3.7038 40.7850 -3.9600
```

## Loop generator (prototype)

Generates circular routes from an origin: waypoints are placed on a ring
around the origin, routed through, measured and re-scaled until the requested
distance (default tolerance 5%) and elevation gain (20%) are met. Typically
converges in 2-3 iterations per route, about a second each.

Terrain awareness: when a gain target is set, waypoint selection is biased
toward high ground (`hilliness`), the ring stretches toward hills
(`stretch`) and, if needed, an explicit summit waypoint is inserted. If the
requested distance/gain combination cannot be met from that origin, the
generator says so instead of returning a bad route (exit code 2).

Loops can also be forced through intermediate points (`--via LAT LON`,
repeatable); the generator folds them into the ring and rescales around
them.

Each generated loop is also scored via Valhalla's `/trace_attributes`:
`comfort` (0-100, distance-weighted surface quality), paved share with the
top surfaces, climb load (vertical-equivalent meters of positive grade) and
max upward grade.

```bash
# 60 km loop from Madrid city centre
.venv/bin/python -m tools.loop_cli 40.4168 -3.7038 --distance-km 60

# 70 km / 900 m D+ loop from Algete
.venv/bin/python -m tools.loop_cli 40.5964 -3.6318 --distance-km 70 --gain-m 900

# Three distinct loops: each one bans the climbs used by the previous ones
.venv/bin/python -m tools.loop_cli 40.5964 -3.6318 --distance-km 70 --routes 3

# Costing options pass through to Valhalla
.venv/bin/python -m tools.loop_cli 40.5964 -3.6318 --distance-km 50 \
    --bicycle-type Mountain --avoid-bad-surfaces 0 --use-hills 1

# Export to GPX with elevation data (loop.gpx / loop_0.gpx, loop_1.gpx, ...)
.venv/bin/python -m tools.loop_cli 40.5964 -3.6318 --distance-km 70 --gpx loop

# Force the loop through intermediate points (repeatable)
.venv/bin/python -m tools.loop_cli 40.5964 -3.6318 --distance-km 130 \
    --via 40.7917 -3.9635

# Options: --routes N --waypoints N --iterations N --tolerance F
#          --gain-tolerance F --verbose --gpx PREFIX --base-url URL
```

Effort scoring from surface/grade data is a next step; `use_hills`,
`avoid_bad_surfaces` and `bicycle_type` already shape route selection through
the Valhalla bicycle costing.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/download_osm.sh` | Download OSM extracts listed in `data/regions.json` |
| `scripts/build_tiles.sh` | Build Valhalla config + routing tiles from an OSM PBF |
| `scripts/download_elevation.sh` | Download elevation tiles covered by the graph |
| `scripts/setup_valhalla.sh` | Orchestrate everything end to end |
| `scripts/smoke_test_height.sh` | Validate the `/height` endpoint |

Shared helpers live in `scripts/lib/common.sh`.

## Documentation

| Document | Contents |
|---|---|
| [docs/data.md](docs/data.md) | Data lifecycle: what lives where, build vs runtime needs, production checklist |
| [docs/valhalla.md](docs/valhalla.md) | Build pipeline, runtime configuration, HTTP API |
| [docs/elevation.md](docs/elevation.md) | Elevation source, tiles, `/height`, grade caveats, `app/engine` pipeline |

## License / data attribution

Routing data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, extracts by [Geofabrik](https://download.geofabrik.de/).
Elevation data: Copernicus DEM GLO-30.
