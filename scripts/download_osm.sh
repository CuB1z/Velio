#!/usr/bin/env bash
#
# Download OSM PBF extracts listed in data/regions.json.
# Files are saved as data/<region>.osm.pbf.
# Usage:
#   scripts/download_osm.sh --list              Show available regions
#   scripts/download_osm.sh <region> [...]      Download one or more regions
#
# Environment variables:
#   FORCE=1         Re-download even if the file already exists

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPTS_DIR}/lib/common.sh"

REGIONS_FILE="${ROOT_DIR}/data/regions.json"
DATA_DIR="${ROOT_DIR}/data"

[[ -f "${REGIONS_FILE}" ]] || die "Regions catalog not found: ${REGIONS_FILE}"
require curl jq

list_regions() {
  log_step "Available regions (${REGIONS_FILE})"
  jq -r 'to_entries[] | "  \(.key)  \(.value.name)\n        \(.value.url)"' "${REGIONS_FILE}"
}

if (( $# == 0 )) || [[ "${1:-}" == "--list" || "${1:-}" == "-l" ]]; then
  list_regions
  if (( $# == 0 )); then
    log_info ""
    log_info "Usage: scripts/download_osm.sh <region> [...]"
  fi
  exit 0
fi

mkdir -p "${DATA_DIR}"

for region in "$@"; do
  url="$(jq -r --arg k "${region}" '.[$k].url // empty' "${REGIONS_FILE}")"
  [[ -n "${url}" ]] || die "Unknown region '${region}'. Use --list to see available regions."

  outfile="${DATA_DIR}/${region}.osm.pbf"

  if [[ -s "${outfile}" ]] && [[ "${FORCE:-0}" != "1" ]]; then
    log_warn "${region}: already downloaded ($(du -h "${outfile}" | cut -f1)), skipping (FORCE=1 to re-download)"
    continue
  fi

  log_step "Downloading ${region} -> ${outfile}"

  tmp_file="${outfile}.part"
  curl -fL --retry 3 --progress-bar -o "${tmp_file}" "${url}"
  [[ -s "${tmp_file}" ]] || die "Download produced an empty file: ${url}"

  mv "${tmp_file}" "${outfile}"
  log_ok "${region}: downloaded ($(du -h "${outfile}" | cut -f1))"
done
