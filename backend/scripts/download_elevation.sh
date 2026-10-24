#!/usr/bin/env bash
#
# Download elevation tiles (.hgt.gz) covering the routing graph.
# Usage: scripts/download_elevation.sh [output-dir]

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPTS_DIR}/lib/common.sh"

VALHALLA_DIR="${ROOT_DIR}/valhalla"
CONFIG_FILE="${VALHALLA_DIR}/config/valhalla.json"
OUTDIR="${1:-${VALHALLA_DIR}/elevation}"
PARALLELISM="${PARALLELISM:-4}"

[[ -f "${CONFIG_FILE}" ]] || die "Config not found: ${CONFIG_FILE}. Run scripts/build_tiles.sh first."

mkdir -p "${OUTDIR}"

log_step "Downloading elevation tiles"
log_info "Config:      ${CONFIG_FILE}"
log_info "Output:      ${OUTDIR}"
log_info "Parallelism: ${PARALLELISM}"
echo

# Default location is already reachable through the /data mount; any custom
# output directory gets its own mount.
if [[ "${OUTDIR}" == "${VALHALLA_DIR}/elevation" ]]; then
  OUT_VOLUME=()
  OUT_ARG="/data/elevation"
else
  OUT_VOLUME=("-v" "${OUTDIR}:/out")
  OUT_ARG="/out"
fi

docker run --rm \
    -v "${VALHALLA_DIR}:/data" \
    "${OUT_VOLUME[@]}" \
    "${VALHALLA_IMAGE}" \
    valhalla_build_elevation \
        --from-tiles \
        --config /data/config/valhalla.json \
        --outdir "${OUT_ARG}" \
        --parallelism "${PARALLELISM}" \
        --verbosity

echo
log_ok "Elevation download completed"
log_info "Tiles: $(find "${OUTDIR}" -name '*.hgt.gz' | wc -l) files ($(du -sh "${OUTDIR}" | cut -f1))"
log_info "Output: ${OUTDIR}"
