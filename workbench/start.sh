#!/usr/bin/env sh
# workbench/start.sh — start (or reuse) the AshenSpire Workbench and open it.
#   ./workbench/start.sh [--port 4300] [--no-open] [--project DIR]
# Runs in the foreground: Ctrl+C stops the Workbench and every tool it started.
# A Workbench already on the port is reused only when it serves the same
# project (its /api/session root); another project's is an error, as in
# Start-Workbench.ps1.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT=4300
PROJECT="$HERE/.."
prev=""
for arg in "$@"; do
  case "$prev" in --port) PORT="$arg" ;; --project) PROJECT="$arg" ;; esac
  prev="$arg"
done
if session="$(curl -fsS -m 2 "http://127.0.0.1:$PORT/api/session" 2>/dev/null)"; then
  if ! want="$(cd "$PROJECT" 2>/dev/null && pwd -P)"; then
    echo "workbench/start.sh: no such project folder: $PROJECT" >&2
    exit 1
  fi
  have="$(printf '%s' "$session" | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d;}).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).root||""));}catch{}});')"
  if [ "$have" != "$want" ]; then
    echo "workbench/start.sh: port $PORT is already running a Workbench for another project (${have:-unknown}), not $want. Choose a different --port." >&2
    exit 1
  fi
  echo "AshenSpire Workbench is already running: http://127.0.0.1:$PORT"
  case " $* " in *" --no-open "*) ;; *) (xdg-open "http://127.0.0.1:$PORT" || open "http://127.0.0.1:$PORT") >/dev/null 2>&1 || true ;; esac
  exit 0
fi
exec node "$HERE/server.mjs" "$@"
