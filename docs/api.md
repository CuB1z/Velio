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

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Service status and version |
| POST | `/api/v1/auth/register` | — | Create a pending local account; a verification code is emailed |
| POST | `/api/v1/auth/verify` | — | Confirm the emailed six digit code and activate the account |
| POST | `/api/v1/auth/resend-verification` | — | Re-issue and resend the verification code (always 202) |
| POST | `/api/v1/auth/forgot-password` | — | Email a reset code to active local accounts (always 202) |
| POST | `/api/v1/auth/reset-password` | — | Confirm the emailed reset code, set the new password and revoke sessions |
| POST | `/api/v1/auth/change-password` | Bearer | Rotate the local credential; live sessions are revoked |
| POST | `/api/v1/auth/login` | — | Email/password login (verified accounts only) |
| POST | `/api/v1/auth/refresh` | — | Rotate refresh token into a new pair |
| POST | `/api/v1/auth/logout` | — | Revoke a refresh token |
| GET | `/api/v1/auth/me` | Bearer | Current user profile |
| GET | `/api/v1/auth/sessions` | Bearer | List live sessions with device metadata |
| DELETE | `/api/v1/auth/sessions/{session_id}` | Bearer | Revoke one session (404 if not owned) |
| DELETE | `/api/v1/auth/sessions` | Bearer | Revoke every session except the caller's |
| GET | `/api/v1/auth/{provider}/authorize` | — | Start the OAuth round trip (307) |
| GET | `/api/v1/auth/{provider}/callback` | — | Finish the OAuth round trip, returns session |
| POST | `/api/v1/auth/me/delete-request` | Bearer | Request account deletion (issues OTP) |
| DELETE | `/api/v1/auth/me` | Bearer | Confirm deletion and hard-delete the account |
| POST | `/api/v1/loops` | Bearer | Circular route from an origin, with distance/gain targets |
| POST | `/api/v1/routes` | Bearer | Point-to-point route through ordered waypoints |
| POST | `/api/v1/routes/analyze` | Bearer | Score an existing encoded polyline |
| POST | `/api/v1/routes/elevation` | Bearer | DEM elevation profile of an encoded polyline |
| GET | `/api/v1/routes/saved` | Bearer | List the caller's saved routes, newest first |
| POST | `/api/v1/routes/saved` | Bearer | Store a compute result under a name |
| GET | `/api/v1/routes/saved/{route_id}` | Bearer | One owned saved route |
| DELETE | `/api/v1/routes/saved/{route_id}` | Bearer | Delete one owned saved route |

## Configuration

Everything is environment-driven (or `.env`):

| Variable | Default | Purpose |
|---|---|---|
| `ENV` | `dev` | `dev` enables `/docs`, `/redoc` and `/openapi.json`; anything else hides them |
| `VALHALLA_URL` | `http://localhost:8002` | Routing engine base URL |
| `VALHALLA_ELEVATION_DIR` | `./valhalla/elevation` | DEM tiles directory |
| `DB_DRIVER` | `postgresql+asyncpg` | SQLAlchemy driver (`sqlite+aiosqlite` for quick local runs) |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | localhost / cycling / cycling_router | Database connection |
| `JWT_SECRET_KEY` | dev value | **Change in production**; signs access and refresh tokens |
| `BREVO_API_KEY` | — | Brevo transactional API key; without it mail is only logged to console |
| `BREVO_LIST_ID` | — | Brevo contacts list id; verified riders are filed into it |
| `MAIL_FROM` | `no-reply@localhost` | Sender address; the display name comes from the sender verified in Brevo |
| `OTP_EXPIRE_MINUTES` / `OTP_MAX_ATTEMPTS` | `15` / `5` | Verification code lifetime and wrong-guess budget |
| `OTP_TEST_MODE` | `false` | Test convenience — requires `ENV=dev` too: confirmation emails are not sent and any 6-digit code verifies the account. Never enable outside local/test stacks |
| `RATE_LIMIT_ENABLED` | `true` | Per-endpoint budgets (see `app/core/ratelimit.py`) and the global per-IP ceiling; `false` disables both |
| `RATE_LIMIT_BACKEND` | `memory` | `memory` (in-process) or `redis` (ZSET sliding window with native TTL bans); `memory` is fine for single-process local dev |
| `REDIS_URL` | — | Redis connection URL (e.g. `redis://redis:6379/0`); required when `RATE_LIMIT_BACKEND=redis` |
| `CORS_ORIGINS` | `["*"]` | Allowed CORS origins |

