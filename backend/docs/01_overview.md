# Velio — Documentation

Self-hosted cycling route engine built on [Valhalla](https://github.com/valhalla/valhalla) and OpenStreetMap data, with an external elevation pipeline and a FastAPI service on top.

## Contents

| Document | Description |
|---|---|
| [05_api.md](05_api.md) | HTTP API reference: auth (OTP verification, OAuth), loops, routes, analysis, configuration |
| [02_data.md](02_data.md) | Data lifecycle: what exists, where it lives, build-time vs runtime requirements, production deployment checklist |
| [03_valhalla.md](03_valhalla.md) | Valhalla setup: build pipeline, Docker runtime, HTTP API endpoints used by the project |
| [04_elevation.md](04_elevation.md) | Elevation: DEM data source, elevation tiles, `/height` endpoint, grade attributes, and the `app/engine` elevation pipeline |

## Repository layout

```
app/
├── main.py               FastAPI application factory point
├── api/                  HTTP layer: routers per resource, dependencies
│   ├── auth/             Register/login/verify/resend/change-password + OAuth round trips
│   ├── health/           Service status endpoint
│   └── v1/               Business endpoints: loops, routes (+ exports helper)
├── clients/              Outbound adapters behind small ports
│   ├── mail.py           MailSender port: console (dev/test) + Brevo transactional API
│   ├── oauth.py          OAuth provider registry and gateway (Google)
│   └── valhalla.py       Valhalla HTTP client shared by the app and the CLIs
├── core/                 App infrastructure
│   ├── config.py         Pydantic settings (env-driven)
│   ├── database.py       Async engine, sessions, Alembic runner
│   ├── exceptions.py     Every exception: generic AppError family, domain, providers
│   ├── lifespan.py       Startup/shutdown of shared resources
│   ├── logging.py        Structured one-line-per-event logging
│   ├── middleware.py     Access log middleware + global rate-limit ceiling
│   ├── ratelimit.py      Per-endpoint budgets, sliding-window limiter port + memory adapter
│   └── security.py       JWT issue/verify, OTP generation, password policy + hashing
├── engine/               Routing & elevation engine (library, no I/O beyond tiles)
│   ├── polyline.py       Encoded polyline encode/decode (1e6 precision)
│   ├── dem.py            .hgt.gz tile reader with bilinear lookup + LRU cache
│   ├── geo.py            Shared geodesic math (haversine, destination point)
│   ├── elevation.py      Resampling, smoothing, gain/loss/grade metrics
│   ├── loop.py           Circular route generator
│   ├── edges.py          Per-edge attribute extraction from /trace_attributes
│   ├── scoring.py        Route quality scoring from edge data
│   ├── gpx.py            GPX 1.1 export with DEM elevation data
│   └── models.py         ProfileSample / ElevationProfile dataclasses
├── models/               SQLAlchemy ORM models (users, identities, tokens, codes)
├── repositories/         Persistence per aggregate (users, refresh tokens, codes)
├── schemas/              Pydantic request/response schemas per resource
└── services/             Use cases binding repositories and clients

migrations/               Alembic environment + versioned migrations
tools/                    Development CLIs (not part of the app)
├── elevation_cli.py      Profile for a route, validated against /height
└── loop_cli.py           Circular route generator CLI

tests/
├── unit/                 Direct module tests (gateways, logging, middleware)
├── api/                  Endpoint tests through the FastAPI app
├── engine/               Engine tests (synthetic tiles, known vectors)
└── e2e/                  Full journeys; skip automatically when Valhalla is down

data/                     Source datasets (gitignored, re-downloadable)
├── regions.json          Catalog of downloadable OSM extracts (versioned)
├── <region>.osm.pbf      One OSM extract per region, with <region>.poly
├── coverage.osm.pbf      The region extracts merged into one file
├── coverage.geojson      Covered regions' boundaries (versioned)
└── restricted_areas.geojson  Military areas and airfields (versioned)

scripts/
├── download_osm.sh         Download OSM extracts listed in data/regions.json
├── build_tiles.sh          OSM PBF -> Valhalla config + routing tiles
├── download_elevation.sh   Download elevation tiles covered by the graph
├── setup_valhalla.sh       Orchestration: OSM + build + elevation + start + validate
└── smoke_test_height.sh    Smoke test for the /height endpoint

valhalla/                 Runtime state, mounted into the container at /data
├── config/               valhalla.json (versioned), *.sqlite (generated)
├── tiles/                Routing tiles (~2.1 GB, generated)
└── elevation/            Elevation tiles (~1 GB, gitignored)

requirements.txt          Runtime dependencies
requirements-dev.txt      Development dependencies (pytest, ruff)
docs/                     This documentation
Dockerfile                API image
../docker/                Compose files (dev stack: API :8000, Valhalla :8002, Postgres :5432)
```

See [02_data.md](02_data.md) for the full data lifecycle and the production
deployment checklist.

## Quick start

```bash
# Full setup from a fresh clone: download and merge the regions, build
# tiles, download elevation, start container, validate
./scripts/setup_valhalla.sh                   # spain,canary-islands,portugal,andorra
./scripts/setup_valhalla.sh --regions spain   # a single region

# Individual steps
./scripts/download_osm.sh --list  # see available regions (data/regions.json)
./scripts/download_osm.sh spain   # download an OSM extract only
./scripts/build_tiles.sh          # rebuild config + routing tiles from data/coverage.osm.pbf
./scripts/download_elevation.sh   # download elevation tiles only
docker compose -f ../docker/docker-compose.dev.yaml up -d valhalla   # start the service

# Verify
./scripts/smoke_test_height.sh
curl http://localhost:8002/status

# Engine: unit tests + end-to-end tests (skip automatically when service is down)
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -q
.venv/bin/python -m tools.elevation_cli 40.4168 -3.7038 40.7850 -3.9600
```
