# Deploying Velio

Production is `docker/docker-compose.dokploy.yaml`, deployed by Dokploy as one Compose app with the images that GitHub Actions publishes to Docker Hub. The frontend (nginx serving the SPA and the prerendered landing) is the only service on Dokploy's network, and it proxies `/api` to the backend on the same origin, so the browser never deals with CORS.

```text
browser ── https ──> Traefik (Dokploy, TLS) ──> frontend (nginx :80)
                                                  ├── /, /es       prerendered landing (dist/prerender/*.html)
                                                  ├── /*           SPA shell (index.html) for every other path
                                                  ├── /assets/*    hashed files, cached 1 year
                                                  └── /api/*       → backend:8000 ──> valhalla:8002, db, redis
```

The language is part of the path: English at the root, Spanish under `/es/...`. The landing URLs (`/`, `/es`) are served prerendered (section 8); every other path gets the SPA shell and the app resolves the language from the URL before its first render.

## 1. DNS

Create an `A` record `velio.cub1z.es` → the VPS public IP (and `AAAA` if the VPS has IPv6). Check it with `dig +short velio.cub1z.es` before asking Dokploy for a certificate.

## 2. Images and releases

The workflows in `.github/workflows` build `backend/` and `frontend/` and push them to Docker Hub as `cub1z/velio-backend` and `cub1z/velio-frontend`, with the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repo secrets (a Docker Hub access token with read and write). Both images are public, like the repository.

| Workflow | When | Tags |
|---|---|---|
| `cd-dev.yaml` | push to `dev` touching `backend/` or `frontend/` | `dev` |
| `cd-release.yaml` | a GitHub release is published | the release tag and `latest`, then asks Dokploy to redeploy, waits for the new version and runs the smoke test |
| `cd-manual.yaml` | run by hand | `<branch>-<date>-<sha>` |

A release is the deploy: fast-forward `dev` into `main`, push, and publish a release from `main` whose tag is the backend version (`app_version` in `backend/app/core/config.py`), e.g. `gh release create v0.34.1 --target main --generate-notes`. The deploy job runs only when the repo has the `DOKPLOY_URL`, `DOKPLOY_AUTH_TOKEN` and `DOKPLOY_COMPOSE_ID` secrets: it asks Dokploy to redeploy, waits up to 15 minutes until `/api/health` reports the tag's version, and runs the smoke test (section 7). Without the secrets, redeploy from Dokploy and run the smoke test by hand.

## 3. Dokploy compose

In Dokploy, a new **Compose** app (the images are public, so no registry credentials are needed):

| Setting | Value |
|---|---|
| Source | GitHub `CuB1z/Velio`, branch `main` |
| Compose path | `./docker/docker-compose.dokploy.yaml` |
| Auto deploy | off: `cd-release.yaml` triggers the deploy once the images exist |

Dokploy runs `docker compose up -d` without `--pull`, so `frontend` and `backend` set `pull_policy: always`: without it a redeploy keeps the `latest` image already on the server.

