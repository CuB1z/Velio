# Valhalla Setup

How Valhalla is built, configured and run in this project.

## Overview

Valhalla is the routing engine. It converts the merged OpenStreetMap extract
into a pre-built graph (tiles) and serves routing requests over HTTP. The runtime does
not need the `.osm.pbf` — only the generated tiles and config.

```
data/<region>.osm.pbf  (spain, canary-islands, portugal, andorra)
        │  tools/merge_regions.py
        ▼
data/coverage.osm.pbf
        │
        ▼
valhalla_build_admins + valhalla_build_tiles     (scripts/build_tiles.sh)
        │
        ▼
valhalla/tiles/  (~2.7 GB, 2107 tiles)
        │
        ▼
valhalla_service  (Docker, port 8002)
```

Current build stats (2026-10-11, Spain + Canary Islands + Portugal + Andorra):

| Metric | Value |
|---|---|
| Merged OSM PBF | 1.98 GB |
| Routing tiles | ~2.7 GB |
| Tiles generated | 2107 |
| Build time | ~13 min (`build_tiles.sh`, 6 threads) |

Sizes, timings and RAM for every step are in [02_data.md](02_data.md#resources).

Docker image: `ghcr.io/valhalla/valhalla:3.8.2` (pinned in all scripts).

## Build pipeline (`scripts/build_tiles.sh`)

Runs four containerized steps in order:

1. **Config generation** — `valhalla_build_config` writes
   `valhalla/config/valhalla.json`. Key settings:
   - `mjolnir.tile_dir: /data/tiles`
   - `mjolnir.tile_extract: /data/tiles.tar`
   - `additional_data.elevation: /data/elevation/`
   - `mjolnir.use_elevation: true` — set afterwards with `jq` (the builder
     has no CLI flag for it); bakes grades into the graph so the bicycle
     costing can weigh slopes
2. **Timezones** — `valhalla_build_timezones` -> `config/timezones.sqlite`.
3. **Administrative areas** — `valhalla_build_admins` from the merged PBF ->
   `config/admins.sqlite`.
4. **Routing tiles** — `valhalla_build_tiles` from the merged PBF -> `tiles/`, then
   `valhalla_build_extract` packs them into `tiles.tar`.

Takes the PBF as its only argument (default `data/coverage.osm.pbf`) and
needs a populated `valhalla/elevation/` (`download_elevation.sh`): without
elevation tiles the build still succeeds but edges carry no grades.

## Runtime (`docker/docker-compose.dev.yaml`)

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

1. Download the regions' extracts and boundary polygons (`download_osm.sh`)
2. Merge them into `data/coverage.osm.pbf` (`tools/merge_regions.py`; skipped
   for a single region)
3. Write `data/coverage.geojson` (`tools/build_coverage.py`) and
   `data/restricted_areas.geojson` (`tools/extract_restricted_areas.py`)
4. Build config + tiles (`build_tiles.sh`)
5. Download elevation tiles (`download_elevation.sh`) and, when that added
   files, build the tiles again so their grades are baked in
6. `docker compose -f docker/docker-compose.dev.yaml up -d --force-recreate valhalla` (from the repo root) and wait for readiness
7. Validate `/status` and `/height` with real coordinates

Flags: `--regions <keys>` (default `spain,canary-islands,portugal,andorra`),
`--region <key>`, `--skip-build`, `--skip-elevation`, `--no-start`. The
Python steps use `.venv/bin/python` unless `PYTHON` points elsewhere.

## HTTP API

Base URL: `http://localhost:8002`

### `/status`

Service health and version info. Used by `setup_valhalla.sh` as readiness probe.

### `/route` (POST)

Point-to-point routing. Returns distance, time, geometry and maneuvers.
Waypoints go in `locations` (not `shape` — that is for the `trace_*`
endpoints). Example body:

```json
{
  "locations": [{"lat": 40.4168, "lon": -3.7038}, {"lat": 40.8570, "lon": -3.9863}],
  "costing": "bicycle",
  "costing_options": {"bicycle": {"use_hills": 0}}
}
```

The route geometry comes back encoded (polyline6) in `.trip.legs[].shape`;
feed it to `/trace_attributes` to get per-edge details.

### `/trace_attributes` (POST)

The most important endpoint for the Cycling Core layer: given a shape (e.g. a
route geometry), it returns per-edge attributes along it:

```
way_id, length, road_class, use, surface, speed, speed_type, lane_count,
cycle_lane, bicycle_network, sidewalk, shoulder, truck_route, density,
bridge, tunnel, roundabout, traffic_signal, toll, traversability,
max_upward_grade, max_downward_grade, weighted_grade
```

Example body — note it takes the **encoded polyline** from a previous
`/route` call; raw far-apart coordinates fail map matching:

```json
{
  "encoded_polyline": "civ}lAav|bhF...",
  "costing": "bicycle",
  "attributes": ["edge.max_upward_grade", "edge.weighted_grade"],
  "shape_format": "polyline6"
}
```

A ~3 km test route returned 80 edges with all road attributes populated;
grade attributes carry real values since elevation is baked into the graph
(see [04_elevation.md](04_elevation.md#grade-attributes)).

### `/height` (POST)

Returns elevation values for arbitrary points using the downloaded elevation
tiles. See [04_elevation.md](04_elevation.md).

## Known limitations

- The merge keeps every extract except the largest in memory (6.4 GB peak
  for Portugal, the Canaries and Andorra next to Spain), so adding another
  large country needs more RAM or a different merge strategy.
