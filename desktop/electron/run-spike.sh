#!/usr/bin/env bash
# Electron spike runner — two app launches: write save, restart, read save.
# Default target is the dev harness (`electron .`); SPIKE_BIN points it at a
# packaged executable instead (e.g. build/AshenSpire-linux-x64/AshenSpire) —
# the package is a different artifact and gets its own run.
# Container boundary: headless box (Xvfb) + root (--no-sandbox). Neither flag
# is needed on a real desktop.
set -u
cd "$(dirname "$0")"
ELECTRON="${SPIKE_BIN:-./node_modules/.bin/electron}"
EXTRA_ARG=""
[ -z "${SPIKE_BIN:-}" ] && EXTRA_ARG="."
RESULTS="${1:-electron-results.txt}"
: > "$RESULTS"

run_once() {
  local mode="$1"
  local t0
  t0=$(date +%s%3N)
  SPIKE_T0="$t0" SPIKE_MODE="$mode" SPIKE_USERDATA="$PWD/userdata" xvfb-run -a \
    "$ELECTRON" --no-sandbox $EXTRA_ARG 2>/dev/null | grep '^SPIKE' >> "$RESULTS"
  local code=$?
  local t1
  t1=$(date +%s%3N)
  echo "SPIKE {\"event\":\"process_exit\",\"mode\":\"$mode\",\"exit_code\":$code,\"total_wall_ms\":$((t1 - t0))}" >> "$RESULTS"
}

echo "=== run 1 (write save) ===" >> "$RESULTS"
run_once write
echo "=== run 2 (restart, read save) ===" >> "$RESULTS"
run_once read
echo "=== on-disk save location ===" >> "$RESULTS"
ls -la userdata/Local\ Storage/leveldb/ >> "$RESULTS" 2>&1
cat "$RESULTS"
