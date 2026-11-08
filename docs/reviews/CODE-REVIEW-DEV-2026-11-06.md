# Code review of `dev` — structure, readability, optimisation, flow, best practices, modularity

Review baseline: `dev` at `19877c0697bfdca4b7563769f1fa6480fae53618` (`build: stamp 0.7.3.212`), 2026-11-06.
Read-only review; no runtime code changes. Four layer reviews (engine+model, ui, composition
root+content+styles, tools+tests+CI) were run in parallel and consolidated here, then every
cited line was re-checked against the tree by a separate citation pass (about 200 citations;
the spans and counts it corrected are reflected below). Correctness bugs were out of scope except where a
structural flaw implies one.

Where a finding is already tracked in [CLEANUP-PLAN.md](../CLEANUP-PLAN.md) it says so; the
plan is the owner's chosen sequence and this review does not replace it. It adds priority,
evidence and a handful of items the plan does not yet carry.

## Headline

The architecture described in [ARCHITECTURE-MAP.md](../ARCHITECTURE-MAP.md) is mostly real:
`src/` has **zero import cycles** across 1,040 modules, combat state changes only through
engine `dispatch`, component models are deep-frozen and validated, the content pipeline
compiles JSON/CSV into `src/content/generated/`, and the test runner refuses stale skip
lists. Those are strengths worth protecting.

The debt is concentrated in five places:

1. **Six functions hold a third of the game.** `mountCombat` (4,270 lines),
   `mountEquipment` (1,950), `collectContentProblems` (1,806), `createSaveManager` (1,363),
   `showFirstScreen` (~700) and `runOpcode` (503) are single closures whose helpers share one
   scope and cannot be tested alone.
2. **The layer contract is inverted in ~30 edges.** `src/model` imports `src/ui` (4 files)
   and `src/engine` (10+ files); `src/content` imports `src/engine`; the root `engine/`
   kernel and `src/framework` are undocumented layers that point in every direction, with
   one back-edge from `engine/runtime` into `src/model`.
3. **The composition root owns domain rules and QA fixtures.** About 45 of `src/main.js`'s
   115 top-level functions are screen flow, ~15 are reward/roll rules, and ~690 lines are
   screenshot-harness state branches, all in the player boot path.
4. **`tools/` carries ~30k lines of orphans and ~96 hand-copied CDP clients**, plus 7.7 MB
   of committed screenshot evidence that the evidence gate does not see.
5. **Ruleset-version branching is scattered**: 161 `combatExpansionVersion` comparisons across
   47 files and 129 `fixCoreEnabled(` calls, 31 of these checks in views. CLEANUP-PLAN step 3i/3j will
   remove most; the rest should collapse into one policy object.

Metrics at baseline:

| Area | Files | Lines | Note |
|---|---|---|---|
| `src/` | 1,040 | 177k | `ui` 77k, `model` 52k, `engine` 23k, `content` 17k, `main.js` 4.9k |
| root `engine/` | 1,805 | 8.6 MB | kernel JS + mechanics/contract JSON + Unity export |
| `tools/` | 346 top-level | 142k | 115 unreachable from any root (~30.6k lines); 61 more in `attic/` |
| `tests/` | 1,111 | 158k | `npm test` 2m00s, 152 pass; 34 of 39 `*.browser.mjs` run by nothing |
| `styles/` | 28 | 17.5k | `kit.css` 6.8k + `combat.css` 2.2k + `ui.css` 2.0k = 63 % |
| add/removeEventListener in `src/ui` | | 864 / 138 | import-time global listeners, guarded once |
| `window.__*` debug handles in `src` | | 38 | some set for players, not only under `shotState` |

## Cross-cutting findings (ranked)

### High

**H1. Layer inversions in `src/model` → `ui`/`engine`.** Most targets are pure leaf modules,
so the fix is a relocation plus re-export, not a redesign.
- `src/engine/d20Chance.js` (no imports) ← `model/cardFaceProjection.js:4`, `cardFaceText.js:2`,
  `playingCard.js:45`, `rollReceipts.js:11`, `proposalStatusRules.js:5`.
