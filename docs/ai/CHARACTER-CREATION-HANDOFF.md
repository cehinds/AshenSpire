# Character creation continuation handoff

## Current Review character stat card follow-up

The user requested the opened Review character stat card use the equipment-card dimensions. Current local build is **0.7.1.1520 / `a12edfdd78`**, source `6d88c4d641fbd870beb5a8c25f6390636c9a2bbd`; remote equivalent is `b0d1dc0f258fcd5d3e166072aa11cc75a6019301`. Standalone SHA-256: `50da976c929e0dc4af4c983f90babd7b6db6c0a20fa0363ea6584de3d744321b`.

- Four actual opened Review screenshots and four structural PNG wireframes are in `docs/preview/features/update-character-creation/review-character-card/`, with a small source/hash capture record and zero recorded capture errors.
- Current CI run `38696812396`, job `116295197508`, passed at exact digest `a12edfdd78`; backup artifact `11954500967`. Pages run `38696977562` is pending; public hosting verification for this revision is pending. Do not apply the prior public HTTP success receipt to this new revision.
- README leads with these four new views. The existing 36-view matrix at `652574f013` remains prior compact-layout evidence, with its original source and manifest intact.
- Evidence is prepared for root review/publication. Earlier completed compact-layout delivery and its limitations are historical context below.


Updated 2026-10-14 (America/Anchorage). Current integrated code: `b5ac91a039e38e7ed2b8bc01770b14ed29b94a9f`.
Captured production source: `f6801043c9d9762550a7a3ff28cba7fc346fee81`; both have
source tree `9124302fb4c26347d21269b9a69db273d99349d3`.
Current artifact: **0.7.1.1520 / `652574f013`**. Never identify a preview by ordinal
alone: local previews share 1520. Older `1ad05d6483` and `7b7e9a674f` captures are historical.

## Current continuation status

The user authorized continuation on 2026-10-14 (America/Anchorage). The previous stop request is
historical and no longer blocks completion of hosting verification and evidence.
Use [the continuation prompt](CHARACTER-CREATION-CONTINUATION-PROMPT.md).

