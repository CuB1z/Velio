# Velio · frontend

Web interface for [Velio](../README.md): generates loop and
point-to-point cycling routes on top of the engine's FastAPI API, scores them
by surface, safety and elevation, and saves them.

React SPA on Vite, with HeroUI v3 and Tailwind v4.

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

It needs the backend running. From the engine repository:

```bash
uvicorn app.main:app --reload --port 8000
```

The Vite proxy forwards `/api` to `http://127.0.0.1:8000`, so there is no CORS
to deal with in development. `VITE_API_BASE_URL` stays relative (`/api/v1`) in
development; in production set it to the backend's absolute public URL.

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with HMR |
| `pnpm build` | Type check and production build |
| `pnpm preview` | Serves the production build locally |
| `pnpm typecheck` | Types only |
| `pnpm lint` | Oxlint |
| `pnpm test` | Vitest |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:coverage` | Vitest with coverage |
| `pnpm contract:pull` | Refreshes `contract/openapi.json` from a running backend |
| `pnpm contract:check` | Checks `src/types/api.ts` and the called paths against `contract/openapi.json` |

## How it is organised

```
src/
  api/         HTTP client and one module per API area
  types/api.ts API contract, mirrors backend/docs/05_api.md
  auth/        Session, token storage and route guards
  components/  common · layout · map · planner · route · auth · landing
  pages/       One per screen
  routes/      Route table
  lib/         Formatting, polylines, GPX, data palette, metrics, map styles
  i18n/        es and en; single source of terminology
tests/         Vitest suites, mirroring src/ (setup in tests/setup.ts)
```

### The data layer rules

`src/types/api.ts` is a literal mirror of the backend's `docs/05_api.md`. If the
API changes, change it there first and the compiler flags the rest.

`tests/api/contract.test.ts` checks those types, and every path the frontend
calls, against `contract/openapi.json`, a committed snapshot of the backend's
OpenAPI schema, so CI does not need a running backend. When the backend
changes, run `pnpm contract:pull` (reads `VELIO_API_URL`, default
`http://localhost:8000`) and re-run the tests.

The compute endpoints (`/loops`, `/routes`, `/routes/analyze`,
`/routes/elevation`) require `Authorization: Bearer`, so **the whole app lives
behind the login**. There is no guest mode.

Session refresh is single-flight (`src/api/client.ts`): without it, several
concurrent requests with an expired token would trigger several rotations, and
the backend treats refresh-token reuse as theft and revokes all of the user's
sessions.

## Routes

| Route | What it is |
|---|---|
| `/` | Public landing. Still reachable when signed in; the call to action then opens `/loops` |
| `/loops` | Loop planner |
| `/routes`, `/analyze`, `/saved`, `/saved/:id`, `/account` | The rest of the app, behind the login |
| `/login`, `/register`, `/verify`, `/forgot-password`, `/reset-password` | Access. A signed-in user is redirected to `/loops` |
| `/oauth/callback` | Return from the OAuth provider |

## Brand and theme

Light mode: background `#F7F8FA`, white cards that float on it, teal accent
`#0E7C86`. Dark mode: background `#0F1419`, cards `#182029`. HeroUI v3 themes
with plain CSS variables, so everything lives in `src/styles/globals.css`.

The accent gives 4.95:1 with white text and 4.65:1 on the light background. On
the dark background the same teal is too dark, so in dark mode it splits into
two uses that keep the hue:

| Use | Colour | Contrast |
|---|---|---|
| Fill (primary button) | `#2BA8B4` | 5.90:1 with `#06202A` text |
| Text and links | `#5FD3DE` | 10.45:1 on `#0F1419` |

The theme is applied by an inline script in `index.html` before first paint,
so reloading in dark mode does not flash light.

### Two HeroUI theme traps

1. **Fields have no border.** HeroUI sets `--field-border-width: 0` and tells
   fields apart only by background and a raised shadow. Here a field gets a
   1 px border, a slightly cooler fill and no elevation.
2. **`--field-shadow: none` kills the focus ring.** The ring is a Tailwind
   `ring-2`, which composes `box-shadow` with `--tw-shadow`; `none` invalidates
   the whole list and a focused field shows no signal at all. It uses a
   transparent but valid shadow (`0 0 0 0 transparent`) instead, the same trick
   HeroUI's dark theme uses.

