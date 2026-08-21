# Issue #282 shrine-fold harness correction

Correction base: `47ec8d83501e7e2300f90b7113ae0500c28f1344`
(tree `e1549ea82b9ffe25aad4f44c92ae7b537622f13c`). The historical subject
reproduced below is its exact parent,
`1be093806b6236fad5f0e922a5bb2bec19870e4a`
(tree `f4ad31578d2dbb89c07a4e2c31a1b8e096a71d0f`).

## Exact-parent reproduction: no observed clipped frame

The prior receipt said its cited BEFORE image visibly clipped `SHRINE OF
EMBER`. That claim is withdrawn. A detached exact-parent worktree was run with:

```powershell
$env:CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tools/shrinefold.mjs
```

The old harness passed `14/14`, and its actual source `1200x730` low-cinders
frame is fully inset rather than clipped. That unaltered output is preserved as
`parent-1be0938-old-harness-low-cinders-1200x730.png`, SHA-256
`263a13ac9b4520179e44a0c620514fce02ea72ec153b4c230a9e8ced7260a68f`.
It was captured by Chrome `151.0.7922.170` from the source-tree
`?shot=rest` route at `1200x730`.

What the exact-parent run proves is narrower: the old harness had no Text XL,
real pointer, real keyboard, title-inset, or vertical-reach contract. It does
not prove that a clipped frame existed. No planted or edited image is presented
as historical runtime evidence.

## Corrected contract

The corrected harness runs the real source and shipped-bundle rest routes at
`390x844` and `1200x730` with `shotSettings={"textSize":"XL"}`. At each
viewport it:

1. verifies that the real settings door applies the canonical Text XL value;
2. activates the Level fold by a real CDP pointer press, collapses it with a
   real Enter key event, and reopens it with a real Space key event;
3. verifies uniform collapsed faces, one-open state, remount persistence, and
   model-derived cinder disablement;
4. distinguishes horizontal escape (a failure) from vertical scrolling (an
   allowed, measured reach path), with the title and active reveal fully inset;
5. moves the pointer away, blurs focus, and uses an explicit capture pose so
   hover/focus residue cannot silently change the screenshots; and
6. records the disabled Level face after scrolling it into view; and
7. compares each low-cinders capture to its immutable committed raw anchor
   through a deterministic normalized-pixel contract.

The desktop affordable Text XL pose needs `7px` of `.shrine-screen` vertical
scroll to fit the entire active reveal; the phone pose needs `0px`. The final
low-cinders capture is taken at scroll origin. At desktop Text XL, the disabled
Level face is below that origin frame and is proven reachable in the separate
`disabled-level` capture.

## Raw-byte nondeterminism and normalized-pixel contract

Raw PNG identity is not an acceptance rule. Repeated exact-head source and
dist runs produced three valid raw hashes for the desktop low-cinders frame:

- committed anchor: `81354b7b753a412f5bbe6eb0ff6d63ca899182c1a9b65c8e59940411f67a6bcd`;
- alternate A: `9b0163d443b78000a267270a71b52c8af2b8c0ca7e156d91fd875207e566db87`;
- alternate B: `dfce19bb6a25fec2261705dd3e844721f7634bf5944206145bb32cbb99991080`.

The largest pairwise difference is 44 pixels in the physical `1200x730`
frame, bounded to rounded fold borders at `x=355..834`, `y=355..416`, with a
maximum RGB-channel delta of exactly 1. Chrome's `--deterministic-mode` was
also measured and did not remove this variation. The prior statement that
source and dist were byte-identical on every run is withdrawn.

The harness now decodes Chrome's non-interlaced 8-bit RGB/RGBA PNG itself and
applies this explicit contract:

- dimensions must match the committed anchor exactly;
- a pixel whose maximum channel delta is `0` is identical;
- a pixel whose maximum channel delta is `1` is reported as raster noise;
- at most 64 raster-noise pixels are permitted; and
- any channel delta greater than 1 is meaningful visual drift and fails.

