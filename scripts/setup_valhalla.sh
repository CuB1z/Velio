#!/usr/bin/env bash
#
# End-to-end Valhalla setup: download OSM data, build tiles,
# download elevation, start the service and validate endpoints.
# Usage: scripts/setup_valhalla.sh [--region <key>] [--skip-build] [--skip-elevation] [--no-start]

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPTS_DIR}/lib/common.sh"

BASE_URL="${BASE_URL:-http://localhost:8002}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-60}"
REGION=""
PBF="${ROOT_DIR}/data/spain.osm.pbf"

DO_BUILD=1
DO_ELEVATION=1
DO_START=1

usage() {
  cat <<'EOF'
Usage: scripts/setup_valhalla.sh [options]

Options:
  --region <key>   Download the OSM extract for <key> (see scripts/download_osm.sh --list)
                   and build tiles from it. Without this flag, an existing
                   data/spain.osm.pbf is required.
  --skip-build     Skip tile/config build
  --skip-elevation Skip elevation download
  --no-start       Do not start/restart docker service
  --help           Show this help

Environment variables:
  BASE_URL         Valhalla base URL for validation (default: http://localhost:8002)
  PARALLELISM      Used by scripts/download_elevation.sh (default: 4)
  WAIT_TIMEOUT     Seconds to wait for Valhalla startup (default: 60)
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --region)
      [[ -n "${2:-}" ]] || die "--region requires a value"
      REGION="$2"
      shift
      ;;
    --skip-build)     DO_BUILD=0 ;;
    --skip-elevation) DO_ELEVATION=0 ;;
    --no-start)       DO_START=0 ;;
    --help|-h)        usage; exit 0 ;;
    *)                die "Unknown option: $1" ;;
  esac
  shift
done

require docker curl jq

log_step "Valhalla setup started"
log_info "Root: ${ROOT_DIR}"

if [[ -n "${REGION}" ]]; then
  log_step "Downloading OSM extract for region '${REGION}'"
  "${SCRIPTS_DIR}/download_osm.sh" "${REGION}"
  PBF="${ROOT_DIR}/data/${REGION}.osm.pbf"
fi

if (( DO_BUILD )); then
  log_step "Building config and routing tiles from $(basename "${PBF}")"
  "${SCRIPTS_DIR}/build_tiles.sh" "${PBF}"
else
  log_warn "Build skipped (--skip-build)"
fi

if (( DO_ELEVATION )); then
  log_step "Downloading elevation tiles"
  "${SCRIPTS_DIR}/download_elevation.sh"
else
  log_warn "Elevation download skipped (--skip-elevation)"
fi

if (( DO_START )); then
  log_step "Starting Valhalla service"
  (cd "${ROOT_DIR}" && docker compose up -d --force-recreate valhalla)

  log_info "Waiting for service readiness (timeout: ${WAIT_TIMEOUT}s)"
  start_ts="$(date +%s)"
  until curl -sSf "${BASE_URL}/status" >/dev/null 2>&1; do
    if (( $(date +%s) - start_ts >= WAIT_TIMEOUT )); then
      die "Valhalla did not become ready within ${WAIT_TIMEOUT}s"
    fi
    sleep 2
  done
else
  log_warn "Service start skipped (--no-start)"
fi

log_step "Validating endpoints"

status_json="$(curl -sS "${BASE_URL}/status")"
log_ok "/status responded"

height_payload='{"shape":[{"lat":40.4168,"lon":-3.7038},{"lat":40.4175,"lon":-3.7030}]}'
height_response="$(curl -sS -X POST "${BASE_URL}/height" \
    -H 'Content-Type: application/json' \
    -d "${height_payload}")"

if jq -e '.height and ([.height[] | select(. != null)] | length > 0)' >/dev/null <<<"${height_response}"; then
  log_ok "/height returned non-null elevations"
  log_info "Sample heights: $(jq -c '.height' <<<"${height_response}")"
else
  log_error "/height response did not include non-null elevation values"
  log_error "Response: ${height_response}"
  exit 1
fi

echo
hr
log_ok "Valhalla setup completed successfully"
log_info "Status JSON: ${status_json}"
