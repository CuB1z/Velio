# HTTP API reference

The loop generator and router run as a FastAPI service on top of a local
Valhalla instance. Start it with:

```bash
uvicorn app.main:app --port 8000
```

Interactive docs live at `/docs` (Swagger UI) and `/redoc`. Configuration is
read from the environment (or a `.env` file): `VALHALLA_URL`,
`VALHALLA_ELEVATION_DIR`, `CORS_ORIGINS`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Service status and version |
| POST | `/api/v1/loops` | Circular route from an origin, with distance/gain targets |
| POST | `/api/v1/routes` | Point-to-point route through ordered waypoints |
| POST | `/api/v1/routes/analyze` | Score an existing encoded polyline |
| POST | `/api/v1/routes/elevation` | DEM elevation profile of an encoded polyline |

All endpoints return JSON. Route geometry comes as an **encoded polyline**
(`polyline` field, [polyline6](https://developers.google.com/maps/documentation/utilities/polylineutility)
precision, 1e-6): a compact string that map libraries (Google Maps Geometry,
Leaflet, Mapbox, `mapbox_polyline`/`polyline` packages) decode directly into
lat/lon points.

---

## GET /api/health

```bash
curl -s localhost:8000/api/health
```

```json
{"status": "ok", "version": "0.6.0"}
```

---

## POST /api/v1/loops

Generates a closed loop from an origin. Waypoints are placed on a ring,
routed through and re-scaled until the requested distance and elevation gain
are met; if the targets cannot be met from that origin the best-effort loop
is returned with `feasible: false`.

Request:

```json
{
  "origin": {"lat": 40.5964, "lon": -3.6318},
  "distance_km": 70,
  "gain_m": 900,
  "via": [{"lat": 40.7917, "lon": -3.9635}],
  "tolerance": 0.05,
  "gain_tolerance": 0.20,
  "waypoint_count": 10,
  "max_iterations": 8,
  "profile": "safe",
  "routes": 2,
  "costing": {"use_hills": 0.6},
  "include_profile": true
}
```

Only `origin` and `distance_km` are required.

- `profile`: named cycling profile mapped onto Valhalla costing options
  (see table below).
- `routes`: generate several distinct loops in one call; every extra loop
  bans the climbs used by the previous ones and is returned in the
  `alternatives` array of the primary loop.
- `costing`: raw Valhalla bicycle overrides (`bicycle_type`, `use_roads`,
  `use_hills`, `avoid_bad_surfaces`) applied on top of `profile`.
- `include_profile`: attach the resampled DEM elevation profile as
  `profile` (one point roughly every 10 m).

Named riding profiles shape both the Valhalla costing and the scoring
weights (distance / safety / elevation):

| `profile` | Intent |
|---|---|
| `fast` | Time and distance first; bigger roads are acceptable |
| `safe` | Quiet roads, cycle infrastructure and good surfaces |
| `fitness` | Training rides: distance and climbing matter most |
| `relaxed` | Easy spinning: little traffic and gentle terrain |

### Export formats

Both `POST /api/v1/loops` and `POST /api/v1/routes` accept a query parameter
`format=json|gpx|geojson` (default `json`):

```bash
curl -s -X POST 'localhost:8000/api/v1/routes?format=gpx' \
  -H 'Content-Type: application/json' \
  -d '{"waypoints":[{"lat":40.4168,"lon":-3.7038},{"lat":40.7850,"lon":-3.9600}]}' \
  -o route.gpx   # GPX 1.1 with DEM elevation per point

curl -s -X POST 'localhost:8000/api/v1/loops?format=geojson' ... # FeatureCollection
```

- `gpx`: `application/gpx+xml`, one `<trk>` whose points carry DEM `<ele>`.
- `geojson`: `application/geo+json`, a FeatureCollection whose properties
  carry the route metrics (`distance_km`, `duration_min`,
  `elevation_gain_m/loss_m`, `overlap_ratio`, `cycling_score`).

```bash
curl -s -X POST localhost:8000/api/v1/loops \
  -H 'Content-Type: application/json' \
  -d '{"origin":{"lat":40.5964,"lon":-3.6318},"distance_km":70,"gain_m":900}'
```

Response:

```json
{
  "distance_km": 68.84,
  "gain_m": 922.20,
  "loss_m": 921.34,
  "feasible": true,
  "iterations": 3,
  "polyline": "u{~fFswjsC`Ay@aE...",
  "duration_min": 178.4,
  "overlap_ratio": 0.0412,
  "score": {
    "comfort": 64.37,
    "paved_share": 0.45,
    "surface_km": {"dirt": 36.44, "paved_smooth": 29.86},
    "climb_load_m": 964.76,
    "max_grade_pct": 24.0
  },
  "cycling_score": {
    "distance": 10.0,
    "safety": 6.8,
    "elevation": 9.1,
    "overlap_penalty": 0.0,
    "total": 8.1
  },
  "profile": [{"lat": 40.596, "lon": -3.6316, "distance_m": 0.0, "elevation_m": 733.2, "grade_pct": null}],
  "alternatives": null
}
```

- `feasible`: targets met within tolerance (`false` = best-effort result).
- `duration_min`: riding time estimated by Valhalla.
- `overlap_ratio`: fraction of the loop (excluding the first and last 1.5 km)
  ridden on ways already travelled earlier; `null` when way ids are not
  available.
- `score`: surface quality metrics from Valhalla edge data; `null` when
  scoring is unavailable. `comfort` is 0-100 distance-weighted surface
  quality, `paved_share` the fraction on paved surfaces, `climb_load_m` the
  vertical-equivalent meters of positive grade and `max_grade_pct` the
  steepest upward grade found.
- `cycling_score`: multi-factor rating in 0-10 — `distance` rewards matching
  the requested length (0 at ±20%), `elevation` the requested climb (0 at
  ±30%), `safety` is a length-weighted road friendliness measure (cycle
  lanes and quiet roads add, primary roads with many lanes or truck traffic
  subtract), `overlap_penalty` subtracts up to 5 points for repeated roads
  above a 5% ratio, and `total` combines them with the weights of the
  selected riding profile.
- `profile`: resampled DEM elevation points (only with `include_profile`).
- `alternatives`: the extra loops from `routes > 1`, each avoiding the
  climbs of the previous ones; `null` when only one loop was requested.

---

## POST /api/v1/routes

Point-to-point bicycle route through ordered waypoints (2 to 20).

```bash
curl -s -X POST localhost:8000/api/v1/routes \
  -H 'Content-Type: application/json' \
  -d '{"waypoints":[{"lat":40.4168,"lon":-3.7038},{"lat":40.7850,"lon":-3.9600}],"include_profile":true,"alternatives":2}'
