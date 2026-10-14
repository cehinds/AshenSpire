# Character creation continuation handoff

Updated 2026-10-14. Current code: `f8546a0ac1fd76657218d266fa40f690eda69472`,
based on origin/dev `53e92b0da`. Final artifact: **0.7.1.1520 / `20bd788bd1`**.
Runtime validation is at `479bf4fe3` / `615181cdbb`; the subsequent change only
aligns component specimens with the production row layout and page order.
The previous `ef85447e6b` and provisional `7fba9e1339` artifacts are historical.
Never identify an artifact by ordinal alone: these local previews share 1520.

## Current owner instructions and implemented behavior

- [x] Preserve the existing Class lore, play style, stats and gear wording.
- [x] Every collapsed Class occupies its own full-width row in List and Grid:
  centered title, icon beside the first sentence, second detail underneath.
  Expanded choices retain four desktop/six mobile body lines, equal responsive
  heights and contained sprites. Native relic details retain their touch target.
- [x] Creation order: **Class → Subclass → Attributes → Feats → Starting Spells
  (caster) / Combat Maneuvers (noncaster) → Starting Equipment → Relic and
  Keepsake → Review**. There are eight visible steps for either class type.
- [x] Subclass is a separate page immediately below Class. It contains the two
  subclass choices, **Subclass traits**, and the inspectable eleven-card deck.
  “Subclass traits” replaces visible Tier terminology in creation.
- [x] Existing initial class-tree choices are selected before the intro.
  Fresh characters choose the existing first opening trait; veteran characters
  choose every eligible opening trait in canonical order. Thresholds, effects,
  requires/excludes and top-tier subclass filtering are unchanged.
- [x] Preview mastery is detached and nonbanking. Class/subclass changes reset
  choices; toggling an earlier trait clears later dependent choices. Keyboard
  selection restores both native DOM focus and the unified cursor after redraw.
- [x] Production birth validates traits and unlocked abilities before adopting
  the run, slot or registries. The optional `initialClassMastery` constructor
  context opens mastery after default grade-zero composition and before selected
  ability validation, canonical replacement, stamping, ordering and zone sync.
  This fixes veteran UI offers being rejected by a level-zero constructor.
- [x] Legacy omitted contexts preserve previous birth and the saved-run pending
  trait prompt. Keep `showMap()`'s fallback for older or incomplete saves.
- [x] Ability picks have a separate page before equipment. Equipment changes
  recheck legal picks; Begin refuses stale choices and directs back to that page.
  Relic selection is removed from Equipment and lives with Keepsake.
- [x] Feats remain browse-only, locked by Character/Class/Skills progression:
  zero starting feat grants. Spells use casting tags/authored casting skill.
- [x] All eight subclass recipes remain exactly **5 subclass + 1 class ability
  + 1 unique weapon art + 2 Strike + 2 Defend = 11**. Optional save/LAN/co-op
  identity carriage, respec/class changes and legacy decks retain prior behavior.

## Verification

- Integrated runtime gate at `479bf4fe3`: **68 passed, zero failed**, covering creation traits,
  actual screen/navigation/payload/focus, class mastery and starting abilities.
  Receipt and full log: `/workspace/scratch/creation-flow-validation/final-tests.result.json`
  and `final-tests.log`.
- Worker production-loader gate: 17 passed, including eight veteran starts in
  actual main import order. Existing opening compatibility: 22 passed. Fresh
  optional-context parity covers all eight decks, grades, instance IDs and stats.
- Independent Sol review approved current code: all eight previously failing
  veteran progression-card starts now produce eleven cards, valid round-trip
  save shape, applied traits and an empty pending queue without banking meta.
  Original failure and fixed receipts: `/workspace/scratch/creation-veteran-begin-review.log`
  and `/workspace/scratch/creation-veteran-begin-fixed-review.log`.
- Config/copy/zoom/named-import gates passed in the worker; final build passed.
  Final build receipt: `/workspace/scratch/creation-flow-validation/catalog-final-build.result.json`.
  Authoritative artifact stamp: `catalog-final-build-stamp.json` in that same directory.
  The final specimen-order regression passed; current navigation and Class folios
  were captured at 1440×900 and 390×844 with zero runtime errors.
