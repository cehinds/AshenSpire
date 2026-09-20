# Herald memory: the unfinished Burning, dark grade

Art-only refinement for prologue scene 4, Herald class memory. The owner asked for the
Herald scene to "look more intense, darker with more burning and ash effects similar to the
Burning", and then to "merge what's there for now".

## What changed

`assets/prologue/carry-herald-desktop.webp` and `assets/prologue/carry-herald-mobile.webp`
were regraded from the plates shipped in #1216:

- exposure lowered about two thirds of a stop with a muted umber colour grade and a dark
  edge vignette, shadow detail lifted slightly so it is not crushed;
- the hearth embers and the glow beneath the novice's robe are protected and a soft
  furnace-orange glow is added at the chest;
- drifting grey ash streaks, pulled toward the upper right like the Burning plate, and
  ember sparks around the hearth and the novice.

Composition, characters, the holy book, the elderly Furnace Saint and the chapel are
unchanged. Dimensions are unchanged (desktop 1280 x 801, mobile 768 x 1365).

## Method and provenance

No image generation was available in this session, so the pass is a deterministic
programmatic grade: `grade.cjs` (Sharp, seeded pseudo-random overlay). It reads
`masters/carry-herald-*-before.png` and rewrites the graded masters and runtime WebPs, so
running `node art/prologue-herald-burning-refinement/grade.cjs` from any checkout with
Sharp on the module path reproduces the deliverables apart from encoder version
differences.

- `masters/carry-herald-*-before.png`: the #1216 plates decoded losslessly.
- `masters/carry-herald-*.png`: graded PNG masters.
- `asset-manifest.json`: dimensions, byte sizes, WebP settings (quality 88, effort 6,
  smart subsampling, no resize) and SHA-256 checksums.
- `inspection/`: previews decoded from the compressed WebPs.
- `generation-prompt.json`: the ready prompt for the still-pending painted revision.

## Still pending: onlookers in shock

The owner also asked that "others should be in shock as the burning is happening". That
needs a repaint, not a grade. The prompt is saved in `generation-prompt.json`; the
recommended next pass is a reference-driven edit of `masters/carry-herald-desktop.png`
with the built-in image tool, then a portrait recomposition for mobile, using the same
export settings as above.
