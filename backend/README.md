# Velio · backend

Self-hosted cycling route engine built on [Valhalla](https://github.com/valhalla/valhalla)
and OpenStreetMap data. Goal: point-to-point and circular cycling routes,
scored by road quality, surface, cycling infrastructure and elevation —
covering Spain and Portugal, islands included, plus Andorra.

## Status

Working today:

- Valhalla bicycle routing over one graph for Spain, the Canary Islands,
  Portugal (Azores and Madeira included) and Andorra (~2.7 GB tiles, built
  from the merged Geofabrik extracts in ~13 minutes)
- Per-edge road attributes via `/trace_attributes` (road class, surface,
  cycle lanes, etc.)
- Elevation lookups via `/height` backed by Copernicus DEM GLO-30 tiles
  (~1 GB, decoupled from the routing graph)
- Elevation engine (`app/engine/`): elevation profiles, gain/loss and grades
  computed from the same DEM tiles — validated against `/height` with
  MAE 0.62 m on a 74 km mountain route
- Route quality scoring (`app/engine/scoring.py`): comfort (surface-weighted,
  0-100), climb load and surface breakdown per generated route, from
  `/trace_attributes` edge data; plus a multi-factor `cycling_score` (0-10)
  blending distance accuracy, road safety attributes and a repeated-road
  overlap penalty (`app/engine/cycling_score.py`, `app/engine/overlap.py`)
- GPX export with DEM elevation data (`--gpx PREFIX` in the loop CLI): the
  generated tracks carry per-point elevation computed by the engine
- FastAPI HTTP service (`app/main.py`): circular loops and point-to-point
  routes over REST, geometry as encoded polylines, DEM gain/loss and quality
  score included — plus per-user saved routes for replaying past results —
  see [docs/05_api.md](docs/05_api.md)

## Architecture

```
Geofabrik catalog  ──> download_osm.sh ──> <region>.osm.pbf + <region>.poly
Region extracts    ──> tools/merge_regions.py ──> data/coverage.osm.pbf
Merged PBF         ──> build_tiles.sh ──> Valhalla tiles ──> valhalla_service (Docker :8002)
Boundary polygons  ──> tools/build_coverage.py ──> data/coverage.geojson
Copernicus DEM     ──> download_elevation.sh ──> .hgt.gz tiles ──> /height + app/engine
Merged PBF         ──> tools/extract_restricted_areas.py ──> data/restricted_areas.geojson ──> loop engine
```

The routing graph carries baked-in elevation (`mjolnir.use_elevation`), so
slope weighs on route calculation through the bicycle costing options (e.g.
`use_hills`). The Python elevation engine (`app/engine/`) reads the same DEM
tiles directly for high-resolution profiles and metrics. Details in
[docs/04_elevation.md](docs/04_elevation.md).

## Requirements

- Docker + Docker Compose
- `curl` and `jq`
- Python 3.12+ (elevation engine and tests)
- ~11 GB free disk to build the dataset (extracts, merged PBF, tiles,
  elevation); the server keeps ~3.9 GB of it
- ~8 GB of free RAM for the build (see
  [docs/02_data.md](docs/02_data.md#resources))

## Quick start

```bash
# One command from a fresh clone: downloads and merges the Spain, Canary
# Islands, Portugal and Andorra extracts, builds routing tiles, downloads
# elevation, starts the container and validates endpoints
./scripts/setup_valhalla.sh

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

## HTTP service

The engine also runs as a FastAPI service exposing circular loops and
point-to-point routes. Full endpoint reference in [docs/05_api.md](docs/05_api.md).

```bash
# Start (reads VALHALLA_URL / VALHALLA_ELEVATION_DIR, defaults to localhost:8002
# and ./valhalla/elevation)
uvicorn app.main:app --reload --port 8000

# Generate a 70 km / 900 m D+ road loop from Algete (Bearer token from /api/v1/auth/login)
curl -s -X POST localhost:8000/api/v1/loops -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"origin":{"lat":40.5964,"lon":-3.6318},"distance_km":70,"gain_m":900,"bike":"road"}' | jq

# The same as Server-Sent Events: progress, each loop as found, then the result
curl -N -X POST localhost:8000/api/v1/loops/stream -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"origin":{"lat":40.5964,"lon":-3.6318},"distance_km":60,"routes":3}'

# Covered regions (public); points outside them answer 422 OUT_OF_COVERAGE
curl -s localhost:8000/api/v1/coverage | jq '{regions, bbox}'

# Point-to-point route with up to two scored alternatives
curl -s -X POST localhost:8000/api/v1/routes -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"waypoints":[{"lat":40.4168,"lon":-3.7038},{"lat":40.7850,"lon":-3.9600}],"alternatives":2}' | jq

# Health and docs
curl -s localhost:8000/api/health | jq   # {"status":"ok","version":"0.35.0"}

# Prometheus metrics (closed unless METRICS_ENABLED=true; see docs/05_api.md)
curl -s localhost:8000/metrics -H "Authorization: Bearer $METRICS_TOKEN" | head
open localhost:8000/docs

