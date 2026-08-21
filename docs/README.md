# Cycling Router — Documentation

Self-hosted cycling route engine built on [Valhalla](https://github.com/valhalla/valhalla) and OpenStreetMap data, with an external elevation pipeline.

## Contents

| Document | Description |
|---|---|
| [data.md](data.md) | Data lifecycle: what exists, where it lives, build-time vs runtime requirements, production deployment checklist |
| [valhalla.md](valhalla.md) | Valhalla setup: build pipeline, Docker runtime, HTTP API endpoints used by the project |
| [elevation.md](elevation.md) | Elevation: DEM data source, elevation tiles, `/height` endpoint, grade attributes, and the planned decoupled elevation pipeline |

## Repository layout

```
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
```
