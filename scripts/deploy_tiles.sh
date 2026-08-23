#!/usr/bin/env bash
#
# Deploy built Valhalla artifacts to the runtime host and verify the service.
#
# Usage:
#   scripts/deploy_tiles.sh --local
#   scripts/deploy_tiles.sh --host user@vps [--path /srv/cycling-router]
#                          [--with-elevation] [--dry-run]
#
# The remote restart is a hook so Dokploy/SSH flows can be plugged in:
#   REMOTE_RESTART_CMD="ssh <host> 'dokploy restart valhalla'" \
#       scripts/deploy_tiles.sh --host user@vps

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPTS_DIR}/lib/common.sh"

VALHALLA_DIR="${ROOT_DIR}/valhalla"
REMOTE_PATH="/srv/cycling-router"
HOST=""
WITH_ELEVATION=false
DRY_RUN=false
LOCAL=false
WAIT_TIMEOUT="${WAIT_TIMEOUT:-120}"
BASE_URL="${BASE_URL:-http://localhost:8002}"

usage() {
  grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' | tail -n +2 | head -12
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) LOCAL=true ;;
    --host) HOST="${2:?--host requires a value}"; shift ;;
    --path) REMOTE_PATH="${2:?--path requires a value}"; shift ;;
    --with-elevation) WITH_ELEVATION=true ;;
    --dry-run) DRY_RUN=true ;;
    -h|--help) usage ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
  shift
done

[[ -f "${VALHALLA_DIR}/tiles.tar" ]] || die "tiles.tar not found: run build_tiles.sh first"
[[ -f "${VALHALLA_DIR}/config/valhalla.json" ]] || die "valhalla.json not found: run build_tiles.sh first"

log_step "Artifacts ready (${HOST:-local})$( $WITH_ELEVATION && echo ', elevation included')"
du -sh "${VALHALLA_DIR}/tiles.tar" "${VALHALLA_DIR}/config" 2>/dev/null || true

RSYNC_FLAGS=(-az --info=stats1)
$DRY_RUN && RSYNC_FLAGS+=(-n)

deploy_to_remote() {
  command -v rsync >/dev/null || die "rsync is required for remote deploys"
  local dest="${HOST}:${REMOTE_PATH}"
  log_step "Syncing config and tiles to ${dest}"

  ssh "${HOST}" "mkdir -p '${REMOTE_PATH}/valhalla/config'"
  rsync "${RSYNC_FLAGS[@]}" \
    "${VALHALLA_DIR}/config/" "${dest}/valhalla/config/"
  rsync "${RSYNC_FLAGS[@]}" "${VALHALLA_DIR}/tiles.tar" "${dest}/valhalla/"

  if $WITH_ELEVATION; then
    log_step "Syncing elevation tiles (~1 GB, this takes a while)"
    ssh "${HOST}" "mkdir -p '${REMOTE_PATH}/valhalla/elevation'"
    rsync "${RSYNC_FLAGS[@]}" "${VALHALLA_DIR}/elevation/" "${dest}/valhalla/elevation/"
  else
    log_step "Skipping elevation (--with-elevation to include it)"
  fi
}

restart_remote_service() {
  if [[ -n "${REMOTE_RESTART_CMD:-}" ]]; then
    log_step "Restarting via REMOTE_RESTART_CMD hook"
    bash -c "${REMOTE_RESTART_CMD}"
  else
    log_step "Restarting over SSH (docker compose up -d)"
    ssh "${HOST}" "cd '${REMOTE_PATH}' && docker compose up -d valhalla"
  fi
}

restart_local_service() {
  log_step "Restarting local stack (docker compose up -d valhalla)"
  (cd "${ROOT_DIR}" && docker compose up -d valhalla)
}

wait_for_status() {
  local url="${1}/status" elapsed=0
  log_step "Waiting for Valhalla at ${url} (timeout ${WAIT_TIMEOUT}s)"
  until curl -sf -m 3 "${url}" >/dev/null; do
    sleep 3
    elapsed=$((elapsed + 3))
    if (( elapsed >= WAIT_TIMEOUT )); then
      die "Valhalla did not come up within ${WAIT_TIMEOUT}s"
    fi
  done
  log_step "Valhalla is up after ${elapsed}s"
}

smoke_test() {
  local url="${1}"
  log_step "Smoke test against ${url}"
  curl -sf -X POST "${url}/height" \
    -H 'Content-Type: application/json' \
    -d '{"shape":[{"lat":40.4168,"lon":-3.7038}]}' >/dev/null \
    || die "/height check failed"
  curl -sf "${url}/status" >/dev/null || die "/status check failed"
  log_step "Smoke test passed"
}

if $LOCAL; then
  restart_local_service
  wait_for_status "${BASE_URL}"
  smoke_test "${BASE_URL}"
else
  [[ -n "${HOST}" ]] || die "provide --host user@server or use --local"
  deploy_to_remote
  restart_remote_service
  wait_for_status "http://${HOST#*@}:8002"
  smoke_test "http://${HOST#*@}:8002"
fi

log_step "Deploy finished"
