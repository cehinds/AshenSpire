# Approved wireframes: implementation

Reference: documentation commit `dcb3d1cd`, draft PR #1005. The owner requested
rebasing the implementation onto current dev after finding that the preview
used an old build. The branch now starts at `1b72522d`; the original
`09bda158` implementation commit was replayed as `18a44b28`. Existing work was
preserved. The owner’s unrelated primary checkout was not edited.

The subsequent merge preparation rebased onto `e017ef1d` (documentation-only
updates); the original implementation commit is now `b07b8747`. Runtime source,
tests, tools, and generated artifacts are byte-identical to the validated tree.
Implementation delivery is tracked in issue #1008.

## Coverage and current behavior

The adjacent `wireframe-coverage.json` lists all 152 approved entries and
separate structural, viewport, and interaction verification states. No entry
is complete yet. A component’s existence does not establish visual parity.

The shared card face now uses the approved 5:8 proportions, four bands, and
left cost rail. Live projections, X costs, and runtime registries still own
the values. The hand has uniform sizing, exclusive selection, instance-keyed
local reordering, and an inspection control outside the clipping scroller.
The inspector reuses real card details and domain actions.

Battlefield geometry uses fixed mirrored slots, front/back layering, equal
vertical ground-anchor intervals, role-specific guard anchors, and separate
selected growth. Existing sprite geometry and size-category ratios remain
authoritative. Shared modal footer actions use equal tracks.

## Reference reconciliation

- CURRENT-SPECIFICATION.md’s latest configuration governs accepted appearance;
  earlier hand fan and battlefield layout CSS is superseded.
- Current dev contains models and components missing from the old base. Reuse
  those runtime authorities; source paths in the reference are not evidence
  that a proposed adapter exists.
- Progression XP/practice examples do not authorize new mechanics. SPEC.md
  remains authoritative; do not turn illustrative reference data into gameplay.
- The hand/footer minimums leave insufficient readable battlefield height at
  844×390. The compact landscape appearance remains unresolved, not verified.

## Validation evidence and limits

Targeted card-cost, hand-layout, formation, and sprite-scale tests pass, as do
selection-store tests. The reference validator reports 152 entries and 608
views with no consistency failures; this is not runtime parity evidence.

Browser checks covered 1440×860, 375×667, 360×780, and 844×390. On iPhone SE,
selecting an adjacent card changed exclusive selection without spending an
action; its information control opened the real inspector, and Back restored
focus. Wide selection preserved the measured ground anchors and shared base
sprite scales. Compact landscape remains too compressed. Full drag/snapping,
all roster sizes, and all dependent screens still need browser verification.

Generated HTML was rebuilt with `node tools/launch.mjs --build-only`.
`verify-shipped` passed six checks and `buildversion --check` passed eight.
The first full Node run found two overlay coordinate writes that bypassed the
shared conversion helper. After converting them through `anchorLocalBox`, the
full Node rerun completed with exit code 0. Targeted zoom checks also pass.
Test logs and temporary images stay outside commits.

## Rewards claim status

Branch `feature/wireframe-rewards`, based on dev `3c72a6df`. W1t's
`{Status}` and claim-status regions now come from one model function,
`rewardClaimStatus(plan, states)` in `src/model/rewardplan.js`, beside the
reward menu it describes.

- The reward door's head shows "{claimed} of {total} claimed", using the
  shared `modal-head-status` slot that the piles viewer uses.
- The body pairs the reward choices with a claim-status column. The column
  lists every row as Taken, Skipped, Full (blocked), or Available. When a
  card choice is still waiting, it adds "Required choice", an optional slot
  that collapses otherwise. The two columns sit side by side on wide hosts
  and stack on narrow hosts, as W1t specifies.
- The new wording lives in `uiStrings.csv` (`reward.status.claimed`,
  `reward.claim.heading`, `reward.state.available`,
  `reward.claim.required`).
- Select-then-confirm for card offers, and Back/primary footers, were
  already in place and are unchanged.

Browser evidence (emulation):
- At 1280×800 the columns sit side by side and the head reads "2 of 6
  claimed". After a card is chosen it reads "3 of 6 claimed" and the
  required-choice line disappears.
- At 390×844 the claim column stacks after the rewards with no horizontal
  scroll.

Limits: the reward door keeps its medium modal width over the battlefield
rather than W1t's 95vw frame, so each wide column is narrow. On Windows,
`tools/uistrings.mjs --check` reports 124 files as changed. The cause is
backslash versus forward-slash paths; the check is not run in CI.

## Remaining integration

Complete the card and hand interaction matrix, compact containment, combatant
inspection and roster stress cases; then integrate and verify dependent
screen shells, equipment, progression, rewards, and remaining overlays against
every coverage entry. No issue or draft implementation PR has been published
for these uncommitted changes.
