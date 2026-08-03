#!/usr/bin/env bash
# Tauri spike runner — two app launches: write save, restart, read save.
# Container boundaries: headless box (Xvfb); WEBKIT_DISABLE_DMABUF_RENDERER=1
# because WebKitGTK's DMA-BUF path blank-screens in containers without a GPU.
set -u
cd "$(dirname "$0")"
BIN=./src-tauri/target/release/ashen-spire-tauri
RESULTS="${1:-tauri-results.txt}"
: > "$RESULTS"
export WEBKIT_DISABLE_DMABUF_RENDERER=1

run_once() {
  local mode="$1"
  local t0
  t0=$(date +%s%3N)
  SPIKE_T0="$t0" SPIKE_MODE="$mode" xvfb-run -a \
    "$BIN" 2>/dev/null | grep '^SPIKE' >> "$RESULTS"
  local code=$?
  local t1
  t1=$(date +%s%3N)
  echo "SPIKE {\"event\":\"process_exit\",\"mode\":\"$mode\",\"exit_code\":$code,\"total_wall_ms\":$((t1 - t0))}" >> "$RESULTS"
}

echo "=== run 1 (write save) ===" >> "$RESULTS"
run_once write
echo "=== run 2 (restart, read save) ===" >> "$RESULTS"
run_once read
echo "=== on-disk save location (WebKitGTK storage under app identifier) ===" >> "$RESULTS"
find ~/.local/share/com.falk.ashenspire ~/.cache/com.falk.ashenspire -type f 2>/dev/null >> "$RESULTS"
cat "$RESULTS"
