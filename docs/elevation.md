# Elevation

How elevation data works in this project: where it comes from, how it is
downloaded, what Valhalla does with it, and how the elevation engine
(`app/engine/`) uses it.

## Design principle

Elevation is used at **two levels**:

1. **Baked into the routing graph** (`mjolnir.use_elevation: true`, set by
   `build_tiles.sh`). Every edge carries its grade, so the bicycle costing can
   weigh slopes during route search — this is what makes hill avoidance
   (`use_hills`) actually change which roads get chosen.
2. **External DEM pipeline** (`app/engine/`, implemented): high-resolution
   elevation profiles, smoothing and gain/loss/grade computed from the same
   `.hgt.gz` tiles, independent of Valhalla. The `/height` endpoint serves as
   ground truth to validate it against.

Rebuilding tiles requires the elevation directory to be populated first;
`download_elevation.sh` runs before `build_tiles.sh` in the setup flow.

## Data source

The elevation tiles are based on **Copernicus DEM GLO-30** (~30 m resolution),
repackaged by Tilezen into `.hgt.gz` files. One file covers a 1x1 degree cell;
files are organized in folders by latitude band:

```
valhalla/elevation/
├── N28/
│   ├── N28E000.hgt.gz
│   └── ...
├── N40/
│   ├── N40E000.hgt.gz     <- Madrid area
│   ├── N40W004.hgt.gz
│   └── ...
└── ...
```

Current size for Spain coverage: ~1 GB, 173 tiles
(`valhalla/elevation/`).

This directory is the **single elevation store**: Valhalla reads it at runtime,
and the elevation engine uses the same files for its own DEM lookups. It is
gitignored — the data is re-downloadable and far too large to version.

## Downloading the tiles (`scripts/download_elevation.sh`)

The supported flow is a pre-download covering the whole graph:

```bash
docker run --rm \
    -v "${VALHALLA_DIR}:/data" \
    ghcr.io/valhalla/valhalla:3.8.2 \
    valhalla_build_elevation \
        --from-tiles \
        --config /data/config/valhalla.json \
        --outdir /data/elevation \
        --parallelism "${PARALLELISM:-4}"
```

- `--from-tiles` scans the routing graph and downloads every elevation tile
  that intersects it — no manual bounding boxes.
- `PARALLELISM` controls download concurrency (default 4).
- The Valhalla config must exist first (`build_tiles.sh` generates it): the
  output path comes from `additional_data.elevation`. Inside the container
  `/data` is the host's `valhalla/`, so tiles land in `valhalla/elevation/`.
- The script prints tile count and total size when it finishes.

> **No runtime auto-download:** with this configuration the service does
> *not* fetch missing tiles on demand — verified by removing
> `N40W004.hgt.gz` and restarting: `/height` returned `null` for Madrid and
> the logs showed no download attempt. If the directory is empty or partial,
> `/height` silently returns nulls for uncovered areas. Always populate it
> with the script.

> **Note on raw DEM TIFFs:** `valhalla_build_elevation` internally downloads
> raw Copernicus GeoTIFFs before converting them to `.hgt.gz`. Those
> intermediates are not needed at runtime and must not be committed or kept
> around (an earlier manual run left ~3 GB of them under
> `valhalla/valhalla/`; safe to delete).

## `/height` endpoint

With elevation tiles present, Valhalla's `/height` action returns elevations
for arbitrary points at request time (no rebuild needed):

```bash
curl -X POST http://localhost:8002/height \
  -H 'Content-Type: application/json' \
  -d '{"shape":[{"lat":40.4168,"lon":-3.7038}]}'
```

```json
{"shape":[{"lat":40.4168,"lon":-3.7038}],"height":[661]}
```

Points outside the downloaded coverage return `null` in the `height` array.

Smoke test: `scripts/smoke_test_height.sh` queries five known Spanish points
(Madrid, Guadarrama, Sierra Nevada, Pirineos, Valencia coast) and validates
HTTP status, non-null numeric heights and a sane range (-500 m to 9000 m):

```bash
./scripts/smoke_test_height.sh          # VERBOSE=0 to silence payloads
VERBOSE=0 ./scripts/smoke_test_height.sh
```

## Grade attributes

Grades are **baked into the graph**: `build_tiles.sh` sets
`mjolnir.use_elevation: true` (via `jq`, the config builder does not expose a
CLI flag) before building tiles, so `trace_attributes` returns real values:

```json
{
  "max_upward_grade": 6,
  "max_downward_grade": -8,
  "weighted_grade": 5.0
}
```

Verified on Madrid -> Puerto de Navacerrada: 536/536 edges with real grades,
steepest uphill 24%, steepest downhill -20%.

### How slope affects routing

The bicycle costing applies a per-edge penalty from `weighted_grade`, scaled
by the `use_hills` option — a **float from 0 to 1** (not an integer scale):

- `use_hills: 0` — maximum hill avoidance (`avoid_hills = 1 - use_hills`
  multiplies the full strength table; a 15% grade costs ~13x)
- `use_hills: 1` — grades ignored
- Out-of-range values are silently clamped to the default

Example on Madrid -> Rascafria:

| `use_hills` | Distance | Time |
|---|---|---|
| 0 (avoid hills) | 82.917 km | 349 min |
| 1 (ignore hills) | 82.544 km | 351 min |

The hill-avoiding route is longer but faster — it trades distance for less
climbing. Reference:
[`bicyclecost.cc`](https://github.com/valhalla/valhalla/blob/3.8.2/src/sif/bicyclecost.cc)
(`kAvoidHillsStrength`, `grade_penalty`).

## Elevation engine (`app/engine/`)

A small Python package that computes elevation metrics for any route without
touching Valhalla at request time:

```
Valhalla route geometry (encoded polyline)
        |
        v
Decode coordinates            app/engine/polyline.py
        |
        v
DEM lookup (.hgt.gz tiles)    app/engine/dem.py
        |
        v
Resample + raw profile        app/engine/elevation.py
        |
        v
Smoothing (median + mean)     app/engine/elevation.py
        |
        v
Gain / Loss / Grade           app/engine/elevation.py
```

- `polyline.py` — encode/decode Valhalla encoded polylines (1e6 precision).
- `dem.py` — `.hgt.gz` reader (int16 big-endian, NW origin, `-32768` voids)
  with bilinear interpolation and an LRU tile cache.
- `elevation.py` — haversine cumulative distance, resampling (~10 m),
  NaN gap filling, median + moving-average smoothing, gain/loss and grades
  measured over a ~30 m baseline.
- `models.py` — `ProfileSample` / `ElevationProfile` dataclasses.
- `__main__.py` — CLI: routes two points through Valhalla, builds the profile
  and validates every sample against `/height`.

Usage from the repo root (service must be running):

```bash
python -m app.engine 40.4168 -3.7038 40.7850 -3.9600
```

Validated on Madrid -> Puerto de Navacerrada (73.8 km, 7386 samples):
**MAE 0.62 m, RMSE 0.84 m, max diff 6.23 m** against `/height`.

Unit tests live in `tests/engine/` (synthetic HGT tiles, known polyline
vectors, flat/ramp/spike profiles):

```bash
.venv/bin/python -m pytest tests/ -q
```
