# Elevation

How elevation data works in this project: where it comes from, how it is
downloaded, what Valhalla does with it, and how the Cycling Core will use it.

## Design principle

Elevation is kept **decoupled from the routing graph**. The plan is to compute
elevation metrics (gain, loss, grade) in the Cycling Core layer from an
external DEM lookup, not from Valhalla's baked-in edge grades. This keeps the
tile build independent of elevation data and gives full control over smoothing
and noise handling.

Valhalla's own elevation support is still used for one thing today: the
`/height` endpoint, which serves as a cross-check for the external pipeline.

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
and the future Cycling Core pipeline will use the same files for its own DEM
lookups. It is gitignored — the data is re-downloadable and far too large to
version.

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

## Grade attributes return `-500`

**Current known limitation.** `trace_attributes` grade fields are all `-500`
and `weighted_grade` is `0.0`:

```json
{
  "max_upward_grade": -500,
  "max_downward_grade": -500,
  "weighted_grade": 0.0
}
```

Why: there are two separate mechanisms in Valhalla.

| Mechanism | Config | Status here |
|---|---|---|
| `/height` lookups at request time | `additional_data.elevation` | Working |
| Grades baked into edges at build time | `mjolnir.use_elevation: true` | Not enabled |

The routing tiles were built before elevation data existed and without
`mjolnir.use_elevation`, so the graph has no elevation stored on its edges.
Enabling it would require setting that flag and rebuilding tiles with the
elevation directory populated.

Per the design principle above, we do **not** plan to enable it: grades will
be computed externally.

## Planned pipeline (Cycling Core)

The production elevation flow will bypass Valhalla entirely:

```
Valhalla route geometry (encoded polyline)
        │
        ▼
Decode coordinates
        │
        ▼
DEM lookup (.hgt tiles)
        │
        ▼
Raw elevation profile
        │
        ▼
Smoothing (DEM noise removal)
        │
        ▼
Gain / Loss / Grade
```

Output model:

```
ElevationProfile
├── gain_m
├── loss_m
├── max_uphill_grade
├── max_downhill_grade
└── profile
```

The raw DEM is noisy, so the pipeline is strictly:
raw elevations -> sampling -> smoothing -> gradient. The `/height` endpoint
and the smoke test serve as ground truth to validate this pipeline against.