Migrations run through Alembic (`start.sh` executes
`alembic -c migrations/alembic.ini upgrade head` before the API boots).

---

## Authentication

Business endpoints require `Authorization: Bearer <access_token>`.
Tokens are JWTs signed by the service: short-lived access tokens plus
rotating refresh tokens persisted server-side (revocable). OAuth providers
(e.g. Google) reuse the same session issuance.

Every account carries a lifecycle `status`: `pending` (local accounts not
yet verified), `active` (fully usable) or `suspended` (administratively
blocked). Only active accounts open or refresh sessions; pending logins
answer `403 EMAIL_NOT_VERIFIED` and suspended ones `403 ACCOUNT_SUSPENDED`.

```bash
# Register: creates a pending account and emails a six digit code.
curl -s -X POST localhost:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"rider@example.com","password":"Secret-123"}' | jq

# Confirm the code from the email to activate the account.
curl -s -X POST localhost:8000/api/v1/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"rider@example.com","code":"123456"}' | jq

# Login only works once the account is active.
curl -s -X POST localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rider@example.com","password":"Secret-123"}' | jq
```

Registration and verification answer the user object alone (no tokens):

```json
{"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "email": "rider@example.com", "full_name": "", "status": "pending"}
```

Session shape (`login` and `refresh` answer it):

```json
{
  "user": {"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "email": "rider@example.com", "full_name": "", "status": "active"},
  "tokens": {"access_token": "...", "refresh_token": "...", "token_type": "bearer"}
}
```

Refresh rotates: the used refresh token is revoked and a fresh pair is
returned. Logging out revokes the given refresh token.

### Sessions

Every login, refresh and OAuth callback stamps the issuing device into the
refresh row (`user_agent`, truncated to 256 chars, plus `created_at`).
Access tokens carry a `sid` claim naming the refresh session they were
issued alongside, so `GET /auth/sessions` can flag which entry is the
caller's own; the marker is accurate until the access token expires or its
refresh rotates away.

```bash
curl -s localhost:8000/api/v1/auth/sessions \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

```json
[
  {"id": 7, "created_at": "2026-08-24T10:12:09Z", "user_agent": "RiderApp/1.0", "current": true},
  {"id": 5, "created_at": "2026-08-23T18:44:51Z", "user_agent": "RiderWeb/2.0", "current": false}
]
```

`DELETE /auth/sessions/{id}` revokes a single row (`404` when it belongs to
someone else); `DELETE /auth/sessions` revokes every live session except
the caller's — when the token carries no usable `sid`, everything dies.

Replaying an already-rotated refresh token is treated as theft: the service
revokes all live sessions of the account and answers the usual `401`.
Unknown garbage tokens just fail without side effects.

### Email verification (OTP)

Local accounts stay `pending` until their emailed six digit code is
confirmed. Codes are single use, expire after `OTP_EXPIRE_MINUTES`
(default 15) and tolerate up to `OTP_MAX_ATTEMPTS` wrong guesses before
being spent. Requesting a new code invalidates the previous one.

| Endpoint | Behaviour |
|---|---|
| `POST /auth/verify {email, code}` | Marks the account active (idempotent once active). Wrong, expired or exhausted codes answer `400 VERIFY_ERROR`. |
| `POST /auth/resend-verification {email}` | Always `202`; a new code is only generated for existing pending accounts, so the endpoint cannot probe registered emails. |

Email goes through Brevo's transactional API when `BREVO_API_KEY` is set;
otherwise messages are written to the application log (`mail` logger),
which is what local development and tests rely on. When `BREVO_LIST_ID`
is also set, activating an account upserts the rider into that Brevo
contacts list — once per account (verification or first OAuth login),
never on routine logins.

### Passwords

Every local credential (registration, password change and reset) enforces
the same policy: 8–128 characters with at least one lowercase, one
uppercase and one digit; it must not equal the account email nor contain
its local part. Symbols are allowed but not required. Violations answer
`422 VALIDATION_ERROR`.

```bash
# Change the password of the logged-in account
curl -s -X POST localhost:8000/api/v1/auth/change-password \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"current_password":"Secret-123","new_password":"Fresh-Secret9"}'
```

A successful change answers `204` and revokes every refresh token of
the account: other devices must log in again, while outstanding access
tokens simply expire within their short lifetime. Wrong current
password answers `401`; accounts created through OAuth only answer
`400` until they set a password.

### Password reset (OTP)

Forgotten passwords go through the same single-use code infrastructure
as email verification (`purpose = password_reset`, same expiry and
wrong-guess budget):

```bash
# Ask for a reset code. Always 202: the endpoint cannot probe emails.
curl -s -X POST localhost:8000/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"rider@example.com"}'

