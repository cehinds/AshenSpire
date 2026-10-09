# Combat expansion: verified checkpoint and remaining delivery

- **Objective remains open**
  - Implement the accepted combat notes in one delivery and make them playable on `dev`, `test`, `alternative/dev`, and `alternative/test`.
  - Preserve current art, animations, all card effects, readable bottom action labels, inspection, multiplayer ownership, and old saved runs.
  - This is a recoverable feature checkpoint, not completed promotion or owner/device acceptance.

- **Repository and source**
  - Repository: `cehinds/AshenSpire`. Command checkout: `D:/repos/.codex/worktrees/combat-expansion-runtime/AshenSpire`.
  - Regular branch: `codex/combat-promotion-polish-20261008`; reviewed source commit `2934beab9d2e517f9d9ff031299bc3cc9c40a62c` was pushed with upstream tracking and verified against `git ls-remote`.
  - The current documentation/build-metadata checkpoint follows that source commit. Fetch the named branch and compare its actual origin tip; a document cannot contain its own future commit hash.
  - Alternative branch: `codex/combat-expansion-alternative-20261007`, checkout `D:/repos/.codex/worktrees/combat-notes-alternative-sync-20261007`; reviewed source `3b7921f4b68e1743cf10a920768b281a7b34a6e7`, followed by tracked checkpoint notes. Its pushed origin tip `f082ea2657ab83c9f8f046b5e44560be3f87729c` was independently verified with `git ls-remote`; #1740's head matches that checkpoint.
  - Last observed shared refs: dev `c47f54d42dd04505b60ac6b478b314788a440ffe`; test `11fbaff51cd32d03166027c76611739b8b9fcf00`; alternative/dev `43221ee66f80055580dfe640418cac37137945f1`; alternative/test `e7a16d7850678016be02bd3dce3d7b2001cce6db`. Re-read origin before merging.
  - Subsequent read/fetch observed dev `f785dc0eb1271ae03849f00c165d0645dca308f0`: [#1763](https://github.com/cehinds/AshenSpire/pull/1763) added the v15 Molten River art/material and its own receipt, followed by architecture sync. It is not yet inherited in source2934/preliminary1151. Reconcile it normally before final regular validation, preserve its receipt and the stronger full-card corrupted trim.
  - Primary `D:/repos/AshenSpire` and other chats' checkouts remain untouched.

- **Implemented inventory**
  - The expanded runtime already landed through earlier PRs, starting with [#1723](https://github.com/cehinds/AshenSpire/pull/1723). Do not duplicate it.
  - New runs carry version 2; existing saved version-1 runs retain their saved rules.
  - Martial/Spell camps, maintained stance, Attack/Defend/Counter/Sweep/Ranged/Smash, schools, typed damage, equipment/range/area tradeoffs, Evade, persistent Ward, Poise, status buildup/recovery, combos, deck hooks, Upcast, and Ashen Blight are source implementations.
  - Power exhausts the paid card instance and keeps installed buffs for combat; Skill normally reuses through discard/shuffle; deck Status cards are separate from active status gauges and recovery controls.
  - Hidden intents, Perception, and staged Bestiary progression are in the enemy-knowledge modules and contract.
  - Current local polish: typed HP damage words, exact per-contact previews, stable hand-viewport fighter anchors, finite player tap areas, upward enemy target packing, complete action-band measurement, and static formula projection with live-value precedence.
  - Future named Scry/Patient Duelist/relic ideas are suggestions, not shipped content. The reaction-runtime PR below is separate unfinished integration.

- **Authoritative files**
  - Read [the implementation contract](../../../combat-expansion-contract.md), [the bullet notes](../../../combat-cards-expansion-proposal.md), [card design](../../../combat-cards-design.md), [enemy knowledge](../../../enemy-knowledge-contract.md), SPEC, CONTRIBUTING, and DEVELOPER.
  - Content: `src/content/combatExpansion*.js`, `combatStatusRules.js`, `combatSigils.js`, `ashenBlight.js`, `enemyKnowledge.js`.
  - Runtime: `src/engine/combatExpansion*.js`, `combatStatusControl.js`, `ashenBlight.js`, `enemyKnowledge*.js`; model: `combatExpansionRules.js`, `combatCardProfile.js`, `upcasting.js`, `perception.js`, `enemyKnowledge*.js`.
  - Polish: `src/model/formulas.js`, `playingCard.js`, `src/ui/components/card.js`, `battlefieldStage.js`, `src/ui/models/CombatOverheadModel.js`, `styles/combat.css`.
  - Constant projection proves finite add/multiply trees and uses the canonical evaluator once. Only supported stack formulas receive descriptive text; unknown/context formulas are never guessed as zero. Overflow and prototype refs fail closed. Canonical engine arithmetic is unchanged.
  - Explicit preview tokens take priority over matching live values, then authored quantities. Zero remains valid. Symbolic quantities are escaped; only numeric quantities receive up/down comparison styling.

- **Verified checks and boundaries**
  - Independent source review clear at formula SHA256 `538ed67488bdcdb0a8a71773ca92c96c702331bb697a75835ba4e21994e01c17`, model `c20406c2995d3d27702cc08b9cf5f77d9bc76a6110bce1f7f12436f2bbaf66d6`, renderer `5cd9a700feabb8de58f17ac8439874439087cb380e83a1d1adb408d10d309e20`.
  - `node --test tests/static-card-formulas.test.mjs`: six tests pass, zero skips. Includes all 1,093 authored card variants, real grade refs, nested fractions/clamps, unknown context, overflow, invalid entity refs, live zeros/overrides, and HTML escaping.
  - Final reviewed source2934 combined card/formula/field run: **41 tests pass, zero skips**. The earlier35-case log is retained separately; the combined run includes the final formula and guard changes.
  - Exact 86 formerly failing authored faces reproject with no unresolved placeholders. This is source projection, not browser fit acceptance.
  - Official regular preliminary build: `0.7.1.1151`, source digest `2236bdab43`, light download 98,723,033 bytes. `node tools/launch.mjs --build-only` exited 0 and refreshed all four aliases; identity exited 0; shipping passed 12 checks. This is preliminary, with no new root PR receipt yet.
  - Alternative inheritance independently passed 2,020 protected paths, 14 reviewed seams, zero unexpected changes, nine exact v15 pins, 13 exact central seams, and 824 preserved receipt lines. Compositor pacing remains 260 ms. The retained alternative 1155/46b build predates current source and is preliminary.
  - Alternative focused run initially had 28 passes and one missing sparse tracked PNG. Exact clean HEAD files were restored, and the stance identity recheck passed; retain the original failure as diagnosis, not a semantic failure or silent skip.

- **Simulator failure and passing retry: preserve the policy**
  - Local `node tests/run-node.mjs --no-selftests --no-discovered` exited 1: **148 passed, 1 failed**. `runsim 5` hit `ETIMEDOUT`/SIGTERM at its existing 120,000 ms limit after Reaver/Starseer/Rogue; no final RESULT was produced.
  - Simulator, bot, run loop, engine and timeout wrapper have zero diff from both previously passing source refs. [Original #1742 core CI](https://github.com/cehinds/AshenSpire/actions/runs/37869451355/job/113623908963) and [later dev core CI](https://github.com/cehinds/AshenSpire/actions/runs/37873946565/job/113638068894) reported all 20 seeded runs, zero crashes/soft-locks, and 149/0 core verdicts. The first run ID was checked through the exact job API.
  - Resource investigation observed 100% CPU on eight logical processors, overlapping bundles and a four-worker discovered suite, 15 GB free memory and disk queue 7. Sampling supports contention; it does not prove the exact scheduling cause of the failure.
  - A single retry at reviewed source2934 passed in **84.403 seconds** under the unchanged120s wrapper: exit0, all20 runs, exactly one RESULT, zero crashes/soft-locks. Seven source hashes stayed unchanged. A foreign builder began8s after the initially quiet start, so this is a quieter retry, not a fully quiet benchmark.
  - Preserve both receipts. A passing isolated gate does not turn the earlier whole-suite invocation into149/0; a fresh full current-head suite/CI remains pending. Never raise the budget, remove watchdogs or accept partial output.

- **Git-preserved evidence and reproducible tools**
  - [Checkpoint evidence](../../../qa/combat-promotion-polish-20261008/checkpoint-evidence.json) inventories copied logs, reviews, hashes and drivers. Built HTML, cache files and private profiles are deliberately not tracked.
  - Historical regular 1148 captures remain under `docs/qa/combat-card-presentation/regular-final-1148/`; they verify earlier source, not these new formula/target fixes.
  - Standard source probes remain in Git: `tools/card-sigils-qa.mjs`, `screenreach.mjs`, `mobilefit.mjs`, `motion-probe.mjs`, `combat-expansion-smoke.mjs` and the other combat QA tools.
  - Copied compiled drivers are under `docs/qa/combat-promotion-polish-20261008/drivers/`. They preserve original assertions/waits; only the root worktree gains a `COMBAT_QA_ROOT` override.
  - Full Counter/Upcast driver checks four shapes and actual session-generated projected p1/p2 ownership fixtures. These are canned transport snapshots, not live LAN/physical-device acceptance.
  - The strong Counter driver retains raw browser Log messages and fails on unknown errors/warnings. Exact documented light-edition SFX/music fallbacks and browser activation-policy entries are classified and retained, not advertised as clean audio acceptance.
  - The narrow hit-target and reduced-motion drivers collect Runtime exceptions and Network.loadingFailed only. They do not establish full raw-log/HTTP404 health; reduced-motion covers three reduced modes, not normal-motion positive control.

- **Commands for a successor**
  - Work in a named D: worktree; set `TEMP`/`TMP` to a D: temporary folder, `ASHEN_ART_SOURCE=cache` after acquiring and verifying the published pinned art packs, and `CHROME` to the installed Edge executable when default browser detection is unavailable.
  - Build with `node tools/launch.mjs --build-only`; then `node tools/buildversion.mjs --check`, `node tools/verify-shipped.mjs`, `node tools/about-changelog.mjs --check-order`, `node tools/update-architecture.mjs --write` where required.
  - Run `node --test tests/static-card-formulas.test.mjs tests/combat-card-damage-labels.test.mjs tests/combat-card-presentation.test.mjs tests/combat-overhead-anchor.test.mjs tests/combat-composition.test.mjs` and the required full lanes from DEVELOPER. Self-tests which mutate trees need separate checkouts.
  - For the full source corpus, supply fresh `SIGIL_QA_OUT`, clean `SIGIL_SOURCE_SHA`, installed `PLAYWRIGHT_MODULE`, and explicit `CHROME`; run `node tools/card-sigils-qa.mjs`. Keep the existing 120-second boot deadline and all 2,186 faces/four widths/eight Information doors/desktop+phone checks.
  - For copied compiled drivers, set `COMBAT_QA_ROOT`, fresh `COMBAT_QA_OUTPUT`, exact `COMBAT_QA_ORDINAL`, `COMBAT_QA_SOURCE`, `COMBAT_QA_ARTIFACT_PATH` and `COMBAT_QA_ARTIFACT_URL` to the new built file. Serve that checkout with `node tools/serve.mjs --port 8823 --no-open --no-lan` or an explicit chosen port; localhost is only a temporary test endpoint.
  - Set a fresh `COMBAT_QA_WIRE`; unset `COMBAT_QA_SHAPES`, `COMBAT_QA_SOLO_ONLY` and `COMBAT_QA_SESSION_PATH`; run copied `prepare-counter-visual-wire.mjs`, then `built-counter-visual-qa.mjs`. Trim requires explicit `COMBAT_QA_STAGE=preliminary-compiled` or `final-compiled`; reduced motion requires a distinct output and `COMBAT_QA_MODE=setting+os`, `setting`, or `os` for each run.
  - Pinned assets are in the repository manifests/releases. V15 was added safely beside v14 in the shared D: cache; neither the junction nor v14 was replaced. A successor can reconstruct the cache from the pins, without this workstation's ignored files.

- **Integration and promotion still pending**
  - [#1742](https://github.com/cehinds/AshenSpire/pull/1742) merged to dev at `2ea1492325553b8e44e06d7f2467f084837ad28a`; architecture tip was `74fbff9a26e4fd6d7f3c6e5d12a928fe133fd138`.
  - [#1764](https://github.com/cehinds/AshenSpire/pull/1764) promoted to test at `11fbaff51cd32d03166027c76611739b8b9fcf00`. Seven workflow groups passed, but [CI 37870840004](https://github.com/cehinds/AshenSpire/actions/runs/37870840004) failed seven jobs: all reachability shards, mobile/five-layout checks and reduced-motion shard 2/3. Source fixes address observed causes, but fresh exact-head CI is still required.
  - [#1740](https://github.com/cehinds/AshenSpire/pull/1740) remains the existing alternative PR. Do not treat its old published head or stale receipt as the current finished build.
  - Regular polish has no new PR at this checkpoint. Open a ready reviewed PR after current checks; use its actual number for an authored receipt, build then box-plus-one receipt, official changelog projection, rebuild, matching identity/order/shipping gates. Preserve every foreign receipt byte/order; never repoint #1742 or invent #1749's receipt.
  - Normally inherit actual new dev changes before final validation. Overlaps: #1766 card layout/rank, #1767 reaction timing, #1757/rear-sprite target anchors, #1763 regular Blight art. Unmerged WIP is not inherited or claimed shipped.
  - Preserve alternative presentation and receipts during reconciliation. Normally merge the regular accepted source/receipt into the alternative branch, regenerate the official architecture, then perform its own #1740 receipt/build cycle and all five fresh native QA families.
  - Merge only with current required checks green; wait for latest architecture-sync and exact dev tip, then normal dev-to-test promotion. Check all fresh heavy workflow groups and protected alternative sync/promotions. Never force/admin merge or touch release/main/tags.
  - Confirm actual new-run playable publication at `https://cehinds.github.io/AshenSpire/test/latest/` and `/alternative/test/latest/` against the delivered build identities; old previews and queued workflows are not completion.

- **Completion checklist at capture**
  - [x] Source implementation and independent formula/source review.
  - [x] Regular reviewed source checkpoint pushed and SHA verified.
  - [x] Preliminary regular 1151 build, canonical identity and shipping checks.
  - [x] Unchanged simulator retry passes within120s; both pass and earlier failure retained.
  - [ ] Current-head full validation.
  - [ ] Fresh complete card corpus and compiled browser/visual acceptance.
  - [ ] Final regular/alternative receipts, ready PRs, current-head CI and merges.
  - [ ] Fresh regular/alternative test promotion, all heavy CI and playable publication.
  - [ ] Owner playtest and physical-device/live-LAN acceptance.
