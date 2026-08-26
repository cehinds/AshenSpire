# QA remediation item #4 — shared Load / Quit confirmation

## Routing and scope

Constantine assigned the numbered remediation queue to App Team 1 through
AshenSpire — Main, overriding ordinary Help Desk intake for implementation.
Help Desk remains the intake/status ledger; Main remains the mandatory relay,
technical triage, and sequencing authority. This candidate changes item #4
only. Item #5, GitHub delivery, Project mutation, publication, release, and
`main`/`release` remain out of scope.

The maker lane is `C:\repos\AshenSpire-qa-04-confirmations` on
`codex/qa-04-confirmations`, deliberately rebased from the staged candidate onto
exact live `origin/dev@03bf280d1bcce8ce1f00529e5e41af90cf8b108d` after item #3
integrated.

## Broken player contract

Load and Quit Without Saving delegated their decisions to `window.confirm`.
That browser-native prompt did not use AshenSpire's visual language, could not
provide the same focus and layered-Escape contract as the in-run menus, and
made browser-dependent chrome the owner of a destructive game decision.

At the first frozen candidate, QA1 also reproduced a physical double-click
click-through: the first activation removed the confirmation and navigated,
then the second hit at the same screen coordinate could reach a newly rendered
Title control or combat enemy detail. Calling the detached old button twice did
not exercise that browser hit-test boundary and was not valid evidence.

## Repair

- One `openConfirmationModal` service renders both decisions from explicit
  labels, consequence copy, and semantic confirm/cancel callbacks.
- Danger decisions are accessible `alertdialog` surfaces. Neutral **Back** is
  first in DOM order and receives initial focus; Tab wraps inside the two
  actions.
- Escape, Back, and the scrim cancel without mutation and restore the invoking
  Quick Menu or overlay launcher. When stacked above Settings, one Escape
  removes only the confirmation.
- The danger action commits exactly once. Load closes the covered menu and
  resumes the active slot; Quit Without Saving stops music, clears the current
  run, and returns to Title.
- After commit, the empty veil remains as a transparent top-layer pointer/input
  shield through two destination paints and a configurable 600 ms activation
  window. It consumes the physical follow-up activation, then releases without
  leaving a visible or semantic modal.
- Confirmation copy is plain text, and both actions inherit the authored
  `--tap-floor` minimum.

The player can now review Load or Quit Without Saving in one consistent themed
surface, back out without losing their place, or deliberately activate the
clearly named destructive action.

## RED-first and behavior evidence

The inherited staged test used label 75, which collided with the integrated
exact-combat-save test. Before changing the label,
`node tools/testnumbers.mjs --raw` reported:

```text
BAD T1 — 1 number(s) worn by more than one test: "75." in tests/engine.test.js + tests/run-node.mjs
RESULT: RED — 1 duplicate test number(s) over 110 label(s)
```

The confirmation contract is now test 76. `node tools/confirmation-modal.mjs`
drives the rendered Map and Combat Quick Menus at 1200×730, 390×844, and
320×640 through Load review, Quit review, Back/Escape, an overlay-stacked
Escape, and exact-once explicit commits. It reuses the real confirmation-action
coordinate for a second physical browser activation after Map Quit, Combat
Quit, and Combat Load; before that second activation, `elementFromPoint`
must resolve the retained shield, and the trace must record no Title-control or
enemy-detail click. It also records horizontal and vertical overflow plus
console/network events at every viewport. Its `--selftest` corpus plants eight
real-source failures: bypassed Load review,
unsafe initial focus, underlying-overlay Escape, cancel mutation, double commit,
broken focus restoration, shrunken/overflowing targets, and premature
input-shield removal.

## Catalog coverage

- `confirmation-modal`
- `confirmation-cancel-control`
- `confirmation-action`

All three stable IDs are present in `UiComponentId.js`, SPEC, Markdown catalog, and
interactive HTML catalog.

