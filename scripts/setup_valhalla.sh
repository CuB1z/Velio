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
REGIONS="${REGIONS:-spain,canary-islands,portugal,andorra}"
PYTHON="${PYTHON:-${ROOT_DIR}/.venv/bin/python}"

DO_BUILD=1
DO_ELEVATION=1
DO_START=1

usage() {
  cat <<'EOF'
Usage: scripts/setup_valhalla.sh [options]

Options:
  --regions <keys> Comma-separated regions from data/regions.json (default:
                   spain,canary-islands,portugal,andorra). Downloads them, merges
                   them into data/coverage.osm.pbf and builds the coverage
                   polygons, restricted areas and tiles from that file.
  --region <key>   Same as --regions with a single region
  --skip-build     Skip tile/config build
  --skip-elevation Skip elevation download
  --no-start       Do not start/restart docker service
  --help           Show this help

Environment variables:
  BASE_URL         Valhalla base URL for validation (default: http://localhost:8002)
  PARALLELISM      Used by scripts/download_elevation.sh (default: 4)
  WAIT_TIMEOUT     Seconds to wait for Valhalla startup (default: 60)
  PYTHON           Interpreter with the dev requirements (default: .venv/bin/python)
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --regions|--region)
      [[ -n "${2:-}" ]] || die "$1 requires a value"
      REGIONS="$2"
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

IFS=',' read -r -a REGION_KEYS <<<"${REGIONS}"
PBF="${ROOT_DIR}/data/coverage.osm.pbf"

if (( DO_BUILD )); then
  [[ -x "${PYTHON}" ]] || die "Python with the dev requirements not found: ${PYTHON} (set PYTHON)"

  log_step "Downloading OSM extracts: ${REGIONS}"
  "${SCRIPTS_DIR}/download_osm.sh" "${REGION_KEYS[@]}"

  if (( ${#REGION_KEYS[@]} > 1 )); then
    log_step "Merging ${#REGION_KEYS[@]} extracts into $(basename "${PBF}")"
    inputs=()
    for key in "${REGION_KEYS[@]}"; do inputs+=("data/${key}.osm.pbf"); done
    (cd "${ROOT_DIR}" && "${PYTHON}" -m tools.merge_regions "${inputs[@]}" --out "data/$(basename "${PBF}")")
  else
    PBF="${ROOT_DIR}/data/${REGION_KEYS[0]}.osm.pbf"
  fi

  log_step "Building coverage polygons and restricted areas"
  (cd "${ROOT_DIR}" && "${PYTHON}" -m tools.build_coverage "${REGION_KEYS[@]}")
  (cd "${ROOT_DIR}" && "${PYTHON}" -m tools.extract_restricted_areas --pbf "data/$(basename "${PBF}")")

  log_step "Building config and routing tiles from $(basename "${PBF}")"
  "${SCRIPTS_DIR}/build_tiles.sh" "${PBF}"
else
  log_warn "Build skipped (--skip-build)"
fi

if (( DO_ELEVATION )); then
  log_step "Downloading elevation tiles"
  count_hgt() { find "${ROOT_DIR}/valhalla/elevation" -name '*.hgt.gz' 2>/dev/null | wc -l; }
  hgt_before="$(count_hgt)"
  "${SCRIPTS_DIR}/download_elevation.sh"
  if (( DO_BUILD )) && (( $(count_hgt) > hgt_before )); then
    log_step "New elevation tiles: rebuilding routing tiles to bake their grades in"
    "${SCRIPTS_DIR}/build_tiles.sh" "${PBF}"
  fi
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
