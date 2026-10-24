#!/usr/bin/env bash
# shellcheck shell=bash
#
# Shared helpers for the backend scripts.
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

# Repo layout ----------------------------------------------------------------

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "${LIB_DIR}")"
ROOT_DIR="$(dirname "${SCRIPTS_DIR}")"

# Docker image used by every Valhalla step (build, elevation, runtime).
VALHALLA_IMAGE="${VALHALLA_IMAGE:-ghcr.io/valhalla/valhalla:3.8.2}"

# Output formatting ----------------------------------------------------------
# Colors only when writing to a TTY; NO_COLOR disables them explicitly.

if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_BLUE=$'\033[1;34m'
  C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'
  C_RED=$'\033[1;31m'
else
  C_RESET='' C_BOLD='' C_DIM='' C_BLUE='' C_GREEN='' C_YELLOW='' C_RED=''
fi

log_step()  { printf '%s==> %s%s\n' "${C_BLUE}" "$*" "${C_RESET}"; }
log_info()  { printf '%s\n' "$*"; }
log_ok()    { printf '%s✓ %s%s\n' "${C_GREEN}" "$*" "${C_RESET}"; }
log_warn()  { printf '%s! %s%s\n' "${C_YELLOW}" "$*" "${C_RESET}"; }
log_error() { printf '%s✗ %s%s\n' "${C_RED}" "$*" "${C_RESET}" >&2; }

hr() { printf '%s==========================================%s\n' "${C_DIM}" "${C_RESET}"; }

die() { log_error "$*"; exit 1; }

# Fails unless every given command is available in PATH.
require() {
  local cmd
  for cmd in "$@"; do
    command -v "${cmd}" >/dev/null 2>&1 || die "'${cmd}' is required but not installed"
  done
}
