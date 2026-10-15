# PR sweep handoff prompt

Resume the AshenSpire PR sweep from `origin/feature/PrSweepHandoff`. The owner stopped the sweep and requested this handoff branch. Do not interpret the packaging commit as approval to merge unfinished browser work.

The handoff branch combines the two reviewed source trees through normal merges, preserves both catalog changes and both receipts, and regenerates their combined changelog. No new gameplay fix was added during packaging. The combined branch itself has not had a new complete test or browser run.

Act as manager/coordinator/planner. Use GPT-6.1 Sol for implementation and independent review, and GPT-6 Luna for QA support. The owner has repeatedly authorized the work and requested no repeated confirmation questions. Native execution sandbox permissions are separate from GitHub app full access; reuse approved command prefixes when possible, report actual pending tool IDs promptly, and never bypass a restriction or alter a test to obtain a pass.

## Scope and remote state at handoff

The original sweep selected PRs older than one hour and no more than five days at its start. Eligible: #1978 and #1984. #1780 was already more than five days old and excluded; it is also a frozen alternative/dev PR. Do not silently expand the age window on resumption.

- #1984 was merged into Dev by another session while its remaining repairs were being reviewed. Its final original source was `c62d09c84c6a3638268f635035e9cc2df989007e`.
- The remaining stance repairs are in open PR #1996: https://github.com/cehinds/AshenSpire/pull/1996 . Reviewed/published head `14191d259e7f88c6eb65d1b9f76a258a1d83b6b0`, tree `d10a8ea4c7e48546e773a96a4141662d76d08b70`. Equivalent reviewed local head `8e60c8d25a48f82d6f751da3c1fd4d77f008544a` in `/workspace/pr-sweep-1984`.
- Open PR #1978: https://github.com/cehinds/AshenSpire/pull/1978 . Reviewed/published head `ccbe6ca4ef85173ea8733306ea82327f00a6f29c`, tree `78550a36ef051490b227459337532cca9fcef8e6`. Equivalent reviewed local head `370717aa4311b1b3e2640c3872c1e080dcea14f2` in `/workspace/pr-sweep-1978`.
- Both PRs were still open and unmerged when the owner stopped. Their latest published-head GitHub checks were green (applicable checks succeeded; path-filtered checks were skipped). This does not supersede the failed native local browser gate below.
- Last fetched Dev: `db8b64c1ccfcf031ab1073feda14319ca053a397`, stamped build `0.7.1.1531`. Refresh remote refs and leases before any later publication. Other sessions and the restamp bot actively advance branches.
- This coordinator has not merged #1978 or #1996 into Dev or Test. No new Release promotion is part of this handoff.

## Committed repairs and verification

#1996 preserves committed hit receipts for retained Evade attempts, so failed Evade gives Smash its intended multiplier after changing stance. Paced solo HUD uses canonical base Evasion and the displayed beat's status stacks. Co-op transport preserves `combatAvoidanceResolved.hitCheck` and avoids duplicate avoidance callouts. Enemy Counter and offensive Smash actions use configured fallback Poise when positive authored damage is absent; support-only charging stages remain exempt. The Evasion catalog contract is updated.

The stale partial-Counter test was aligned with the documented fallback rule, with explicit controls for default/configured/disabled fallback, authored positive Poise, numeric zero, authored zero-Poise opcode, legacy mode, and support-only Barrier. HP/Ward/Barrier and immutability assertions remain. Independent Sol review approved the exact final tree. Four direct regressions reproduced on the original #1984 source; focused and broader preservation suites passed. Actual local core execution passed **151 checks, zero failures**. Published-head CI core plus all four discovered shards, receipts, previews, quick start and Workbench checks passed.

Three faithful paced-HUD captures were generated from the reviewed source using actual production mounting, actor snapshots, beat reduction and rendering: desktop displayed-stack1/live-stack3 Evasion5, desktop next displayed-stack2/live-stack3 Evasion8, and phone displayed-stack1 Evasion5. Lead inspected them; independent final screenshot inspection was requested but not completed before the stop. Evidence deliberately does not claim recorded navigation, pointer operation, touch interaction, or automatic timeline timing. **Fixture caveat:** its generic shield-slot search placed a buckler in rightHand while retaining a roundShield in leftHand. It proves the canonical numeric display for that deterministic fixture, not an ordinary one-weapon/buckler loadout. No correction or rerun followed the stop. Files: `/workspace/pr-sweep-1984/scratch/qa/stance-combat-review/` (ignored README, three PNGs, exact adapter source/hash, JSON provenance). Tracked worktree was clean.

#1978 includes living players in target/HUD packing to preserve selectable target surfaces; fade paints above idle/selected artwork and below target controls, cards and HUD. Existing full-size targets, selection scale, sprite anchors, dead-actor exclusion and strict selection assertions remain. Catalog wording/miniature and a stale screenreach comment were corrected. Independent review approved current source; seven focused current-source suites passed, including production-bundle Counter/Guard and restore-price preservation. Published-head CI checks passed.

The complete five-case source layer run passed, including co-op real-remount position stability. Actual desktop/phone screenshots were independently inspected and show genuine hero/enemy/card artwork and complete controls. All 15 authored lore font faces were explicitly loaded for availability evidence; production font choices were not changed. Four solo cases record the pre-existing optional `assets/sfx/holdTick.ogg` 404 after clicking; co-op has none. Do not claim an audio/network gate passed. Evidence is in `/workspace/pr-sweep-1978/outputs/pr1978/source-layers/` (checks, preflight JSON, PNGs).