Every verdict reports both raw hash prefixes, noise/meaningful counts, maximum
delta, and bounding box. A default verification run never replaces the raw
anchor with whichever antialias variant won that compositor pass. A custom
`--out` run still saves its actual raw candidate. This does not normalize or
edit a screenshot; it normalizes only the comparison verdict.

The 64-pixel allowance is wider than the observed 44-pixel maximum but remains
tiny relative to the 876,000-pixel desktop frame. Two same-door plants prove
that it does not hide meaningful change: a 4px fold translation produces more
than 50,000 meaningful phone pixels, and a cyan fold-border plant produces
more than 6,000 meaningful phone pixels. Existing plants separately catch the
title leaving the viewport and collapsed-face geometry divergence.

## Focused results

- Three repeated `node tools/shrinefold.mjs --out <unique-dir>` rounds —
  source, `26/26` green each.
- Three repeated `node tools/shrinefold.mjs --dist --out <unique-dir>` rounds
  — shipped bundle, `26/26` green each.
- Default source and dist runs — `26/26` each, with the committed anchors
  unchanged before/after despite raw candidates `dfce19bb...` and
  `9b0163d4...`.
- `node tools/shrinefold.mjs --selftest` — `10/10` same-door plants caught and
  the unplanted copied tree green:
  - S0: requested Text XL silently resolves to Text M;
  - S3: pointer activation cannot reach the Level face;
  - S3b: keyboard-generated disclosure clicks are ignored;
  - S2: collapsed faces stop being uniform;
  - S4: opening Flask leaves Level painted;
  - S6: cinder shortfall no longer disables Level;
  - S5: flask reallocation forgets the open fold; and
  - S7: the final desktop title is clipped above the viewport;
  - S7c: an in-bounds 4px fold translation changes rendered geometry; and
  - S7c: a cyan fold border changes the rendered palette.
- `node tests/run-node.mjs` — `94 passed, 0 failed`.
- `node tools/linkcheck.mjs` — `280/280` module graphs link.
- `node tools/onefold.mjs` — fold constructors `1 == 1`; aria-expanded
  constructors `3 == 3`.
- `node tools/screenreach.mjs --only 390x844` and the corresponding `--dist`
  run — Rest has four controls, zero covered, at the arrival-state boundary.
- `node tools/verify-shipped.mjs` — `6/6` green; artifact SHA-256 prefix
  `818bfb39b4e0`.
- `node tools/buildversion.mjs --check` — `8/8` green; H is explicitly n/a
  because the changes are only tool/evidence bytes.

## Committed Text XL anchor hashes

Source and dist anchors have matching bytes. Repeated raw-candidate identity is
not claimed; the normalized contract above owns that verdict.

- affordable `1200x730`:
  `965a0a9cae3359c738cda376d689cb9aa116cde0e1b4b403f9293dccb427a2df`
- affordable `390x844`:
  `2e30a0829a3ad477c7e3c46b1036042d39346b5fa47434d2122bac777ca32eb1`
- disabled Level `1200x730`:
  `6937b4c4e9b5ba7fcd92d35bdef0e7467c94b1b0e913c61e93fc961aac952dff`
- disabled Level `390x844`:
  `d3356c896b4858bd7ed3af84a5878ab5c77a384bc9b3ebd17db6e2bc6f20b6d3`
- low cinders `1200x730`:
  `81354b7b753a412f5bbe6eb0ff6d63ca899182c1a9b65c8e59940411f67a6bcd`
- low cinders `390x844`:
  `d3356c896b4858bd7ed3af84a5878ab5c77a384bc9b3ebd17db6e2bc6f20b6d3`

The identical phone disabled-Level and low-cinders hashes are expected: at
`390x844`, the disabled face is already fully visible at the origin, so the
supplemental reach pose does not move the screen.

## Serialization boundary

This correction changes only `tools/shrinefold.mjs` and this external evidence
directory. It does not regenerate or edit product source, CSS, README,
`AshenSpire.html`, `build/`, `dist/`, or `buildordinal.json`. `verify-shipped`
therefore continues to report the pre-existing artifact at `28b98d2`; the two
commits between that artifact and the correction base are tool/evidence-only.
Source and dist screenshots have distinct filenames, so neither run can
overwrite the other.