The domain comes from the Traefik labels on `frontend` (`Host(velio.cub1z.es)`, `websecure`, Let's Encrypt), not from Dokploy's domain settings. No service publishes a port.

`API_UPSTREAM` (set to `http://backend:8000` by the compose) is read when the frontend container starts (nginx templates), so pointing it elsewhere needs a restart, not a rebuild. The SSE endpoint `/api/v1/loops/stream` has its own nginx location with buffering off; without it the progressive loop results arrive all at once.

Set these in the Dokploy environment of the compose app:

```dotenv
JWT_SECRET_KEY=<long random string>
DB_USER=velio
DB_PASSWORD=<long random string>
DB_NAME=velio
OAUTH_GOOGLE_CLIENT_ID=...
OAUTH_GOOGLE_CLIENT_SECRET=...
BREVO_API_KEY=...
BREVO_LIST_ID=...
MAIL_FROM=...
BACKUP_PASSPHRASE=<long random string, kept in a password manager too>
BACKUP_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
BACKUP_S3_REGION=eu-central-003
BACKUP_S3_BUCKET=velio-backups
BACKUP_S3_ACCESS_KEY_ID=<B2 keyID>
BACKUP_S3_SECRET_ACCESS_KEY=<B2 applicationKey>
```

The compose fixes `ENV=prod`, `CORS_ORIGINS`, `AUTH_REDIRECT_BASE` and `OAUTH_SUCCESS_REDIRECT` for `https://velio.cub1z.es`. `VELIO_TAG` (default `latest`) pins an image version, `VALHALLA_DIR` (default `/srv/velio/valhalla`), `VALHALLA_THREADS` (default 2, match the vCPUs) and `UVICORN_WORKERS` (default 1) tune the server.

- `CORS_ORIGINS` cannot contain `*` outside dev; the SPA is same-origin, the explicit origin is only there for anything calling the API from the browser directly.
- With `OAUTH_SUCCESS_REDIRECT` set, the Google callback answers `303` to the SPA with the tokens in the fragment (`#access_token=…`) and failures as `#error=…`.

The same stack built from source runs locally with `docker/docker-compose.yaml` (frontend on `localhost:8080`).

## 4. Routing graph and elevation

Valhalla reads its graph (`tiles.tar`, `config/`) and the elevation tiles (`elevation/`) from `VALHALLA_DIR` on the host, mounted read-only. They are built off the server (merging the regions peaks at 6.4 GB of RAM) with `backend/scripts/build_tiles.sh`, see [backend/docs/03_valhalla.md](../backend/docs/03_valhalla.md). They live outside the Dokploy app folder because Dokploy re-clones the repository on every deploy.

```sh
ssh <user@vps> 'sudo mkdir -p /srv/velio/valhalla && sudo chown -R $(whoami): /srv/velio'
rsync -az --info=progress2 backend/valhalla/config backend/valhalla/tiles.tar backend/valhalla/elevation <user@vps>:/srv/velio/valhalla/
```

```text
/srv/velio/valhalla/
├── config/      valhalla.json, timezones.sqlite, admins.sqlite
├── tiles.tar    2.8 GB
└── elevation/   .hgt.gz tiles, 1.2 GB
```

The unpacked `tiles/` folder is not needed on the server. After replacing the graph, restart the `valhalla` service from Dokploy.

## 5. Database backups

Postgres runs inside the compose with its data in the `pgdata` volume. `db-backup` ([eeshugerman/postgres-backup-s3](https://github.com/eeshugerman/postgres-backup-s3), pinned by digest) dumps it with `pg_dump --format=custom` on `BACKUP_SCHEDULE` (default `@daily`, midnight UTC), encrypts the dump with GPG using `BACKUP_PASSPHRASE` and uploads it to `s3://<bucket>/<BACKUP_S3_PREFIX>/velio_<timestamp>.dump.gpg`. After a successful upload it deletes the dumps older than `BACKUP_KEEP_DAYS` (default 14); a failed dump or upload stops before that, so the last good copies stay.

The bucket is a private Backblaze B2 bucket in `eu-central-003` with B2 server-side encryption and the lifecycle rule *keep prior versions for 7 days*, so a deleted dump can still be recovered for a week. The application key is restricted to that bucket with read and write access. `BACKUP_S3_PREFIX` (default `velio/prod`) keeps environments apart in the same bucket. Without `BACKUP_PASSPHRASE` the dumps cannot be decrypted: keep it outside the server.

Take a backup now (after the first deploy, or before a risky migration) and list what is stored:

```sh
docker exec <db-backup container> sh backup.sh
docker exec <db-backup container> sh -c 'source ./env.sh; aws $aws_args s3 ls s3://$S3_BUCKET/$S3_PREFIX/'
```

Restore the latest dump, or the one with a given timestamp. `pg_restore --clean --if-exists` drops and re-creates every object, so the database ends up exactly as it was in the dump and anything written after it is lost:

```sh
docker exec <db-backup container> sh restore.sh
docker exec <db-backup container> sh restore.sh 2026-10-25T00:00:00
```

To move to another server, deploy the same compose there with the same environment, then run `restore.sh` before opening it to traffic.

## 6. Google Cloud console

In the OAuth client used by `OAUTH_GOOGLE_CLIENT_ID`:

- Authorised redirect URI: `https://velio.cub1z.es/api/v1/auth/google/callback` (`AUTH_REDIRECT_BASE` + `/api/v1/auth/google/callback`).
- Authorised JavaScript origin: `https://velio.cub1z.es`.

## 7. Smoke test

The release workflow runs it after every deploy; run it by hand after a manual redeploy:

```sh
frontend/scripts/smoke.sh https://velio.cub1z.es
```

It checks the landing in both languages (status and prerendered content: `<html lang>`, `<h1>`), that `/es/login` still gets the SPA shell, two deep links (`/saved`, `/loops`), `/api/health` through the proxy and that `/api/v1/auth/me` answers `401` without a token.

The frontend image can be checked locally against a backend on the host:

```sh
docker build -t velio-frontend:local frontend
docker run --rm -p 8088:80 --add-host=host.docker.internal:host-gateway \
  -e API_UPSTREAM=http://host.docker.internal:8000 velio-frontend:local
frontend/scripts/smoke.sh http://localhost:8088
```

## 8. Prerendered landing

The landing is a client-rendered SPA, so crawlers would otherwise get an empty `#root`. The frontend image build runs `pnpm prerender` after `vite build`: `frontend/scripts/prerender.mjs` starts `vite preview`, opens `/` and `/<lang>` for every non-default language in headless Chromium, scrolls so every section reveals, and writes the rendered document to `dist/prerender/index.html` and `dist/prerender/<lang>.html` with `<html lang>`, canonical, `hreflang` alternates, the localised description and the Open Graph tags already in the HTML. `dist/index.html` stays the clean shell for every other route.

- nginx: `location = /` serves `prerender/index.html`; `location /` tries `$uri`, then `/prerender$uri.html`, then the shell. `/prerender/` is `internal`, so the files are not reachable as their own URLs.
- Absolute URLs come from the `SITE_URL` build arg; the runtime keeps using the page origin.
- The build stage runs on `mcr.microsoft.com/playwright:<version>-noble` (Node + Chromium). Its tag must match `@playwright/test` in `frontend/package.json`: bump both together.
- Locally: `pnpm build && pnpm prerender` in `frontend/` (needs `pnpm exec playwright install chromium` once). `vite preview` does not know the prerender mapping; check the real thing with the Docker commands above.
- React replaces the prerendered DOM on mount (`createRoot`), so the snapshot is for crawlers and the first paint; a section that is only partly inside the first viewport can blink once.