- `src/engine/rng.js` (no imports) ← `model/bookBonusRewards.js:1`, `gameProfileRewards.js:12`,
  `cardUpgradeSteps.js:9`.
- `src/engine/combatRounds/stance.js` ("no imports" header) ← `model/actionCosts.js:21`.
- `src/ui/strings.js:33` imports only content; `src/ui/sha256.js` has no DOM. Yet
  `model/rollReceipts.js:9`, `combatLog.js:8`, `attributePointPreview.js:20` import `t`, and
  `model/offlineDownload.js:3` imports sha256.
- Real engine logic in model: `model/combatRounds.js:14` (resolver parsers),
  `validate.js:5` and `combatSnapshot.js:4-5` (zone/burden validators), `formulas.js:15`
  (`counterstrikeAmount`), `attributePointPreview.js:15-16` (`stanceHit`).
- Fix: move `d20Chance`, `rng`, `stance` and the pure validators under `src/model/` (or a
  `src/core/`), leave the old paths as one-line re-exports, and widen the dependency test so it
  cannot regress. `attributePointPreview` should take the engine functions as parameters.
- **Landed since baseline:** [#2613](https://github.com/cehinds/AshenSpire/pull/2613)
  (`chore/RulesLayerGuard`, on `dev` at `0.7.3.214`) moved `strings` and `sha256` into
  `src/model/` behind UI shims and added `tests/layering.test.mjs`, which fails any import
  from `src/engine`, `src/model` or root `engine/` into `src/ui`/`src/main.js` or a browser
  global. That closes the model→ui half of this finding and is the guard CLEANUP-PLAN 4b
  promised. The model→engine, content→engine and framework edges are not yet covered by it.

**H2. Two undocumented layers with edges in every direction.**
- Root `engine/` (kernel, runtime interpreter, mechanics and UI contracts, Unity export) is a
  runtime dependency of ten `src/model` files (`src/model/gameProfile.js:3`,
  `gameProfileEnemy.js:1`, `smithingCore.js:10`, `verifiedProfiles.js:5` …) but is absent from
  the map's layer table and root allowlist, and `engine/runtime/bindings.mjs:2` re-exports
  `../../src/model/mechanicsKernel.js` back into it.
- `src/framework/` imports engine (`statusSemantics.js:15,33`), model (`deckComposition.js:28`)
  and ui (`optionDecision.js:12,20`); engine imports it back (`engine/combat.js:78,95`,
  `save.js:39`), as do model (`registries.js:32-33`, `loadout.js:21`) and 13 ui files.
  `src/framework/index.js:5-8` still says "nothing here is consulted by the running game", and
  the barrel is imported by nothing. `stampDeck` is defined at `model/loadout.js:3189` and
  re-exported via `framework/deckComposition.js:35`, so engine reaches it one way and 19 other
  sites another.
- Fix: give both a row and a rank in ARCHITECTURE-MAP.md (kernel below model; framework
  beside model, no ui imports), delete the dead barrel and the stale header, and cover both
  in the same dependency test as H1, and remove the `bindings.mjs` back-edge. Step 4a of the
  plan is the natural home.

**H3. God functions.** All have section banners or obvious seams already.
- `src/ui/screens/combat.js:206-4475` `mountCombat`: 54 top-level state cells. Seams:
  `wireCardInput` (2973, 548 lines), beat playback (`applyBeatToDisp` 1363, `afterDispatch`
  3629), `renderEnemies` 2493, `previewCard` 235, `openCombatArmoury` 4243. Target shape:
  `createX({ getState, dispatch, host })` returning `{ render, dispose }`. (Plan #12.)
- `src/ui/screens/equipment.js:700-2653` `mountEquipment`: `inventoryBlock` (1559, 353
  lines), `characterStatsPanel` (2056), `pickerTable` (1459) share one scope.
- `src/model/validate.js:377-2183` `collectContentProblems`: 1,806 lines. Split per bundle
  section the way `tags.js:94`, `tree.js:154`, `shopKinds.js:397` already do.
- `src/engine/save.js:370-1733` `createSaveManager`: ~30 inner functions. Seams at 378
  (archive), 525 (meta/profile), 672 (shared-profile store), 841 (space reclaim); four
  factories over `storage`, composed.
- `src/engine/actions.js:1647-2149` `runOpcode`: 503-line switch with a minified one-liner at
  1650. Replace with an `OPCODE_HANDLERS` map.
- `src/model/state.js:990-1670` `validateRunShape` 682 lines; `:423-690` `initializeRunDerivedStats`
  268 lines; `src/engine/combat.js:2583-3024` `previewCard` 443; `:161-517` `createCombat` 357.
  Split each into phase helpers.
- `src/model/loadout.js` (3,958 lines, 89 exports, 64 importers): banners at 54, 122, 742,
  885, 1177, 1447, 2045, 2892, 3072, 3174, 3347, 3402 mark a clean `loadout/*.js` split
  behind an `index.js` barrel so importers do not move. (Plan #13.)

**H4. `src/main.js` is not yet a composition root.** (Plan #10 covers the split; this gives
it a shape.)
- `showFirstScreen` (4170-4867) is ~700 lines, ~690 of them a `shotState` ladder with 13
  states OR-ed at 4173; 332 `shot` references in the file; import-time shot code at 354-460
  and 4040; `window.__equipCfg` captured at 600 for players as well.
- Domain rules reading module globals (`run`, `rng`, `registries`, `saves.loadMeta()`):
  `rollLevelChoices` 3304, `rollSkillDrafts`/`RankUps`/`Attributes`/`Feats`/`ClassDrafts`,
  `rollCardRows`, `sigilOffer`, `runResult` 2328, `recordCollectedArmament` 2402, `rollDrop`,
  `treasureSmithingReward`, `combatMods`. Not testable headless.
- `registries` is rebuilt at nine sites (505, 1382, 1581, 1897, 1912, 1957, 2097, 2495) from
  two different settings sources.
- 1,456 of 4,894 lines (30 %) are narrative comments with issue history; move the history to docs.
- `main.js:2620-2632` builds an activity-launcher screen inline with `style.cssText`; it belongs
  in `src/ui/screens/`.
- Extraction seams, each one PR: (a) `src/dev/shotStates.js` with a `{ state: fn }` table;
  (b) `src/engine/rewardRolls.js`, pure in `(registries, run, rng, settings)`;
  (c) `src/ui/displaySettings.js` (`layoutForCap` … `applyDisplaySettings`, 517-590);
  (d) `src/engine/runPersistence.js` (`persist*`, `saveNow`, `*PendingEntryCheckpoint`
  3036-3073, `saveSlotRecords`, `loadActiveSlot`); (e) `src/ui/bootArt.js`;
  (f) `src/ui/rewardFlow.js` (`onCombatEnd` 3084-3286, 203 lines, `beginPendingReward`,
  `mountPendingReward`); (g) one `setRegistries()` that also refreshes debug handles.

**H5. `tools/` hygiene.**
- 115 top-level tools (about 30.6k lines) are reachable from no root (package.json,
  workflows, `run.sh`/`run.bat`, `tests/run-node.mjs`, other tools, tests). Examples:
  `tools/armoury-picked-up.mjs` 1857, `swap-row-reads.mjs` 1454, `rebind-capture.mjs` 1390,
  `hudbars.mjs` 1262. This contradicts `tools/attic/README.md:3`. Fix: attic or delete,
  plus a reachability test.
- ~96 tools hand-copy a CDP client (id counter, pending map, sessions) on top of
  `tools/browser.mjs`, which stops at `wsUrl` (`browser.mjs:443,472`). Examples
  `holdconfirm.mjs:177-186`, `hudbars.mjs:247`, `refusal-audit.mjs:196`,
  `external-play.mjs:177`. Fix: export `connectCdp(wsUrl)` from `browser.mjs`.
- `tools/results/` has 82 tracked files, 7.7 MB of PNG/txt; `tools/hud-component-studio/`
  8.1 MB in 385 JSON files. `tests/qa-evidence-size.test.mjs:21-26` only guards `docs/` and
  JSON. Fix: untrack, send to CI artifacts, widen the gate to `tools/` and images.
- 34 of 39 `tests/*.browser.mjs` are run by nothing (discovery matches only `.test.mjs`,
  `run-node.mjs:107-130`); they need Playwright via `PLAYWRIGHT_MODULE` (undeclared), 24
  hardcode `/usr/bin/chromium`, 23 use 77 `waitForTimeout` sleeps, against
  DEVELOPER.md:598. Fix: port the keepers to `tools/browser.mjs`, delete the rest.

### Medium

**M1. Hot-path allocation in previews.** `src/engine/combatRules.js:286` `candidateState`
`structuredClone`s the whole fight, and `combat.js:2590` `previewCard` calls it per card;
`combat.js:2999` clones the status rules on every preview. Freeze rules once at
`createCombat` and share by reference; make `knowledgeView` sharing the default in
`PreviewMemoModel`. `registries.js:624-626` runs `deepFreeze` and `applyAbilityGrade` before
the cache check; compute the key first. The `resolveCache` key includes `playsEver`
(`registries.js:650`), so it grows without bound within a run.

**M2. Ruleset-version branches.** 161 `combatExpansionVersion` comparisons / 47 files (38 in
`engine/combat.js`, 25 in `actions.js`), 129 `fixCoreEnabled(` calls, 31 version checks in
`src/ui` (13 in `screens/combat.js`). `ui/models/acBadge.js:8` re-implements the engine's
floor rule. `screens/combat.js:2066-2077` branches on version, computes
`ratingDamageMultiplier` and builds English sentences inline. Plan step 3i/3j deletes the
legacy branch; what remains should be one policy object chosen in `createCombat`, the
badge value should come from the engine, and the bar help text should come from a model
(`CombatBarHelpModel`) that returns string keys and arguments.

**M3. Views mutate domain state.** `screens/settings.js:2846-2880` writes `settings[key]`
(23 such writes in the file), calls `onChange`, and rolls back by hand. Send a patch and let
the owner apply and repaint. `screens/combat.js:791, 799, 924, 2817` read interaction state
from CSS classes and `data-hold`; track `dragging`/`holding`/`selectedIndex` in a small
interaction model and make the classes write-only.

**M4. Duplicated helpers.**
- `esc`: `components/tooltip.js:665` (does not escape `'`, stringifies `null`) vs
  `kit/index.js:95` (escapes `'`, `null` → `""`), plus local copies in `cardArtLayers.js:4`,
  `layeredEnvironment.js:6`, `models/CardOptionSummaryModel.js:144`; 27 files import `esc`
  from the 774-line tooltip module. One `ui/html.js`, re-exported by both.
- `deepFreeze` ×3 (`registries.js:69`, `fixCoreRulesCache.js:22`, `statusPresentation.js:89`);
  `record` ×7; `finite` ×5; identical hostile-op Set in `combatEngagement.js:80` and
  `combatRangeLineage.js:11`. One `model/guards.js`, `HOSTILE_OPS` in `schemas.js`.
- "copy the fight's plain data" ×3: `combat.js:2440` `isData`, `combatRules.js:280`,
  `combatRounds/timeline.js:982`. One `snapshotCombat` helper.
- `sandbox()` ×6 and `mkdtempSync` ×39 across tools; 124 tools embed their own `--selftest`
  mutant harness (`holdconfirm.mjs:211-378`). One `tools/lib/mutants.mjs` and sidecar
  `*.selftest.mjs`.
- 148 tools parse argv by `includes`/`indexOf`; none use `node:util` `parseArgs`.

**M5. Dead code that is still maintained.** `src/ui/fx.js:1301` `playLegacyTimeline` (453
lines) runs only when `getBeatOrder() === 'impact'`; `setBeatOrder` is called only from
`tests/combat-feel.test.mjs:257` and nothing in `src` sets `ctx.beatOrder`. Delete it and
its tests, or make `impact` a real setting. Dead exports (no reference in src/tests/tools):
`engine/counterReturn.js:79`, `engine/enemyKnowledge.js:240`, `model/smithing.js:689-699`,
`model/rangeCombatPolicy.js:5`, `registries.js` `objectIsKind`, `tree.js` `variableForToken`,
`combatSnapshot.js` `COMBAT_SNAPSHOT_*`, `fx.js:668`, `input.js:619`, `settings.js:1024`,
`tooltip.js:224`; ~300 more exports are used only in their own file.

**M6. Content/model boundary.** Ten hand-written content files import model and 64 model
files import content. `src/content/prototypes/combatBuilds.js:6-7` imports `engine/combat.js`
and is statically reachable from `main.js:131` via `combatTest.js`; `src/dev/armamentKitPreview.js`
is static at `main.js:60`. Projections living in content (`combatExpansionCards.js`,
`traitProjection.js`, `equipment.js` with 12 functions) belong in model; dev/test screens
belong behind a dynamic `import()` under `shotState`.

**M7. Generated data outside `generated/`.** `src/content/sharedOutfitArt.js` (3,875 lines),
`defeatedArt.js`, `enemyStateArt.js` name generators under `art/` that left the repo;
`paintedOutfits.js` (2,451) and 15 others are tool output beside hand code;
`enemyBodyLandmarks.js` (1,636) is reviewed data with no source. Put the manifests in
`content/source/*.json` (or the art release manifest) and compile them, which also lets them
load lazily instead of parsing on boot.

**M8. `src/ui/models/` mixes three kinds of file.** Only 18 of 120 use `componentModel()`;
53 contain no freeze; 32 are under 30 lines; `CombatIntentProjectionModel.js:44-83` and
`CombatRangeRankModel.js:23-39` mutate their input (the former's function starts at 44 and ends at 82). Split into `models/` (frozen),
`projections/` (pure), `controllers/` (stateful) and merge single-caller stubs.

**M9. CSS.** `kit.css` 6,813 lines (63 `!important`), `combat.css` 2,221 (98),
`combat-target-responsive.css` 71 `!important` in 222 lines; `.combat` is top-level in nine
files. Three token mechanisms: `tokens.generated.css`, `hud-layout.generated.css` (28 bare
hex), and `main.js:517-590` `setProperty` at import time that throws boot-fatal on bad
config. `style-lint --check` shows nine counts below baseline (`map.css` hex 95 → 22), so
run `--write-baseline` to lock the gains. `index.html:36,52` load `combat-test.css` and
`combat-rounds-preview.css` for every player.

**M10. CI and runner.** `ci.yml` is 1,745 lines with 24 checkouts, 21 setup-node and 20
fetch-art steps despite composite actions existing. `ward-to-block-cards.yml:20` and
`combat-audit-hosted-preview.yml` trigger on branches that no longer exist. No npm script
matches the PR gate (`tests.yml:208` adds `--discovered-only --no-slow`). `package.json`
lacks `"type": "module"`, so every run prints `MODULE_TYPELESS_PACKAGE_JSON` and reparses
`tests/engine.test.js`. `tests/run-node.mjs` is 1,395 lines of hand-numbered checks with a
documented number collision (99-106) and the root-import block copied three times (29-84).

### Low

- `src/model/state.js:1752` `migrateRunSchema` uses 15 literal version lists
  (`[1,…,18].includes`); `schemaVersion < N` with named constants reads better.
- `src/engine/combat.js` has 82 import statements including 9 namespace imports named `A`, `F`,
  `R`, `S`; name them.
- `screens/settings.js:274-850` holds a 577-line `ROWS` table and string-built row HTML with
  unescaped `${r.label}`; move `ROWS` to a model and render with kit builders. The Undo label
  at `settings.js:2853` is a literal inside an `innerHTML` template; route it through strings.
- `data-component` ids bypass the registry at `equipCompareModal.js:53`,
  `equipment.js:610`, and as string literals at `artLoadNotice.js:24,26`,
  `bootArtStatus.js:17`, `startupGate.js:56-66`; add a test over `UiComponentId`.
- Import-time global listeners (`card.js:745`, `iconTray.js:40`, `kit/categoryNav.js:62`,
  `damageReceipt.js:113-123`) are guarded but undetachable; expose `installX()`.
- `main.js:2620-2632` builds a screen inline with `style.cssText`.
- ARCHITECTURE-MAP.md names `src/net/lan.js` (never existed per `git log --all`) and omits
  `src/framework`, `src/services`, `src/config`, `src/dev` and root `engine/`.
- `tools/README.md` misses 16 `.mjs` and 21 of 25 `.py` tools; `sync-alternatives.yml` vs
  `alternative-sync.yml` naming.
- 39 tests assign `globalThis.document` and 29 hand-roll `classList` although
  `tests/helpers/*-dom.mjs` exists; `serve-watch.test.mjs` and `engine-export.test.mjs` use
  real 100 ms sleeps.

## Strengths to keep

- Zero import cycles; leaf modules such as `d20Chance.js` and `rng.js` import nothing.
- `componentModel()` (`ui/models/ComponentModel.js:4-52`) deep-freezes, rejects callbacks and
  validates ids; the kit builders are used in ~80 files.
- Combat state changes only through `dispatch`; `atomicCommit` (`engine/combat.js:2439`)
  rolls back a failed round and restores the RNG.
- Layout reads and writes are batched (`fx.js:112`, `battlefieldStage.js:293-315`); drag
  resolves the drop target at most once per frame.
- `engine/kernel/gameConfig.js` is pure, acyclic, rejects reserved keys and hashes
  canonical JSON.
- Content pipeline `content/source/` → `generated/` with "do not edit" headers; the
  style-lint ratchet; `framework-gate.mjs`.
- Test runner: automatic discovery, reasons required for every skip, stale skips fail,
  shard timeouts print output, `tools/browser.mjs` tracks leaks.
- No npm dependencies; the attic is documented; `save.js` preserves an unreadable archive
  before discarding it.

## Suggested order (one area per PR, per CLEANUP-PLAN)

1. **Guard first**: extend `tests/layering.test.mjs` (landed in #2613) to model→engine,
   content→engine and the framework rank; add the tools reachability test and the wider
   evidence gate. These stop the debt growing while the rest lands.
2. **Relocations with re-exports** (H1, H2): `d20Chance`, `rng`, `stance`, `strings`,
   `sha256`, pure validators; delete the framework barrel and header; map rows for
   `engine/` and `framework/`.
3. **Delete** (M5, H5): `playLegacyTimeline`, dead exports, orphan tools, unrun browser
   tests, committed evidence, dead-branch workflows.
4. **Plan steps 3g–3m** as sequenced, then the version-policy object (M2).
5. **Splits** (H3, H4): `main.js` seams (a)–(g), then `combat.js`, `equipment.js`,
   `validate.js`, `save.js`, `loadout.js`, `runOpcode`.
6. **Hygiene**: `connectCdp`, `tools/lib/{cli,mutants}.mjs`, `type: module`, `test:pr`,
   CI `prepare` composite, `ui/models` reclassification, CSS split and baseline write.

## Checklist

One box per actionable finding, in the suggested order. Tick a box in the PR that lands it
and name the PR beside it, the way CLEANUP-PLAN.md does.

### 1. Guards

- [x] Extend `tests/layering.test.mjs` to model→engine, content→engine and the framework rank (H1, H2) — [#2659](https://github.com/cehinds/AshenSpire/pull/2659)
- [x] Tools reachability test ([#2669](https://github.com/cehinds/AshenSpire/pull/2669)): fail on a `tools/*.mjs` unreachable from package.json, workflows, `run.sh`/`run.bat`, `tests/run-node.mjs` or another tool (H5)
- [x] Widen `tests/qa-evidence-size.test.mjs` to `tools/` and image files (H5) — [#2673](https://github.com/cehinds/AshenSpire/pull/2673). Images under the docs evidence dirs are not gated yet: 61 tracked PNGs there exceed 256 KiB (`docs/art-evidence/2026-09-0x/`, `docs/qa/releases/`) and need a docs cleanup first.
- [x] Test that every `data-component` id is in `UiComponentId` (Low) — [#2675](https://github.com/cehinds/AshenSpire/pull/2675)
- [ ] Unused-export lint (M5)
- [x] Test that `tools/README.md` lists every tool (Low) — [#2672](https://github.com/cehinds/AshenSpire/pull/2672)

### 2. Relocations with re-exports

- [ ] Move `src/engine/d20Chance.js`, `rng.js`, `combatRounds/stance.js` under `src/model/`, old paths re-export (H1)
- [ ] Move the pure validators and parsers (`validateZoneEffect`, `enemyBurdenProblems`, resolver parsers, `counterstrikeAmount`) into model; pass engine functions into `attributePointPreview` as parameters (H1)
- [x] ARCHITECTURE-MAP.md: rows and rank for root `engine/` and `src/framework`; add `src/services`, `src/config`, `src/dev`; drop the `src/net/lan.js` row (H2, Low) — [#2659](https://github.com/cehinds/AshenSpire/pull/2659)
- [ ] Delete the unused `src/framework/index.js` barrel and its stale header (H2)
- [ ] Remove the `engine/runtime/bindings.mjs` back-edge into `src/model` (H2)
- [ ] Move content projections (`combatExpansionCards.js`, `traitProjection.js`, `equipment.js` functions) into `src/model` (M6)
- [ ] Load `combatTest.js`/`combatBuilds.js` and `armamentKitPreview.js` by dynamic `import()` under `shotState` only (M6)
- [ ] Compile `sharedOutfitArt`, `paintedOutfits`, `defeatedArt`, `enemyStateArt`, `enemyBodyLandmarks` from `content/source` into `generated/` (M7)

### 3. Deletions

- [ ] Delete `playLegacyTimeline` and the `impact` beat order with its tests, or make it a real setting (M5)
- [ ] Remove the dead exports listed under M5; drop `export` on file-private symbols (M5)
- [ ] Attic or delete the 115 orphan tools (H5)
- [ ] Port the worthwhile `tests/*.browser.mjs` to `tools/browser.mjs`, delete the rest (H5)
- [x] Untrack `tools/results/` and `tools/hud-component-studio/` evidence; publish as CI artifacts (H5) — [#2673](https://github.com/cehinds/AshenSpire/pull/2673). `hud-component-studio/` JSON is the catalog and scenes the Studio loads, not run output, so it stays; its five large files are in the gate's `ALLOWED` list.
- [ ] Delete `ward-to-block-cards.yml` and `combat-audit-hosted-preview.yml` (M10)
- [x] Stop loading `combat-test.css` and `combat-rounds-preview.css` for players (M9) — [#2671](https://github.com/cehinds/AshenSpire/pull/2671)

### 4. After CLEANUP-PLAN steps 3g–3m

- [ ] One rules-policy object chosen in `createCombat` replaces the remaining `combatExpansionVersion`/`fixCoreEnabled` branches (M2)
- [ ] `acBadge` shows a value the engine exports; `CombatBarHelpModel` replaces the inline rule and strings at `screens/combat.js:2066-2077` (M2)
- [ ] `settings.js` sends a patch to `onChange` instead of writing `settings[key]` and rolling back by hand (M3)
- [ ] `combat.js` keeps `dragging`/`holding`/`selectedIndex` in an interaction model; CSS classes become write-only (M3)

### 5. Splits

- [ ] `main.js` → `src/dev/shotStates.js` with a `{ state: fn }` table (H4)
- [ ] `main.js` → `src/engine/rewardRolls.js`, pure in `(registries, run, rng, settings)` (H4)
- [ ] `main.js` → `src/ui/displaySettings.js` (H4)
- [ ] `main.js` → `src/engine/runPersistence.js` (H4)
- [ ] `main.js` → `src/ui/bootArt.js` (H4)
- [ ] `main.js` → `src/ui/rewardFlow.js` (H4)
- [ ] `main.js`: one `setRegistries()` that refreshes the debug handles (H4)
- [ ] `main.js`: move narrative comments to docs; activity-launcher screen (`main.js:2620-2632`) → `src/ui/screens/` (H4)
- [ ] `mountCombat` → `createX({ getState, dispatch, host })` modules: card input, beat playback, enemies, preview, armoury (H3)
- [ ] `mountEquipment` → `components/armoury*` fed by models (H3)
- [ ] `collectContentProblems` → one validator per bundle section (H3)
- [ ] `createSaveManager` → archive, meta/profile, shared-profile, space-reclaim factories (H3)
- [ ] `loadout.js` → `loadout/*.js` behind an `index.js` barrel (H3)
- [ ] `runOpcode` → `OPCODE_HANDLERS` map (H3)
- [ ] `validateRunShape`, `initializeRunDerivedStats`, `previewCard`, `createCombat` → phase helpers (H3)
- [x] `migrateRunSchema`: `schemaVersion < N` with named constants (Low) — #2657
- [ ] `engine/combat.js`: name the `A`/`F`/`R`/`S` namespace imports (Low)

### 6. Hygiene

- [ ] Freeze rules once in `createCombat`; stop `structuredClone` per preview; `knowledgeView` sharing default in `PreviewMemoModel`; `resolveCard` computes its cache key first; cap `resolveCache` (M1)
- [ ] One `esc` in `ui/html.js`; `model/guards.js` for `deepFreeze`/`record`/`finite`; `HOSTILE_OPS` in `schemas.js`; one `snapshotCombat` helper (M4)
- [ ] `tools/browser.mjs` exports `connectCdp`; migrate the ~96 copies (H5)
- [ ] `tools/lib/cli.mjs` over `parseArgs`; `tools/lib/mutants.mjs` with sidecar `*.selftest.mjs`; one shared `sandbox()` for the `mkdtempSync` tools (M4)
- [ ] `package.json`: `"type": "module"` and a `test:pr` script (M10)
- [ ] `ci.yml`: one `prepare` composite; rename `sync-alternatives.yml`/`alternative-sync.yml` by direction (M10, Low)
- [ ] `tests/run-node.mjs`: data table of gates, one fixture loader (M10)
- [ ] Tests: single `helpers/dom.mjs`; replace real sleeps with events or fake timers (Low)
- [ ] `src/ui/models/` → `models/`, `projections/`, `controllers/`; merge single-caller stubs; stop `CombatIntentProjectionModel` and `CombatRangeRankModel` mutating their input (M8)
- [ ] CSS: split `kit.css` by section, fold tiny override files, one token mechanism, `style-lint --write-baseline` (M9)
- [ ] `settings.js`: `ROWS` to a model, rows via kit builders, Undo label via strings (Low)
- [ ] Import-time global listeners behind explicit `installX()` (Low)