And a cascade detail: the light block is written on `:root`, which also applies
in dark mode, and comes **after** HeroUI's `.dark`. Any variable touched in the
light block must be repeated in the dark one or it leaks.

### Dropdown.Trigger does not take a button inside

`Dropdown.Trigger` **already is** the `<button>`. Putting a HeroUI `<Button>`
inside produces `<button><button>`, which is invalid HTML. Passing it the
button classes instead raises a second problem: `.dropdown__trigger` forces
`display: block` and wins over `.button`, which is inline-flex, so
`justify-center` stops working, the icon sticks to the left edge and the hover
background looks offset.

`src/components/common/dropdownTrigger.ts` fixes both at once; use it for any
button-like trigger. There is a regression test in `ThemeToggle.test.tsx`,
because neither the compiler nor the linter catches either bug.

### Three map traps

All three gave a blank map or a map without the route, and the compiler catches
none of them:

1. **Do not size the container through positioning.** maplibre adds the
   `.maplibregl-map` class, which brings `position: relative` from an
   **unlayered** stylesheet, and in CSS unlayered rules beat any layer —
   including `utilities`, where Tailwind v4 puts its utilities. With
   `absolute inset-0`, that `relative` won, `inset-0` did nothing and the div
   collapsed to zero height. It uses `size-full`, which does not compete with
   `position`.
2. **`setStyle` with the same style is a no-op and does not emit `styledata`.**
   Calling it on mount with the style the constructor had already set left the
   seeding of sources and layers waiting on a `once('styledata')` that never
   came: a map without the route. The style is now only changed when it really
   changes, and seeding listens to `styledata` **and** `idle`, because during a
   style change `styledata` can arrive with the style half-loaded.
3. **maplibre and Vite pre-bundling.** Vite rewrites the path of maplibre's
   worker and it returns 404 in development: the map mounts but does not
   decode a single tile. It is excluded in `optimizeDeps` (`vite.config.ts`).
   Since it is lazy-loaded, Vite discovers it late and the problem is more
   likely.

And a fourth one, about usage: the result panel floats over the map, so
`fitPadding` (from `mapFitPadding` in `src/lib/mapStyles.ts`) reserves room at
the bottom, or the route is framed in the centre and ends up behind it.

### The logo

`src/components/layout/Logo.tsx` is **generated** from `public/velio.svg`: the
two paths are copied as-is, not transcribed. If the logo changes, regenerate it
instead of editing it by hand. `VelioMark` is just the symbol (rail, favicon)
and `VelioLogo` the full lockup; both inherit `currentColor`.

## Maps without an API key

- **Map**: OpenFreeMap Positron (light) and Dark (dark), vector, worldwide. In
  dark mode the basemap colours are re-tinted to slate (`tintStyle`).
- **Satellite**: Esri World Imagery, one global layer (sub-metre in Spain and
  Portugal), so there is no colour seam at the border. It uses Esri's public
  tile endpoint for now; Esri's terms ask for an ArcGIS account in production,
  so switch to an ArcGIS Location Platform key (free tier) before deploying.
- **Relief**: an optional hillshade over the map style (not the imagery) from AWS Terrain Tiles (Terrarium), capped at z11 to keep each view near +0.5 MB.

None needs credentials. Styles are changed in `src/lib/mapStyles.ts`.

`maplibre-gl` weighs close to a megabyte, so it loads in its own chunk
(`src/components/map/LazyMap.tsx`): the access screens do not download it.

## Data colours

Chart colours are theme tokens (`--chart-1` … `--chart-5`, `--chart-neutral` in
`src/styles/globals.css`), with separate steps for light and dark mode, not a
flip of one another. `src/lib/chartPalette.ts` reads them at runtime and falls
back to its own per-mode lists when a token is missing (e.g. in tests). Each
surface type keeps a fixed slot, so asphalt is the same colour on every route.

**Rule to respect**: the surface bar uses orange and green in the same bar, a pair
that is hard to tell apart with tritanopia (the validator flagged it in the
fallback palette at ΔE 5.0 light / 3.7 dark). It is only acceptable with
secondary encoding, so every segment of the surface bar carries a direct label
and segments are separated by 2 px. A test guards it (`SurfaceBar.test.tsx`);
if the labels disappear, the chart is no longer accessible.

## Terminology

`src/i18n/es.ts` is the single source. One concept, one name:

