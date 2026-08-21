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

Planned next: external elevation pipeline (gain/loss/grade), route scoring,
circular route generator, FastAPI service. See
[docs/data.md](docs/data.md) and the project spec for details.

## Architecture

```
OpenStreetMap PBF ──> build_tiles.sh ──> Valhalla tiles ──> valhalla_service (Docker :8002)
Geofabrik catalog  ──> download_osm.sh
Copernicus DEM     ──> download_elevation.sh ──> .hgt.gz tiles ──> /height + future Cycling Core
```

The routing graph carries no baked-in elevation by design; elevation metrics
will be computed externally so they stay independent from tile rebuilds.
Details in [docs/elevation.md](docs/elevation.md).

## Requirements

- Docker + Docker Compose
- `curl` and `jq`
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
| [docs/elevation.md](docs/elevation.md) | Elevation source, tiles, `/height`, grade caveats, planned pipeline |

## License / data attribution

Routing data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, extracts by [Geofabrik](https://download.geofabrik.de/).
Elevation data: Copernicus DEM GLO-30.
