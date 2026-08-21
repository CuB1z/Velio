# Valhalla Setup

How Valhalla is built, configured and run in this project.

## Overview

Valhalla is the routing engine. It converts the OpenStreetMap extract into a
pre-built graph (tiles) and serves routing requests over HTTP. The runtime does
not need the `.osm.pbf` — only the generated tiles and config.

```
data/spain.osm.pbf
        │
        ▼
valhalla_build_admins + valhalla_build_tiles     (scripts/build_tiles.sh)
        │
        ▼
valhalla/tiles/  (~2.1 GB, 1836 tiles for Spain)
        │
        ▼
valhalla_service  (Docker, port 8002)
```

Current build stats for Spain:

| Metric | Value |
|---|---|
| OSM PBF | ~1.4 GB |
| Routing tiles | ~2.1 GB |
| Tiles generated | 1836 |
| Build time | ~7 min 30 s |

Docker image: `ghcr.io/valhalla/valhalla:3.8.2` (pinned in all scripts).

## Build pipeline (`scripts/build_tiles.sh`)

Runs four containerized steps in order:

1. **Config generation** — `valhalla_build_config` writes
   `valhalla/config/valhalla.json`. Key settings:
   - `mjolnir.tile_dir: /data/tiles`
   - `mjolnir.tile_extract: /data/tiles.tar`
   - `additional_data.elevation: /data/elevation/`
2. **Timezones** — `valhalla_build_timezones` -> `config/timezones.sqlite`.
3. **Administrative areas** — `valhalla_build_admins` from the PBF ->
   `config/admins.sqlite`.
4. **Routing tiles** — `valhalla_build_tiles` from the PBF -> `tiles/`, then
   `valhalla_build_extract` packs them into `tiles.tar`.

The script is currently hardcoded to `data/spain.osm.pbf`; the intent is to
make it accept multiple PBFs so several countries share one routing space.

## Runtime (`docker-compose.yaml`)

```yaml
image:    ghcr.io/valhalla/valhalla:3.8.2
command:  valhalla_service /data/config/valhalla.json 4   # 4 threads
ports:    8002:8002
volume:   ./valhalla -> /data
restart:  unless-stopped
```

On startup the service loads the tiles referenced by the config. No OSM data
is required at runtime.

## Orchestration (`scripts/setup_valhalla.sh`)

End-to-end setup used after a fresh clone or a data refresh:

1. Build config + tiles (`build_tiles.sh`)
2. Download elevation tiles (`download_elevation.sh`)
3. `docker compose up -d --force-recreate valhalla` and wait for readiness
4. Validate `/status` and `/height` with real coordinates

Flags: `--skip-build`, `--skip-elevation`, `--no-start`.

## HTTP API

Base URL: `http://localhost:8002`

### `/status`

Service health and version info. Used by `setup_valhalla.sh` as readiness probe.

### `/route` (POST)

Point-to-point routing. Returns distance, time, geometry and maneuvers.
Example body:

```json
{
  "shape": [{"lat": 40.4168, "lon": -3.7038}, {"lat": 40.8570, "lon": -3.9863}],
  "costing": "bicycle"
}
```

### `/trace_attributes` (POST)

The most important endpoint for the Cycling Core layer: given a shape (e.g. a
route geometry), it returns per-edge attributes along it:

```
way_id, length, road_class, use, surface, speed, speed_type, lane_count,
cycle_lane, bicycle_network, sidewalk, shoulder, truck_route, density,
bridge, tunnel, roundabout, traffic_signal, toll, traversability,
max_upward_grade, max_downward_grade, weighted_grade
```

Example body:

```json
{
  "shape": [{"lat": 40.4168, "lon": -3.7038}, {"lat": 40.4268, "lon": -3.6938}],
  "costing": "bicycle",
  "attributes": ["edge.max_upward_grade", "edge.weighted_grade"],
  "shape_format": "polyline6"
}
```

A ~3 km test route returned 80 edges with all road attributes populated.

> **Note:** grade attributes (`max_upward_grade`, etc.) currently return `-500`
> because elevation is not baked into the graph. See
> [elevation.md](elevation.md#grade-attributes-return--500) for details.

### `/height` (POST)

Returns elevation values for arbitrary points using the downloaded elevation
tiles. See [elevation.md](elevation.md).

## Known limitations

- Grade attributes are not populated yet (see elevation docs).
- `build_tiles.sh` only supports the Spain dataset for now.
