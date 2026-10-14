# Character creation continuation handoff

Updated 2026-10-14. Current code: `711358b686cc4258d9a12db36eb7b11947d31de7`,
based on origin/dev `53e92b0da`. Final artifact: **0.7.1.1520 / `12841b3d31`**.
Runtime validation is at `479bf4fe3` / `615181cdbb`; later changes affect only creation icons, responsive typography/alignment and
component specimens. Engine, model and content bytes are unchanged in this pass.
The previous `ef85447e6b` and provisional `7fba9e1339` artifacts are historical.
Never identify an artifact by ordinal alone: these local previews share 1520.

## Current visual pass

- [x] Wireframe shown before implementation: shared centered left icon column,
  class name/lore/play style aligned in the right text column. Orange reference
  guides are not production decoration; all Class words remain unchanged.
- [x] Original reusable SVG marks: **Reaver red point-down greatsword; Starseer
  purple spellbook; Rogue green paired daggers; Herald gold sun**. These are
  creation-only; global class glyphs and canonical character paintings are intact.
  SVGs are decorative, namespace-correct, nonfocusable, and inherited/unknown
  IDs safely return null for the caller's fallback.
- [x] Physical sizes compensated for UI zoom: class names 24 px, collapsed lore/
  play style 16/15 px, section headings 28–32 px, navigation labels 20 px. All are
  below the owner's **36 pt / 48 px** maximum; section names remain single-line.
  Desktop rail is 280 physical px. Phone current-step / All Steps controls stack.
- [x] Phone title has its own row above the view toggle and portrait/menu/close
  toolbar. QA reproduced then fixed the former collision at 390×844.
- [x] Expanded body copy stays 16 px, with existing four desktop/six phone lines,
  shared responsive heights, contained sprites and the native relic target.
- [x] Final focused Class/detail gate: **11 passed, zero failed** at current code.
  Receipt: `/workspace/scratch/creation-icon-alignment-preview/validation/final-tests.result.json`.
  Independent Sol source review approved; engine/model/content delta is empty.
- [x] Source browser QA: full-width List/Grid rows, centered icons, exact copy,
  correct motifs/colors and no horizontal document overflow at 1440×900,
  1440×720 and 390×844. Fixed phone header has no overlap; Subclass headings and
  navigation names remain on their own rows. No runtime errors.
- Wireframe: `/workspace/scratch/creation-icon-alignment-preview/wireframe/`.
  Fixed source captures/metrics: the adjacent `sourceQA-fixed/` folder; earlier
  `sourceQA/` preserves the initial phone overlap evidence.
- Current build receipt/stamp: `/workspace/scratch/creation-icon-alignment-preview/validation/build.result.json`
  and `build-stamp.json`. Build source is `711358b686` / digest `12841b3d31`.
- Final artifact captures passed at digest `12841b3d31`: desktop/mobile Class,
  Subclass headings/navigation and the shared Class choice folio. All four known
  class SVGs exist in the shipped DOM with the exact red/purple/green/gold colors.
  Actual-DOM SVG exports and 256×256 transparent PNGs are provided separately.
- Current launcher: `/workspace/scratch/creation-icon-alignment-preview/packages/0.7.1.1520-12841b3d31/AshenSpire-class-layout-preview-0.7.1.1520/START-HERE.html`.
  ZIP is alongside that folder. Package hash matches the exact built game;
  integrity check passes. It includes current screenshots/folios, four SVG/PNG
  marks, the corrected desktop/mobile wireframe, a gallery and design-only editor.
- Owner's next requested pass: remove live List/Grid; align portrait/menu/close
  with Create character; combine section name, right-anchored step count and
  caret into one dropdown row. Then capture all nine creation menu types at
  desktop/tablet/mobile/widescreen, with one wireframe per menu and a preview.
  Finish this visual pass's feature PR/merge before applying that next change.

## Creation flow and implemented behavior

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
- Current origin publication receipt: `/workspace/scratch/creation-icon-alignment-preview/origin-state.json`.
  The earlier flow receipt remains `/workspace/scratch/creation-flow-origin-state.json`.
  Local workers are published first, then integrated into `Feature/AddSubClasses`
  and `Feature/updateCharacterCreation`. Publication must verify exact tree parity.
- Current artifact source remains `711358b686`; later handoff-only commits do not relabel the build.
  The previous flow package is retained as historical evidence below.
- Class icon renderer: `src/ui/components/creationClassIcon.js`; creationCards uses it
  for known identities and retains fallback visuals for unknown/locked classes.
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
