# Core 2 JavaScript cleanup checklist

**Status:** JS01–JS07 verified locally by root. JS08–JS14 remain open. Checkboxes change only after root acceptance.

## Baseline and provenance

- Worktree: `C:\Users\const\.codex\worktrees\js-core2-cleanup\AshenSpire`, branch `codex/js-core2-cleanup`, base `c39f9362e0d20c484dfb0003872b07a591847167`.
- The read-only audit first inspected `88b5c5956fb2097863b0705178a086df412a4a80`; root verified live dev `c39f9362e0d20c484dfb0003872b07a591847167` adds only `buildordinal.json`. The checklist uses the latter as its implementation base.
- The separate `feature/UpdateUI` checkout remains untouched. Its pre-existing generated-file modifications are not part of this worktree's baseline.
- Scope is a bounded maintainability and compatibility cleanup. No push, merge, publish, release, or broad rewrite is authorized. Existing files, branches, worktrees, artifacts, and archives remain preserved.

## Accepted facts and behavior distinctions

- Preserve the existing composition/component architecture, immutable Component Models, headless simulation boundary, JSON/CSV data owners, profile cache, and compatibility doors. Latest dev already separates loadout, validation, settings rows, and persistence owners; do not repeat those extractions.
- A mixed-profile backup export is a confirmed import gap. Resolve each slot using its own saved profile; do not weaken registry/hash validation.
- Malformed combat snapshot shapes can throw raw `TypeError` during validation. This violates diagnostic behavior; the audit did not establish save loss.
- Counter execution uses the configured stack fraction while one combat log sentence says `10%`. Use the actual recorded receipt; do not recompute historical text from current config.
- Rules intentionally have different lifetimes: profile-pinned, fight-versioned, and explicitly live. Do not pin every value or change lifetime without an explicit rules/migration decision.
- Counter → combat tactics → matchups has a source import cycle with bundle-order workarounds. Preview and execution action preparation overlap, but committed metadata, prospective stance, and mutation order intentionally differ; share only the proven common construction.
- Existing tests cover current source behavior but do not yet cover the reproduced mixed-profile import or malformed-snapshot cases. JS02–JS03 must add those regressions. No full suite, production build, browser playtest, formatter pass, or implementation migration was performed for the audit.

## Ordered implementation modules

- [x] **JS01 · Freeze the latest-dev baseline and separate checks from writes — P0; Sol + root.**
  - **Status:** Verified locally by root; commit `b20e4863378`.
  - **Why:** Create a trustworthy behavioral comparison and make routine verification safe to repeat.
  - **Scope:** Capture exact source/config identities, representative current and historical saves, seeded combat receipts and RNG positions. Make compiler `--check` non-writing; retain explicit build behavior.
  - **Evidence:** Before JS01, `tools/build-game.mjs:482–493` wrote the artifact before comparing the summary; `tests/build-game.test.mjs:86–90` only asserted that `--check` exits successfully. The command documentation was updated in `engine/export/README.md:9–16` and `docs/MANUAL-EDITING.md:266–275`.
  - **Acceptance:** Check mode preserves output bytes, existence, and timestamps on current and stale summaries; explicit build keeps its deterministic digest. The README and maintainer recipe describe those command semantics. Compare source and bundled compiler behavior. This is a source/bundle gate, not full browser acceptance.
  - **Accepted evidence:** Root verified the compiler CLI check with filesystem writes denied; artifact identity was `sha256:9a625c76d83db2db32ced75988ab61c51a4e8c25bda8c73ff26e3d20886f5e9d` (2,694,438 bytes). Focused compiler tests `the build CLI` and `artifact file is build output` each passed 1/1 after the CRLF assertion correction. Root's eight-file source/bundle parity run passed 35/35. The core gate `node tests/run-node.mjs --no-selftests --no-discovered` exited 0: 151 passed, 0 failed. Root reviewed and accepted the module.
  - **Coverage limits:** The parity scenarios run in native ESM and the production module transform; they are not full browser acceptance. Historical-profile scenarios use the saved historical profile to create a new run; they do not verify import or continuation of a saved historical run. `npm test` uses `--no-discovered`, so the new compiler/baseline tests require the discovered/full test lane.
  - **Environment adjustment:** Windows CRLF-only diffs made generated checks falsely stale. In this worktree only, ran `node tools/hud-layout-css.mjs --write`, `node tools/base-cards.mjs`, and `node tools/mechanics-browser.mjs`; normalized diffs for the affected generated outputs are empty. `node tools/content-build.mjs --check` now passes. No authored content changed in these normalizations.
  - **Dependencies:** None.

