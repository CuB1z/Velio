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

check_body() {
  if curl -s "$BASE$1" | grep -q "$2"; then
    echo "ok   $1 contains $2"
  else
    echo "FAIL $1 does not contain $2"
    fail=1
  fi
}

check / 200
check /es 200
check /saved 200
check /loops 200
check /api/health 200
check /api/v1/auth/me 401

check_body / '<html lang="en"'
check_body / '<h1'
check_body /es '<html lang="es"'
check_body /es '<h1'
check_body /es/login '<div id="root"></div>'
check_body /privacy '<h1'
check_body /es/privacy '<html lang="es"'
check_body /terms '<h1'
check_body /es/terms '<h1'

exit "$fail"
