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

At the second frozen candidate, QA2 measured the danger action text at 3.70:1
and the uppercase consequence eyebrow at 4.11:1, both below the 4.5:1 text
contrast floor. Ember still cleared the non-text border requirement, but it was
not an accessible text color on the rendered confirmation backgrounds.

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
- Blood/ember remains on the danger borders. The action and eyebrow words now
  use the existing `--parchment` token; the browser gate reads their computed
  foreground/background colors and requires at least 4.5:1 at every viewport.
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
console/network events at every viewport. Its `--selftest` corpus plants nine
real-source failures: bypassed Load review,
unsafe initial focus, underlying-overlay Escape, cancel mutation, double commit,
broken focus restoration, shrunken/overflowing targets, premature input-shield
removal, and low-contrast danger text.

For the contrast reopen, the new computed-color assertion first failed at all
three source viewports with action `3.70:1` and eyebrow `4.11:1`. After the
token-only repair, action measures `15.46:1` and eyebrow `17.15:1` at all three
viewports. The same door also adds a ninth source plant that restores ember
text and must fail by `CONFIRMATION-*-CONTRAST`.

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
- Shipped build: `0.4.0.1376`; source digest `14fa81f2e2`; artifact SHA-256
  `f5388cdb66abbe6e11d77a9daf546c1cce635ae77df77cbbd443393213454f2d`;
  root/build/dist aliases are byte-identical at 4,152,488 bytes.
- Focused rendered source door: `63/63`; copied-tree known-bad corpus: `9/9`
  caught by its named RED, followed by a clean green copy.
- Exact shipped browser door: `63/63` across Map and Combat at 1200×730,
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
91598ad465a3cdc19aa860ef9d067d1d05d668f6df6898ead5fadc645a3977b0
ec5213e3a72d18b3cc1ab2a9520aad34aae7ccc72af9882dcf63a23f77a4856c
bcf674c017a05cc60e6e52dca67818f039a8e8a3af7affddcbc195baf850f982
4fc0eb40d28b07eec18b60535440c3278ca5d38870d799119689f6c9310353fc
c53b250cae56bbfedbbe431e8e0f64455f76dde04fed0f369159ac41fc1cb4c5
ef16e86b9bde40b6694079a54ed8efc25d0e2076d6be55a580b4d03490165780
72597e144c934ebfd20d90f32a70a98d33e50cf9befeb094bb74139de44e469c
e1c6f102da6d112bb58178dcdb76991890cbce47012b67381644d12ef611b0ae
5a4550c2373430711875bbe83ae07a3517b55d0fdfaadf81e09dc765ac22c9e4
```

## Remaining boundary

Headless Chromium covers keyboard Escape, mouse activation, focus order,
rendered geometry, and all three responsive viewports. Physical touch, real gamepad
hardware, mobile Safari safe-area behavior, and assistive-technology speech are
not claimed and remain suitable independent QA boundaries.