- [x] **JS02 · Resolve each backup slot using its saved context — P1; Sol.**
  - **Status:** Verified locally by root; JS01 baseline commit `b20e4863378`.
  - **Why:** A backup containing multiple supported profiles must restore each slot under its own saved configuration.
  - **Scope:** Restore each imported slot through the same per-save profile and override resolution as Continue; keep validation isolated, recovery backup, and rollback.
  - **Evidence:** `src/engine/saveTransfer.js:24`, `src/main.js:978`, `src/engine/save.js:467`; mixed current/historical profile reproduction.
  - **Acceptance:** Current, historical, and mixed-profile backups round-trip with exact combat state/RNG. Unsupported profiles or failed writes preserve recoverable data. Browser exercise uses isolated fresh storage at 1280×800 and 390×844: import a backup with a current-profile Gilded Knight reaction in slot 1 and a genuine historical-profile Ashheart Dragon fight in slot 2; verify Continue loads slot 1 and Load Game loads slot 2 under the correct encounter identity. Then try a rejected backup and confirm the imported saves remain usable. Capture title/import, Continue, historical Load, and refusal states at both sizes.
  - **Fixture boundary:** The accepted 2,588,611-byte fixture uses the app-shaped run initializer, places the current Gilded Knight save newest for Continue, and pairs it with historical profile `dev-profile-73ef`; SHA-256 `d7cbc1b5c16697b8671af582aae0b8ab98ed23081ec3cd5fea58a056f1a7e281`. Prologue values differ but are not visible mid-fight, so the browser asserts read-only enemy identity and screenshots while headless tests check profile pins, prologue values, and RNG.
  - **Accepted verification:** 52/52 focused checks and 151/151 core checks passed; the standalone build and 12/12 shipped checks passed. The source/bundle baseline stayed exact; the load-door mutation was caught and its unmodified browser control passed. Fresh-profile Chromium passed 8/8 checks across 1280×800 and 390×844: Continue resolved to `gildedKnight`, historical Load to `ashheartDragon`, version-999 backup was refused with existing Continue preserved, and both viewports had zero console/runtime errors. Results and screenshots: [`results.json`](../scratch/qa/js02/evidence/results.json), [`desktop-1280x800-continue-current.png`](../scratch/qa/js02/evidence/desktop-1280x800-continue-current.png), [`desktop-1280x800-load-historical.png`](../scratch/qa/js02/evidence/desktop-1280x800-load-historical.png), [`phone-390x844-continue-current.png`](../scratch/qa/js02/evidence/phone-390x844-continue-current.png), [`phone-390x844-load-historical.png`](../scratch/qa/js02/evidence/phone-390x844-load-historical.png), [`phone-390x844-rejected-backup.png`](../scratch/qa/js02/evidence/phone-390x844-rejected-backup.png). Root inspected the desktop and phone captures.
  - **Dependencies:** JS01.

