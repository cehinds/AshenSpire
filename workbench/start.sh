#!/usr/bin/env sh
# workbench/start.sh — start (or reuse) the AshenSpire Workbench and open it.
#   ./workbench/start.sh [--port 4300] [--no-open] [--project DIR]
# Runs in the foreground: Ctrl+C stops the Workbench and every tool it started.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT=4300
prev=""
for arg in "$@"; do
  case "$prev" in --port) PORT="$arg" ;; esac
  prev="$arg"
done
if curl -fsS -m 2 "http://127.0.0.1:$PORT/api/session" >/dev/null 2>&1; then
  echo "AshenSpire Workbench is already running: http://127.0.0.1:$PORT"
  case " $* " in *" --no-open "*) ;; *) (xdg-open "http://127.0.0.1:$PORT" || open "http://127.0.0.1:$PORT") >/dev/null 2>&1 || true ;; esac
  exit 0
fi
exec node "$HERE/server.mjs" "$@"