## Candidate and verification

- Base: `origin/dev@03bf280d1bcce8ce1f00529e5e41af90cf8b108d`.
- Branch: `codex/qa-04-confirmations`; the exact local candidate head is
  reported after the final commit because a commit cannot contain its own SHA.
- Shipped build: `0.4.0.1375`; source digest `fa8e91bd6d`; artifact SHA-256
  `ce31142abdf653be5a58f6062e9918407e6954e15bb3d51f04bcd1c04c1cdd4d`;
  root/build/dist aliases are byte-identical at 4,152,330 bytes.
- Focused rendered source door: `60/60`; copied-tree known-bad corpus: `8/8`
  caught by its named RED, followed by a clean green copy.
- Exact shipped browser door: `60/60` across Map and Combat at 1200×730,
  390×844, and 320×640. Every modal reported zero horizontal/vertical overflow;
  diagnostic capture reported 0 unexpected console or network events. The
  counted expected headless baseline was console/network `21/4`, `20/3`, and
  `20/3` respectively (autoplay warnings plus missing favicon/LAN probe only).
- Full Node suite: `112 passed, 0 failed`; focused test 76 PASS; test labels:
  `110/110` unique.
- Component contract: `20/20`; component known-bads: `20/20` red.
- Link contract: `363/363`; link known-bads: `5/5` red.
- Shipped artifact: `6/6`; shipped known-bad corpus: `25/25`; build-version
  provenance: `8/8`; build-version corpus: `21/21`; bundler corpus:
  `0 failing cases`; content projection current; About/Changelog: 42 receipts.
- One serialized `launch.mjs --build-only` regeneration was performed after
  source authority froze; the focused shipped browser run refreshed the exact
  build screenshots, and `git diff --check` is clean.

## Screenshots

- `docs/preview/qa-confirmation-load-wide-1200x730.png`
- `docs/preview/qa-confirmation-load-mobile-390x844.png`
- `docs/preview/qa-confirmation-quit-wide-1200x730.png`
- `docs/preview/qa-confirmation-quit-mobile-390x844.png`
- `docs/preview/qa-confirmation-load-compact-320x640.png`
- `docs/preview/qa-confirmation-quit-compact-320x640.png`
- `docs/preview/qa-confirmation-combat-quit-wide-1200x730.png`
- `docs/preview/qa-confirmation-combat-quit-mobile-390x844.png`
- `docs/preview/qa-confirmation-combat-quit-compact-320x640.png`

Screenshots prove rendered state only; the focused browser door supplies the
interaction evidence.

Exact screenshot SHA-256 values, in the order listed above, are:

```text
ea72faf510bdd59c8c9b0bb15aaccdf610ef175973f653a0127285ec0cc6c46d
e088ce85d8fe0e5411306ce772ad43b6fedf2c625198ed70e425ccddddc1918e
d91c2ff9fd1cf7a882eab5843603c8192e28481265805c7a81347abc243786f5
a461a842729d5abb7307ea7c98d3b731d553e2e5f77559d23313c17a069e906b
bd096d4e1189f98321f471581ea71c0c6e0d49b881ad852beef043ab9e876f83
26be68beff5a8aaab230f7667ad47cd25c47cf6ac2754c68fabc9fdf6f4b5788
bec6828cb05c7fa9369d128301baa4bb56bc9b7e126170c0029f78d9bb47e75a
230bb783a3fbc9aa8fec93cf14c1de3c27773f901b444e43e9fc673976508421
bcf901f4ae3b2b7992150c5a237ea793958a8385c782deb582cdbd4be70d4d13
```

## Remaining boundary

Headless Chromium covers keyboard Escape, mouse activation, focus order,
rendered geometry, and all three responsive viewports. Physical touch, real gamepad
hardware, mobile Safari safe-area behavior, and assistive-technology speech are
not claimed and remain suitable independent QA boundaries.