- [x] **JS03 · Make snapshot validation total and diagnostic — P1; Sol.**
  - **Status:** Verified locally by root; commit `57a61557139`.
  - **Why:** Malformed input should return precise field errors rather than escape validation as a raw exception.
  - **Scope:** Check collection and element shapes before iteration and references; reuse helpers only where contracts match.
  - **Evidence:** `src/model/combatSnapshot.js:220`, `:329`, `:388`.
  - **Acceptance:** Wrong collection types, null entries, and bad references return field-addressed problems rather than raw exceptions; supported historical snapshots and recovery behavior remain unchanged.
  - **Accepted evidence:** Core gate `node tests/run-node.mjs --no-selftests --no-discovered` passed 151/151; `node tools/plantsites.mjs --check` passed (310 sites, 5 known drifted/35 unreadable all match baseline); `node tools/launch.mjs --build-only` exited 0 and emitted build 0.7.4.64 (`d1cf8fa8ed`). Root reports separate JS03 gates at 49/49, 168/168, and 113/113. Ordered gate logs and exit files are in `scratch/qa/js03/ordered-gates/`.
  - **Browser evidence:** `scratch/qa/js03/ordered-gates/browser/results.json` records 8 passing checks at desktop 1280×800 and phone 390×844: current Continue `gildedKnight`, historical Load `ashheartDragon`, malformed queue refusal names `combatEntered.snapshot.abilityQueue`, Continue remains `gildedKnight`, and zero console/runtime errors. Root reviewed screenshots/results and accepted the module. The detailed diagnostic is in the DOM result; its screenshot text extends below the modal fold. Refusal screenshots: `desktop-1280x800-rejected-backup.png`, `phone-390x844-rejected-backup.png`; continuation screenshots are `desktop-1280x800-continue-after-refusal.png` and `phone-390x844-continue-after-refusal.png`.
  - **Dependencies:** JS01; review alongside JS02.

- [x] **JS04 · Establish naming, formatting, and typed boundary contracts — P1; Sol + Luna.**
  - **Status:** Verified locally by root; commit `595f98aabfd`.
  - **Why:** Consistent public/private names and checked boundary shapes make routine edits easier to review safely.
  - **Scope:** Set JS/MJS/CJS to four spaces and LF while preserving two-space layout for hash-sensitive legacy runtime files. Migrate the Component Model and Run HUD View Model APIs to PascalCase, retaining declared camelCase compatibility aliases and moving safe UI imports. Keep serialized keys stable. Document style and LF/hash identity. Add an isolated code-quality package for staged naming/format checks and focused save-boundary types.
  - **Evidence:** `.editorconfig`, `jsconfig.json:6`, `src/ui/models/ComponentModel.js:24`, `src/ui/viewModels/RunHudViewModel.js:11`.
  - **Acceptance:** Checks catch deliberate naming/type violations; imports, browser entry points, serialized keys, and source/bundle behavior remain intact. Set LF explicitly for hash-sensitive runtime inputs so Windows checkout line endings cannot perturb generated profile identity; keep hash checks strict. Remove adapters only after consumer proof.
  - **Accepted verification:** `npm run code:check` passed its naming/format gate over 931 authored source modules and four enrolled owners; strict TypeScript checking passed for the two save-boundary owners. Tool selftest passed 6/6. This is a staged ratchet for new exports, not a migration of all legacy exports. The UI naming migration adds five PascalCase Component Model exports and `RunHudViewModel`, retains six explicit deprecated camelCase aliases, and moves direct imports in 26 safe UI consumer files; legacy callers are still covered by the aliases. Four enrolled modules satisfy the scoped formatter, and serialized Component Model fields remain unchanged.
  - **Accepted QA:** Core gate passed 151/151; plantsites passed 310 sites (5 known drifted and 35 unreadable, all matching baseline); standalone build exited 0 at 0.7.4.65 and refreshed 4/4 aliases. The UI contract guard passed 22/22; its selftests passed 71/71 plants, catalog checks 72/72, and independent UI/baseline checks 69/69. Source/bundle baseline, transfer and link regression passed 15/15. Fresh Chromium passed 8/8 checks on 1280×800 and 390×844: Continue loaded `gildedKnight`, slot 2 restored `ashheartDragon`, malformed `combatEntered.snapshot.abilityQueue` was refused, Continue remained intact, and both viewports reported zero console/runtime errors. Root reviewed both refusal screenshots and the phone Continue screen. Results: `scratch/qa/js04/ordered-gates/browser/results.json`; screenshots are in the same folder.
  - **Line-ending verification:** `git check-attr` reports `text eol=lf` for engine/runtime, formula/mechanics and generated JS/CSS samples, while binary assets retain `text: unset`. `git ls-files --eol` showed the sample hash-sensitive tracked files already LF in index and worktree; no bulk renormalization was run.
  - **Dependencies:** JS01–JS03.

