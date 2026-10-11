# Deploying velio-web

The web app ships as one container: a multi-stage `Dockerfile` builds the SPA
with pnpm and serves `dist/` from nginx, which also proxies `/api` to the
backend on the same origin. The browser only ever talks to
`https://velio.cub1z.es`, so there is no CORS between the SPA and the API.

```text
browser ── https ──> Traefik (Dokploy, TLS) ──> velio-web (nginx :80)
                                                  ├── /            SPA, deep links → index.html
                                                  ├── /assets/*    hashed files, cached 1 year
                                                  └── /api/*       → API_UPSTREAM (velio-api:8000)
```

## 1. DNS

Create an `A` record `velio.cub1z.es` → the VPS public IP (and `AAAA` if the
VPS has IPv6). Check it with `dig +short velio.cub1z.es` before asking Dokploy
for a certificate.

## 2. Dokploy application

New **Application** in the same project as the backend compose:

| Setting | Value |
|---|---|
| Source | GitHub `CuB1z/VelioWeb`, branch `main` |
| Build type | Dockerfile (`./Dockerfile`, context `.`) |
| Build arg | `VITE_API_BASE_URL=/api/v1` (the default; relative on purpose) |
| Environment | `API_UPSTREAM=http://velio-api:8000` |
| Network | the same Docker network as the backend (`dokploy-network`) so `velio-api` resolves |
| Domain | `velio.cub1z.es`, port `80`, HTTPS with Let's Encrypt |
| Auto deploy | on (Dokploy webhook on push to `main`) |

`API_UPSTREAM` is read at container start (nginx templates), so pointing the
web app at another backend needs a restart, not a rebuild.

The SSE endpoint `/api/v1/loops/stream` has its own nginx location with
buffering off; without it the progressive loop results arrive all at once.

## 3. Backend environment (cycling-router)

Set these in the backend compose environment and redeploy it:

```dotenv
ENV=prod
CORS_ORIGINS=["https://velio.cub1z.es"]
AUTH_REDIRECT_BASE=https://velio.cub1z.es
OAUTH_SUCCESS_REDIRECT=https://velio.cub1z.es/oauth/callback
```

- `CORS_ORIGINS` cannot contain `*` outside dev; the SPA is same-origin, the
  explicit origin is only there for anything calling the API from the browser
  directly.
- With `OAUTH_SUCCESS_REDIRECT` set, the Google callback answers `303` to the
  SPA with the tokens in the fragment (`#access_token=…`) and failures as
  `#error=…`.

## 4. Google Cloud console

In the OAuth client used by `OAUTH_GOOGLE_CLIENT_ID`:

- Authorised redirect URI: `https://velio.cub1z.es/api/v1/auth/google/callback`
  (`AUTH_REDIRECT_BASE` + `/api/v1/auth/google/callback`).
- Authorised JavaScript origin: `https://velio.cub1z.es`.

## 5. Smoke test

After every deploy:

```sh
scripts/smoke.sh https://velio.cub1z.es
```

It checks the landing, two deep links (`/saved`, `/loops`), `/api/health`
through the proxy and that `/api/v1/auth/me` answers `401` without a token.

The same image can be checked locally against a backend on the host:

```sh
docker build -t velio-web:local .
docker run --rm -p 8088:80 --add-host=host.docker.internal:host-gateway \
  -e API_UPSTREAM=http://host.docker.internal:8000 velio-web:local
scripts/smoke.sh http://localhost:8088
```