# Export any route as GPX (DEM elevation included) or GeoJSON
curl -s -X POST 'localhost:8000/api/v1/loops?format=gpx' \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"origin":{"lat":40.5964,"lon":-3.6318},"distance_km":70}' -o loop.gpx

# Or run everything containerised from the repo root: API on :8000,
# Valhalla on :8002, sharing the backend/valhalla data directory. Compose
# files live in the root docker/ folder; configuration comes from your
# environment (--env-file), never from the compose files themselves.
docker compose --env-file backend/.env -f docker/docker-compose.dev.yaml up -d --build api

# Isolated TEST stack (dev conveniences on: any code verifies accounts).
# Point --env-file at your own env file for the stack:
docker compose --env-file <your-env-file> \
  -f docker/docker-compose.test.yaml up -d --build api
```

Configuration comes from the environment (or a `.env`): `VALHALLA_URL`,
`VALHALLA_ELEVATION_DIR`, `VALHALLA_TIMEOUT_S`, `CORS_ORIGINS`, `DEBUG`,
`RATE_LIMIT_ENABLED`.
Accounts are verified by email before they can log in: registration sends a
six digit code (Brevo transactional API when `BREVO_API_KEY` is set, the
application log otherwise) and `POST /api/v1/auth/verify` activates the
account. Passwords follow a shared strength policy, can be rotated
through `POST /api/v1/auth/change-password` or recovered without a
session via `POST /api/v1/auth/forgot-password` + `POST /api/v1/auth/reset-password`
(both revoke live sessions), and
activated riders are filed into a Brevo contacts list when `BREVO_LIST_ID`
is set — full flow in [docs/05_api.md](docs/05_api.md).
Logging is structured one-dict-per-line on stdout (`app/core/logging.py`):
service events carry their fields, uvicorn's own records flow through the
same pipeline, and every HTTP request emits one access event with
`request_id`, `method`, `path`, `status`, `duration_ms` and the
proxy-aware `client_ip` (`X-Forwarded-For`). The container entry point is
`start.sh`, where pre-start steps (e.g. future migrations) belong; uvicorn
workers are set with `UVICORN_WORKERS` (default 1, e.g. `UVICORN_WORKERS=2 start.sh`
behind a reverse proxy) and the port with `PORT` (default 8000).

Both endpoints return the geometry as an encoded polyline (`polyline`,
[polyline6](https://developers.google.com/maps/documentation/utilities/polylineutility)
precision — decodable by any map library), distance and DEM-based
`gain_m` / `loss_m`, plus an optional `score` block with comfort,
paved share, surface breakdown, climb load and max grade. Loops add a
`feasible` flag (best-effort route with `feasible: false` when the targets
cannot be met from that origin), riding `duration_min`, `overlap_ratio`
(repeated-road share outside the ±1.5 km urban window) and a multi-factor
`cycling_score` in 0-10 (distance accuracy + road safety - overlap penalty).
Errors share one JSON body:
`{"error", "message", "details"}` — validation/routing failures answer `422`,
an unreachable Valhalla answers `503`, and exhausted rate-limit budgets
answer `429` with a `Retry-After` header.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/download_osm.sh` | Download OSM extracts listed in `data/regions.json` |
| `scripts/build_tiles.sh` | Build Valhalla config + routing tiles from an OSM PBF (default `data/coverage.osm.pbf`) |
| `scripts/download_elevation.sh` | Download elevation tiles covered by the graph |
| `scripts/setup_valhalla.sh` | Orchestrate everything end to end |
| `scripts/smoke_test_height.sh` | Validate the `/height` endpoint |
| `scripts/deploy_tiles.sh` | Ship tiles/config/elevation to the runtime host (`--local` or `--host user@vps`) and smoke test it |

Shared helpers live in `scripts/lib/common.sh`.

## Code hygiene

Before opening a PR run both checks; they must exit clean:

```bash
ruff check .        # lint (rules in ruff.toml)
mypy app/           # static types (config in mypy.ini)
```

Install the dev extras (`pip install -r requirements-dev.txt`) to get `mypy`;
`ruff` is in the same file. As with tests, use the project `.venv`.

## Documentation

| Document | Contents |
|---|---|
| [docs/01_overview.md](docs/01_overview.md) | Index of these docs, quick start and project layout |
| [docs/02_data.md](docs/02_data.md) | Data lifecycle: what lives where, build vs runtime needs, production checklist |
| [docs/03_valhalla.md](docs/03_valhalla.md) | Build pipeline, runtime configuration, HTTP API |
| [docs/04_elevation.md](docs/04_elevation.md) | Elevation source, tiles, `/height`, grade caveats, `app/engine` pipeline |
| [docs/05_api.md](docs/05_api.md) | HTTP API reference: auth, loops, routes, analysis, saved routes, configuration |

## License / data attribution

Routing data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, extracts by [Geofabrik](https://download.geofabrik.de/).
Elevation data: Copernicus DEM GLO-30.