- [x] **JS05 · Declare one configuration authority and lifetime per value — P1; Sol.**
  - **Status:** Verified locally by root; commit `29019e70df2`.
  - **Why:** A JSON setting needs one owner and a predictable effect on new runs, saved runs, and active fights.
  - **Scope:** Map Core packs, shared source, framework data, settings, generated adapters, and runtime locks. Classify values as startup/run/fight/live, validate defaults/ranges once, and document Counter/Reflect policies. Preserve current behavior absent an explicit rules change.
  - **Evidence:** `docs/MANUAL-EDITING.md:11`, `tools/game-config.mjs:17,61`, `src/model/combatTacticsRules.js:12`, `src/engine/guardStacks.js:27`.
  - **Acceptance:** Two configurations demonstrate the documented lifetime; old/new saves behave as specified; generated data and locks remain deterministic.
  - **Implementation boundary:** Required framework mechanics data now fails closed when absent, preventing `--check` from accepting a stale generated mirror. Maintainer guidance distinguishes profile-pinned rules, runtime-hashed FixCore fight rules, and live framework tuning; it warns that a run pinned to a previous FixCore runtime may need its compatible build. This slice does not change combat formulas or save schemas.
  - **Accepted verification:** Two-profile/configuration lifetime proof passed 2/2; independent runtime/source-bundle checks passed 44/44; Sol focused suite passed 103 / skipped 5 platform cases / failed 0. `npm run code:check` and strict TypeScript checks passed. Final core gate `node tests/run-node.mjs --no-selftests --no-discovered` exited 0 (151/151); plantsites check passed (310 scanned, 5 known drifted and 35 unreadable, all counts match baseline); standalone `node tools/launch.mjs --build-only` exited 0, build `0.7.4.66` (`5a295ea013`), launcher refreshed 4/4 aliases; independent shipped check passed 12/12. This module changes no visible UI, so no new browser run was required. Detailed local command outcomes are in [`ordered-gates`](../scratch/qa/js05/ordered-gates/); `build-final.summary.txt` is a concise result record, not a raw build log.
  - **Dependencies:** JS01–JS04.

- [x] **JS06 · Render combat explanations from actual receipts — P1; Sol.**
  - **Status:** Verified locally by root; commit `e53e5ef010d`.
  - **Why:** Explanatory text must describe the rule contribution that actually occurred under the selected configuration.
  - **Scope:** Resolve Precision tooltip/lifecycle placeholders from live mechanics values; render Counter stack percentages in health and card help from one presentation helper; use Reflect's integer percent getters in health labels; make authored Precision placeholders reject unsupported tokens. Core HUD help uses its resolved Precision definition with the legacy fallback unchanged. Make the no-revealed-attack Counter face avoid claiming a fixed fraction. Preserve historical combat-log amounts from receipts and keep the default 10% wording unchanged.
  - **Evidence:** `content/framework/mechanics.json:76–78`, `src/model/statusPresentation.js:17,80`, `src/ui/models/CombatHealthModel.js:41–42`, `src/ui/components/card.js:930–931`, `src/engine/guardStacks.js:58–65`, `content/source/uiStrings.csv:45,782`, `src/model/combatLog.js:188`, `src/engine/combatMatchups.js:786`.
  - **Acceptance:** Non-default fractions and thin/legacy events produce truthful explanations; combat calculations and RNG do not change.
  - **Accepted verification:** Focused suite passed 110/110 (`scratch/qa/js06/ordered-gates/focused-final.log`); `npm run code:check` passed for 932 authored modules/5 enrolled owners and strict TypeScript; framework-data and content builders plus their `--check` commands passed. The profile lock remained unchanged (SHA-256 `80F1E45E63CEAF7C543CB824C5104DF32D48A3987B2F71F454A43240827C9C82`). Ordered core passed 151/151, plantsites scanned 310 with drift/unreadable counts matching baseline, and build passed as 0.7.4.67 (`a823a303c7`), refreshing 4/4 aliases. Root's independent collection passed 56/56. Built Chromium acceptance at 1280×800 and 390×844 confirmed the paid 1 SP reaction and receipt `13 = 4 base + 7 stack share + 2 advantage`, with zero console/runtime errors and audio muted. Root reviewed the screenshots: [`desktop-1280x800-paid-reaction.png`](../scratch/qa/js06/browser-built-verified/desktop-1280x800-paid-reaction.png), [`desktop-1280x800-counter-log.png`](../scratch/qa/js06/browser-built-verified/desktop-1280x800-counter-log.png), [`phone-390x844-paid-reaction.png`](../scratch/qa/js06/browser-built-verified/phone-390x844-paid-reaction.png), [`phone-390x844-counter-log.png`](../scratch/qa/js06/browser-built-verified/phone-390x844-counter-log.png), [`results.json`](../scratch/qa/js06/browser-built-verified/results.json). An initial unmuted browser run made four optional SFX requests that returned 404; acceptance was repeated muted, so audio assets were not evaluated. Raw ordered-gate logs and exit files: [`ordered-gates`](../scratch/qa/js06/ordered-gates/).
  - **Dependencies:** JS01; follow JS05's lifetime policy.

