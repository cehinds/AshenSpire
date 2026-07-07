#!/usr/bin/env bash
# Spire of the Erdtree — build the standalone, refresh dist/, then serve on
# localhost and open the game in your browser.
#   ./run.sh              build + serve + open
#   ./run.sh --no-open    build + serve, don't open a browser
#   ./run.sh --build-only just refresh dist/, no server
#   ./run.sh --port 9000  serve on a specific port
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found on PATH. Install it from https://nodejs.org"
  exit 1
fi
exec node "$DIR/tools/launch.mjs" "$@"
