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
Escape, and exact-once explicit Quit commit. It also records horizontal and
vertical overflow plus console/network events at every viewport. Its
`--selftest` corpus plants seven real-source failures: bypassed Load review,
unsafe initial focus, underlying-overlay Escape, cancel mutation, double commit,
broken focus restoration, and shrunken/overflowing targets.

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
- Shipped build: `0.4.0.1374`; source digest `9ee533f12e`; artifact SHA-256
  `e1401471b434ba8ebde4d87edffe32e2f77598ea1ac82a832c3d7c9ab744dbb4`;
  root/build/dist aliases are byte-identical at 4,150,003 bytes.
- Focused rendered source door: `45/45`; copied-tree known-bad corpus: `7/7`
  caught by its named RED, followed by a clean green copy.
- Exact shipped browser door: `45/45` across Map and Combat at 1200×730,
  390×844, and 320×640. Every modal reported zero horizontal/vertical overflow;
  diagnostic capture reported 0 unexpected console or network events. The
  counted expected headless baseline was console/network `20/3`, `19/2`, and
  `19/2` respectively (autoplay warnings plus missing favicon/LAN probe only).
- Full Node suite: `112 passed, 0 failed`; focused test 76 PASS; test labels:
  `110/110` unique.
- Component contract: `20/20`; component known-bads: `20/20` red.
- Link contract: `363/363`; link known-bads: `5/5` red.
- Shipped artifact: `6/6`; shipped known-bad corpus: `25/25`; build-version
  provenance: `8/8`; build-version corpus: `21/21`; bundler corpus:
  `0 failing cases`; content projection current; About/Changelog: 42 receipts.
- One serialized `launch.mjs --build-only` regeneration was performed after
  source authority froze; `git diff --check` is clean.

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

## Remaining boundary

Headless Chromium covers keyboard Escape, mouse activation, focus order,
rendered geometry, and all three responsive viewports. Physical touch, real gamepad
hardware, mobile Safari safe-area behavior, and assistive-technology speech are
not claimed and remain suitable independent QA boundaries.
