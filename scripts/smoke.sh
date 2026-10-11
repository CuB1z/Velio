#!/usr/bin/env sh
set -eu

BASE="${1:-https://velio.cub1z.es}"
fail=0

check() {
  status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$1")
  if [ "$status" = "$2" ]; then
    echo "ok   $1 -> $status"
  else
    echo "FAIL $1 -> $status (expected $2)"
    fail=1
  fi
}

check / 200
check /saved 200
check /loops 200
check /api/health 200
check /api/v1/auth/me 401

exit "$fail"
