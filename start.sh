#!/usr/bin/env bash
#
# Container entry point: pre-start steps first, then launch the API.
# Migrations or any one-off setup belong here, before uvicorn takes over.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# --- Pre-start hooks -------------------------------------------------------
# Database migrations run before the API accepts traffic.
alembic -c migrations/alembic.ini upgrade head

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