# Swap the credential for the new one.
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/v1/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"rider@example.com","code":"123456","new_password":"Fresh-Secret9"}'
```

| Endpoint | Behaviour |
|---|---|
| `POST /auth/forgot-password {email}` | Always `202`. A code is only mailed to existing **active** accounts holding a local credential — pending accounts verify through the signup flow and OAuth-only accounts have no password to reset. While a code is still live no new one is sent, so the endpoint cannot be turned into a mail-bombing vector. |
| `POST /auth/reset-password {email, code, new_password}` | Verifies the code, stores the new hash and revokes every refresh token of the account (`204`). Wrong, expired or exhausted codes answer `400 RESET_ERROR`; suspended accounts answer `403 ACCOUNT_SUSPENDED`. |

A reset never activates a pending account nor files Brevo contacts;
those belong to the verification flow alone.

### OAuth (Google)

Two round trips, minimum data requested: Google asks `openid email
profile` and the service stores nothing beyond email, provider id and
optional name.

Linking a provider identity to an existing local account requires the
provider to have verified the email (`email_verified`); an unverified
address answering for a registered account is rejected with
`400 OAUTH_ERROR` and the account is left untouched.

> **Note:** additional providers plug into the same round trips via the
> provider registry in `app/clients/oauth.py`.

```bash
# 1. Send the user to the consent screen (307 redirect)
curl -s -o /dev/null -w '%{redirect_url}' \
  localhost:8000/api/v1/auth/google/authorize

# 2. Provider calls back; the code+state become an app session
curl -s "localhost:8000/api/v1/auth/google/callback?code=CODE&state=STATE"
```
The callback answers the same `AuthSession` shape as login. The `state`
parameter is a signed anti-CSRF token valid for 10 minutes; forged or
expired states answer `400 OAUTH_ERROR`. Providers without client
credentials configured answer `503` on `authorize`.

Environment additions:

| Variable | Purpose |
|---|---|
| `OAUTH_GOOGLE_CLIENT_ID/SECRET` | Google OAuth app credentials |
| `AUTH_REDIRECT_BASE` | Public base URL used to build the Google callback URI |

### GDPR account deletion

Two-step flow: request a code, then confirm the hard-delete. The action
is **irreversible** — the user row, all refresh tokens, saved routes, email
verification records, Brevo contact and linked OAuth identities are
permanently removed via database cascade.

Every account receives the code, regardless of the login method (local
or OAuth-only): deletion always requires email access, guarding against
a stolen credential deleting the account on its own.

```bash
# 1. Request the deletion code (any account)
curl -s -X POST localhost:8000/api/v1/auth/me/delete-request \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# → 202 Accepted

