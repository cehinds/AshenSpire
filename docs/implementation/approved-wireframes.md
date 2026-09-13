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

## Map: select, then Enter (classic act map)

Branch `feature/wireframe-map-bands`, based on dev `3c72a6df`. The owner
chose full W4b on both maps. This branch covers the classic act map, which
standard runs use; the world-journey atlas follows in its own branch.

- **Select, then Enter.** A tap on a lit node selects it; it no longer
  travels. Enter, or picking the selected node again, travels through the
  existing `enterNode` callback.
  - `src/ui/models/MapSelectionModel.js` owns the rule: an unreachable node
    is never selectable.
  - Keyboard and gamepad activation reach the same click path, so pressing
    confirm twice on a node also travels.
  - A repeat pick enters only once the selection has stood
    `wireframeUi.map.repeatPickDelayMs` (400 ms, provisional), so a fast
    double tap selects but never travels in one gesture.
- **Context band (WGM4).** Below the scene, the band shows the selected
  node's floor, kind, and description from the same `NODE_TYPES` table the
  legend and tooltip read. It adds a boss destination and the Sealstone Key
  reveal when they apply.
  - Under fog it shows the kind the board drew, never the hidden one. The
    board now passes its own reading with each pick.
  - The band has a fixed height, min(20% of the height, 8rem), and scrolls
    its own overflow, so a pick never shrinks the scene under the finger.
  - Without the board's reading a node reads as unknown; the hidden kind
    cannot leak through a caller that forgot to pass one.
