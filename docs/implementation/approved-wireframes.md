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

## Atlas: select, then Enter (world-journey map)

Branch `feature/wireframe-atlas-bands`, based on dev `3c72a6df`, issue #1026. The owner
chose full W4b on both maps. This section covers the world-journey atlas
(`src/ui/screens/worldAtlas.js`, used when `run.journey` exists). The classic
act map is on `feature/wireframe-map-bands` (issue #1023). That branch was not
merged when this started, so the atlas follows its pattern with its own model
and `atlas.*` strings.

- **Bands.** Header (title, vitals, Armoury / Menu / Save & quit), map scene,
  context band, footer. The screen no longer scrolls. Only the scene's
  scrollport (the camera) and the context band scroll.
- **Select, then Enter.** A tap on any discovered place, on the map or in the
  open-roads list, selects it and fills the context band. It no longer opens
  the location dialog.
  - `src/ui/models/AtlasSelectionModel.js` owns the rule. An undiscovered
    place is never selectable. A discovered place without a road can be read
    but not entered.
  - Tapping the selected place again does what Enter would. Where Enter is
    unavailable, it opens the place's details instead.
- **Enter (WGM7).** Enter travels to a selected open road through `onTravel`.
  That is the same command the location dialog's "Travel to …" button calls,
  so journey rules, discovery and reachability are untouched. At the place
  where you stand, Enter opens its location view, where exploring, services
  and quests live.
  - Why travel rather than open the dialog: W4b's footer primary commits the
    selection, as the classic map's Enter does. If Enter only opened the
    dialog, reaching a place would take three taps, and the footer would
    duplicate the dialog's Travel button.
  - Inspection stays one tap away through Details.
- **Context band (WGM4).** It shows the selected place's region, name, road
  state, and description, plus the open roads, sealed-road notes, the three
  guiding lights, progress, and the legend. It sizes to its content up to 20%
  of the height. On narrow screens the roads follow the name and road state,
  and the rest scrolls inside the band.
- **Footer (WGM6).** Recenter, on the left, is the former "You" button (same
  camera call). − / Fit / + float in the scene's top-right corner.
- **Wording.** New text lives in `uiStrings.csv` (`atlas.*`). The location
  dialog's road-state sentence now reads the same rows.
- **Tools.** `world-atlas-qa` now selects a road and presses Enter, and asserts
  that the bands fit at both of its viewports. `mobile-readability-qa` uses the
  new Details control.

Browser evidence (in-app browser emulation, `?shot=atlas`, seed SHOWCASE,
Wanderer profile). Screen shares, in % of viewport height:

| Viewport | Header | Scene | Context | Footer | Screen scroll |
|---|---:|---:|---:|---:|---|
| 1280×800 | 9.0 | 63.2 | 20.0 | 7.8 | none |
| 390×844 | 9.4 | 63.6 | 20.0 | 7.0 | none |
| 360×780 | 9.6 | 62.9 | 20.0 | 7.5 | none |

- The context band reached its cap at all three sizes. Its content overflows
  by 12px at 1280×800 and by about 210px on the phones, and scrolls inside the
  band.
- At 1280×800, selecting Pilgrim Road from the roads list did not travel,
  and labelled the button "Enter Pilgrim Road". Enter then opened combat with
  the journey moved to that node.
- A second tap on the same map node also travelled.
- A real click on Details opened Crownfall's location dialog, showing its
  local map and "You are here.". Close returned focus to Details.
- Buttons are named by the words they wear ("Details", "Recenter",
  "Enter Crownfall"). They carry no `title`, which the shared tooltip layer
  would turn into the accessible name.

Deviations and limits:
- The scene takes about 63% rather than 60%. The header and footer need less
  than their nominal 10%, and the map absorbs the difference.
- Fit still fits the map's width. On a wide scene, the square map is taller
  than the viewport, so Fit does not show the whole map at 1280×800. The
  camera model is unchanged (zoom is clamped at 1 or more).
- There is no region selector (WGM5): a journey has one world map.
- On phones, the header uses two rows: title and vitals, then the three
  actions.
- The shared screen-entry transition offsets the screen by 8px for under
  250ms after mounting.
- Keyboard Enter could not be proven in the preview pane. The page never had
  focus, and the untouched Menu button did not activate either. Keyboard and
  gamepad reach the same click path.
- `world-atlas-qa` and `mobile-readability-qa` need Playwright with Edge.
- `tools/uistrings.mjs --check` is red on Windows for every file: its baseline
  keys use `/` and the tree uses `\`. The atlas screen is not in its baseline.

## Remaining integration

Complete the card and hand interaction matrix, compact containment, combatant
inspection and roster stress cases; then integrate and verify dependent
screen shells, equipment, progression, rewards, and remaining overlays against
every coverage entry. No issue or draft implementation PR has been published
for these uncommitted changes.
