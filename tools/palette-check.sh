#!/usr/bin/env bash
# tools/palette-check.sh — gate on tools/palette-probe.html.
#
# Answers one question with an exit status: is the armour-separation metric in
# tools/palette-audit.py measuring what it is used to claim?
#
#   bash tools/palette-check.sh              run, print evidence, gate
#   bash tools/palette-check.sh --plates DIR also write the fixture PNGs there
#
# It runs three instruments, in increasing cost, and keeps a BROKEN INSTRUMENT and a
# REAL FINDING ABOUT THE ART on separate exit codes — conflating them is how a content
# problem gets "fixed" by editing a threshold:
#
#   1. palette-audit.py --selfcheck      pure maths, no Blender, no browser
#   2. palette-probe.html                the shipped .webp through Chromium
#   3. palette-audit.py --source-audit   the authored hex in outfits.csv
#
# Exit codes
#   0    every declared check UPHELD and no content collision
#   1    a check was REFUTED or UNKNOWN (silence is not a pass) — instrument/regression
#   2    no evidence block at all — the page never finished
#   3    two consecutive runs disagreed (determinism lost)
#   4    instruments are fine; the ART has a collision (source audit tripped)
#   127  no browser found; every candidate tried is printed
#
# The probe declares each expected verdict BEFORE measuring, so this script can
# only ever agree or disagree with a declaration that is already in the artifact.
#
# ── CI DOES NOT RUN THIS. A GREEN CI RUN SAYS NOTHING ABOUT COLOUR. ───────────
# Checked at the merge of dev @ 5315249, which brought this repo its first
# workflow: .github/workflows/ci.yml contains no reference to palette-check.sh,
# palette-audit.py or palette-probe.html in any of its four jobs. So none of the
# 20 declared checks below runs per commit. Under SOP 2's silence guard that makes
# every claim in this directory `unknown` in CI — and unknown blocks, it does not
# read green. Stated here because a green run on a branch carrying this file is an
# absence that looks like a result, which is the one shape this house keeps
# finding. The `boundary` job says "nothing here RENDERS"; it does not yet say
# "nothing here checks whether two armour sets are separated", and that sentence
# is the accurate one.
#
# THE EXIT-CODE CONTRACT, for whoever wires it in — and it is not "just add a
# step", which is why I did not add one to another seat's workflow:
#   1, 2, 3  MUST block. Broken instrument, no evidence, determinism lost.
#   127      MUST block, as `unknown` — never a pass. No browser is not a clean bill.
#   4        MUST NOT block while the content call is held for Constantine. Exit 4
#            is a live finding about the palettes (reaver default|warden), not a
#            regression, and a gate that is red-by-design on an unmade decision
#            teaches everyone to ignore the gate. It needs to be VISIBLE and
#            non-blocking until someone repaints, then blocking forever after.
# Wiring that split is Rune's file and Marina's sequence, not mine to self-grant.
#
# ── REMOVAL CONDITION (SOP 1's corollary) ─────────────────────────────────────
# This script has no life of its own — it is the exit status of
# tools/palette-probe.html. It dies with the probe (that file's own REMOVAL
# CONDITION block lists five clauses and names this script in clause 1), and it
# ALSO dies on one condition of its own:
#
#   the exit-code split stops meaning anything. The whole reason this file exists
#   rather than a one-line `chrome --dump-dom | grep` is that exit 1 (broken
#   instrument) and exit 4 (real finding about the art) must never be the same
#   number — conflating them is how a content problem gets "fixed" by moving a
#   threshold. Test it: break the probe (invert one `expect`) and separately break
#   the art (edit one outfits.csv hex to collide). If both come back as the same
#   exit code, this script has stopped doing its only job and goes. Do not repair
#   it by adding a flag.
#
# THAT TEST IS RUN, NOT ASSERTED. I ran it 2026-07-27 in a throwaway `git archive`
# extraction of HEAD with these three files copied in, and observed THREE DISTINCT
# exit codes — so the split is measured, not a claim in a comment:
#
#   exit 1  instrument broken, art untouched. Inverted D10's predicate
#           (`satHue > 90` -> `> 900`). Result: CHECKS 20 UPHELD 19 REFUTED 1,
#           REFUTED_IDS D10, and the run STOPPED before stage 3 — a broken
#           instrument never gets to emit a verdict about the art.
#   exit 4  art collides, instruments clean. The unmodified tree, today:
#           20/20 UPHELD, then reaver default|warden closest on 3 of 4 materials.
#   exit 0  both clean. Repainted warden's four hexes to a violet in the throwaway
#           tree: 20/20 UPHELD and SOURCE AUDIT PASS. This is the one that matters
#           most — it proves exit 4 is a FINDING about these palettes and not a
#           permanent red that everyone learns to ignore, and it names the shape of
#           the fix (repaint warden away from default) without repainting anything.
# ──────────────────────────────────────────────────────────────────────────────
set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROBE="$DIR/palette-probe.html"
PLATE_DIR=""
[ "${1:-}" = "--plates" ] && { PLATE_DIR="${2:?--plates needs a directory}"; mkdir -p "$PLATE_DIR"; }