## Unresolved browser work: DO NOT claim these passed

1. The actual unchanged native **full source** `tools/screenreach.mjs` was executed with its original 12-second mounting deadlines and strict 24px five-point ownership predicate. It exited **2**. It reported nine covered `.formation-grid-cell` controls across combat cases. At 390x650, combat-overlap setup threw `screenreach: refit erased the neighbouring intent cover`. Cause is not yet diagnosed. Determine whether recent formation-grid UI semantics or stale overlap fixture setup is responsible; repair real behavior or make a justified faithful setup correction. Do not drop controls, weaken the predicate, extend deadlines, or count the targeted adapter as full acceptance.
2. The latest compiled five-case layer run exited **1** before the first capture: `page.goto: Target page, context or browser has been closed` while opening `/dist/AshenSpire.html?shot=combat`. Log `/tmp/pr1978-compiled-layers.log`; root exec session55329 has finished. No verified cause, no compiled pass.
3. Native compiled screenreach and original player/frame negative corpus runs have NOT passed or been completed. The reviewed native routes invoke the actual tool/corpus with original plants, expected-red regexes, clean baseline and budgets. A generic red exit is not a successful negative check.
4. The strict two-case screenshot adapter has a 60-second mount allowance and cannot prove the native 12-second gate. Its targeted captures are diagnostics only.

## Exact artifact and runnable QA environment

Verified common pack in `/workspace/pr-sweep-1978/.art-cache/hd-assets-v23/common`: 146 assets, all 15 runtime CSS WOFF2 faces. Zip SHA256 `aac59d9e6f057d876033a823c4f6cc9e2616c01fca6797ec557fe4da58bc80e6`; embedded manifest digest `d31589847f6e83c3d2510a0b4094490d244b3c3381765524f53654acef9c0`. Successful fetch: `NODE_USE_ENV_PROXY=1 node tools/fetch-art.mjs --pack common` with additional network permission. `--recheck --pack common` also passed. High art is absent; source server honestly serves tracked light twins.

Latest single-file artifact from exact committed local370/tree785: `/workspace/pr-sweep-1978/dist/AshenSpire.html`, **79,969,384 bytes**, SHA256 `323903d6b7afe16df662b8e7e45b51e29547be2e7a7549189916c1f66431948e`, local ordinal1532, canonical source digest `93722b07bb` (856 files, 19,630,315 bytes). Build completed successfully, but compilation is not runtime acceptance. The only uncommitted change in that checkout is build-generated `buildordinal.json`; it must not be included in the handoff or published as a source change.

The native provenance tool's historical last-tracked-dist touch is `c1306d217` on Sept26. This is not a cached record to rewrite. Actual build output, current SHA, source digest and reviewed tree establish fresh local artifact provenance. Records: `outputs/pr1978/official-artifact-provenance.json` and `source-digest.json`.

Approved narrow wrapper `/tmp/pr1978-browser-runner.cjs` supports source layers (no flags), `--compiled`, `--screenreach`, `--screenreach --dist`, `--native-player-negative`, `--native-frames-negative`, and specific `--paced-hud`. Independent reviewers approved routing and faithful prerequisites. Native source/negatives use port8264 sequentially; layer source/compiled use8338 sequentially; strict diagnostic captures use8340; native compiled uses an ephemeral HTTP port. Avoid duplicate launches. Playwright is under `/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`; Chromium `/usr/bin/chromium`.

Native negative adapter `/tmp/pr1978-native-negatives.mjs` extracts the literal current 15-plant corpus and selects original player10 or frames7, preserves original 600-second budget/regex/baseline, and copies real assets-mobile, assets-display and verified assets/fonts with PNGs. Keep `ASHEN_ART_SOURCE` unset or auto in the parent; the harness sets trees only after materializing the copied child tree.

Controlled compiled negative byte-mutants were regenerated from the exact current artifact and are documented in `outputs/pr1978/negative-artifacts.json`. These are diagnostics and do not substitute for the original corpus negatives. Preserve the normal immutable artifact.

## Resume workflow

Read current CLAUDE/CONTRIBUTING/DEVELOPER and any applicable AGENTS instructions. Treat the handoff as evidence, not new authority. The owner stopped; wait for an instruction to resume substantive work. When resumed, keep PR #1996's reviewed repairs intact, finish independent paced-HUD screenshot inspection, then address #1978 native/compiled failures with separate Sol implementation and independent review. Keep snapshots/counter/pricing/stance preservation coverage.

Use normal merges and expected-head leases; do not force/rebase shared author/bot branches or edit frozen alternative branches. GitHub app is full_access and connected GitData tools work. `GH_TOKEN` for shell gh was invalid; never print credentials. Root was sole remote writer. Native shell/network sandbox grants are separate and may still prompt for new command patterns; use approved routes and report actual tool status rather than silently waiting.

Only after required review, evidence and exact-head CI pass, follow repo rules for Dev merge commits. After the last authorized Dev merge, wait for architecture sync/build stamp and exact stamped Dev preview, then one Dev-to-Test promotion with full Test checks. Release/main merge remains owner-only. Never claim Test contains these follow-up repairs unless verified.