- [x] **JS07 · Remove the Counter import cycle and reduce boundary exceptions — P1; Sol.**
  - **Status:** Verified locally by root.
  - **Why:** Initialization-order workarounds can make bundled behavior differ from source behavior.
  - **Scope:** Remove the Counter–Tactics–Matchups back edge through a narrow pure-data/preview seam. Address other dependency exceptions individually, preserving the layering ratchet.
  - **Evidence:** `src/engine/counterRule.js:11`, `src/engine/combatCardTactics.js:10`, `src/engine/combatMatchups.js:4`, `tests/layering.test.mjs`.
  - **Acceptance:** Source and production bundle agree for manual/automatic Counter, forecasts, and pending reactions; exception count only decreases.
  - **Accepted verification:** Core gate passed 151/151; plantsites scanned 310 with known drift/unreadable counts matching baseline; standalone build passed at 0.7.4.68 (`ecadc3c974`), with 4/4 aliases refreshed. The pre-change import graph showed the concrete Counter → Damage Preview → Actions → Counter cycle; final source and bundle checks report zero cycles for both owners. Root's independent collection passed 56/56; Domain's focused suite passed 102/102 and layering passed 5/5; quality passed for 933 authored modules/6 enrolled owners. Counter cap native/bundle probe matrix `2/1/0/0/2` passed. The source/profile hash stayed unchanged; no new layering exception was added, and the existing 26 known-rank inversions remain. No UI/browser rerun was needed because the extraction preserves behavior and production-transform parity passed. Ordered gate raw logs and exit files: [`ordered-gates`](../scratch/qa/js07/ordered-gates/).
  - **Dependencies:** JS01, JS04.

- [ ] **JS08 · Share proven action preparation between preview and execution — P2; Sol.**
  - **Why:** One source for shared action facts reduces parallel edits without erasing intentional stage differences.
  - **Scope:** Extract pure shared card/action construction with explicit inputs/results. Keep payment, committed metadata, prospective stance, observer filtering, and mutation order in their existing stages.
  - **Evidence:** `src/engine/combat.js:1707,2063`.
  - **Acceptance:** Preview/execution costs and receipts agree; inspection consumes no state/RNG; accepted actions charge once and refusals spend nothing.
  - **Dependencies:** JS01, JS04, JS07.

- [ ] **JS09 · Extract application lifecycle controllers from `main.js` — P2; Sol.**
  - **Why:** Startup and save coordination should be understandable without navigating the entire game-flow module.
  - **Scope:** First move profile boot/migration/storage warnings behind injected dependencies; split run/checkpoint transitions only as a later bounded step. Define one app-shaped run initializer for stats, customization, path, seen events, and related creation fields now initialized across the composition-root path. Preserve the composition root and public launch paths.
  - **Evidence:** `src/main.js:318,415,563,798–823,978,2338`; the run initializer must match the defaults Main supplies so fixtures do not reassemble them independently.
  - **Acceptance:** Startup, Continue, rejected restore, full storage, checkpoint ordering, and screen transitions retain behavior in focused headless/browser flows.
  - **Dependencies:** JS02–JS05.

