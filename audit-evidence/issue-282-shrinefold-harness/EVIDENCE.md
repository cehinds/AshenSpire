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
6. records the disabled Level face after scrolling it into view.

The desktop affordable Text XL pose needs `7px` of `.shrine-screen` vertical
scroll to fit the entire active reveal; the phone pose needs `0px`. The final
low-cinders capture is taken at scroll origin. At desktop Text XL, the disabled
Level face is below that origin frame and is proven reachable in the separate
`disabled-level` capture.

## Focused results

- `node tools/shrinefold.mjs` — source, `24/24` green.
- `node tools/shrinefold.mjs --dist` — shipped bundle, `24/24` green.
- `node tools/shrinefold.mjs --selftest` — `8/8` same-door plants caught and
  the unplanted copied tree green:
  - S0: requested Text XL silently resolves to Text M;
  - S3: pointer activation cannot reach the Level face;
  - S3b: keyboard-generated disclosure clicks are ignored;
  - S2: collapsed faces stop being uniform;
  - S4: opening Flask leaves Level painted;
  - S6: cinder shortfall no longer disables Level;
  - S5: flask reallocation forgets the open fold; and
  - S7: the final desktop title is clipped above the viewport.
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

## Current Text XL capture hashes

Source and dist are byte-identical for every corrected capture in this run:

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
