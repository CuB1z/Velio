#!/usr/bin/env bash
#
# Build Valhalla routing tiles from an OSM PBF extract.
# Usage: scripts/build_tiles.sh [path/to/osm.pbf]

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPTS_DIR}/lib/common.sh"

PBF="${1:-${ROOT_DIR}/data/spain.osm.pbf}"
VALHALLA_DIR="${ROOT_DIR}/valhalla"
CONFIG_DIR="${VALHALLA_DIR}/config"
TILES_DIR="${VALHALLA_DIR}/tiles"
ELEVATION_DIR="${VALHALLA_DIR}/elevation"

[[ -f "${PBF}" ]] || die "OSM extract not found: ${PBF}"

mkdir -p "${CONFIG_DIR}" "${TILES_DIR}" "${ELEVATION_DIR}"

log_step "Generating Valhalla configuration"

docker run --rm \
    -v "${VALHALLA_DIR}:/data" \
    "${VALHALLA_IMAGE}" \
    valhalla_build_config \
        --mjolnir-tile-dir /data/tiles \
        --mjolnir-tile-extract /data/tiles.tar \
        --mjolnir-timezone /data/config/timezones.sqlite \
        --mjolnir-admin /data/config/admins.sqlite \
        --additional-data-elevation /data/elevation/ \
    > "${CONFIG_DIR}/valhalla.json"

log_step "Building timezones"

docker run --rm \
    -v "${VALHALLA_DIR}:/data" \
    "${VALHALLA_IMAGE}" \
    valhalla_build_timezones \
    > "${CONFIG_DIR}/timezones.sqlite"

log_step "Building administrative areas"

docker run --rm \
    -v "${VALHALLA_DIR}:/data" \
    -v "$(dirname "${PBF}"):/osm:ro" \
    "${VALHALLA_IMAGE}" \
    valhalla_build_admins \
        -c /data/config/valhalla.json \
        "/osm/$(basename "${PBF}")"

log_step "Building routing tiles (this takes a few minutes)"

docker run --rm \
    -v "${VALHALLA_DIR}:/data" \
    -v "$(dirname "${PBF}"):/osm:ro" \
    "${VALHALLA_IMAGE}" \
    valhalla_build_tiles \
        -c /data/config/valhalla.json \
        "/osm/$(basename "${PBF}")"

log_step "Building tile extract"

docker run --rm \
    -v "${VALHALLA_DIR}:/data" \
    "${VALHALLA_IMAGE}" \
    valhalla_build_extract \
        -c /data/config/valhalla.json \
        -v

echo
log_ok "Valhalla tiles built successfully"
log_info "Tiles:  ${TILES_DIR}"
log_info "Config: ${CONFIG_DIR}/valhalla.json"
