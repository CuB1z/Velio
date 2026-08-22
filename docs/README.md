# Cycling Router — Documentation

Self-hosted cycling route engine built on [Valhalla](https://github.com/valhalla/valhalla) and OpenStreetMap data, with an external elevation pipeline.

## Contents

| Document | Description |
|---|---|
| [data.md](data.md) | Data lifecycle: what exists, where it lives, build-time vs runtime requirements, production deployment checklist |
| [valhalla.md](valhalla.md) | Valhalla setup: build pipeline, Docker runtime, HTTP API endpoints used by the project |
| [elevation.md](elevation.md) | Elevation: DEM data source, elevation tiles, `/height` endpoint, grade attributes, and the `app/engine` elevation pipeline |

## Repository layout

```
app/
└── engine/              Elevation engine (Python package, production code)
    ├── polyline.py      Encoded polyline encode/decode (1e6 precision)
    ├── dem.py           .hgt.gz tile reader with bilinear lookup + LRU cache
    ├── geo.py           Shared geodesic math (haversine, destination point)
    ├── elevation.py     Resampling, smoothing, gain/loss/grade metrics
    ├── loop.py          Circular route generator (library, no I/O)
    └── models.py        ProfileSample / ElevationProfile dataclasses

tools/                  Development CLIs (not part of the app)
├── valhalla.py         Minimal Valhalla HTTP client shared by the CLIs
├── elevation_cli.py    Profile for a route, validated against /height
└── loop_cli.py         Circular route generator CLI

tests/
└── engine/              Unit tests (synthetic tiles, known vectors)

data/                  Source datasets (gitignored, re-downloadable)
├── regions.json       Catalog of downloadable OSM extracts (versioned)
└── spain.osm.pbf      OSM extract for Spain (~1.4 GB)

scripts/
├── download_osm.sh         Download OSM extracts listed in data/regions.json
├── build_tiles.sh          OSM PBF -> Valhalla config + routing tiles
├── download_elevation.sh   Download elevation tiles covered by the graph
├── setup_valhalla.sh       Orchestration: OSM + build + elevation + start + validate
└── smoke_test_height.sh    Smoke test for the /height endpoint

valhalla/              Runtime state, mounted into the container at /data
├── config/            valhalla.json (versioned), *.sqlite (generated)
├── tiles/             Routing tiles (~2.1 GB, generated)
└── elevation/         Elevation tiles (~1 GB, gitignored)

requirements.txt       Runtime dependencies (numpy)
requirements-dev.txt   Development dependencies (pytest)
docs/                  This documentation
docker-compose.yaml    Runtime service definition (port 8002)
```

See [data.md](data.md) for the full data lifecycle and the production
deployment checklist.

## Quick start

```bash
# Full setup from a fresh clone: download Spain, build tiles,
# download elevation, start container, validate
./scripts/setup_valhalla.sh --region spain

# Individual steps
./scripts/download_osm.sh --list  # see available regions (data/regions.json)
./scripts/download_osm.sh spain   # download an OSM extract only
./scripts/build_tiles.sh          # rebuild config + routing tiles from data/spain.osm.pbf
./scripts/download_elevation.sh   # download elevation tiles only
docker compose up -d valhalla     # start the service

# Verify
./scripts/smoke_test_height.sh
curl http://localhost:8002/status

# Elevation engine: unit tests + end-to-end validation against /height
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -q
.venv/bin/python -m tools.elevation_cli 40.4168 -3.7038 40.7850 -3.9600
```