```

Response:

```json
{
  "distance_km": 74.12,
  "gain_m": 1053.50,
  "loss_m": 988.20,
  "polyline": "u{~fFswjsC`Ay@aE...",
  "duration_min": 214.6,
  "overlap_ratio": 0.0311,
  "score": {"comfort": 71.2, "paved_share": 0.83, "...": "..."},
  "cycling_score": {"distance": 10.0, "safety": 7.4, "overlap_penalty": 0.0, "total": 8.4},
  "profile": [{"lat": 40.4168, "lon": -3.7038, "distance_m": 0.0, "elevation_m": 652.1, "grade_pct": null}],
  "alternatives": [{"distance_km": 78.90, "...": "..."}]
}
```

Gain/loss come from local Copernicus DEM tiles. `score`, `overlap_ratio`,
`cycling_score` and `profile` carry the same meaning as in loops;
`include_profile` controls whether the resampled elevation points are
attached. `alternatives` asks Valhalla for up to two extra paths between the
waypoints; each one is scored like the primary route. Servers that do not
generate alternatives answer with `alternatives: null`.

---

## Errors

Every error answers with the same JSON shape:

```json
{"error": "ERROR_CODE", "message": "human readable", "details": {}}
```

| Status | `error` | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | A well-formed request carries an unusable value (e.g. a polyline that decodes to one point) |
| 422 | `VALIDATION_ERROR` | Request body fails schema validation |
| 422 | `ROUTING_ERROR` | Valhalla cannot route through the given points |
| 503 | `SERVICE_UNAVAILABLE` | Valhalla unreachable |

---

## POST /api/v1/routes/analyze

Scores an existing encoded polyline (polyline6) without re-routing it.
Useful to rate tracks recorded elsewhere or loops produced by earlier
calls.

```json
{
  "polyline": "u{~fFswjsC...",
  "target_km": 70,
  "target_gain_m": 900
}
```

Only `polyline` is required; targets tune the matching factors.

```bash
curl -s -X POST localhost:8000/api/v1/routes/analyze \
  -H 'Content-Type: application/json' \
  -d '{"polyline":"u{~fFswjsC..."}'
```

Response: `distance_km`, DEM-based `gain_m`/`loss_m`, plus the usual
`score`, `overlap_ratio` and `cycling_score` blocks.

---

## POST /api/v1/routes/elevation

DEM elevation profile for an encoded polyline — no Valhalla involved.

```json
{"polyline": "u{~fFswjsC..."}
```

Response:

```json
{
  "distance_km": 74.12,
  "gain_m": 1053.5,
  "loss_m": 988.2,
  "max_uphill_grade_pct": 11.9,
  "max_downhill_grade_pct": -12.4,
  "profile": [
    {"lat": 40.4168, "lon": -3.7038, "distance_m": 0.0, "elevation_m": 652.1, "grade_pct": null}
  ]
}
```