- **Footer (WGM6, WGM7).** Recenter (the board's existing `resetFraming`)
  sits on the left and Enter on the right. Enter is disabled until a
  reachable node is selected and then names the kind.
- **Co-op.** The co-op map shares the board but keeps its own pick; nothing
  changes there.
- **Wording.** New text lives in `uiStrings.csv` (`map.*`).
- **Tools.** `tutorial-reach`, `offline-play-qa`, and
  `map-camera-persistence` now press Enter after selecting a node. The
  camera tool's self-test seam matches the board's new `onPick` call.
- **Camera.** The band and footer are built before the board mounts. The
  board checks a saved fit camera against the scene's height, so the bands
  must already take theirs, or every remount (Armoury, Continue) would drop
  the player's pan.
- **Selection mark.** A glow marks the selected node, because the pad
  cursor and hover both repaint the node's stroke.

Browser evidence (emulation, `?shot=map`):
- At 1280×800 one tap selected the lone reachable node, filled the band
  ("Floor 1 · Monster · A fight — cinders and a card reward."), enabled
  "Enter Monster", and stayed on the map. Enter opened combat.
- At 390×844 the second tap on the selected node opened combat.
- At both sizes the footer is in view and the page does not scroll. The map
  takes 58% of the height at 1280×800 and 66% at 390×844.

Limits:
- The run HUD plus route strip still take about 17% rather than W4b's 10%
  header; narrowing them means redesigning the shared HUD.
- The zoom bar's ⊙ remains beside the footer's Recenter (the co-op map shares
  that bar).
## Combatant lower stack

Branch `feature/wireframe-combatant-stack`, based on dev `3c72a6df`. WCF2 now
has one pure plan, `src/ui/models/CombatantStackModel.js`, with values in
`wireframeUi.combatantStack`.

- Rows arrive already filtered by activity. Order: HP (always), other
  resources, buildup ranked by fill, stance, then the status-icon row.
- At most five rows. Stance and the icon row are reserved before optional
  bars. Buildup that does not fit becomes a ring pip in the icon row.
  Resources that do not fit stay readable in the inspector.
- `procDisplayPlan` uses this plan. It replaces the former fixed cap of two
  buildup bars, and arcane exposure counts as a resource row when it renders.
- The icon row never wraps. Its capacity comes from the configured 1.575rem
  tile plus its gap; a reference rem is at least 16 physical px, as in the
  hand and footer plans. When icons overflow, the last tile is `+N`. Where
  the combat screen registers the inspector, `+N` opens it with every
  effect. Co-op keeps its popover.

Browser evidence (emulation): at 390×844 an enemy with poise and three
buildup meters showed HP, poise, two buildup bars, and an icon row. The
third buildup became a ring pip. The player's `+N` opened the inspector
with all six added effects.

Limits: on narrow slots the contract tile size leaves room for few icons, so
`+N` carries most effects there. The player's evade chip and Dodge receipt
are ability chips outside this plan. WT0/WCT1 timing already runs through
one tooltip service whose default delay is 1s. It is not changed here.
## Control roles and appearance

Branch `feature/wireframe-control-roles`, based on dev
`3c72a6df`. COLOR-INTERACTION-CONTRACT §3 now has one resolver,
`src/ui/models/ControlAppearance.js`. It applies the contract's precedence:
absent, then unavailable/busy, then destructive, then exit, then primary, then
utility/selection. Registered exceptions are validated by name.

- The kit `button()` stamps `data-control-role`, derived from its weight
  (a danger class is destructive), or from an explicit `role`. A registered
  `exception` is stamped as `data-control-exception`.
- Close (both shell builders), Back, Cancel, and Leave carry the exit role.
  They stay brown/gold at rest and turn red under pointer, keyboard, or pad
  highlight. A sole exit in the modal primary slot no longer receives
  primary green.
- `combatEndTurn` exception: a legal early End Turn stays neutral at rest and
  turns green while highlighted. Spent actions still mark it ready. Legality is
  unchanged.
- The positive (ready) colours now live in one set of
  `--control-positive-*` tokens.

WGH1 needed no change. `HUD_REFERENCE_MAX` (200/20/20) scales each track by
maximum/reference; the fill is current/maximum; there is no minimum track
length; `balance.ui.hudBars.main.scaleByMax` is on.

Not in this task: the nine size presets (WCB0). Grid button rows resolve
percentages against their own tracks, so presets need a workspace migration
that consumes them. They were not added as unused tokens.
## Combat bands and packed footer

Branch `feature/wireframe-combat-footer`, based on dev `3c72a6df`. W4a band
sizes and the WGC6 footer come from one pure model,
`src/ui/models/CombatLayout.js`, with every value in `wireframeUi.combat`,
`wireframeUi.hand`, and `wireframeUi.footer`. `components/combatLayout.js`
measures the combat root and the footer's host band, then writes custom
properties. `kit.css` places them; its old literals remain only as first-paint
and co-op fallbacks.

- Bands: nominal 10/55/30/5; the hand keeps 208 px and the footer 56 px
  (physical, after `--ui-zoom`); the battlefield absorbs the difference.
  When the remainder cannot hold one readable combatant (minimum sprite plus
  detail reserve), the root carries `data-combat-geometry="unsupported"`.
  844×390 reports unsupported; text and targets are not shrunk.
- Footer: one centered, gap-first grid. Actions and Potions share one circle
  at 95% of footer height, capped at 20% of the width; End Turn shares that
  height up to 40%; Draw and Discard use up to 10%.
- Resolved conflict: on narrow hosts the 10% pile envelope is smaller than
  the 44 px target and the two-line Discard/Exhaust face. The target and a
  provisional `pileMinimumRem: 4` readable floor win; End Turn gives up
  width. The floor uses the same reference rem as the hand (at least 16
  physical px), so it is 64 physical px, not CSS 4rem, and does not follow
  the text-size setting. The owner should confirm or replace this floor.
  Below about 290 px physical the floors cannot all fit; the footer reports
  `data-footer-geometry="unsupported"` and keeps the unpacked layout.

Browser evidence (emulation, animations finished):
- 1440×860: circles 53.2 px, piles 142.7 px, End Turn 570.7 px, centered.
- 375×667 and 360×780: piles hold their content without overflow; every
  footer target is at least 44 px; no overlap with the hand or viewport.
- A live resize from 375×667 to 360×780 re-planned the bands and tracks
  without remounting.

Limits: compact landscape still needs an owner decision (suggest rotation,
scroll, or relax minimums). `tools/combat-action-row.mjs`, which is not in
CI, still describes edge-anchored Actions and Potions. The packed-centered
WGC6 contract supersedes that and the tool needs updating. The hidden
preview pane throttles animation frames, so measurements were taken after
forcing a render.

## Remaining integration

Complete the card and hand interaction matrix, compact containment, combatant
inspection and roster stress cases; then integrate and verify dependent
screen shells, equipment, progression, rewards, and remaining overlays against
every coverage entry. No issue or draft implementation PR has been published
for these uncommitted changes.