- Class source browser proof: `/workspace/scratch/character-creation-preview-v2/class-row-sourceQA/`.
  All four selected classes: 198 px / four lines at 1440×900; 180 px / four at
  1440×720; 286.95 px / six at 390×844. Collapsed choices are full-width rows.
- Final standalone browser proof: `/workspace/scratch/subclass-preview/screenshots-0.7.1.1520-615181cdbb/actual-veteran-normal-begin.json`.
  Actual startup → title → creation (no shot route), valid isolated level-five
  Reaver profile, all three traits, offered `progression-cinder-guard`, Equipment,
  Relic/Keepsake, Review and Begin. Saved Heavy Knight has eleven cards,
  `coreTags=[ironFooting,ashenReserve,bulwarkKing]`, no pending initial tree tiers,
  no duplicate mastery overlay at startup and no runtime errors. The queued
  traits are already resolved before the intro; this receipt does not claim an
  intro playthrough. Browser plugin was absent;
  QA used managed Chromium/Playwright. The optional music manifest uses its
  documented procedural fallback.

The earlier pass's 665-file/6,456-test fast certificate and 151 core checks remain
historical evidence at `/workspace/scratch/subclass-validation/`. They were not
rerun as a single-source full suite for this revision. Heavy simulation/tool
self-tests and release checks were not run. No dev/main/release merge is claimed.

## Delivery and continuation

- Launcher: `/workspace/scratch/subclass-preview/packages/flow-0.7.1.1520-20bd788bd1/AshenSpire-subclass-preview-0.7.1.1520/START-HERE.html`.
  Same folder contains `GALLERY.html`, `AshenSpire.html` and the design layer editor.
- ZIP in that parent directory: `AshenSpire-subclass-preview-0.7.1.1520.zip`.
  Integrity verified; packaged game matches the final standalone build exactly.
- Gallery: 69 capture records, 19 page images and 50 component PNGs in 25 groups.
  Evidence is explicitly mixed: four final-build updated folios, 23 runtime/page/
  trait records from `615181cdbb`, and 42 reused unchanged component images from
  `ef85447e6b`. Per-record provenance is in `capture-manifest.json`. Old class-grid
  images and superseded navigation/Class folios are excluded. The final game and
  live component viewer are `20bd788bd1`; no broad runtime rerun is claimed after
  the catalog-only correction.
- Origin publication receipt: `/workspace/scratch/creation-flow-origin-state.json`.
  Local workers are published first, then integrated into `Feature/AddSubClasses`
  and `Feature/updateCharacterCreation`. Publication must verify exact tree parity.
- Artifact source remains `f8546a0ac`; later handoff-only commits do not relabel the build.
- Production surfaces: `src/ui/screens/customize.js`, `CreationWorkspaceModel.js`,
  `creationCards.js`, `styles/kit.css`, and authored creation config/UI strings.
- Trait projection/replay: `src/model/creationTraits.js`; staged constructor:
  `src/model/state.js`; detached runtime adoption: `src/main.js`.
- Focused tests: `creation-traits`, `creation-subclass-screen`, `creation-flow`,
  `subclass-bundled-opening`, `subclass-opening`, `class-mastery-run`, `starting-abilities`.
- Further visual/balance work follows owner playtest feedback. Keep words short,
  checkbox updates and actual desktop/mobile previews; use Sol/Luna workers and
  root as coordinator/reviewer. The design layer editor is design-only: mouse
  adjustments do not automatically patch production source.

Default FrostMonarch still uses Ash Staff/empty hand. Generic Bashing Blow is
unarmed (13 Blunt, no inherited Cold/Frost); pure casts are excluded from weapon
infusion. A resolved physical Sword source adds 2 Cold/1 Frost after HP damage.
Sword/Staff acceptance is a diagnostic fixture, not a legal starting Sword choice.
Do not change equipment legality to force a preview bonus to appear.
