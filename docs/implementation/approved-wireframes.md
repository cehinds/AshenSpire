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

## Main menu save preview

Branch `feature/wireframe-title-menu`, based on dev `3c72a6df`.

- **W3b.** With a save to continue, the title highlights Continue (gold) and
  shows that exact save beside the menu:
  - the class;
  - `slotFacts` (act, floor, HP);
  - "Slot n · Seed x".

  It reuses the save facts the slot doors already print. On narrow hosts the
  preview stacks below the menu. Only the menu list and the preview become
  columns; the wordmark stays centred on the screen. Continue keeps its
  `.title-menu .slot-continue` hook, so the default focus and the tools
  that click it are unchanged.
- **W3a.** With no save, the lone centred menu is unchanged and has no empty
  preview placeholder.
- **Strings.** The new wording is in `uiStrings.csv`
  (`title.save.eyebrow`, `title.save.identity`, `title.save.aria`).
- **W2.** Confirmations already match W2 through `openConfirmationModal`:
  - a question title and a close control;
  - the message plus a consequence details card;
  - Back on the left and an action-named primary on the right;
  - danger tone as an alert dialog.

  Only the Back button's exit role remains, and it belongs with #1013.

Browser evidence (emulation): the production `mountTitle` was mounted with
a fixture save (slot 1: Reaver, Act 2, Floor 5, 48/62 HP).
- At 1280×800 the menu and preview sit in two columns, Continue is
  highlighted and focused, the wordmark is within 2.3px of centre, and nothing
  overflows.
- At 390×844 the preview stacks below the menu in view.
- The no-save title keeps the centred menu with Continue disabled.

Limits:
- A real new climb could not be started on the preview origin (Begin stayed
  on character creation), so W3b was verified with a fixture save, not a
  played one.
- The menu order and labels differ from W3: this build has Load, New,
  Collection, and Download & saves where W3 shows New game, Load game, and
  Multiplayer. That is an owner decision; this branch does not change it.

## Remaining integration

Complete the card and hand interaction matrix, compact containment, combatant
inspection and roster stress cases; then integrate and verify dependent
screen shells, equipment, progression, rewards, and remaining overlays against
every coverage entry. No issue or draft implementation PR has been published
for these uncommitted changes.
