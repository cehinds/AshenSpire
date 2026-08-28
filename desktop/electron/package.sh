#!/usr/bin/env bash
# desktop/electron/package.sh — package the Steam builds AND prove the packaged
# game is the game this repo is shipping.
#
# WHY THIS SCRIPT EXISTS (Vira's gate, #70). My first package embedded its own
# tree's dist faithfully — proven by asar extraction and sha256 rather than by
# trusting the packager — and that proof was real, correct, and about the wrong
# artifact. The branch's base was six merges behind the declared release, so the
# .exe carried a dist that predated the declaration and Sten's word did not
# transfer through it. Her lesson, kept here because the next person needs it
# more than I did:
#
#   A BYTE-IDENTITY PROOF ANSWERS "IS THE COPY FAITHFUL" AND IS SILENT ON
#   "FAITHFUL TO WHAT". It is the strongest possible evidence about a referent
#   nobody checked.
#
# So the referent is checked here, mechanically, on every package:
#   1. EXPECTED is derived from THIS REPO'S dist/AshenSpire.html at package
#      time. It is never a pasted constant — a hand-copied baseline goes stale
#      silently and then has to be "updated", which is how a check becomes a
#      rubber stamp (Marina's ruling on the frozen baseline, same shape).
#   2. Each packaged artifact's asar is extracted and the embedded
#      AshenSpire.html hashed. Extracted, not trusted.
#   3. A mismatch FAILS the packaging (exit 1). The build does not exist rather
#      than existing unverified.
#
# It cannot tell you the repo is at the declared commit — only that what you
# packaged is what this working tree ships. Checking the tree against the
# declaration is the human step, and it is printed loudly at the end so nobody
# can complete this without reading a hash they can compare to Sten's.
set -euo pipefail
cd "$(dirname "$0")"

# BJORN'S RULE, taken: refuse to package a tree whose dist does not match a
# NAMED REF. His line — "a package buildable from any checkout will eventually
# be built from the wrong one" — and it just was. Pass the release ref and the
# comparison stops being a person's memory:
#     ASHEN_RELEASE_REF=edd9390 ./package.sh
# The expected bytes are still DERIVED (from that ref, via git), never pasted.
RELEASE_REF="${ASHEN_RELEASE_REF:-}"

REPO_DIST="../../dist/AshenSpire.html"
[ -f "$REPO_DIST" ] || { echo "no $REPO_DIST — run from a full checkout"; exit 2; }
EXPECTED="$(sha256sum "$REPO_DIST" | cut -d' ' -f1)"
if [ -n "$RELEASE_REF" ]; then
  DECLARED="$(git -C ../.. show "$RELEASE_REF:dist/AshenSpire.html" | sha256sum | cut -d' ' -f1)" || {
    echo "cannot read dist at ref '$RELEASE_REF'"; exit 2; }
  if [ "$EXPECTED" != "$DECLARED" ]; then
    echo "REFUSING TO PACKAGE — this tree is not the declared release."
    echo "  tree dist     $EXPECTED"
    echo "  $RELEASE_REF dist  $DECLARED"
    echo "  Packaging here would ship a game the declaration does not cover."
    exit 1
  fi
  echo "tree matches declared ref $RELEASE_REF"
fi
echo "expected game bytes (derived from this tree): $EXPECTED"
echo "                                              $(git -C ../.. rev-parse --short HEAD) $(git -C ../.. log -1 --format=%s | cut -c1-60)"

# The packager copies dist-embed/, so refresh it from the repo's dist. This is
# the ONLY path by which the game enters the package.
rm -rf dist-embed build
cp -r ../../dist ./dist-embed

npx --yes @electron/packager . AshenSpire --platform=linux --arch=x64 --out=build \
  --ignore='userdata|build|run-spike.sh|package.sh|.*results\.txt' >/dev/null
npx --yes @electron/packager . AshenSpire --platform=win32 --arch=x64 --out=build \
  --ignore='userdata|build|run-spike.sh|package.sh|.*results\.txt' >/dev/null

fail=0
for target in linux-x64 win32-x64; do
  asar="build/AshenSpire-${target}/resources/app.asar"
  [ -f "$asar" ] || { echo "MISSING  $target — no app.asar"; fail=1; continue; }
  tmp="$(mktemp -d)"
  ( cd "$tmp" && npx --yes @electron/asar extract-file "$OLDPWD/$asar" dist-embed/AshenSpire.html )
  got="$(sha256sum "$tmp/AshenSpire.html" | cut -d' ' -f1)"
  rm -rf "$tmp"
  if [ "$got" = "$EXPECTED" ]; then
    echo "VERIFIED $target embeds this tree's game — $got"
  else
    echo "MISMATCH $target embeds $got"
    echo "         expected                $EXPECTED"
    echo "         the package would ship a game this repo is not shipping."
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo
  echo "packaging FAILED — builds left in place for inspection, do not ship them."
  exit 1
fi

echo
echo "packaged: build/AshenSpire-linux-x64/AshenSpire · build/AshenSpire-win32-x64/AshenSpire.exe"
echo
echo "BOUNDARY — what this does NOT prove:"
echo "  · that this tree is the DECLARED release. It proves the package matches"
echo "    THIS working tree. Compare the hash above against the declaration"
echo "    before shipping — that comparison is a person's job, on purpose."
echo "  · that the packaged app RUNS. run-spike.sh measures that, separately."
echo "  · anything about macOS, or about a signed/iconned Windows build."