echo "=== 1/3  pure maths (no Blender, no browser) ==="
if ! python3 "$DIR/palette-audit.py" --selfcheck; then
  echo "selfcheck failed — the maths under everything else is wrong; stopping here"
  exit 1
fi

echo
echo "=== 2/3  the shipped .webp through Chromium ==="
CANDIDATES=(
  /opt/pw-browsers/chromium-1194/chrome-linux/chrome
  "$(command -v chromium 2>/dev/null)"
  "$(command -v chromium-browser 2>/dev/null)"
  "$(command -v google-chrome 2>/dev/null)"
  "$(command -v chrome 2>/dev/null)"
)
BROWSER=""
for c in "${CANDIDATES[@]}"; do [ -n "$c" ] && [ -x "$c" ] && { BROWSER="$c"; break; }; done
if [ -z "$BROWSER" ]; then
  echo "no browser found. tried:"; for c in "${CANDIDATES[@]}"; do echo "  ${c:-(not on PATH)}"; done
  exit 127
fi
echo "browser $BROWSER"

# --allow-file-access-from-files: the probe reads assets/equipment/*.webp through a
# canvas, which a file:// page may not do without it. Without the flag getImageData
# throws SecurityError and the probe reports PROBE_ERROR rather than passing quietly.
run_probe() {
  "$BROWSER" --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --force-color-profile=srgb \
    --virtual-time-budget=60000 --dump-dom "$PROBE" 2>/dev/null
}

extract() {
  python3 - "$1" <<'PY'
import html, re, sys
dom = open(sys.argv[1], encoding='utf-8', errors='replace').read()
# Read ONLY the rendered <pre id="out"> element, never the whole DOM. The page's own
# <script> source contains the literal string "BEGIN EVIDENCE" in its error handler, and
# --dump-dom includes script text: a whole-DOM regex happily matched that instead and
# reported a page that produced no evidence as a clean run. Found by negative test N3.
pre = re.search(r'<pre[^>]*id="out"[^>]*>(.*?)</pre>', dom, re.S)
if not pre:
    sys.exit(2)
body = html.unescape(pre.group(1))
m = re.search(r'BEGIN EVIDENCE.*?END EVIDENCE', body, re.S)
if not m:
    sys.exit(2)
print(m.group(0))
PY
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
run_probe > "$TMP/a.dom"; extract "$TMP/a.dom" > "$TMP/a.txt" || { echo "no evidence block in the DOM"; exit 2; }
run_probe > "$TMP/b.dom"; extract "$TMP/b.dom" > "$TMP/b.txt" || { echo "no evidence block on rerun"; exit 2; }

if ! cmp -s "$TMP/a.txt" "$TMP/b.txt"; then
  echo "DETERMINISM LOST — two consecutive runs disagreed:"; diff "$TMP/a.txt" "$TMP/b.txt" | head -40; exit 3
fi

# PLATE lines carry base64 PNGs; keep them out of the printed evidence.
grep -v '^PLATE ' "$TMP/a.txt"
echo "determinism  two consecutive runs byte-identical"

if [ -n "$PLATE_DIR" ]; then
  python3 - "$TMP/a.txt" "$PLATE_DIR" <<'PY'
import base64, sys
out = sys.argv[2]
n = 0
for line in open(sys.argv[1], encoding='utf-8'):
    if not line.startswith('PLATE '): continue
    _, name, url = line.split(' ', 2)
    data = url.strip().split(',', 1)[1]
    open(f'{out}/{name}.png', 'wb').write(base64.b64decode(data))
    n += 1
print(f'plates       wrote {n} PNG(s) to {out}')
PY
fi

RESULT="$(grep -o 'RESULT=[A-Z]*' "$TMP/a.txt" | tail -1)"
if [ "$RESULT" != "RESULT=PASS" ]; then
  echo
  echo "a declared check was REFUTED or UNKNOWN — see the CHECK lines above"
  exit 1
fi

echo
echo "=== 3/3  the authored hex in content/source/outfits.csv ==="
if ! python3 "$DIR/palette-audit.py" --source-audit; then
  echo
  echo "INSTRUMENTS OK — but the art has a collision. This is a finding about the"
  echo "palettes, not a broken check: do not silence it by moving a number."
  exit 4
fi
exit 0
