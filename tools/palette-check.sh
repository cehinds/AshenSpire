#!/usr/bin/env bash
# tools/palette-check.sh — gate on tools/palette-probe.html.
#
# Answers one question with an exit status: is the armour-separation metric in
# tools/palette-audit.py measuring what it is used to claim?
#
#   bash tools/palette-check.sh              run, print evidence, gate
#   bash tools/palette-check.sh --plates DIR also write the fixture PNGs there
#   bash tools/palette-check.sh --selftest   re-run the three-exit-code proof below,
#                                            by planting in a real copy of this tree
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
# THAT TEST IS RUN, NOT ASSERTED — AND SINCE 2026-08-15 IT IS RE-RUN BY `--selftest`
# RATHER THAN REMEMBERED. What follows is the original observation, and it was a
# ONE-OFF: a hand procedure in a throwaway tree, recorded in this comment and
# never runnable again. Under SOP 2's drift clause a ref-pinned observation is
# `unknown (drifted)` at every later ref, so by the time Vira's doors audit ran
# (2026-08-14) this file's evidence had rotted — and the audit filed it under
# HARNESS/exempt, which is a second thing to correct: this script's whole output
# is an exit code with a five-way contract. It asserts, therefore it is a check,
# therefore the instrument rule binds it. Both corrections are mine; the file is
# mine. `--selftest` plants the same three states in a real copy of the tree and
# requires the same three exit codes, so the paragraph below is now a description
# of something a reader can watch happen instead of something they must believe.
#
# THE ORIGINAL OBSERVATION, kept because it is the record of why the split exists:
# I ran it 2026-07-27 in a throwaway `git archive`
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

# ── --selftest — THE THREE-EXIT-CODE PROOF, RE-RUN INSTEAD OF REMEMBERED ──────
#
# The known-bads are real edits to the real files, in a COPY OF THIS WHOLE TREE
# — not a fixture, not a stub. Each arm runs the UNMODIFIED palette-check.sh from
# that copy, so every stage the real run performs runs: python's selfcheck maths,
# Chromium rendering the shipped .webp plates through a canvas, the evidence
# block parsed out of the DOM, the determinism re-run, and the source audit over
# the real outfits.csv. The copy exists so the working tree is never edited; the
# plants themselves are exactly the ones a careless commit would make.
#
# WHY A COPY AND NOT AN in-place PLANT+RESTORE: this script's stage 2 shells out
# to a browser and its stage 3 to python, and a plant that has to be restored
# after a browser crash is a plant that can leave the repo broken. A copy cannot.
if [ "${1:-}" = "--selftest" ]; then
  ROOT="$(cd "$DIR/.." && pwd)"
  WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
  echo "palette-check --selftest — the exit-code split, re-measured by planting in a real tree copy."
  echo "  source tree $ROOT"
  echo "  work        $WORK"
  echo
  cp -r "$ROOT/tools" "$WORK/tools"
  mkdir -p "$WORK/content" "$WORK/assets"
  cp -r "$ROOT/content/source" "$WORK/content/source"
  cp -r "$ROOT/assets/equipment" "$WORK/assets/equipment"

  BAD=0
  arm() { # arm <name> <expected-exit> <why>
    local name="$1" want="$2" why="$3"
    local out rc
    out="$(bash "$WORK/tools/palette-check.sh" 2>&1)"; rc=$?
    if [ "$rc" -eq "$want" ]; then
      echo "  $name: exit $rc as required — $why"
      echo "$out" | grep -E 'REFUTED_IDS|CHECKS [0-9]+|SOURCE AUDIT|closest on' | head -3 | sed 's/^/      /'
    else
      BAD=$((BAD+1))
      echo "  $name: WANTED exit $want, GOT $rc — $why"
      echo "$out" | tail -5 | sed 's/^/      /'
    fi
  }

  # ARM 1 — INSTRUMENT BROKEN, ART UNTOUCHED. D10 is the probe's positive
  # control: two flat, well-saturated, genuinely different colours must read as
  # different. Inverting its predicate (satHue > 90 -> > 900) makes the control
  # refuse a case it was built to accept. A broken instrument must never be
  # allowed to emit a verdict about the art, so the run must STOP at stage 2.
  sed -i 's/satHue > 90 \&\& satShift < 0.5)/satHue > 900 \&\& satShift < 0.5)/' "$WORK/tools/palette-probe.html"
  arm "instrument (exit 1)" 1 "D10's positive control inverted in palette-probe.html; the run must stop before judging the art"
  cp "$ROOT/tools/palette-probe.html" "$WORK/tools/palette-probe.html"

  # ARM 2 — INSTRUMENTS CLEAN, THE ART COLLIDES. This is the UNMODIFIED tree, and
  # nothing is planted: reaver default|warden really are painted alike today. The
  # known-bad for this arm is the shipped content itself.
  arm "art (exit 4)" 4 "the tree as it stands — reaver default|warden closest on 3 of 4 materials, unplanted"

  # ARM 3 — BOTH CLEAN. Warden repainted away from default, in the real CSV, by
  # the real authoring door. This is the arm that matters most: it proves exit 4
  # is a FINDING about these palettes and not a permanent red everyone learns to
  # ignore. If this one cannot reach 0, the exit-code split has stopped meaning
  # anything and this script's own removal condition has fired.
  sed -i 's/^warden,reaver,Warden Mail,3F4C5A,64798E,3A3226,24272A,/warden,reaver,Warden Mail,5B3F7A,8A64B0,4A3A5E,2E2436,/' "$WORK/content/source/outfits.csv"
  arm "repaint (exit 0)" 0 "warden's four authored hexes moved to a violet in outfits.csv; instruments and art both clean"

  echo
  cat <<'DOORBLOCK'
DOOR: every plant above is an edit to a REAL FILE in a real copy of this tree, and each arm runs the
      UNMODIFIED tools/palette-check.sh from that copy. The known-bad travels python's selfcheck, the
      browser rendering the shipped .webp plates through a canvas, the DOM evidence block, the
      determinism re-run and the source audit over the real outfits.csv. Nothing is handed to a
      function and no verdict here is computed by the selftest.
NOT PASSED: exit 2 (no evidence block) and exit 3 (determinism lost) have NO plant — they are declared
      states with no known-bad, so they remain `unknown`, not green. Exit 127 (no browser) likewise.
      This proves the 1 / 4 / 0 split, which is the split the removal condition is about.
BOUNDARY: one Linux box, one Chromium, the authored hex and the shipped plates as they stand. Silent
      on whether any pair READS as two suits at in-game size — that still needs an eye, as stage 3 says.
DOORBLOCK
  if [ "$BAD" -eq 0 ]; then
    echo
    echo "SELFTEST: 3/3 arms produced their required exit code — the 1/4/0 split is measured, not remembered."
    exit 0
  fi
  echo
  echo "SELFTEST: $BAD arm(s) wrong. If exit 1 and exit 4 have become the same number, this script has"
  echo "stopped doing its only job and its removal condition has fired. Do not repair it by adding a flag."
  exit 1
fi

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