| API field | On-screen name (Spanish UI) |
|---|---|
| `gain_m` | Desnivel + (never "Subida" or "Ascenso") |
| `loss_m` | Desnivel − |
| `cycling_score` | Puntuación (never "Nota") |
| `score.comfort` | Firme (never "Comodidad") |
| `score.max_grade_pct` | Pendiente máx. |
| `profile.max_uphill_grade_pct` | Rampa máx. |
| `overlap_ratio` | Solape |
| the object itself | Ruta (never "Trazado" or "Track") |

In Spanish, numbers use a decimal comma, coordinates included: mixing `40.5964`
with `68,8` in the same panel reads as a bug. English uses `en-GB` formatting.
Everything goes through `src/lib/format.ts`.

## Decisions worth revisiting

- **The refresh token lives in `localStorage`** and the access token only in
  memory. That is the most that can be done without backend support: the API
  returns the tokens in the response body, not as an `httpOnly` cookie. If it
  ever issues them as a cookie, this storage goes away.
- **OAuth needs two backend variables**, and they are different:
  `AUTH_REDIRECT_BASE` still points **to the API** (it is the URI registered
  with Google), and `OAUTH_SUCCESS_REDIRECT=http://localhost:5173/oauth/callback`
  is where the API sends the browser afterwards. Without the second one, the
  callback answers JSON and the user lands on a raw page.
  The tokens arrive in the **fragment** (`#`), which never reaches the server:
  `src/pages/auth/OAuthCallback.tsx` adopts them, calls `/auth/me` and clears
  the address bar straight away.
- **Saved-route search filters the loaded page, not the whole set**: the API
  has no search endpoint.
- **Export from a saved route's detail is generated on the client**
  (`src/lib/exportLocal.ts`). The backend's `?format=gpx` exports recompute
  from the original request, and for a saved route we only have the result.
- **The surface breakdown normalises over the real distance**, not over the
  sum of `surface_km`: not every edge carries a surface attribute, and the gap
  is shown as "no data" instead of being spread across the others.
- **The landing shows real engine output**: loops generated by the engine as-is
  (`src/pages/landingExamples.ts`), rendered with the product's real components
  (score card, surface bar, elevation profile). No maps outside the planner, no
  invented prices or testimonials.
- **The map limits come from the backend coverage** (`GET /coverage`, `useCoverage`): every map is bounded by the covered regions' bbox plus 2°, with an Iberia box while it loads or if it fails. The planners check a clicked point or the browser position against the coverage polygons before using it and explain why when it is outside; the backend still answers `OUT_OF_COVERAGE` for anything that slips through.

## End-to-end tests

Playwright, in `e2e/`, two kinds:

- `pnpm e2e` runs `e2e/mocked/` (desktop, plus `responsive.spec.ts` on a
  Pixel 7) with the API mocked by `e2e/support/mockApi.ts`: landing, auth,
  planners, saved routes, 429 countdowns. No backend needed.
- `pnpm e2e:live` runs `e2e/live/` against a real backend through the Vite
  proxy: sign up, verify, generate a loop, save, export GPX, analyse that GPX,
  delete, sign out. It needs the backend test stack (`OTP_TEST_MODE` lets any
  six digit code verify), started from the repo root with
  `docker compose -f docker/docker-compose.test.yaml up -d --build api`.

`E2E_BASE_URL` points either suite at another origin, e.g. the production
image on `http://localhost:8088` (see [docs/02_deploy.md](../docs/02_deploy.md)). The
first run needs `pnpm exec playwright install chromium`.

## Deploy

One container: the `Dockerfile` builds the SPA, prerenders the landing, the privacy policy and the terms per language and writes `sitemap.xml` and `robots.txt` (`pnpm prerender`, Playwright) and serves it from nginx
(`nginx/velio.conf.template`), which proxies `/api` to the backend on the same
origin. It ships with the backend in `docker/docker-compose.yaml`, deployed on Dokploy from `main`; DNS, environment, Google console and the smoke test are in [docs/02_deploy.md](../docs/02_deploy.md).

## Data licences

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, tiles and styles by [OpenFreeMap](https://openfreemap.org/)
© [OpenMapTiles](https://www.openmaptiles.org/).
Satellite imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics, and the GIS User Community), credited in the map attribution.
Elevation: Copernicus DEM GLO-30, via the backend.
Relief shading: AWS Terrain Tiles; in Europe EU-DEM, produced using Copernicus data and information funded by the European Union, credited in the map attribution.
