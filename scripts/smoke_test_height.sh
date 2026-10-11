#!/usr/bin/env bash
#
# Smoke test for the Valhalla /height endpoint across known Spanish locations.
# Usage: scripts/smoke_test_height.sh   (VERBOSE=0 to silence payloads)

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPTS_DIR}/lib/common.sh"

BASE_URL="${BASE_URL:-http://localhost:8002}"
VERBOSE="${VERBOSE:-1}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-15}"

require curl jq

POINTS=(
  "Madrid Centro|40.4168|-3.7038"
  "Sierra de Guadarrama|40.8570|-3.9863"
  "Sierra Nevada|37.0944|-3.3870"
  "Pirineos|42.6656|0.0056"
  "Valencia Costa|39.4699|-0.3763"
  "Tenerife|28.4874|-16.3159"
  "Lisboa|38.7223|-9.1393"
  "Porto|41.1579|-8.6291"
  "Serra da Estrela|40.3217|-7.6114"
  "Madeira|32.6669|-16.9241"
  "Azores|37.7412|-25.6756"
  "Andorra|42.5063|1.5218"
)

log_step "Valhalla elevation smoke test"
log_info "Endpoint: ${BASE_URL}/height"
log_info "Timeout per request: ${REQUEST_TIMEOUT}s"
echo

ok_count=0
fail_count=0

for row in "${POINTS[@]}"; do
  IFS='|' read -r name lat lon <<<"${row}"

  log_info "Checking ${name} (lat=${lat}, lon=${lon})"
  payload="$(jq -nc --argjson lat "${lat}" --argjson lon "${lon}" '{shape:[{lat:$lat,lon:$lon}]}')"
  if [[ "${VERBOSE}" == "1" ]]; then
    log_info "Payload: ${payload}"
  fi

  set +e
  raw_response="$(curl -sS \
      --connect-timeout 3 \
      --max-time "${REQUEST_TIMEOUT}" \
      -X POST "${BASE_URL}/height" \
      -H 'Content-Type: application/json' \
      -d "${payload}" \
      -w $'\n%{http_code}')"
  curl_exit=$?
  set -e

  if (( curl_exit != 0 )); then
    log_error "FAIL ${name}: request error (curl exit ${curl_exit})"
    fail_count=$((fail_count + 1))
    continue
  fi

  response="${raw_response%$'\n'*}"
  http_code="${raw_response##*$'\n'}"

  if [[ "${VERBOSE}" == "1" ]]; then
    log_info "HTTP ${http_code}"
    log_info "Response: ${response}"
  fi

  if [[ "${http_code}" != "200" ]]; then
    log_error "FAIL ${name}: unexpected HTTP status ${http_code}"
    fail_count=$((fail_count + 1))
    continue
  fi

  height="$(jq -r '.height[0]' <<<"${response}")"

  if [[ "${height}" == "null" ]] || ! jq -en --argjson h "${height}" '$h|type=="number"' >/dev/null 2>&1; then
    log_error "FAIL ${name}: lat=${lat}, lon=${lon}, height=${height}"
    fail_count=$((fail_count + 1))
    continue
  fi

  # Elevation sanity range for Earth terrain in meters.
  if ! jq -en --argjson h "${height}" '($h >= -500) and ($h <= 9000)' >/dev/null 2>&1; then
    log_error "FAIL ${name}: lat=${lat}, lon=${lon}, height=${height} (out of sane range)"
    fail_count=$((fail_count + 1))
    continue
  fi

  log_ok "PASS ${name}: lat=${lat}, lon=${lon}, height=${height} m"
  ok_count=$((ok_count + 1))
done

echo
hr
log_info "Smoke test summary"
printf '  %sOK:   %d%s\n' "${C_GREEN}" "${ok_count}" "${C_RESET}"
if (( fail_count > 0 )); then
  printf '  %sFAIL: %d%s\n' "${C_RED}" "${fail_count}" "${C_RESET}"
else
  printf '  FAIL: %d\n' "${fail_count}"
fi
hr

if (( fail_count > 0 )); then
  exit 1
fi
log_ok "All checks passed"