- [ ] **JS10 · Extract combat display reduction and lifecycle owners — P2; Sol + Luna.**
  - **Why:** Paced display updates and interaction lifetimes are separate responsibilities from screen composition.
  - **Scope:** Move snapshot/follow-up/event reduction into a UI model first; then give targeting, playback, and subscription cleanup bounded interfaces. Keep existing Component Models and renderers.
  - **Evidence:** `src/ui/screens/combat.js:204,1262,1332,1379`.
  - **Acceptance:** Display state and event order match; intent, meters, reaction resume, teardown, keyboard/mouse/gamepad, and desktop/mobile flows remain correct.
  - **Dependencies:** JS04, JS06, JS08.

- [ ] **JS11 · Extract settings draft, reset, and undo policy — P2; Luna, Sol review.**
  - **Why:** Settings transitions should be tested independently from HTML generation and event binding.
  - **Scope:** Preserve `SettingsRowsModel`; move draft transitions, reset plans, and undo timing to a focused model. Leave DOM binding in the screen and persist through its explicit boundary.
  - **Evidence:** `src/ui/screens/settings.js:725,741,966,1950`.
  - **Acceptance:** Group/all reset, undo expiry, defaults, profile switches, invalid values, and persistence retain accepted results.
  - **Dependencies:** JS04–JS05 and relevant JS09 interfaces.

- [ ] **JS12 · Clarify enemy authoring and registry projection — P2; Sol.**
  - **Why:** An enemy edit needs a clear source for each field and actionable diagnostics when a projection is invalid.
  - **Scope:** Document and isolate the existing shared-definition/Core-row overlay, including `coreOffense`/`coreSp` opt-ins; improve field-level diagnostics without moving balance authority.
  - **Evidence:** `tools/enemy-sheets.mjs:2`, `src/model/gameProfile.js:74`, `src/model/gameProfileEnemy.js:5`, `src/engine/combat.js:323`.
  - **Acceptance:** Shared/configured enemy fixtures preserve IDs, move order, seeded HP/RNG, saved intent, and affordability.
  - **Dependencies:** JS05, JS08.

- [ ] **JS13 · Centralize only intentional presentation/gesture tunables — P2; Luna.**
  - **Why:** Maintainers should edit intended tuning values in one validated place without turning structural constants into configuration.
  - **Scope:** Extend existing JSON configuration for justified user-facing values such as hold timing, pointer slop, undo lifetime, or hand paging. Reuse gesture/lifecycle helpers only when semantics match. Keep algorithmic sentinels and safety ceilings in code.
  - **Evidence:** `src/ui/screens/combat.js:656,1235`, `src/ui/screens/settings.js:725`, `tools/style-lint.mjs:30`, `content/config/ui/tokens.json`.
  - **Acceptance:** Defaults keep screenshots/input unchanged; non-default settings propagate consistently across reduced motion, long text, touch, keyboard, and gamepad. Do not move every number mechanically.
  - **Dependencies:** JS05, JS10–JS11.

- [ ] **JS14 · Complete the solo-maintainer map and final consistency gate — P2; Luna + root.**
  - **Why:** A solo maintainer needs a practical route from an edit to the right validator and acceptance check.
  - **Scope:** Extend `docs/MANUAL-EDITING.md` rather than create a competing guide; cover cards, enemies, balance, screen text/layout, and save-safe rule changes. Refresh the generated architecture inventory and finish naming migration with documented exceptions.
  - **Evidence:** `docs/MANUAL-EDITING.md`, `docs/ARCHITECTURE-CURRENT-DEV.md:8`, `tools/README.md`, component catalog.
  - **Acceptance:** Follow recipes from an isolated checkout; links/commands work; each tunable has one owner; launch doors and source/bundle acceptance pass.
  - **Dependencies:** Earlier modules complete.

## Checkpoint rules

- Root owns implementation order, integration, independent QA, and the decision to mark a module verified. A passing focused test alone does not close a checkbox.
- Record the before-state and expected differences. Keep formatting/naming changes distinguishable from behavior changes.
- Update guides with the module that changes their commands or ownership. Preserve generated outputs and archives; edit authored sources, not generated files.
- JSON owns editable content/tuning; code owns algorithms, stable identities, and safety invariants. Moving existing CSV requires an explicit schema/compatibility decision.
- Root closes each module only after its acceptance review. Full browser acceptance is still required where visible behavior changes; source/compiler checks are not a substitute.