# 2. Confirm with the emailed code
curl -s -X DELETE localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"code":"123456"}'
# → 204 No Content (token is now invalid)
```

The request endpoint reuses the generic OTP engine with
`purpose = account_delete` (same expiry and wrong-guess budget as
verification and password-reset). It always answers `202` — the endpoint
cannot probe which accounts exist.

The confirm endpoint:

1. Validates the OTP (`400 DELETE_ERROR` on wrong / expired / exhausted code).
2. Revokes every refresh token of the account.
3. Deletes the Brevo contact when `BREVO_LIST_ID` is configured.
4. Hard-deletes the user row; foreign keys cascade to tokens, saved routes,
   identities and verification codes.

Once confirmed, the access token is invalid and all active sessions die.

Rate limit: `POST /me/delete-request` allows 3 requests/min/authenticated
user to prevent OTP flooding.

All endpoints return JSON. Route geometry comes as an **encoded polyline**
(`polyline` field, [polyline6](https://developers.google.com/maps/documentation/utilities/polylineutility)
precision, 1e-6): a compact string that map libraries (Google Maps Geometry,
Leaflet, Mapbox, `mapbox_polyline`/`polyline` packages) decode directly into
lat/lon points.

---

## Saved routes

Computed results can be stored under a name and replayed later without
re-routing. The payload is the verbatim response of the compute endpoint that
produced it (polyline6 plus metric blocks). Routes are private: foreign ids
are indistinguishable from missing ones (both answer `404 NOT_FOUND`).

```bash
# Save one result (payload as returned by POST /routes or /loops)
curl -s -X POST localhost:8000/api/v1/routes/saved \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Algete 70","payload":{"polyline":"u{~fF...","distance_km":70.1}}'

# List, newest first (limit optional, default 50, max 200; page 1-based)
curl -s "localhost:8000/api/v1/routes/saved?page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

# Fetch / delete by id
curl -s localhost:8000/api/v1/routes/saved/$ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE localhost:8000/api/v1/routes/saved/$ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"   # 204
```

The list answers a paginated envelope (`data` plus page metadata, shared
as `PaginatedOut[SavedRoute]`):

```json
{
  "data": [{"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "name": "Algete 70", "payload": {}, "created_at": "2026-08-27T10:00:00Z"}],
  "meta": {"page": 1, "limit": 10, "total": 42, "total_pages": 5, "is_last": false}
}
```

`meta.limit` echoes the effective page size (capped at 200), `meta.total`
the caller's saved routes, and `meta.is_last` whether more pages exist.

---

## GET /api/health

```bash
curl -s localhost:8000/api/health
```

```json
{"status": "ok", "version": "0.22.1"}
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

Every error answers with the same JSON shape — including authentication
and rate-limit failures; no endpoint returns FastAPI's bare `detail` body:

```json
{"error": "ERROR_CODE", "message": "human readable", "details": {}}
```

| Status | `error` | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | A well-formed request carries an unusable value (e.g. a polyline that decodes to one point) |
| 400 | `NO_LOCAL_PASSWORD` | An OAuth-only account attempted a local-credential operation |
| 400 | `DELETE_ERROR` | Wrong, expired or exhausted account-deletion code |
| 400 | `VERIFY_ERROR` / `RESET_ERROR` | Wrong, expired or exhausted emailed code |
| 400 | `OAUTH_ERROR` | Forged or expired OAuth state, rejected code |
| 401 | `UNAUTHORIZED` / `INVALID_CREDENTIALS` / `INVALID_REFRESH_TOKEN` | Missing/invalid Bearer token, wrong password, replayed refresh token |
| 403 | `EMAIL_NOT_VERIFIED` / `ACCOUNT_SUSPENDED` | Account exists but is pending or suspended |
| 404 | `NOT_FOUND` / `UNKNOWN_PROVIDER` | Unknown resource for this caller or provider name |
| 409 | `EMAIL_ALREADY_REGISTERED` | The email already belongs to an account |
| 422 | `VALIDATION_ERROR` | Request body fails schema validation |
| 422 | `ROUTING_ERROR` | Valhalla cannot route through the given points |
| 429 | `RATE_LIMITED` | Too many requests: the per-endpoint budget (see `RATE_LIMIT_ENABLED`) or the global per-IP ceiling tripped; retry after the seconds stated in the `Retry-After` header |
| 503 | `SERVICE_UNAVAILABLE` | Valhalla unreachable |

---

## Rate limiting

Every request counts against per-minute budgets; an exhausted budget
answers `429 RATE_LIMITED` with a `Retry-After` header stating the seconds
until the next request is accepted. Two layers apply:

- **Per endpoint** (`RULES` in `app/core/ratelimit.py`): ruled paths carry
  an IP budget and/or an authenticated-user budget (e.g. register and login
  50/min/IP, `/auth/me` 120/min/user, compute endpoints 60/min/user). Paths
  without a rule only face the global layer.
- **Global courtesy ceiling**: every route — ruled or not — shares
  120 requests/min/IP, enforced by middleware.

Exhausted keys get a temporary ban with Redis-style TTL semantics: the
deadline is fixed at creation, hammering during the ban never extends it,
and overflowing again right after expiry doubles the next ban (60s
doubling, capped at 1h). A quiet window restores the key.

`RATE_LIMIT_ENABLED=false` disables both layers (local dev and tests).

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