- All current game source is merged into origin `Feature/updateCharacterCreation` at `b5ac91a039e38e7ed2b8bc01770b14ed29b94a9f` via #2006. Current documentation-only descendant: `13a117814`; this does not relabel the built source.
- Final local production artifact: **0.7.1.1520 / `652574f013`**, SHA-256 `20c5fd7db59de53faa7e0debe9a243d875d59ecbe9ecf32718e5174df7b73eea`, 78,151,638 bytes.
- Feature build [38659839311](https://github.com/cehinds/AshenSpire/actions/runs/38659839311) succeeded; backup artifact [11938781737](https://github.com/cehinds/AshenSpire/actions/runs/38659839311/artifacts/11938781737).
- Public Pages delivery is verified: [run 38676827571, deploy job 116243897791](https://github.com/cehinds/AshenSpire/actions/runs/38676827571/job/116243897791), step **Verify public feature preview delivery**, succeeded. Its log reports four public HTTP targets passed, including `Feature/updateCharacterCreation` at source `b5ac91a039e38e7ed2b8bc01770b14ed29b94a9f`.
- Verified Play URL: https://cehinds.github.io/AshenSpire/branches/Feature/updateCharacterCreation/latest/ . This is runner HTTP verification; the earlier local browser proxy failure did not establish a site failure or interactive browser success.
- Final evidence is refreshed: 36 screenshots, 36 wireframe PNGs and 36 structural SVGs, all at digest `652574f013`. Visual review found no header overlap or document overflow; Review has zero vertical scroll range at all four sizes. README now leads with the verified Play link and links the full gallery. Independent Sol review approved hashes, dimensions, provenance, links and unchanged release README content.
- Local sandbox mirror loaded the exact build and advanced from the startup gate to the title menu with Enter within six seconds. Pointer automation timed out, and the subsequent slot/character flow was not completed in that wrapper probe; do not claim a full click-flow pass. Direct creation-screen checks and the final capture matrix remain the separate UI evidence.
- Persistent public HTTP checks merged into dev via #2004 and have now passed after publication. No gameplay/CSS implementation changes are needed for this evidence completion.

## Shared header and compact rows

- [x] Desktop header combines Create character, active section and live count/hint.
- [x] Phone header keeps Create character and a compact live count; the dropdown names the section.
- [x] Repeated page headings removed; desktop header padding reduced.
- [x] Trait/keepsake rows keep related text on one line; long text uses ellipsis with full authored text retained.
- [x] Starting deck defaults closed; all eleven card inspectors remain available when opened.
- [x] Relic rules/details fold; the duplicate Continue to Review body button is hidden in the live screen.
- [x] Phone class sprites sit beside text. Equal selected rows are about 203px, folded rows 96px; 320px-width checks also passed.
- [x] First-row spell information control stays inside card art instead of covering navigation.
- [x] 36 focused tests passed for the shared-header pass; 11 screen tests passed for the Review follow-up. Sol source review approved both. Live counters, disclosures and 44px inspector target were verified.
- [x] Review loadout and edit choices fold closed; phone Review has zero vertical scroll range, with all original cards, eleven deck inspectors and seven edit controls retained.
- [x] Public Pages deployment and source-specific public HTTP delivery verified (run `38676827571`).
- [x] Final four-size screenshots and wireframes refreshed; visual and provenance review passed. Evidence-only publication is integrated with this document.

Code PRs: [#2001](https://github.com/cehinds/AshenSpire/pull/2001) worker to AddSubClasses,
then [#2002](https://github.com/cehinds/AshenSpire/pull/2002) to updateCharacterCreation.
The Review follow-up merged through #2005 and #2006. The earlier compact-heading pass merged through #1998 and #1999.

## Feature build hosting

The shared Pages publisher merged into dev through [#1997](https://github.com/cehinds/AshenSpire/pull/1997).
The persistent delivery guide and README cleanup helper merged through [#2000](https://github.com/cehinds/AshenSpire/pull/2000).
Feature branches no longer require an open PR for Pages hosting. The primary link should be:
`https://cehinds.github.io/AshenSpire/branches/Feature/updateCharacterCreation/latest/`.
The successful public HTTP receipt above verifies delivery of the intended source. Artifact downloads are backups.
Only exact source builds or proven documentation-only descendants qualify; changed code without a fresh
successful build is omitted. The trusted dev publisher keeps the existing channels and serves feature HTML
as text inside an opaque-origin sandbox. No persistent progress is promised in that preview.

Known existing input issue: native DOM focus and the gamepad cursor can differ; Enter follows the gamepad
cursor. A matched baseline/current browser probe reproduced this before and after the layout change.
This presentation pass does not change global input routing.

## Previous density and locked-choice pass


- [x] Scoped compact spacing/fonts; readable main copy and44px controls retained.
  Removed repeated ability subtitles and duplicate selected-subclass description.
  Phone spells use two columns; maneuvers keep the horizontal shelf to avoid a
  vertical-scroll regression. Review uses compact gear and an existing native
  disclosure for its eleven-card starting deck; all inspectors remain available.
- [x] Locked feats are native-disabled, cannot become active through mouse,
  keyboard or inspect API, and show requirements inline. Spell pool remains
  authored/eligibility-filtered; activation rechecks the current legal plan to
  reject stale click/inspector handlers. No rule or deck-count change.
- [x]52 focused tests passed at sourceeb5937f97; UI-string/diff gates passed.
  Independent Sol source review approved. Phone Review collapsed scroll range
 855px vs1554.5px baseline in the same CSS-pixel unit, about45% less. Expanding
  the disclosure retains all11 card inspection controls. Source/browser receipts
  are in `/workspace/scratch/creation-density-preview/`.
- Historical standalone build:0.7.1.1520/digest1ad05d6483, sourceeb5937f97.
  Build succeeded80.69s. Later evidence/README commits do not relabel this source.
- Exact feature HEAD CI build succeeded:
  https://github.com/cehinds/AshenSpire/actions/runs/38654072847
  Download: https://github.com/cehinds/AshenSpire/actions/runs/38654072847/artifacts/11935887981
  CI sourcefb7c6c587 has the same b97e6cfed source tree as localeb5937f97.
  Artifacts require GitHub sign-in and expire after14days; the workflow builds
  feature HEAD on code pushes without merging dev and excludes docs-only pushes.
- Code PR#1993 merged into Feature/AddSubClasses and Feature/updateCharacterCreation.
  New36 screenshots+36structural PNG/SVG wireframes use only digest1ad05d6483.
  Feature GitHub evidence: `docs/preview/features/update-character-creation/README.md`.
  Local package directory: `/workspace/scratch/creation-density-preview/packages/0.7.1.1520-1ad05d6483/`.
- Persistent feature delivery protocol: CONTRIBUTING.md#feature-branch-previews.
  Root README marked preview block must stay directly below the title and show
  working test-build links and mobile/desktop/wide/tablet evidence for the change.
  BEFORE merging into dev run `node tools/feature-preview.mjs --remove` and
  remove only docs/preview/features/update-character-creation/. Keep the shared
  protocol, helper/tests and feature-preview workflow. Do not replace Release screenshots.
- Origin/PR publication receipt: `/workspace/scratch/creation-density-preview/origin-state.json`.

## Previous compact navigation pass (historical4185 artifact)

- [x] Live List/Grid controls removed. Phone header places portrait, menu and close
  beside Create character on one row. Reference annotation lines/colors are not UI.
- [x] One selector face combines the section name on the left, right-anchored
  `1 of 8` count and caret. Count/label update on selection; the accessible label
  announces section and position. Desktop/tablet/widescreen retain the adaptive
  sidebar. No forced device mode or global categoryNav behavior change.
- [x] Shared creation navigation supports omitted currentId and empty steps.
  Independent Sol review caught the fallback issue and approved both fixes.
- [x] Focused gate at `8e21eb57b8` before the tablet-only CSS fix: **25 passed, zero failed** (navigation, actual caster/
  martial creation screens, Class tiles and detail controls). UI strings ratchet
  and diff check passed. Receipts: `/workspace/scratch/creation-compact-navigation-preview/validation/`.
- [x] Source browser QA: 1440×900 desktop, 1024×768 tablet, 390×844 mobile,
  1920×1080 widescreen. Title/actions share one row without overlap; no horizontal
  overflow/runtime errors. Actual nav is rail at desktop/tablet/wide, selector on
  phone. Phone dropdown lists all eight sections on single lines.
- [x] Tablet capture caught gear/weapon-art wrapping outside the selected Class tile.
  A collection-width container query reserves equal220px minimum heights when
  the tablet sidebar leaves a narrow content column; wide/phone layouts remain intact.
  All four selected classes were measured in a warm1024×768 session: equal220px,
  native44px relic targets, final gear/weapon art at least8px inside the tile,
  no overlap/overflow/runtime errors. Receipt: `/workspace/scratch/creation-compact-navigation-preview/sourceQA-tablet-all-classes/metrics.json`.
- Current build source: `893a58d7dedad7e14f0931eaea217a46662fec53`.
  Artifact **0.7.1.1520 / `4185f5c773`**; build succeeded in 47.15 seconds.
  Later handoff-only commits do not relabel the built source.
- Header wireframes shown before implementation:
  `/workspace/scratch/creation-compact-navigation-preview/header-wireframe/`.
- [x] Final artifact captures: **36 screenshots** — nine menu types (Class, Subclass,
  Attributes, Feats, Starting Spells, Combat Maneuvers, Starting Equipment,
  Relic and Keepsake, Review) at1440×900,1024×768,390×844,1920×1080. Each class
  path has eight visible sections; both caster and martial ability pages are shown.
  All records use source893a58d7/digest4185f5c773; no unexpected errors, header
  overlaps or document horizontal overflow. The optional music manifest404 is
  explicitly recorded with its procedural fallback; it is not silently hidden.
  Review captures are browse poses without selected traits, so Begin is correctly
  disabled; they are not new normal-start gameplay receipts.
- Capture/structural wireframe directory:
  `/workspace/scratch/creation-compact-navigation-preview/screenshots-0.7.1.1520-4185f5c773/`.
  `capture-manifest.json` records each stage, viewport, layout and artifact digest.
- Current delivery directory:
  `/workspace/scratch/creation-compact-navigation-preview/packages/0.7.1.1520-4185f5c773/`.
  Launcher/gallery, final standalone game,36SVG/PNG wireframes, unchanged class
  SVG/PNG exports, live component viewer, mouse design layer editor and ZIP live
  here. The editor is a design sandbox; mouse edits do not automatically patch source.
  Prior12841/8d88 screenshots are historical and excluded from the new menu gallery.

## Previous icon/layout pass (merged PR #1989)

- [x] Original reusable creation SVG marks: Reaver red point-down greatsword,
  Starseer purple spellbook, Rogue green paired daggers, Herald gold sun.
  Canonical character paintings/global glyphs and Class wording remain unchanged.
- [x] Centered icon column; aligned name/lore/play-style column; full-width class
  rows. Physical sizes: Class name24px, lore16px/play style15px, headings28–32px,
  navigation20px, below36pt/48px maximum. Expanded bodies use four desktop/six
  phone lines and shared responsive heights, contained sprites, native details.
- Historical icon artifact `711358b686` / `12841b3d31`; its old two-row phone
  header and List/Grid controls are superseded by the compact navigation pass.
  Unchanged actual-DOM SVG/transparent256px PNG exports remain usable.
- Previous package: `/workspace/scratch/creation-icon-alignment-preview/packages/0.7.1.1520-12841b3d31/`.
  Prior origin receipt: `/workspace/scratch/creation-icon-alignment-preview/origin-state.json`.

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

## Historical flow delivery and continuation

- Historical flow launcher: `/workspace/scratch/subclass-preview/packages/flow-0.7.1.1520-20bd788bd1/AshenSpire-subclass-preview-0.7.1.1520/START-HERE.html`.
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
- Current origin publication receipt: `/workspace/scratch/creation-compact-navigation-preview/origin-state.json`.
  The earlier flow receipt remains `/workspace/scratch/creation-flow-origin-state.json`.
  Local workers are published first, then integrated into `Feature/AddSubClasses`
  and `Feature/updateCharacterCreation`. Publication must verify exact tree parity.
- Current artifact source remains `893a58d7de`; later handoff-only commits do not relabel the build.
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
