#!/usr/bin/env sh

set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <certificate-path> [output.mobileconfig]" >&2
  exit 1
fi

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/build_mobileconfig.py"

if [ "$#" -eq 2 ]; then
  uv run "$PY_SCRIPT" "$1" --output "$2"
else
  uv run "$PY_SCRIPT" "$1"
fi
