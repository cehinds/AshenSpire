# Alternative combat source checkpoint — draft PR #1740

This is a recoverable source checkpoint, not a completed delivery or final compiled acceptance. The named origin branch is `codex/combat-expansion-alternative-20261007`, targeting `alternative/dev` in draft PR #1740. Do not merge until the remaining gates pass.

The reviewed source checkpoint is `255bba3b5690c13296b5d5f764d4912626a72ee6`: normal merge `5534400c0bd552d80a813585b5acd7b1e56ed914` plus the official architecture refresh. It preserves accepted regular source `25477baeb6453a95875ec65e6efa617b5e1b0e3a` (including actual dev's #1763 v15 receipt) and actual alternative parent `43221ee66f80055580dfe640418cac37137945f1` in ancestry. The earlier recoverable checkpoint `f082ea2657ab83c9f8f046b5e44560be3f87729c` remains an ancestor. This note and its evidence are a subsequent documentation-only checkpoint.

[Source evidence](./source-evidence.json) records 2,020 protected paths, 14 explicit presentation/receipt seams, zero unexpected protected changes, nine exact alternative art/animation/style pins, and 13 exact shared gameplay/UI/save/session seams. All 825 receipt lines survive; every foreign line and its relative parent order are retained from both actual parents. The formula, card text, card renderer, full face QA, and new formula tests additionally match the accepted regular source exactly. Earlier 2934 inheritance was independently reviewed; refreshed current-source independent review is recorded separately before final delivery.

The alternative independent source-alpha aura compositor is an intentional thinner-glow rendering change. Its authored frames, color/radius inputs, fractional placement, travel and 260ms sequence remain unchanged. Frozen renderer SHA256 is `ccb69580bc836b01bbaefd0c90ab818cf8522fc802ff19ff8863b8cfc66ed856`; stage SHA256 is `d04b399135e18a6e0f72a2387bd97e6c2873e4128398c5c49ff50124872d747f`. The visible canvas explicitly requests `willReadFrequently:true` because action materialization already reads pixels. Full-card volcanic trim, forced-color hiding and the incoming v15 Molten River meter are preserved.

Current validation passes **33/33 focused source checks with no skips** across static formulas, field anchors, aura renderer, stage, all twelve selected-source/Full/Lite identities and CSS asset projection. Eleven absent, clean, tracked source files were restored from exact HEAD before testing. The earlier 28/29 run's missing sparse PNG failure remains recorded; a source audit sampled during materialization also remains separately recorded, and its clean rerun passes. The changed-path audit checks 36 paths since the previous published checkpoint with no LFS-filtered files. This is source evidence; it does not substitute for compiled browser QA.

The latest measured local artifact is **0.7.1.1155 / 46b231ffb4**, a **PRELIMINARY prelude stale for this source**. It predates the latest typed text, v15, field and formula integration. The PR's older 1135 gallery is historical preliminary evidence. Earlier failed 1143/1153/1154 native attempts remain diagnostic records; none is relabeled as final. No built HTML is committed, and no final artifact or current hosted-check success is claimed.

## Remaining delivery steps

1. Receive regular PR #1768's final committed source/receipt handoff. Normally inherit it and any newer settled `alternative/dev`/regular test ancestry; retain the highest **actually measured** build metadata, every foreign receipt, all alternative pins and the reviewed seams. Preserve any actually landed #1767 art-gap change without assuming its draft has landed. Refresh `node tools/about-changelog.mjs --write` and `node tools/update-architecture.mjs --write`; repeat the protection/receipt/source audit. Alternative builds and browsers remain paused while the regular official prelude is active.
2. Run the official alternative prelude: `node tools/launch.mjs --build-only`. Advance only PR #1740's authored receipt to the measured ordinal plus one, run `node tools/about-changelog.mjs --write`, then repeat `node tools/launch.mjs --build-only` for the final pack and standalone plus all four aliases. Do not type an unmeasured build ordinal or commit HTML.
3. Run focused source checks from the repository root:

   ```powershell
   node --test --test-concurrency=1 tests/static-card-formulas.test.mjs tests/combat-overhead-anchor.test.mjs tests/alternative-aura-renderer.test.mjs tests/alternative-card-stage.test.mjs tests/alternative-selected-stances.test.mjs tests/asset-css.test.mjs
   node tools/buildversion.mjs --check
   node tools/verify-shipped.mjs
   node tools/receipts.mjs --check --pr 1740
   node tools/dirorder.mjs --check
   ```

4. Regenerate Counter wires through actual `createSession` → accepted host action → snapshot → `projectLanSnapshot` from this frozen alternative source. Repeat all five strict native QA families, all four mounted Counter shapes (desktop, 390px, 320px and reduced), eight owner observations, and the separate 128-case trim/forced-color/Information/Escape matrix on the exact unmodified final artifact. Include native cold motion/DOM impact timing, full paid tier/rank/modifiers, correct owner, real hits, normal positive controls and reduced modes. Existing corpus, deadlines, negative controls and hit testing stay intact. Raw browser logs remain retained; only exact documented light-edition audio fallback/policy limits may be classified. Unknown warnings, canvas readback warnings, exceptions and unrelated network failures fail QA. No audio or live-LAN acceptance claim.
5. Record and inspect final screenshots, identity, source hashes, health counts and limitations in a tracked final gallery. Review independently, push normally, require exact-head fast checks, then merge to `alternative/dev`, wait for architecture sync, promote to `alternative/test` and verify fresh exact-head heavy workflows. Do not duplicate automatically triggered CI or claim regular/alternative delivery from queued checks.

The prior off-tree runner files and raw diagnostic logs are helpful local records, but the source, recorded invariants and commands above are the recoverable authority. If those local drivers are unavailable to a successor, recreate the same rigorous native corpus rather than treating this checkpoint as acceptance.
