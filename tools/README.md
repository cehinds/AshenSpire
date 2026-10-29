# tools/

Index of the tools, written 2026-10-17 by hand from each tool's own header comment (no generator yet; update the row when a tool is added) and from
`git grep -l -F "<name>.mjs" -- ":!tools/<name>.mjs" ":!tools/README.md"` over tracked files (this index names every tool, so it is excluded) (substring match, so a short name can
pick up a longer one). Nothing is deleted; tools nothing references live in `tools/attic/` (owner, 2026-10-17; the Attic section below). Common ones run as `npm run <script>` (package.json, DEVELOPER.md).
Callers: `wf` workflow, `tests` file under tests/, `tools` other file under tools/, `docs` markdown, `other` anything else;
`+N` = more callers than shown. A row with several names groups the tools that have no header comment and share a name
prefix; its callers are the union.

`tools/attic/`: tools nothing references, kept runnable; see the Attic section.

## Tools something references (329 files, plus the 8 subfolders)

| Tool | What it does (its header comment) | Who calls it |
| --- | --- | --- |
| `card-layers/` (7 files) | Open '/tools/card-layers/index.html#editor' on the existing source-preview server. | tools card-layout-save-qa, card-master-qa, card-rank-layers/preview.html; docs docs/workbench/RETIRED-TOOLS.md; other workbench/tools.json |
| `card-rank-layers/` (2 files) | Open '/tools/card-rank-layers/preview.html' on the repository preview server. | tools card-layout-save-qa, card-rank-layers-qa; other workbench/tools.json |
| `card-solid-bb/` (2 files) | Implementation notes for 'feature/card-solid-bb'. The screenshots and 'report.json' | tools card-layers/index.html; other workbench/tools.json |
| `combat-audit/` (16 files) | This audit found and fixed the primary Quit menu action and two measured initialization costs: the Settings card… | wf combat-audit-hosted-preview; tests combat-audit-card-condition-contracts, combat-audit-card-effect-contracts, combat-audit-cards +6; docs docs/handoffs/full-combat-audit.md, docs/preview/full-combat-audit/README.md, docs/preview/full-combat-audit/accepted-stance-followup.md +2 |
| `hud-component-studio/` (1295 files) | From this directory, run 'python -m http.server 8360 --bind 127.0.0.1' and open http://localhost:8360/. On Windows,… | docs CREDITS.md, docs/ai/CHARACTER-CREATION-HANDOFF.md, docs/design/character-creation/README.md +1; other docs/component-catalog.html, workbench/tools.json |
| `lib/` (7 files) | tools/lib/build-lock — one writer of the generated trees across processes. | wf workbench; tests build-lock, build-steps, class-smash-qa-notices +4; tools config-build, content-build, engine-export +2; docs docs/workbench/CONSOLIDATION.md; other .gitignore, editor/server.mjs +12 |
| `results/` (82 files) | (no header comment) | tools buildstamp-shot, e11-reward-correction, hud-quick-compact +3; other src/content/statuses.js |
| `score/` (4 files) | tools/score/alt — the "alt" cut of a score (owner, 2026-09-26: "alt | tests music-score; docs CREDITS.md, DEVELOPER.md, SPEC.md +5; other music/score/_motifs.mjs, music/score/boss.mjs +13 |
| `about-changelog.mjs` | Focused contract for #189. CHANGELOG.md is authored; the generated browser | wf alternative-sync, build-stamp, ci +2; tests build-stamp, check-order-pending; tools build-stamp, plantsites-baseline.json, pr-restamp +1; docs .claude/skills/finish/SKILL.md, DEVELOPER.md, docs/FINISH.md +11; other src/content/changelog.generated.js, src/content/changelog.js +1 |
| `actends.mjs` | actends — when the act opens, can the player SEE both ends of it? | other src/ui/components/mapboard.js |
| `actionreach.mjs` | actionreach — is the way OUT of a screen on screen when the screen | tools flaskbox, mapreach, menufit +2 |
| `advanced-config-preview.mjs` | Browser witness for Settings > Advanced configuration. | tests advanced-settings-groups |
| `ai-disclosure.mjs` | ai-disclosure — the store surface of the AI-use acknowledgement and | docs SPEC.md, docs/SPEC-RECONCILE.md, docs/spec-audit/SPEC-AUDIT.md; other src/content/aiDisclosure.js |
| `alternative-art-qa.mjs` | Production combat, including actual input; output belongs outside tracked source. | docs DEVELOPER.md |
| `alternative-branches.mjs` | Shared naming rules for optional alternative development/test pairs. | wf dev-preview, receipts; tests alternative-branches, settings-revamp; tools pages-site, sync-alternatives |
| `alternative-selected-stances-export.mjs`, `alternative-selected-stances-qa.mjs`, `alternative-stances-inventory.mjs`, `alternative-stances-serve.mjs` | (no header comment) | tests alternative-stances; tools alternative-stances-build.py; docs CREDITS.md, docs/workbench/CONSOLIDATION.md, pose-studio/stances/README.md +1 |
| `armament-smithing-ui.mjs` | Issue #211 — real-Chromium Shrine Smith UI proof at the two acceptance | other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/ui/components/smithUpgradeModal.js +1 |
| `armoury-arrival-figure.mjs` | Armoury tab reachability and visible character/card geometry in a real browser. | wf ci; tools gatelist, watched-probes.json, watched; other docs/architecture-handoff/wireframe-gallery.html, src/ui/screens/equipment.js |
| `armoury-picked-up.mjs` | armoury-picked-up — the Armoury tells the truth about what you are | tools plantsites-baseline.json |
| `art-authoring.mjs` | art-authoring — the authoring tools that still live here, and why | tools card-effect-art-build, card-effect-art-check, card-effect-layers-check +14; docs DEVELOPER.md, docs/ART-REPO-PLAN.md, docs/EXTERNAL-ASSETS-PLAN.md +1 |
| `art-export-plan.mjs` | A JSON bridge for authoring tools in other languages. Pixel limits and | tests art-resolution-policy; tools alternative-art-build.py; docs docs/ART-EXPORT-POLICY.md |
| `art-intake.mjs` | art-intake — which files in a pull request belong to the art | wf art-migrate; tests art-intake; docs CONTRIBUTING.md |
| `art-manifest.mjs` | art-manifest — the data-driven art manifest: one entry per asset id, | wf art-migrate; tests art-manifest, asset-pack, fetch-art; tools art-intake, asset-pack, buildversion +2; docs CONTRIBUTING.md, DEVELOPER.md, docs/ART-REPO-PLAN.md +3; other art-manifest.json, editor/server.mjs |
| `art-source.mjs` | art-source — where a tool reads the art packs' files. | wf action, ci, coop-hud +4; tests art-source, book-art, bow-animation +18; tools art-authoring, asset-pack, buildversion +22; docs DEVELOPER.md, docs/ART-REPO-PLAN.md, docs/EXTERNAL-ASSETS-PLAN.md; other docs/design/class-armor-rear-2026-10-06/sources/shared-armor.test.snapshot.mjs, docs/design/combat-depth-2026-10-05/build-library.py +6 |
| `artifact-provenance.mjs` | artifact-provenance — WHICH TREE DID THIS MEASUREMENT ACTUALLY SEE? | tools actionreach, ai-disclosure, axisfit +22 |
| `asks-ledger.mjs` | Keep the durable owner-ask mirror deterministic and make GitHub drift loud. | docs docs/framework-migration-checklist.md |
| `asset-catalog.mjs` | asset-catalog - the asset catalog (engine/contracts/asset-catalog.schema.json). | tests asset-catalog, maps-json; tools build-game; other games/ashenspire/assets/catalog.summary.json |
| `asset-css.mjs` | asset-css — the web edition's CSS assets, moved out of the inlined | tests asset-css; tools buildversion, bundle, verify-external; docs DEVELOPER.md, docs/EXTERNAL-ASSETS-PLAN.md; other src/ui/assetPacks.js |
| `asset-data.mjs` | asset-data — where the non-art files that used to sit beside the art | tools concept-cutout, equipment-blender.py, palette-audit.py +3; docs docs/ART-REPO-PLAN.md |
| `asset-pack.mjs` | asset-pack — the pack format: a content-addressed object store and | tests alternative-selected-stances, art-tier, asset-pack +7; tools art-manifest, buildversion, bundle +7; docs DEVELOPER.md, docs/EXTERNAL-ASSETS-PLAN.md; other .gitignore, desktop/windows/build-installer.mjs +3 |
| `assetmime.mjs` | assetmime — which files under assets/ are shippable art, and as what. | tests mobile-performance; tools art-manifest, asset-pack, buildversion +1; docs docs/ART-REPO-PLAN.md, docs/EXTERNAL-ASSETS-PLAN.md, docs/MOBILE-PERFORMANCE.md; other workbench/core/assets.mjs, workbench/server.mjs |
| `attack-source-audit.mjs` | Reviewable projection of the sole authored tag junction, not another registry. | tests run-node; docs DEVELOPER.md, docs/COMBAT-TAG-SOURCES.md |
| `axisfit.mjs` | axisfit — LAW 5's machine check. On a narrow shape, every scroll | tests engine.test.js; tools coop-hand-parity, mobilefit, pairsweep +2; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/ui/handAxis.js +3 |
| `balance-intent.mjs` | balance-intent — per-enemy intent DPS and self-heal, as printed by | tests balance-intent; tools balance |
| `balance-runs-check.mjs` | THE RECORDED REPORT'S CONFIGURATION, CHECKED AGAINST CONTENT. | tests balance-runs-check; tools balance; docs DEVELOPER.md |
| `balance.mjs` | balance — headless balance analysis (SPEC §9 M3). | tests balance-doc, balance-runs-check, card-cost-fastpath +3; tools balance-intent, balance-runs-check; docs DEVELOPER.md, docs/BALANCE.md, docs/FINISH.md +2; other src/engine/runCombat.js, src/model/encounterTier.js |
| `base-cards.mjs` | JSON is the authoring source; this projection supports import-only/file:// builds. | tests base-card-pack-source, base-card-pack, engine-export; tools content-build, engine-export, game-config; docs DEVELOPER.md, docs/ai/json-game-modules/CONTINUE.md, games/ashenspire/packs/base-cards/guide.md; other src/content/generated/baseCards.js, workbench/core/files.mjs |
| `book-art-browser.mjs`, `book-learning-browser.mjs`, `book-library-built-browser.mjs` | (no header comment) | docs docs/BOOK-ART.md, docs/BOOK-LIBRARY.md |
| `book-art-export-preview.mjs` | Transparent composition exports from the same renderer used by the game. | docs docs/preview/book-library/layers/painted/README.md, docs/workbench/CONSOLIDATION.md |
| `browser.mjs` | browser — THE ONE HOME FOR "START A BROWSER AND TAKE ITS PROFILE | wf ci; tests battlefield-layout.browser, browser-launch-floor, browser-serve +12; tools about-changelog, actends, actionreach +148; docs DEVELOPER.md, docs/BOOK-ART.md, docs/BOOK-LIBRARY.md +14; other docs/preview/display-appearance-0.7.1.1163/capture.mjs, pose-studio/stances/update-stances/sequence-review/check-player.mjs +3 |
| `build-game.mjs` | build-game - compiles every authored JSON layer into one serialized, deterministic artifact | tests build-game; tools ui-validate; docs CHANGELOG.md, docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md, engine/export/README.md +1; other .gitignore, games/ashenspire/build.summary.json +2 |
| `build-stamp.mjs` | build-stamp — THE BUILD NUMBER IS PRODUCED AFTER THE MERGE, NOT BEFORE IT. | wf build-stamp; tests build-stamp; tools about-changelog, receipts; docs DEVELOPER.md |
| `buildstamp-shot-selftest.mjs` | buildstamp-shot-selftest — the known-bad corpus for the INK gate. | tools buildstamp-shot |
| `buildstamp-shot.mjs` | buildstamp-shot — IS THE BUILD VERSION ACTUALLY ON THE SCREEN? | wf ci; tools buildstamp-shot-selftest, buildversion-selftest, buildversion +2; other src/ui/components/buildstamp.js |
| `buildversion-selftest.mjs` | buildversion-selftest — the known-bad corpus for the version check. | wf ci; tests buildversion-shard; tools buildversion; docs docs/ART-REPO-PLAN.md, docs/EXTERNAL-ASSETS-PLAN.md, docs/FINISH.md |
| `buildversion.mjs` | buildversion — DERIVE the build version, and hold the line that | wf ci, dev-preview, pages-builds; tests alternative-branches, build-identity, buildversion-schema-versions; tools about-changelog, ai-disclosure, art-source +20; docs docs/ARCHITECTURE-MAP.md, docs/ART-REPO-PLAN.md, docs/COMBAT-EQUIPMENT-RULES.md +10; other .gitignore, buildordinal.json +8 |
| `bundle.mjs` | bundle — produce the built game: the pack-shaped HTML at | wf ci, dev-preview; tests alternative-art, build-identity, combat-audit-runtime +8; tools ai-disclosure, art-manifest, art-source +26; docs DEVELOPER.md, SPEC.md, desktop/windows/README.md +8; other buildordinal.json, desktop/windows/build-installer.mjs +20 |
| `bundle.test.mjs` | bundle.test — the parse gate's own fixtures (#77 property 4). | wf ci, worker-check; tests run-node-lanes, run-node; tools art-source, hud-component-studio/README.md, linkcheck; docs DEVELOPER.md, docs/ART-REPO-PLAN.md, docs/EXTERNAL-ASSETS-PLAN.md +2 |
| `card-cutout-assets.mjs` | Branch-owned PNGs use the same verified common-pack path as alternative art | tests layered-card-art; tools asset-pack, buildversion, bundle; docs docs/card-art-composition.md |
| `card-components.mjs`, `card-layout-save-qa.mjs`, `card-layout-save.mjs`, `card-master-qa.mjs`, `card-rank-layers-qa.mjs`, `card-sigils-qa.mjs` | (no header comment) | tests card-object-ids; tools buildversion, bundle, card-components.test +5; docs docs/workbench/CONSOLIDATION.md, docs/ai/session-continuations/2026-10-08/card-layers-and-rank.md, docs/ai/session-continuations/2026-10-08/combat-mechanics-and-formulas-status.md; other src/content/cardComponents.generated.js, workbench/core/files.mjs +4 |
| `card-components.test.mjs` | (no header comment) | tests run-node (discovered: every *.test.mjs) |
| `card-drag-targeting.mjs` | card-drag-targeting — browser acceptance for #150 + #198 + #311 | tools hybrid-input-parity, plantsites-baseline.json |
| `card-effect-art-build.mjs` | Normalize the authored six-frame refresh; preserve one scale and anchor per sheet. | tools combat-effects-ship; docs CREDITS.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md, docs/design/player-polish-asset-kit-2026-10-02/CANONICAL-CREDITS.md; other src/content/combatEffectArt.js |
| `card-feedback.mjs` | Real browser card feedback gate. Debug fixtures control only initial hand, | docs DEVELOPER.md, docs/COMPONENT-CATALOG.md |
| `card-inspection-qa.mjs` | Production UI interaction regression checks through Playwright. | docs docs/preview/shared-card-inspection/README.md |
| `card-layer-editor-qa.mjs` | Compatibility entry point. The save QA uses an isolated copy of the game JSON. | tools card-layers/README.md |
| `card-one-shape.mjs` | card-one-shape — THE PLAYING CARD HAS ONE SHAPE, MEASURED ON REAL | tests card-size-tuning; docs docs/COMPONENT-CATALOG.md, docs/COMPONENT-MODEL-ARCHITECTURE.md; other docs/component-catalog.html, docs/tag-model/tables/presentation/components.csv |
| `card-value-index-oracle.mjs` | Record the independent pre-index implementation against today's content. | tests card-value-tag-index |
| `character-creation-check.mjs` | Focused real-Chromium verification of character creation's stats step. | tests card-size-tuning; tools modal-shell-contract; docs DEVELOPER.md; other .gitignore, docs/architecture-handoff/pre-existing-changes.txt |
| `character-creation-components-qa.mjs` | Photograph actual production components from the existing shot catalog. | docs DEVELOPER.md, docs/ai/CHARACTER-CREATION-HANDOFF.md |
| `characters-convert.mjs` | Players and enemies in one shape (owner 2026-10-17): games/ashenspire/packs/core/characters.json. | tools enemy-decks-convert; docs engine/modules/characters/guide.md |
| `check-feature-pages.mjs` | Verify public delivery only. Never download or execute a feature game's HTML. | wf pages-builds; tests art-migrate-trigger, check-feature-pages |
| `class-loadouts.mjs` | Observed-red contract: equipment-bound core roles plus one class signature. | tests engine.test.js; tools cross-class-equipment, plantsites-baseline.json |
| `class-smash-aura-qa.mjs`, `class-smash-gameplay-qa.mjs` | (no header comment) | docs pose-studio/stances/class-smash/qa/README.md |
| `click-impact-card.mjs` | (no header comment) | tests click-impact-card; tools click-impact-probe, combat-action-row, motion-probe +1 |
| `click-impact-probe.mjs` | click-impact-probe — how long from the click that plays a card | wf quick-start; tests beat-order, click-impact; tools map-tap-latency; docs DEVELOPER.md, docs/FINISH.md, docs/preview/combat-targeting-1115/README.md +2; other docs/preview/combat-targeting-1127/results.json, src/ui/fx.js |
| `click-impact-rounds.mjs` | tools/click-impact-rounds.mjs — the click-impact probe's judgement, apart from the drive | tests click-impact-rounds; tools click-impact-probe |
| `closedsets.mjs` | closedsets — Viki, 2026-08-08. | tests closedsets, run-node, spell-damage-dealt-mult; tools doorplant, onevocab; docs docs/plan-progression-and-property-system.md; other src/buildversion.js, src/content/encounters/weald.js +2 |
| `collect-feature-previews.mjs` | Trusted Pages collector: download data only; never run a feature checkout. | wf pages-builds; tests art-migrate-trigger, collect-feature-previews; tools combat-audit/hosted-preview |
| `combat-action-row.mjs` | combat-action-row — #21's single-owner combat action-row gate. | tools plantsites-baseline.json; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/ui/components/armamentRadial.js +1 |
| `combat-default-weapons-qa.mjs` | Paid plays in a controlled registered-card encounter; no renderer/timeline patches. | docs pose-studio/stances/class-smash/qa/default-weapons/README.md |
| `combat-effects-ship.mjs`, `combat-expansion-smoke.mjs`, `combat-layer-qa.mjs`, `combat-option-c-qa.mjs`, `combat-prototypes-browser.mjs`, `combat-prototypes.mjs`, `combat-size-qa.mjs`, `combat-sprite-scale-qa.mjs`, `combat-test-browser.mjs` | (no header comment) | tests combat-expansion-bot, battlefield-stage-threads; tools card-effect-art-build, balance; docs CREDITS.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md, docs/design/player-polish-asset-kit-2026-10-02/CANONICAL-CREDITS.md +8; other src/content/combatEffectArt.js |
| `combat-feel-probe.mjs` | Real-browser hit-stop check: production CSS and painted stages, desktop and phone. | docs DEVELOPER.md |
| `combat-hud-menus.mjs` | Trusted desktop/phone HUD menu checks. Source or --standalone; controlled | docs DEVELOPER.md |
| `combat-log-touch-qa.mjs` | Exercise the log with browser-native taps/drags. No app state injection. | tests combat-log-modal |
| `combat-mobile-touch-qa.mjs` | Real touch gestures against the authored starting hand. No combat state is | tests combat-inspect-visibility |
| `combat-save.mjs` | Focused acceptance for QA remediation #3: explicit combat saves preserve | tools plantsites-baseline.json; docs DEVELOPER.md, docs/COMPONENT-CATALOG.md; other docs/component-catalog.html, docs/tag-model/tables/presentation/components.csv |
| `combat-stances-gallery.mjs` | Real combat-UI held screenshots and registered-stage reference clips. | docs pose-studio/stances/combat-stances-gallery/README.md |
| `combatant-overhead-qa.mjs` | (no header comment) | docs DEVELOPER.md |
| `component-refs.mjs` | component-refs — cut each costume component out of its painting and | tools lowpoly-components.json; other .gitignore |
| `concept-cutout.mjs` | concept-cutout — turn the four class concept paintings into the | tools component-refs, painted-poses, pose-cutout +2; docs CREDITS.md, asset-data/classes/SUCCESSOR-CONTRACT.md, docs/ART-REPO-PLAN.md +4; other asset-data/classes/rejected-inputs.json, asset-data/sprites/class-sprites.manifest.json +2 |
| `config-build.mjs` | config-build — compile content/config/**.json into | wf alternative-sync; tests build-lock, deck-editor-costs, engine-export +3; tools content-build, engine-export, launch +1; docs DEVELOPER.md, content/config/README.md, docs/COMPONENT-MODEL-ARCHITECTURE.md +8; other package.json, src/config/generated/ui.js +14 |
| `confirmation-modal.mjs` | Focused acceptance for QA remediation #4: Load and Quit Without Saving use | tools escape-back, plantsites-baseline.json; docs DEVELOPER.md, docs/COMPONENT-CATALOG.md |
| `conhp.mjs` | conhp — D22 Constitution/HP authority contract. | tests fixtures/run-save-vigour-window.json; tools onevocab, runcreation, saveroundtrip; other docs/architecture-handoff/pre-existing-changes.txt |
| `content-build.mjs` | content-build — compile authored JSON/CSV content into ES modules, | wf ward-to-block-cards; tests build-lock, engine-export, engine.test.js +1; tools config-build, dirorder, doorplant +8; docs DEVELOPER.md, SPEC.md, content/config/README.md +12; other docs/architecture-handoff/source-map.json, docs/design/class-armor-rear-2026-10-06/sources/outfits.js +59 |
| `contentreach.mjs` | contentreach — CAN A PLAYER EVER GET THIS CARD, RELIC OR EVENT? | tests contentreach; docs SPEC.md, docs/FINISH.md |
| `contrast-audit.mjs` | contrast-audit — what the eye actually gets: WCAG contrast of the | wf ci; tests contrast-title-continue, engine.test.js; tools buildstamp-shot, mapreach, pairsweep +1; docs SPEC.md, docs/FINISH.md, docs/RELEASE-CHECKLIST.md +1; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/main.js +2 |
| `coop-combat-smoke.mjs` | coop-combat-smoke — headless check of the shared N-player combat | docs docs/MULTIPLAYER.md |
| `coop-hand-parity.mjs` | coop-hand-parity — the renderer collapse's own check, and the one | tools plantsites-baseline.json |
| `coop-hud-top.mjs` | coop-hud-top — the co-op formation HUD top, measured in Chromium. | wf coop-hud; tests coop-hud-top; tools combat-action-row, flask-menu-probe; docs DEVELOPER.md, docs/FINISH.md, docs/preview/modules/animation/browser-followup/CAPTURE.md; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/ui/screens/coop.js +1 |
| `coop-restore-isolation.mjs` | coop-restore-isolation — ONE POISONED MEMBER FAILS WITH A RECEIPT; | tools session-resume-smoke |
| `coop-secondbeat.mjs` | Co-op End Turn must ask the same action table as solo. This is intentionally | tools plantsites-baseline.json |
| `coop-shoot.mjs` | coop-shoot — LIVE multi-client co-op screenshots (no canned data). | tools release-shots, tutorial-reach; other src/ui/screens/coop.js |
| `core-entry-fixture.mjs` | A deterministic real-input route: seed 4, initial Shrine, then the leftmost | tests core-entry-fixture; tools click-impact-probe, quick-start-inputs |
| `creationbrief.mjs` | creationbrief — D26's short form, observed on glass. | tools browser, foldsurvivors, release-shots; docs CHANGELOG.md, DEVELOPER.md; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/content/changelog.generated.js +3 |
| `credits-check.mjs` | credits-check — does every asset directory have a CREDITS row, and | wf ci; tests run-node; docs CREDITS.md, SPEC.md, docs/ART-REPO-PLAN.md +4 |
| `deck-editor-targets.mjs` | deck-editor-targets — the deck editor's browser probe (SPEC §14.1 | docs docs/FINISH.md |
| `derived-runtime-authority.mjs` | Runtime authority contract for Energy and Draw. The run's versioned derived | tools class-loadouts, cross-class-equipment, plantsites-baseline.json |
| `derived-tables.mjs` | Derived, read-only tables of the resolved Core profile (owner 2026-10-17): every character's attributes | tests derived-tables |
| `derivedstats.mjs` | derivedstats — executable contract for the inert derived-stat table. | other docs/architecture-handoff/pre-existing-changes.txt |
| `dialogue-context-fit.mjs` | dialogue-context-fit — the W4c context band holds its responses. | tools dialogue-hud-fit |
| `dirorder.mjs` | dirorder — the one home for "what order do we read a directory in?" | wf ci; tools art-manifest, asset-pack, buildversion +7; docs SPEC.md, docs/EXTERNAL-ASSETS-PLAN.md |
| `disabled-reason.mjs` | disabled-reason — "A disabled Next button shows its reason as | tests disabled-reason; docs docs/COMPONENT-CATALOG.md, docs/FINISH.md; other docs/component-catalog.html, docs/tag-model/tables/presentation/components.csv +1 |
| `display-art-library.mjs` | Organize existing, hash-verified exports without repainting or re-encoding them. | wf alternative-sync; docs assets-display/README.md, docs/ai/session-continuations/2026-10-08/pr-integration-and-promotion.md |
| `displayfirst.mjs` | displayfirst — FULLSCREEN IS THE FIRST THING A PLAYER MEETS UNDER | wf ci; tests advanced-settings-groups; tools flask-menu-probe, hudparity, plantsites-baseline.json; docs docs/framework-migration-checklist.md; other src/ui/components/settingsPreview.js, src/ui/screens/settings.js |
| `doorplant.mjs` | doorplant — the same-door selftest harness: plant a known-bad in a | wf ci, dev-preview; tests doorplant-shard, doorplant-source-roots, motion-probe-alternative +1; tools about-changelog, actionreach, armoury-picked-up +59; docs DEVELOPER.md, docs/FINISH.md |
| `doublescroll.mjs` | doublescroll — TWO THUMBS SIDE BY SIDE IN ONE DOOR. Constantine, | wf ci |
| `e11-reward-correction.mjs` | E11/#256 exact-head browser gate: the real reward renderer, shared hold | other docs/architecture-handoff/pre-existing-changes.txt |
| `enemy-decks-convert.mjs` | Re-runnable conversion: legacy weighted 'moves' enemies (src/content/enemies/act1-3.js) -> enemies-module | docs docs/plans/enemy-decks.md, engine/modules/characters/guide.md, engine/modules/enemies/guide.md |
| `enemy-level-content.mjs` | Focused inert-content gate for issue #238. | tests content-validators; docs docs/FINISH.md |
| `engine-export.mjs` | engine-export — the game's data as engine-ready JSON. | wf workbench; tests build-lock, engine-export; docs docs/ENGINE-EXPORT.md, docs/ai/json-game-modules/IMPLEMENTATION.md, docs/ai/json-game-modules/PSEUDOCODE.md +3; other .gitignore, docs/engine-export/unity/AshenSpireExportImporter.cs +4 |
| `environment-art-build.mjs` | Encode approved original boards and complete maps. Runtime SVG viewBoxes | docs CREDITS.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md, docs/design/player-polish-asset-kit-2026-10-02/CANONICAL-CREDITS.md |
| `equipment-animation-browser.mjs` | (no header comment) | docs docs/EQUIPMENT-ANIMATION-REFERENCES.md |
| `equipment-surface-receipts.mjs` | Observed-red contract for the one presentation receipt shared by character | tools plantsites-baseline.json, swap-cost-relic-surface; other src/model/equipmentPresentation.js, src/ui/screens/customize.js |
| `escape-back.mjs` | escape-back — Escape and pad B back out of every screen, measured | tests escape-back; docs DEVELOPER.md, docs/FINISH.md; other src/ui/input.js, src/ui/screens/map.js |
| `export-layered-card-art.mjs` | Select already-approved cutouts; do not repaint, flatten, or recolor them | docs docs/card-art-composition.md; other src/content/layeredCardArt.generated.js |
| `export-extended-card-art.mjs` | (no header comment) | tests extended-card-artwork; docs docs/EXTENDED-CARD-ART.md, docs/workbench/CONSOLIDATION.md; other src/ui/extendedCardArtwork.js |
| `external-play-art-state.mjs` | (no header comment) | tests external-play-network; tools external-play |
| `external-play.mjs` | external-play — load the DE-INLINED build in a real browser and | wf dev-preview; tests external-play-network; tools verify-external, verify-shipped; docs DEVELOPER.md, dist/README.md, docs/EXTERNAL-ASSETS-PLAN.md |
| `feature-preview.mjs` | Keep feature-only README evidence removable without touching release content. | tests feature-preview; docs CONTRIBUTING.md, docs/handoffs/full-combat-audit.md, docs/preview/full-combat-audit/VIEWPORT-CAPTURES.md |
| `fetch-art.mjs` | fetch-art — fetch the pinned art release, one pack at a time, and check it. | wf action, ci, dev-preview +2; tests art-source, build-identity, fetch-art; tools art-authoring, art-manifest, art-source +8; docs DEVELOPER.md, dist/README.md, docs/ARCHITECTURE-MAP.md +11; other .gitignore, desktop/windows/fetch-hd-art.ps1 +8 |
| `flask-action-contract.mjs` | Placement-agnostic flask interaction contract. Selection opens a menu; it | tests run-node; tools flask-menu-probe, plantsites-baseline.json; docs DEVELOPER.md, docs/FINISH.md, docs/RELEASE-CHECKLIST.md |
| `flask-intent-smoke.mjs` | Direct host-authority probe for contextual flask Use. Inspect/cancel/drop are | tools plantsites-baseline.json |
| `flask-menu-cancel.mjs` | Runtime parity probe: gamepad Cancel is synthesized as window-targeted | tools modal-shell-contract, plantsites-baseline.json |
| `flask-menu-probe.mjs` | flask-menu-probe — every flask menu, opened in Chromium. | wf ci; tools flask-action-contract, plantsites-baseline.json; docs DEVELOPER.md, docs/FINISH.md; other src/main.js |
| `flask-reallocation.mjs` | Fixed-capacity Crimson/Azure charge contract. This intentionally starts red: | tools flaskbox |
| `flaskbox.mjs` | flaskbox — A FLASK THAT IS A CONTROL HAS ONE BOX, AND IT IS AT THE | tools flask-reallocation, placement, plantsites-baseline.json +1; other src/ui/screens/rest.js |
| `flaskgrowth.mjs` | flaskgrowth — the growth chain's corpus, and proof it refuses. | docs SPEC.md; other src/content/balance.js, src/model/flaskgrowth.js +2 |
| `flaskpresentation.mjs` | Contract for data-owned, non-color-only flask identity on every major surface. | tools flaskbox |
| `foldsurvivors.mjs` | foldsurvivors — E5's class, and the reason no existing gate could | other src/ui/components/disclosure.js |
| `footer-paint.mjs` | The transparent padding of authored PNG/WebP components is not missing ink. | tests footer-paint; tools hintstrip |
| `framework-data-build.mjs` | framework-data-build — compile content/framework/*.json into | tests build-lock, engine-export; tools content-build, engine-export, framework-gate; docs DEVELOPER.md, docs/ENGINE-EXPORT.md, docs/framework-cutover-report.md +1; other editor/server.mjs, editor/tests/studio.test.mjs +10 |
| `framework-gate.mjs` | framework-gate — the cutover gate runner (framework contract: | tools content-build; docs docs/framework-cutover-report.md, docs/framework-migration-checklist.md |
| `full-run-probe.mjs` | full-run-probe — one whole run, played in Chromium from the title | wf ci; tests full-run-probe; docs DEVELOPER.md, docs/FINISH.md |
| `fullscreen-control.mjs` | Deterministic controller checks for Settings > Fullscreen. No browser claims: | wf ci; tools plantsites-baseline.json; docs SPEC.md |
| `game-config.mjs` | Compile source JSON to importable JS for the repository's import-only bundler. | wf feature-preview; tests base-card-pack, enemies-module, engine-export +4; tools build-game, content-build, derived-tables +2; docs DEVELOPER.md, docs/ENGINE-EXPORT.md, docs/ai/json-game-modules/ARCHITECTURE.md +32; other src/content/generated/gameProfiles.js, workbench/core/files.mjs +6 |
| `gatelist.mjs` | gatelist — WHICH INSTRUMENTS DOES A GATE ACTUALLY RUN, AND DOES IT | wf ci; tests run-node; tools plantsites-baseline.json, watched |
| `gear-convert.mjs` | Re-runnable conversion: content/source/weapons.csv + outfits.csv -> games/ashenspire/packs/core/gear.json | docs engine/modules/gear/guide.md |
| `gesture-cancel.mjs` | gesture-cancel — the gesture lifecycle, observed: a cancelled drag | tools card-drag-targeting, inspecthold, plantsites-baseline.json |
| `git-artifact.mjs` | Read a committed artifact regardless of whether Git stores its bytes or an | wf pages-builds; tools git-artifact.test, pages-site |
| `git-artifact.test.mjs` | (no header comment) | wf ci |
| `gracerefill.mjs` | gracerefill — what a grace hands back, and proof it refuses. | tests run-node; docs SPEC.md; other src/model/gracerefill.js, src/model/validate.js +2 |
| `hand-pager-threshold.mjs` | hand-pager-threshold — focused browser acceptance for #208. | tools plantsites-baseline.json |
| `hand-resize-probe.mjs` | Browser regression: observe real hand width changes without writing styles | tests card-two-beats |
| `hand-side-probe.mjs` | hand-side-probe — WHICH SIDE OF THE MODEL IS AN ARMAMENT DRAWN ON? | wf ci; tools plantsites-baseline.json; docs docs/ART-REPO-PLAN.md, docs/EXTERNAL-ASSETS-PLAN.md |
| `handlayout.mjs` | handlayout — the hand-layout word (C2), measured: overlap FITS, | tests card-two-beats; tools coop-hand-parity, inspecthold, overlapreader +1; other src/model/validate.js, src/ui/components/hand.js +1 |
| `handrenderers.mjs` | handrenderers — THE GREEN-DEBT SENTINEL. How many places in this | tools onefold; other src/ui/components/disclosure.js |
| `head-meta.mjs` | head-meta — the web/share metadata the bundle carries (FINISH §13). | tests web-meta; tools buildversion, bundle, og-image; docs docs/EXTERNAL-ASSETS-PLAN.md |
| `hintstrip.mjs` | hintstrip — THE COMBAT ACTION ROW SITS UNDER THE CARDS, WHOLE, AND | wf ci; tests doorplant-shard, run-node; tools gatelist, plantsites-baseline.json; docs docs/FINISH.md; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/ui/components/hand.js +1 |
| `holdbeat.mjs` | holdbeat — DID THE BEAT ACTUALLY MAKE A SOUND? (Vega, 2026-08-08.) | tools sfx-loudness; other src/ui/components/holdbeat.js |
| `holdconfirm.mjs` | holdconfirm — THE SECOND BEAT: WHICH ACTIONS TAKE ONE, WHICH FORM, | tests card-two-beats, confirmation-modal; tools armoury-picked-up, controlstrip, release-shots; other src/main.js, src/model/consequence.js +7 |
| `hud-layout-css.mjs` | hud-layout-css — compile content/hud-layout/<form-factor>.json into | tests hud-layout-css, run-node; tools content-build, hud-component-studio/README.md, hud-layout-tokens +1; docs DEVELOPER.md, docs/hud-layout-tokens.md; other docs/design/battlefield-options-2026-10-16/visual-preview.html, styles/hud-layout.generated.css +4 |
| `hud-layout-tokens.mjs` | hud-layout-tokens — the HUD layout token allowlist and its | tests hud-layout-css; tools content-build, hud-component-studio/css-export.js, hud-layout-css; docs DEVELOPER.md |
| `hud-potion-followup.mjs` | hud-potion-followup — the exact approved shared-HUD follow-up. | tools hudparity |
| `hud-quick-compact.mjs` | Focused rendered receipt for the HUD's two quick controls, Fullscreen and | other docs/design/battlefield-options-2026-10-16/visual-preview.html, styles/kit.css |
| `hudbars.mjs` | hudbars — does the HUD bar's LENGTH actually track the maximum? | tools hudparity, plantsites-baseline.json; docs docs/spec-audit/SPEC-AUDIT.md; other docs/architecture-handoff/wireframe-gallery.html, src/content/balance.js +4 |
| `hudparity.mjs` | hudparity — ONE HUD: the map and the combat screen draw the same | tools hudbars, plantsites-baseline.json; other docs/architecture-handoff/wireframe-gallery.html, src/main.js +1 |
| `hybrid-input-parity.mjs` | hybrid-input-parity — same-door acceptance for AshenSpire #204. | tests qa-evidence-size; tools card-drag-targeting, plantsites-baseline.json; docs docs/workbench/CONSOLIDATION.md; other docs/design/battlefield-options-2026-10-16/visual-preview.html, docs/preview/hybrid-input-parity-manifest.json +2 |
| `hybridstats.mjs` | hybridstats — observed contract for the integrated Hybrid stats slice. | other src/ui/components/runHud.js |
| `inspecthold.mjs` | inspecthold — hold-to-inspect on the hand, observed: a read can | tools coop-hand-parity, creationbrief, handlayout +2; docs docs/preview/shared-card-inspection/README.md; other src/ui/components/holdconfirm.js, src/ui/input.js |
| `lan-resume-smoke.mjs` | lan-resume-smoke — headless check of host disk-resume over the wire: | docs docs/MULTIPLAYER.md |
| `lan-smoke.mjs` | lan-smoke — headless end-to-end check of the LAN foundation (S1). | docs docs/MULTIPLAYER.md |
| `lan-state.mjs`, `lan.mjs` | (no header comment) | wf ci; tests enemy-knowledge-lan, enemy-stance-sprites, lan-intent-privacy +6; tools lan, alternative-art-build.py, coop-restore-isolation +7; docs docs/design/update-stances/integration-notes.md, SPEC.md, docs/ART-EXPORT-POLICY.md +3; other src/content/mapconfig.js, src/engine/mapgen.js +6 |
| `launch.mjs` | launch — the one-click launcher. | wf alternative-sync, ci, dev-preview +3; tests build-lock; tools actionreach, asset-pack, axisfit +29; docs .claude/skills/finish/SKILL.md, DEVELOPER.md, content/config/README.md +24; other .gitignore, docs/architecture-handoff/source-map.json +10 |
| `linkcheck.mjs` | linkcheck — every named import in the tree resolves to a real | wf dev-preview; tests linkcheck-batch-sharing, run-node-lanes, run-node +1; tools gatelist; docs DEVELOPER.md; other src/ui/screens/rest.js |
| `local-checks.mjs` | Shared finite local QA payload. Run in an owned background worker when needed. | tests local-checks-snapshot; docs docs/local-background-checks.md |
| `location-presentation-report.mjs` | (no header comment) | docs docs/location-presentation/README.md |
| `map-camera-persistence.mjs` | Same-door gate for issue #38: a player-chosen map zoom and vertical camera | wf map-camera; tests map-tap-main-thread; tools full-run-probe, tutorial-reach; docs DEVELOPER.md, docs/FINISH.md |
| `map-detail-build.mjs` | Native-resolution pyramid, deliberately outside assets/ (which is inlined). | tools environment-art-build; docs CREDITS.md, docs/EXTERNAL-ASSETS-PLAN.md, docs/design/improve-map-battlefield-art/README.md +3; other src/content/mapArt.generated.js |
| `map-tap-latency.mjs` | map-tap-latency — how long does a phone tap on a map node take to | tests map-tap-main-thread; other docs/qa/map-tap-latency/result.json |
| `map-two-axis-pan.mjs` | Issue #1168: the opt-in/default two-axis map camera moves horizontally and | wf dev-preview; tests map-two-axis-pan-scale |
| `mapfit.mjs` | mapfit — when the game frames the act map for the player, is the | tools actends; other src/content/mapconfig.js, src/model/map/mapview.js +2 |
| `mapfog.mjs` | mapfog — does the fog cover the right things, and does the screen | tests engine.test.js; tools actends, browser, pairsweep; docs engine/modules/routes/guide.md; other src/model/map/mapknowledge.js |
| `mapplan.mjs` | mapplan — the data-driven tooling for map config (SPEC §6). | tests engine.test.js; docs SPEC.md, docs/framework-migration-checklist.md; other src/content/mapconfig.js, src/engine/mapgen.js +5 |
| `mapreach.mjs` | mapreach — can a player REACH every map node, and what can they see | tools actends, mapfit; docs SPEC.md; other docs/architecture-handoff/wireframe-gallery.html, docs/design/battlefield-options-2026-10-16/visual-preview.html +3 |
| `maps-validate.mjs` | maps-validate - validates the JSON map layer. | tests build-game, maps-json; tools build-game; other package.json |
| `mapspacing.mjs` | mapspacing — measure adjacent map-floor pitch on the rendered map. | tools actends; other src/model/map/mapview.js |
| `markhome.mjs` | markhome — card text marks may not be keyed to one of their two | tests run-node |
| `measure-classes.mjs` | measure-classes — instrumented per-class win-rate measurement | tests run-node-lanes, sim-parity, simbot-decisions +1; tools results/starseerkit-decision.md, results/sweep-bleed-threshold.md; docs docs/FINISH.md, docs/RELEASE-CHECKLIST.md; other src/engine/runCombat.js |
| `mechanics-generate.mjs` | mechanics-generate — one mechanic folder per behaviour tag and per status. | tests mechanics; docs engine/mechanics/README.md; other engine/contracts/mechanic.schema.json |
| `menufit.mjs` | menufit — the two surfaces a player manages a RUN from: the Armoury | tools mapreach, plantsites-baseline.json, release-shots +1; other src/ui/screens/equipment.js |
| `mobileart-policy.mjs` | mobileart-policy — the one home for what "mobile art" means. | tests alternative-art, alternative-card-animation, alternative-selected-stances +3; tools art-export-plan, art-manifest, buildversion +5; docs docs/ART-EXPORT-POLICY.md, docs/EXTERNAL-ASSETS-PLAN.md, docs/MOBILE-PERFORMANCE.md +1 |
| `mobilefit.mjs` | mobilefit — can a finger reach the combat controls, at every shape | tools axisfit, mapreach, screenreach +2; docs docs/ai/session-continuations/2026-10-08/combat-mechanics-and-formulas-status.md; other docs/design/battlefield-options-2026-10-16/visual-preview.html, styles/combat.css |
| `modal-no-reset.mjs` | Real-browser acceptance for FixModal W8: acting inside a modal never resets | tools plantsites-baseline.json |
| `modal-shell-contract.mjs` | modal-shell-contract — the shell is the only chrome, and the count | tests wireframe-confirmation; tools textfit; other docs/architecture-handoff/source-map.json, docs/design/battlefield-options-2026-10-16/visual-preview.html +2 |
| `motion-probe.mjs` | motion-probe — idle life and reduced motion, measured in a real | wf ci; tests motion-probe-alternative, motion-probe-boundary, motion-probe-fixed-rest +1; tools plantsites-baseline.json; docs DEVELOPER.md, docs/FINISH.md, docs/ai/session-continuations/2026-10-08/combat-mechanics-and-formulas-status.md +1; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/ui/assets.js +1 |
| `music-bed-gain-probe.mjs` | music-bed-gain-probe — headless proof that 'bed.gain' reaches the | other src/ui/audio.js |
| `music-silence-probe.mjs` | music-silence-probe — headless proof that the engine can tell | tests engine.test.js; tools webaudio-stub |
| `music-toggle-parity.mjs` | Issue #230: music-only preference and Quick Menu/Settings parity. | wf ci; tools plantsites-baseline.json; other src/ui/components/card.js |
| `offline-play-qa.mjs` | offline-play-qa — the Download & saves screen and the game it saves, | docs docs/EXTERNAL-ASSETS-PLAN.md, docs/FINISH.md, docs/offline-play.md |
| `og-image.mjs` | og-image — the share image every build's og:image names. | tests web-meta; tools pages-site; docs docs/EXTERNAL-ASSETS-PLAN.md |
| `onefold.mjs` | onefold — HOW MANY PLACES IN THIS TREE BUILD A FOLD? | tools plantsites-baseline.json; other src/ui/components/disclosure.js, src/ui/components/trayComponents.js |
| `onevocab.mjs` | onevocab — Sten, 2026-08-15. | tests run-node; tools conhp, equipment-surface-receipts, plantsites-baseline.json +2; other src/ui/models/StatsPreviewModel.js |
| `overlapreader.mjs` | overlapreader — the two-knob refusal, observed at the boot door: | other src/model/validate.js |
| `pages-offline.mjs` | pages-offline — the Pages service worker in a real Chromium | wf dev-preview; tests pages-offline-entry, pages-sw; tools pages-store; docs DEVELOPER.md, docs/EXTERNAL-ASSETS-PLAN.md |
| `pages-site.mjs` | pages-site — assemble the GitHub Pages site that lists EVERY branch's | wf pages-builds; tests alternative-branches, check-feature-pages, collect-feature-previews +4; tools art-source, collect-feature-previews, offline-play-qa +4; docs DEVELOPER.md, docs/EXTERNAL-ASSETS-PLAN.md, docs/offline-play.md +1; other .gitignore, src/model/offlineDownload.js +2 |
| `pages-store.mjs` | pages-store — the Pages object store and the pages that read it | tests offline-zip, pages-sw; tools offline-play-qa, pages-offline, pages-site; docs DEVELOPER.md, docs/EXTERNAL-ASSETS-PLAN.md; other src/model/offlineDownload.js |
| `pages-sw.mjs` | pages-sw — the Pages service worker, as text (docs/EXTERNAL-ASSETS-PLAN.md | wf pages-builds; tests pages-sw; tools pages-offline, pages-site, pages-store; docs DEVELOPER.md, docs/EXTERNAL-ASSETS-PLAN.md, docs/FINISH.md; other src/ui/offlineInstall.js |
| `painted-book-browser.mjs` | (no header comment) | docs docs/preview/book-library/layers/painted/README.md |
| `painted-outfits-ship.mjs` | Ship the reviewed artwork without recoloring outfit identities. | docs CREDITS.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md, docs/design/player-polish-asset-kit-2026-10-02/CANONICAL-CREDITS.md; other src/content/paintedOutfits.js |
| `painted-poses.mjs` | painted-poses — cut a painted pose sheet into single-pose frames. | docs CREDITS.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md, docs/design/player-polish-asset-kit-2026-10-02/CANONICAL-CREDITS.md; other .gitignore |
| `parchment.mjs` | parchment — writes the act plates: 'assets/map/parchment_actN.svg'. | tests engine.test.js; tools credits-check; docs CREDITS.md, docs/ART-REPO-PLAN.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md +1; other assets-mobile/map/parchment_act1.svg, assets-mobile/map/parchment_act2.svg +8 |
| `perf-probe.mjs` | perf-probe — mobile performance, measured (docs/FINISH.md §7). | docs DEVELOPER.md, docs/PERF-MOBILE-BASELINE.md |
| `placement.mjs` | placement — ANCHORED PLACEMENT HAS ONE HOME, AND THE GAP HAS ONE | tools flask-menu-cancel, flaskbox, hintstrip +1; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/ui/components/flask.js +2 |
| `plantsites.mjs` | Issue #498: 28 plant sites across 9 gates had drifted — their find-strings no | wf dev-preview; tools doorplant, placement, plantsites-baseline.json +2; docs DEVELOPER.md, docs/MOBILE-PERFORMANCE.md, docs/ai/AI-ROUTING.md +1; other package.json |
| `player-hud-clearance-qa.mjs` | Geometry and screenshots from the real screenshot route and mountCombat. | wf player-hud-clearance; docs docs/preview/full-combat-audit/resumed/css-followup.md |
| `player-poise-threshold.mjs` | player-poise-threshold — observed-red contract for player Poise. | tools equipment-surface-receipts, hudbars, plantsites-baseline.json |
| `pointer-target.mjs` | Serialized into browser probes; chooses input coordinates without dispatching | tests pointer-target; tools click-impact-probe, combat-card-stability-qa, combat-layer-qa +4 |
| `pose-cutout.mjs` | pose-cutout — cut generated full-body combat poses out of their | tools concept-cutout; docs CREDITS.md, docs/ART-REPO-PLAN.md, docs/art-evidence/2026-09-03/poses/README.md +3; other asset-data/sprites/class-sprites.manifest.json |
| `pose-ship.mjs` | pose-ship — publish a subset of the pose sprites into assets/. | tests run-node; docs CREDITS.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md, docs/design/player-polish-asset-kit-2026-10-02/CANONICAL-CREDITS.md; other asset-data/poses/pose-sprites.manifest.json, src/content/poseSprites.js |
| `pose-sprites.mjs` | pose-sprites — turn a folder of pose renders into shipped-shape sprites. | tools painted-poses, pose-ship; docs CREDITS.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md, docs/design/player-polish-asset-kit-2026-10-02/CANONICAL-CREDITS.md |
| `pose-studio-capture.mjs` | (no header comment) | wf dev-preview; other pose-studio/tests/server-source-roots.test.mjs |
| `pr-restamp.mjs` | pr-restamp — KEEPS AN OPEN PULL REQUEST MERGEABLE AFTER EACH dev BUILD STAMP. | wf pr-restamp; tests pr-restamp; docs CONTRIBUTING.md, DEVELOPER.md |
| `profile-durability-probe.mjs` | profile-loss-e444d77 — Sten, 2026-08-06. | tests engine.test.js, run-node; tools buildversion, plantsites-baseline.json, saveroundtrip; docs docs/FINISH.md; other src/engine/save.js |
| `profile-first-run.mjs` | profile-first-run — Viki, 2026-08-08 (M7). | tests engine.test.js; tools browser |
| `profile-surface-drive.mjs` | profile-surface-drive — Rune, 2026-08-07 (#67). | tools plantsites-baseline.json |
| `prologue-editor-save.mjs` | A local authoring bridge for the opening editor. Only the final journey | tests prologue-editor-defaults; tools displayfirst, serve; docs docs/workbench/CONSOLIDATION.md |
| `quest-choice-contract.mjs` | Issue #257: previous event choices can unlock or exclude later quest steps. | docs SPEC.md, docs/framework-migration-checklist.md; other src/model/validate.js |
| `quick-start-inputs.mjs` | Count real native inputs from the default Core New Game menu to its first | wf quick-start; tests quick-start-tutorial-input, quick-start; tools map-camera-persistence; docs docs/FINISH.md |
| `quicknav-reach.mjs` | quicknav-reach — the shipped quick menu, checked in a browser. | tools plantsites-baseline.json |
| `readiness-poses-ship.mjs` | Normalize authored sprite sheets to the existing 640px canvas / y=600 floor. | docs CREDITS.md, docs/design/player-components-2026-10-03/SOURCE-CREDITS.md, docs/design/player-polish-asset-kit-2026-10-02/CANONICAL-CREDITS.md; other src/content/readinessPoseArt.js |
| `readme-sync.mjs` | readme-sync — keeps the generated parts of README.md current. | wf readme-sync; tests readme-sync |
| `rear-player-qa.mjs` | (no header comment) | docs docs/ai/session-continuations/2026-10-08/rear-sprites-and-layering.md |
| `rear-qa-runtime.mjs` | Browser-test instrumentation only. The on-disk package stays unchanged; | tools combat-attached-details-qa, combat-card-stability-qa, combat-layer-qa +2 |
| `reaver-attack-animation.mjs` | Standing validation for the owner-approved painted Reaver attack. The | docs docs/ART-REPO-PLAN.md |
| `rebind-capture.mjs` | Focused browser acceptance for QA remediation #5 and #18: capture ownership | tools plantsites-baseline.json |
| `rebuild-matches.mjs` | rebuild-matches — does a build from THIS source reproduce what is | tools buildversion, bundle; docs docs/EXTERNAL-ASSETS-PLAN.md, docs/versioning.md; other src/buildversion.js |
| `receipts.mjs` | receipts — EVERY MERGED PULL REQUEST HAS A RECEIPT BEFORE IT IS PROMOTED. | wf receipts, worker-check; tests receipts-pr, receipts-root, receipts-window; tools about-changelog, build-stamp, equipment-surface-receipts +3; docs CHANGELOG.md, DEVELOPER.md, docs/FINISH.md +4; other package.json, src/model/equipmentPresentation.js +1 |
| `refusal-audit.mjs` | refusal-audit — every control that refuses must say why. | other src/ui/components/refusal.js |
| `release-series.mjs` | Gate current CI/CD builds; archived downloads retain their original versions. | wf ci, dev-preview, pages-builds; docs docs/RELEASE-CHECKLIST.md |
| `release-shots-selftest.mjs` | release-shots-selftest — the known-bad corpus for release-shots. | tools release-shots |
| `release-shots.mjs` | release-shots — photograph the RELEASE BUILD, screen by screen, | wf ci; tests engine.test.js, run-node; tools axisfit, buildstamp-shot, contrast-audit +5; docs SPEC.md, docs/SPEC-RECONCILE.md, docs/preview/issue-185-5198e8a/README.md +3; other src/buildversion.js, src/main.js +2 |
| `restore-settings-drive.mjs` | restore-settings-drive — Rune, 2026-08-07 (#68 D22). | tools plantsites-baseline.json |
| `reward-collect-drive.mjs` | reward-collect-drive — Bjorn, 2026-08-21 (E11/#256, PR #290). | tools full-run-probe, plantsites-baseline.json; other src/main.js |
| `reward-map-layout-qa.mjs` | Production reward/map mounts: column containment and touch response budget. | tools map-tap-latency |
| `rogue-parity.mjs` | Rogue full-slice contract. Source/model only: no browser and no generated build. | tests content-validators; docs docs/ART-REPO-PLAN.md, docs/FINISH.md |
| `runcreation.mjs` | runcreation — WHO WROTE THIS NUMBER, AND WHAT DID THEY OVERWRITE? | tools onevocab, plantsites-baseline.json, saveroundtrip; other src/engine/save.js, src/model/healLedger.js |
| `runsim-selftest-policy.mjs` | One budget owner for the simulator and its outer test-suite wrapper. | tests run-node, runsim-selftest-completion; tools runsim |
| `runsim.mjs` | (no header comment) | tests a3-lean-retune, release-checklist, run-node-lanes +5; tools balance, contentreach, full-run-probe +10; docs DEVELOPER.md, SPEC.md, docs/BALANCE.md +9; other content/framework/mechanics.json, src/content/attributes.js +12 |
| `saveroundtrip.mjs` | saveroundtrip — IS A SAVE A FIXED POINT OF THE SAVE DOOR? | tests fixtures/run-save-vigour-window.json; tools buildversion, plantsites-baseline.json; other src/model/healLedger.js |
| `screen-census.mjs` | screen-census — every player-facing screen in the tree, and what | tests run-node; tools refusal-audit |
| `screenreach.mjs` | (no header comment) | wf ci; tests combat-frame-reach, combat-target-layers, screenreach-overlap-fixture +1; tools actionreach, flaskbox, mapreach +4; docs CHANGELOG.md, DEVELOPER.md, SPEC.md +2; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/content/changelog.generated.js +2 |
| `screenshot.mjs` | screenshot — capture real screenshots of the game into docs/preview/. | wf ci; tests shot-match, shot-ready, write-atomic; tools armoury-picked-up, browser, lib/shot-match +4; docs DEVELOPER.md, SPEC.md, docs/ART-REPO-PLAN.md +4; other src/main.js, workbench/core/jobs.mjs +5 |
| `scroll-cue-bleed.mjs` | scroll-cue-bleed — issue #29: painted bleed and visible scroll cues. | tools combat-action-row, plantsites-baseline.json |
| `seedrefuses.mjs` | seedrefuses — the seed field keeps the promise printed on it. | tests engine.test.js; other src/ui/components/mapboard.js |
| `selected-combat-sequence-export.mjs` | Production export from approved review rasters. No image generation or body refitting. | other pose-studio/stances/update-stances/sequence-production-provenance.json |
| `selected-smash-registration.mjs` | Register the selected SM03 production exports; generation remains on the art side. | tests selected-smash-registration; tools selected-combat-sequence-export, selected-sweep-registration |
| `selected-sweep-registration.mjs` | Register the selected SW09 production exports; generation remains on the art side. | tests selected-sweep-registration; tools selected-combat-sequence-export |
| `selected-weapon-profile-export.mjs` | (no header comment) | docs CREDITS.md, docs/design/update-stances/delivery-status.md; other docs/design/update-stances/production-matrix.json |
| `serve-preview.mjs` | Copied to the preview archive root; serves only that folder on loopback. | wf dev-preview; docs docs/preview/starting-equipment/README.md; other src/ui/buildChannel.js |
| `serve.mjs` | serve — a zero-dependency static file server for local play. | wf ci, coop-hud, dev-preview +4; tests art-source, battlefield-layout.browser, final-wave-ui.browser +9; tools about-changelog, actends, actionreach +162; docs DEVELOPER.md, SPEC.md, dist/README.md +13; other docs/architecture-handoff/pre-existing-changes.txt, docs/preview/display-appearance-0.7.1.1163/capture.mjs +8 |
| `session-resume-smoke.mjs` | session-resume-smoke — headless check of host disk-resume: a live | docs docs/MULTIPLAYER.md |
| `session-smoke.mjs` | session-smoke — headless check of the authoritative co-op session | tools gracerefill; docs docs/MULTIPLAYER.md, docs/framework-migration-checklist.md |
| `session.mjs` | (no header comment) | tests ability-combat-entry, ability-draft-receipts, boss-tiers +31; tools arcane-exposure-engine, armament-smithing, contentreach +17; docs SPEC.md, docs/FINISH.md, docs/MULTIPLAYER.md +2; other docs/design/class-armor-rear-2026-10-06/sources/loadout.js, src/content/cards/coop.js +15 |
| `settings-defaults.mjs` | settings-defaults — promote a settings profile to the build's defaults. | docs docs/SETTINGS-REVAMP.md; other src/content/settingsDefaults.js, src/main.js +1 |
| `settingsreach.mjs` | settingsreach — can a tired human find the settings section they | tools artifact-provenance; other src/ui/screens/settings.js |
| `sfx-filename-convention.mjs` | Focused door for #47: SFX files bind by assets/sfx/<id>.ogg without a | tools art-source; docs DEVELOPER.md, docs/ART-REPO-PLAN.md, docs/EXTERNAL-ASSETS-PLAN.md |
| `sfx-gain-probe.mjs` | sfx-gain-probe — headless gain-target inspection for the SFX | tools sfx-filename-convention, sfx-loudness, webaudio-stub |
| `sfx-loudness.mjs` | sfx-loudness — deterministic A-weighted loudness of every SFX | tools holdbeat; docs SPEC.md; other src/content/sfx.js |
| `shopbars.mjs` | shopbars — THE MERCHANT IS A CATEGORY RAIL, AND EACH ITEM ANSWERS | tools foldsurvivors, plantsites-baseline.json |
| `short-landscape-support.mjs` | short-landscape-support — #27's short-wide combat composition. | tools plantsites-baseline.json, uprightgate; other src/content/balance.js |
| `shotReady.mjs` | shotReady — "is every combatant's artwork on screen yet?", asked | tests shot-ready; tools screenshot; docs docs/FINISH.md; other docs/preview/display-appearance-0.7.1.1163/capture.mjs |
| `shotguard-probe.mjs` | shotguard-probe — prove, in a real browser, that a ?shot= boot cannot | wf ci; other src/main.js |
| `sigil-medallion.mjs` | The chosen sigil is drawn on the figure, on every style that draws a figure. | other src/ui/assets.js |
| `simbot.mjs` | simbot — what the simulator bots may play, asked of the engine. | tests ability-riders, base-card-pack, card-cost-fastpath +11; tools balance, combat-expansion-smoke, coop-combat-smoke +4; docs DEVELOPER.md |
| `simrun.mjs` | (no header comment) | tests simbot-decisions, simrun-loop; tools measure-classes, runsim; docs DEVELOPER.md, SPEC.md, docs/FINISH.md +1 |
| `slot-load-door.mjs` | The in-run Load door, driven in the real page (SPEC §3.12, §9 M2). | wf ci; tests slot-load-focus; tools plantsites-baseline.json; docs DEVELOPER.md, docs/FINISH.md; other src/main.js |
| `sound-opening.mjs` | Browser regression (review of #1472): a FRESH fight sounds its opening draw | docs DEVELOPER.md, docs/FINISH.md; other src/main.js |
| `stance-combat-qa.mjs` | Actual-screen screenshot QA for the stance/accuracy HUD. All UI is rendered | wf ward-to-block-cards; docs docs/STANCE-COMBAT-QA.md |
| `starseer-spell-reactions-qa.mjs` | Real standalone HTML input. Fixtures use canonical engine enemies and cards; | docs docs/preview/starseer-spell-reactions/README.md |
| `starter-card-art-browser.mjs` | Run against serve after fetching the pinned art release. | docs docs/preview/starter-card-art/README.md |
| `starting-equipment-qa.mjs` | (no header comment) | docs docs/COMPONENT-CATALOG.md, docs/preview/starting-equipment/README.md |
| `startup-gate.mjs` | Issue #229 — the cold boot belongs to the startup gate until one complete | wf ci, dev-preview; tests doorplant-shard; tools plantsites-baseline.json, settingsreach; docs DEVELOPER.md, docs/EXTERNAL-ASSETS-PLAN.md, docs/preview/issue-229-startup-gate-build-1305/README.md |
| `status-presentation-authority.mjs` | Status instance presentation authority. Names and mechanic fields never | tools plantsites-baseline.json |
| `statusreach.mjs` | statusreach — CAN A PLAYER EVER MEET THIS STATUS? | tests run-node, statusreach-expansion, statusreach-stance; tools contentreach |
| `style-lint.mjs` | tools/style-lint.mjs — a ratchet on raw sizes, layers and colours in styles/*.css. | tests run-node, style-lint; docs DEVELOPER.md |
| `surfaces.mjs` | surfaces — is every navigable surface DECLARED IN DATA also HANDLED? | tests config-migration, run-node; tools gatelist, screen-census; other src/config/authored.js, src/main.js +1 |
| `swap-cost-relic-surface.mjs` | swap-cost-relic-surface — ARM 2 of MR-41 (as amended by MR-46): | tools equipment-surface-receipts, plantsites-baseline.json; other src/model/equipmentPresentation.js |
| `swap-row-reads.mjs` | swap-row-reads — Sunna, 2026-08-15. | tools equipment-surface-receipts, plantsites-baseline.json |
| `sync-alternatives.mjs` | Merge a promoted test snapshot into existing alternative pairs. No force | wf sync-alternatives; tests alternative-branches |
| `tapsize.mjs` | tapsize — does Minimum tap size actually move the floor, on glass? | tests engine.test.js; tools flaskbox, hud-quick-compact, mapreach +4; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/ui/screens/settings.js +1 |
| `testnumbers.mjs` | testnumbers — NO TWO TESTS WEAR THE SAME NUMBER. | tests run-node; tools plantsites-baseline.json |
| `tokens-css.mjs` | tools/tokens-css.mjs — publish the design tokens in content/config/ui/tokens.json as CSS custom properties. | tests run-node, serve-watch, tokens-css; tools launch, serve; docs DEVELOPER.md; other index.html, styles/tokens.generated.css |
| `text-geometry.mjs` | text-geometry — Law 4: Text size owns text, not component geometry. | tools plantsites-baseline.json |
| `textfit.mjs` | textfit — THE GATE FOR "NOTHING BLEEDS", MEASURED ON A REAL PAGE. | tests card-presentation-levels |
| `title-new-slot.mjs` | Focused acceptance for QA remediation #2: New Game keeps the selected empty | tools plantsites-baseline.json |
| `tooltip-review-qa.mjs` | (no header comment) | docs docs/preview/concise-card-tooltips/README.md |
| `tray-components.mjs` | Focused browser gate for the shared four-edge Folding Tray component. | docs DEVELOPER.md, docs/TRAY-COMPONENTS.md |
| `tutorial-reach.mjs` | tutorial-reach — can a real player finish (or skip) the first-run | wf ci, tutorial-reach; tests run-node, tutorial-reach-stability; tools actionreach, gatelist, mobilefit +4; docs DEVELOPER.md, docs/FINISH.md; other src/main.js |
| `twin-sword-animation-browser.mjs` | (no header comment) | docs docs/EQUIPMENT-ANIMATION-REFERENCES.md |
| `ui-components.mjs` | Reusable UI component contract: stable semantic ids, one shared Map/Combat | tests run-node, ui-component-catalogs; docs DEVELOPER.md, docs/FINISH.md, docs/RELEASE-CHECKLIST.md +1 |
| `ui-sweep.mjs` | ui-sweep — THE CONTACT SHEET, AND THE FACTS IT WAS TAKEN FOR. | tools plantsites-baseline.json; docs DEVELOPER.md, ui-studio/README.md |
| `ui-validate.mjs` | Validates the JSON UI layer (engine/ui/components, games/<game>/ui/screens) and writes engine/ui/index.json. | tests ui-json; tools build-game; docs engine/ui/README.md; other package.json |
| `uistrings.mjs` | uistrings — THE COPY RATCHET. How many sentences does the | tests run-node; tools uistrings-baseline.json; docs DEVELOPER.md, docs/FINISH.md, docs/RELEASE-CHECKLIST.md; other docs/architecture-handoff/wireframe-gallery.html, src/ui/components/piles.js |
| `unarmed-animation-import.mjs` | (no header comment) | tests unarmed-animation, unarmed-magic; docs docs/EQUIPMENT-ANIMATION-REFERENCES.md |
| `uniform-stat-foldouts.mjs` | Focused rendered-browser contract for the primary-stat foldouts. | docs CHANGELOG.md; other docs/design/battlefield-options-2026-10-16/visual-preview.html, src/content/changelog.generated.js +1 |
| `update-architecture.mjs` | Refresh the current-dev architecture inventory without rewriting the core | wf alternative-sync, architecture-sync; tests alternative-branches; tools sync-alternatives; docs docs/ARCHITECTURE-CURRENT-DEV.md, docs/ARCHITECTURE-MAP.md, docs/ai/session-continuations/2026-10-08/combat-mechanics-and-formulas-status.md; other docs/architecture-handoff/source-map.json, src/ui/services/saveJsonFile.js |
| `uprightgate.mjs` | uprightgate — R-32's machine check. A SHAPE THE BOARD DOES NOT FIT | tools about-changelog, holdconfirm, plantsites-baseline.json +1; other docs/architecture-handoff/pre-existing-changes.txt, src/content/balance.js +2 |
| `urlpath-conversions.mjs` | Reject hand-rolled conversion between module URLs and filesystem paths. | tests run-node; tools sigil-medallion |
| `veil-owns-input.mjs` | veil-owns-input — WHILE A VEIL IS STANDING, THE SCREEN BENEATH IT | tools holdconfirm; other docs/architecture-handoff/wireframe-gallery.html, src/ui/components/resbars.js +2 |
| `verdict.mjs` | verdict — THE CI DOOR. A TOOL'S SILENCE IS NOT ITS SUCCESS. | wf ci, coop-hud, dev-preview +6; tests fixtures/verdict/silent_exit_zero, fixtures/verdict/vacuous_green, receipts-pr; tools about-changelog, card-drag-targeting, displayfirst +17; docs DEVELOPER.md, docs/RELEASE-CHECKLIST.md, docs/architecture-handoff/CURRENT-SOURCE-AUDIT.md +2; other src/ui/components/card.js |
| `verify-external.mjs` | verify-external — verify the DE-INLINED build: that the packs the | wf dev-preview; tools assetmime, bundle, external-play +2; docs DEVELOPER.md, dist/README.md, docs/ART-REPO-PLAN.md +2; other src/ui/assetPacks.js |
| `verify-shipped.mjs` | verify-shipped — verify the file a PLAYER is handed, not the file the | wf ci, dev-preview; tests fixtures/verdict/vacuous_green; tools bundle, dirorder, gatelist +10; docs CHANGELOG.md, DEVELOPER.md, SPEC.md +15; other docs/preview/display-appearance-0.7.1.1163/capture.mjs, editor/server.mjs +1 |
| `ward-to-block-card-text.mjs` | (no header comment) | wf ward-to-block-cards |
| `ward-to-block-cards-qa.mjs` | Capture six production card surfaces before and after opening their real inspector. | wf ward-to-block-cards |
| `watched-selftest.mjs` | watched-selftest — the known-bad corpus for watched. | tools watched |
| `watched.mjs` | watched — did anyone OPEN THE BUILD and SEE the control? | tests run-node; tools watched-probes.json, watched-selftest |
| `weapon-card-packages.mjs` | (no header comment) | tests closedsets, run-node; tools closedsets; other src/engine/combatSnapshot.js, src/engine/save.js |
| `weapon-card-preview.mjs` | Real Chromium coverage of every canonical armament through the production renderer. | tests card-door-stack; docs DEVELOPER.md, docs/COMPONENT-CATALOG.md, docs/FINISH.md +1 |
| `webaudio-stub.mjs` | webaudio-stub — the ONE minimal WebAudio stub the headless audio | tests music-folder-race, music-region, music-tiles-index; tools music-bed-gain-probe, music-silence-probe, music-toggle-parity +2; other src/ui/components/card.js |
| `weightclass-census.mjs` | weightclass-census — the Weight Class A/B evidence instrument. | docs docs/framework-migration-checklist.md; other content/framework/mechanics.json, src/framework/data/mechanics.js |
| `workbench-static.mjs` | workbench-static — builds the Workbench as a static site for GitHub Pages. | wf pages-builds; tests workbench-static; tools linkcheck; docs workbench/README.md |
| `workflow-lint.mjs` | workflow-lint — THE DOOR CANNOT SEE THE WIRING ABOVE ITSELF. | wf ci; tests fetch-art; tools gatelist, verdict; docs DEVELOPER.md, docs/RELEASE-CHECKLIST.md |
| `world-atlas-data.mjs`, `world-atlas-qa.mjs` | (no header comment) | tests world-atlas; tools content-build; docs docs/WORLD-ATLAS.md, docs/workbench/CONSOLIDATION.md, docs/COMPONENT-CATALOG.md +1 |
| `zip.mjs` | zip — a deterministic zip writer and a small reader, no dependencies. | tests fetch-art, offline-zip; tools art-manifest, buildversion, fetch-art +1; docs DEVELOPER.md, docs/EXTERNAL-ASSETS-PLAN.md, docs/offline-play.md; other src/model/offlineDownload.js, src/model/zipStream.js |
| `zoomplace.mjs` | zoomplace — do the cursor-anchored overlays land ON the cursor, at | tests run-node; tools gatelist, mobilefit, plantsites-baseline.json +1; docs SPEC.md; other src/ui/fx.js |
| `zoomunits.mjs` | zoomunits — one coordinate space, one home. | tests fixtures/verdict/silent_exit_zero, run-node; tools zoomplace; other src/ui/fx.js |

## Attic — unreferenced tools moved to tools/attic/ (owner, 2026-10-17) (71 files)

These 71 tools were moved to `tools/attic/`, not deleted: no tracked file outside the tool names it (no workflow, test, launch, doc or tool). A tool is brought back by `git mv tools/attic/<name> tools/<name>` plus a row in the table above. Nothing in CI runs from `tools/attic/`.

| Tool | First header-comment line |
| --- | --- |
| `actionregistry-destinations.mjs` | Focused source contract for remediation #7. The ActionRegistry owns only |
| `arcane-exposure-engine.mjs` | arcane-exposure-engine — observed-red host engine contract. |
| `arcane-exposure-schema.mjs` | arcane-exposure-schema — observed-red schema/carrier contract. |
| `arcane-exposure-ui.mjs` | Observed-red UI contract. Both combat surfaces consume host-owned snapshots; |
| `arcane-exposure-visual.mjs` | Arcane Exposure visual truth: source/dist x solo/co-op x 320/390. |
| `armament-equip-flow-qa.mjs` | Real Chromium pointer/touch checks of the production Armoury. |
| `armament-kits-qa.mjs` | (no header comment) |
| `armament-smithing.mjs` | Issue #211 — deterministic, non-writing acceptance gate for run-owned |
| `armoury-inventory-disclosure.mjs` | Focused door for Constantine's 2026-08-23 Armoury disclosure correction. |
| `art-runtime-check.mjs` | Capture real event, speaker, and combat-card screens after their art loads. |
| `attribute-phase1-boundary.mjs` | Attribute integration boundary after the approved derived/equipment slices. |
| `bjclauses.mjs` | bjclauses — re-derive Constantine's eight D17 map clauses against |
| `bow-animation-config.mjs` | Rebuild the bow presentation bindings from the authored unarmed outfit sets. |
| `card-effect-layers-check.mjs` | (no header comment) |
| `card-effect-art-check.mjs` | Real browser evidence for the refreshed registry, gallery and card activations. |
| `card-flick-pointer-qa.mjs` | Native browser pointer streams: no supplied timestamps or DOM-dispatched events. |
| `card-hold-targeting-qa.mjs` | Rendered regression for issue #1171: hold a targeted card, then choose the |
| `card-removal-flick-qa.mjs` | Browser plugin unavailable: production screens exercised with Playwright. |
| `card-use-qa.mjs` | Actual selected-card inspection and hold-to-use flows, desktop and touch. |
| `class-book-browser.mjs` | (no header comment) |
| `class-material-leaks.mjs` | class-material-leaks — catch cross-class material leaks statically. |
| `combat-attached-details-qa.mjs`, `combat-card-stability-qa.mjs`, `combat-formation-qa.mjs`, `combat-ground-qa.mjs` | (no header comment) |
| `combat-header-qa.mjs` | Verify real rendered header geometry and health after an authored enemy turn. |
| `combat-sprite-selection-qa.mjs` | Real selection inputs exercise the visual emphasis without changing the |
| `combat-target-clarity-qa.mjs` | Real combat targeting and stature regression; uses production renderer, art and input. |
| `combatant-stage.mjs` | Rendered contract for the combat battlefield's vertical safe corridor. |
| `configured-shot-qa.mjs` | Screenshot fixtures must mount the surface named by ?shot, even when the |
| `configured-ui-qa.mjs` | (no header comment) |
| `controlstrip.mjs` | controlstrip — DOES THE SCREEN TELL THE TRUTH ABOUT ITS CONTROLS? |
| `creation-flow-qa.mjs` | Focused runtime flow checks using production content/renderers, without gameplay mocks. |
| `cross-class-equipment.mjs` | Observed-red contract: cross-class equipment requirements and card fit. |
| `current-build-ui-repair.mjs` | #045/#046 current-build acceptance: real rendered title/combat geometry and |
| `defeated-targets.mjs` | Rendered regression: a retained defeated frame cannot consume targeting. |
| `dialogue-hud-fit.mjs` | dialogue-hud-fit — THE W4c HUD IS READABLE, ON EVERY SCREEN. |
| `equipment-stat-isolation.mjs` | Observed-red contract: representative DEX weapons and five-stat ownership. |
| `flask-data-authority.mjs` | Data-authority contract for capacity, charge identity, and Grace labels. |
| `friendly-target-parity.mjs` | Focused source door for issue #209. The selected standalone door is added |
| `guard-float-parity.mjs` | Focused guard-hit parity gate (#207). |
| `inspect-one-click-browser.mjs` | Real-browser regression for one-press inspection (owner, 2026-10-13: a visible |
| `layoutmode.mjs` | layoutmode — #39's focused browser witness. |
| `level-semantics.mjs` | Focused pure-model gate for issue #237. |
| `level-up-flow-qa.mjs` | Real Chromium interaction checks of production progression and Character UI. |
| `map-pan-ownership.mjs` | Issue #40: with two-axis map dragging disabled, the browser owns touch/pen |
| `map-route-probe.mjs` | Live map history layout and destination-inspection regression probe. |
| `merchant-offers-browser.mjs` | Production merchant renderer and transactions, on a disposable preview visit. |
| `mobile-card-check.mjs` | Touch regression checks for selection, confirmation, cancellation and detail text. |
| `mobile-readability-qa.mjs` | (no header comment) |
| `modal-keyboard-check.mjs` | Real keyboard regression checks for shared modal tabs and nested focus. |
| `painted-items-check.mjs` | Run against serve; Playwright must be available to Node. |
| `painted-items-ship.mjs` | Rebuild inventory-size WebP assets from the preserved painted PNG masters. |
| `painted-outfits-check.mjs` | Browser integration check. Start serve on port 4277 first. |
| `pairsweep.mjs` | pairsweep — the settings door, walked: named high-risk pairs of |
| `pointbuy-preview-check.mjs` | Run against a rebuilt preview server; Playwright must be available to Node. |
| `presentation-matrix.mjs` | Final phone presentation contract: source/dist x Grace/creation/Armoury x 320/390. |
| `reaver-attack-playtest.mjs` | Real-browser smoke for the painted Reaver sequence: play an actual Strike, |
| `reward-confirm-qa.mjs` | (no header comment) |
| `reward-new-badge-qa.mjs` | Browser gate for the reward-card status stack: NEW sits above the card and |
| `reward-xp-sequence-qa.mjs` | Real-browser reward presentation probe using the production mount and styles. |
| `sfx-authority-contract.mjs` | Issue #67: played ids and authored SFX rows are one two-way authority. |
| `skill-book-shop-browser.mjs` | Real renderer, real purchase plan/commit, disposable visit (no user saves). |
| `starting-abilities-qa.mjs` | (no header comment) |
| `starting-kit-discovery.mjs` | Observed-red contract: profile-owned starting-kit discovery without spoilers. |
| `sword-shield-animation-browser.mjs` | (no header comment) |
| `textsize-baseline.mjs` | textsize-baseline — #53's browser witness. |
| `tooltippersist.mjs` | tooltippersist — E8: the tooltip stays up until something replaces |
| `unarmed-animation-browser.mjs` | (no header comment) |
| `uprightsetting.mjs` | uprightsetting — BOTH EDGES OF HIS AMENDMENT TO THE UPRIGHT GATE. |
| `viewport-units.mjs` | viewport-units — Law 2's detector for viewport-constrained UI CSS. |
