# Full combat audit — resumed delivery handoff

**Resumed by explicit user instruction, 2026-10-15 UTC.** The pause record below is historical. For the authoritative current merge state and Dev→Test promotion record, read [PR1990](https://github.com/cehinds/AshenSpire/pull/1990) and its linked delivery updates before continuing. The manager owns integration and promotion; this handoff does not freeze those live states.

## Delivery evidence at consolidation — 2026-10-15 UTC

- Reviewed code-bearing head: `eccdfe210380b12b7b9ec380f83b59bada881690`, including upstream Dev `cb4586ba551b5abee62ea220b6b68c3c4b188876` / committed box `0.7.1.1535`. Subsequent game source is unchanged; `d2d02a91` changes only read-only proof-tool buffering, followed by documentation consolidation. Exact merge head and gate results are recorded in PR1990.
- [Play the verified feature build](https://cehinds.github.io/AshenSpire/branches/feature/FullCombatAudit/latest/): **0.7.1.1536**, source **78492dee2e**, from code-bearing commit `eccdfe210380b12b7b9ec380f83b59bada881690`, [feature build 38699427329](https://github.com/cehinds/AshenSpire/actions/runs/38699427329), [download artifact 11954559610](https://github.com/cehinds/AshenSpire/actions/runs/38699427329/artifacts/11954559610). Frozen [actual public browser proof 38705237731](https://github.com/cehinds/AshenSpire/actions/runs/38705237731), [artifact 11958675887](https://github.com/cehinds/AshenSpire/actions/runs/38705237731/artifacts/11958675887), passes all six checks with `errors=[]`; actual executed HTML SHA-256 `71036042f98bcf220a60146c3916666b3cce1388b30394ab6716394b38eb8b87`. See the [permanent preview record](../preview/full-combat-audit/README.md) for exact bytes, screenshots and limits.
- The original normal hosted run [38699427242](https://github.com/cehinds/AshenSpire/actions/runs/38699427242) failed when Chromium's 128 MiB response buffer evicted the large HTML; [failure artifact 11958190075](https://github.com/cehinds/AshenSpire/actions/runs/38699427242/artifacts/11958190075) is preserved. The successful frozen replay uses the reviewed larger buffer and the same actual public ECC game, with unchanged runtime checks. Parent `d2d02a91fdf59dcd2012aa38a9e86be18e03ac44` integrates only that one-line read-only proof-helper buffer correction; game digest `78492dee2e` is unchanged. Its fresh normal feature build/publication/hosted proof was pending at this consolidation; do not infer success from the frozen replay. Consult the live PR for subsequent normal-pipeline results.
- Native/production-loader verification remains source-bound: the earlier c54 baseline passed **107/107** across 15 files (exact command/log below). After the CSS-only Dev1535 update, **111/111 focused native tests passed, zero failures/skips**, using `node --test tests/combat-health.test.mjs tests/combat-health-guard.test.mjs tests/block-presentation.test.mjs tests/player-details-placement.test.mjs tests/ui-component-catalogs.test.mjs tests/hud-layout-css.test.mjs`. Historical former-executor log: `/workspace/scratch/full-combat-audit/resume-dev1535-hud-tests.log`; SHA-256 `5acbd365c6b5e3f509d63ba47663c2e2e29b7f6262da4ee2921dea695e2256e9`. The tested normal Dev merge has equivalent runtime/CSS to the subsequent a486 bot restamp; later receipt repair changes derived text only.
- Fresh resumed compiled evidence is separate from the historical matrix: [18 mouse/touch cases](../preview/full-combat-audit/resumed/README.md) at build `0.7.1.1534` / source `84651451fe`; then [13 focused CSS-follow-up cases](../preview/full-combat-audit/resumed/css-followup.md) at build `0.7.1.1536` / source `78492dee2e` (ten Star Spark cases plus three real selected-player panel geometry/input checks). No older result is relabeled as the newer source.
- The original four menu screenshots retain build `0.7.1.1530` / source `368140ce27`. Fresh hosted images have their own identity in the permanent preview record.
- The root README Release gallery now uses actual public Release **0.7.1.1517** captures, source `d310c277fffaaec6ec7a58a87de846577f12312d` / digest `a5b5079cb1`; [capture record](../preview/releases/0.7.1.1517/README.md). README route verification checked 30 targets with HTTP200 in [run 38698554816](https://github.com/cehinds/AshenSpire/actions/runs/38698554816), [artifact 11955416451](https://github.com/cehinds/AshenSpire/actions/runs/38698554816/artifacts/11955416451).
- Pre-merge cleanup follows the official helper: `node tools/feature-preview.mjs --remove`, followed by removing only `docs/preview/features/full-combat-audit/`. Permanent evidence under `docs/preview/full-combat-audit/`, Release galleries, channel `readme-sync` blocks and AI disclosure remain. Check the PR's current tree rather than inferring cleanup state from this historical instruction.

## Copyable continuation prompt

> Continue the Full Combat Audit delivery resumed by the user on 2026-10-15 UTC. Read this handoff and current CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md and SPEC.md. Inspect live PR1990, current Dev/Test refs and the working tree first; current merge and promotion state is authoritative in the PR, while the pause/base/CI records below are historical. Preserve all dirty or unmerged worktrees and all original evidence identities. Do not force-push, commit built HTML or bulk QA JSON, or bump the local build ordinal.
>
> Functional audit work is complete and independently reviewed. Retain bounded coverage claims, including 106 uncovered individual conditional indices. For code-bearing changes, inspect the actual source change and run justified fresh checks; documentation-only changes do not require rebuilding or rerunning the full matrix. Use the current permanent preview record for actual hosted proof and fresh screenshots. Historical build1530 screenshots and full matrices cannot establish later runtime changes.
>
> The manager owns the PR1990 merge into Dev and Dev→Test promotion. If integration remains open, require independent review, appropriate exact-head fast gates and actual hosted proof, then complete mandatory temporary-preview cleanup with the official helper. Before promotion, wait for current Dev architecture-sync, build-stamp and stamped dev-preview success under CONTRIBUTING.md. If already promoted, inspect the actual Test/alternative runs and fix confirmed failures normally. Do not merge main or release. Deliver verified playable/download links and permanent screenshots without implying an exhaustive game-state cross-product.

## Historical branch and reviewed implementation record

- Workspace: `/workspace/full-combat-audit`; branch `feature/FullCombatAudit`; remote target `origin/feature/FullCombatAudit`.
- Historical paused implementation head: `d43f0c143f0be4dd5d751e0248584ed829ee7b0b`; pause handoff `58c78f6b63cf92a3e001912788f67514ca6e19cf`. Parent was clean at resume, then fast-forwarded without rewriting history to `c54c4728ad2f4c59eea0753ebca6d1f996a0c5af`.
- Historical integrated Dev base: `db8b64c1ccfcf031ab1073feda14319ca053a397`, committed box `0.7.1.1531`. PR1990's receipt used that actual box at pause; the earlier remote restamp used Dev box `0.7.1.1533`. The normal merge is `04113107389a0cd233dec3908dc61edc027c4f74`.
- Audit PR: https://github.com/cehinds/AshenSpire/pull/1990 . It was unmerged and unpromoted at the historical pause; its live PR state and delivery updates are authoritative now.
- Confirmed fixes: primary Quit is last/reachable and handles blocked closes with Return to title; the Settings sample card is created only when its folded Preview opens; card-value projection groups authored tags once per operation, with an independently captured unindexed-current-Dev parity oracle. No combat gameplay defect was confirmed by this audit.
- Preserved upstream Ward/stance combat and art v23. No balance or default-character/weapon animation policy was changed by the audit.
- Previous, separate Starseer fix: PR1985 https://github.com/cehinds/AshenSpire/pull/1985 extracted `reactionState.js` from the combatReactions/enemyReactions import cycle while preserving the public re-export. Original compiled HTML legally targeted Gilded Knight but caught `reactionPaused is not a function`, with no payment/damage/recovery. That fix was already merged and promoted (historical Test repair PR1988, SHA `b275dc55b00e2d6a41173d1f8dffc28202842d78`); do not confuse that completed task with unmerged audit PR1990.

All integrated code/tool changes received independent review. Key recent commits: `e78df41da` refreshes the independent unindexed Ward-content oracle and strict Quit/Escape wiring; `9ecf8b5dd` fixes the relic CLI's platform file-URL guard; `3a2983522` integrates the approved exact standalone/browser proof; `659d4ca32` records final bounded evidence; `613455b55` makes the 92-test command and per-file counts explicit. `be35d478f` and `d43f0c143` add the reviewed read-only hosted verification workflow/helper and settle response/navigation readers. The interpreter merge preserves `ASHEN_PYTHON`, then `PYTHON`, then the platform fallback; it does not relax tests.

## Coverage and limits

The full matrices and 360 browser rows below retain their original source identity (compiled source `60e89f5ff8c4763552e62ebaf08830e26461b5b9`, build `0.7.1.1530`). They were not rerun or relabeled for the newer Dev stance changes. The resumed focused checks are recorded separately below.

Inventory is registry-derived: 4 classes, 304 cards, 523 applicable class/card pairs, 1,892 upgrade/grade/profile/upcast candidates (including saved legacy faces), 17 equipment profiles, 33 enemies, 73 relics, 71 statuses, 21 card-effect opcodes and 43 authored condition shapes.

- Recorded native and real production-loader matrices: **3,784 intents each**, 3,760 paid/resolved plays with separate SP/MP payment/restoration ledgers, 24 named authored-unplayable refusals, zero fixture gaps or unexpected failures. End turn, next turn and a subsequent play are checked.
- Refusals: 1,046 intents per loader, 1,013 named atomic rejections and 33 zero-effective-price accepted plays. Snapshots include enemies, queues, phase/turn, prompts, trigger gates and RNG; derived preview caches are excluded explicitly.
- Conditional outcomes: 156 attributed general indices, **106 explicitly uncovered individual indices**; 25 focused conditional contracts, 12 deferred counter rows and five exact-state family closures per loader. The union proves 42 literal shapes plus the frost/frostExposed→frozen/chilled projection: **43 representative semantic families**, not all indices or all state combinations. Exact-state closures use authored amounts plus normative stance/status/skill effects, not receipt sums as their oracle.
- Effects helper: 35 positive representative contracts plus two funded-neutral recovery outcomes per loader. Keyword/absent-op labels are explicit; representative coverage is not every authored opcode occurrence.
- Relic/status/enemy consumers: 68 relic rule branches, 33 negative controls; 31 passive declarations split into 19 actual consumer effects and 12 explicit no-ops; 71 status lifecycle rows and 20 modifier consumers; all 103 moves of 33 enemies; four scenarios for two reactive moves. All 35 encounters × four classes converge to victory (140 per loader) using named capability fixtures and a real paid reach probe. This is not each class's normal starter deck or a complete campaign.
- Recorded compiled browser: **360/360 distinct critical rows**, zero runtime errors, unexpected network failures, missing/unexpected keys or unfinished reports; 358 packed HTML + two embedded-media standalone rows. Includes 264 enemy UI cases (33 enemies × four classes × mouse/touch), 26 normal scenarios, 24 real equipment-profile plays, eight canonical-pool gallery cases, eight Sweep cases, eight real reaction-choice cases, eight successful-Evade cases, ten base/upgraded/upcast Star Spark→Gilded Knight cases and two Falling Constellation cases. The standalone pair uses actual figure taps, positive exact spell HP damage, end turn and paid next-turn Defend. Reference-source equality verifies 794 JavaScript modules.
- Animation: 52 paid dispatch rows + 24 profile rows (76 distinct), 58 normal action groups complete their return, zero origin gaps. Falling Constellation uses generic Spell; no distinct ranged-Magic playback is claimed. Successful Evade proves a real miss and **no automatic Counter**. Three classes lack an authored Evade clip; fallback frames are not counted as authored Evade animation. Earlier eight failed Evade expectations remain historical diagnostics, not hidden failures.
- Historical baseline browser: **2,262 distinct cases**, 2,238 paid + 24 named refusals; failed historical ledger attempts have rerun links and are not counted twice. Historical native/CJS base matrices each cover 17,259 intents (523 pairs ×33), 16,863 accepted +396 unplayable. Early friendly targeting used compatibility defaults. These are separately bound baseline evidence, not current Ward/stance UI claims.

Remaining state cross-products include all-enemy upgraded/profile variants, every carrier/progression path, co-op, full campaign sequences/boss phases, every RNG outcome and combined relic/status/stance interactions. Actual per-card effects are bounded by the named contracts; do not call the audit mathematically exhaustive.

The local broad suite was **RED**, not all green: 685 discovered files, 6,553 tests, 24 failures. Sixteen stale assertions were subsequently repaired (15 pre-index hashes after upstream content changes, one farewell-location scan). The recorded rerun is exactly:

`node --test tests/card-value-tag-index.test.mjs tests/escape-back.test.mjs tests/quit-game.test.mjs`

It passes 92/92: 61 tag-index, 27 Escape, four Quit. The first two alone contain 88. Eight remaining local failures require sparse-excluded tracked legacy art or the missing high pack; do not skip/weaken them. Full-checkout/pinned-art **exact-head CI is authoritative and was pending at pause**. Other recorded focused contracts pass; module URL scanner found zero unconverted sites after the relic guard fix.

## Historical executor: immutable captures, local files and stopped servers

**Executor replacement, 2026-10-15 UTC:** the former `/workspace/full-combat-audit`, worktrees, scratch raw reports and absolute paths below are historical locations on the former executor; they are not claimed present on the replacement environment. Pushed source/docs/curated images, linked CI artifacts, recorded hashes and reproduction commands remain durable. Earlier independent source/report/image reviews remain valid for their named immutable inputs. The replacement `/workspace/AshenSpire` worktree is separate and must be preserved; inspect current paths and disk availability before running reproduction commands.

Preserved gameplay capture commit: `60e89f5ff8c4763552e62ebaf08830e26461b5b9`, digest `368140ce27`, build `0.7.1.1530`, art `hd-assets-v23`. Later Dev changes now also affect stance execution and enemy previews; these images and the full matrices establish only their named original source. Fresh resumed evidence is listed at the top. Captures accurately retain their original identity; do not relabel them as later artifact bytes.

- Packed browser HTML: 15,169,050 bytes; SHA256 `1d63824ea3d6df48d2909b31b595e48d63e46e2d4322f74e868371b92792c319`.
- Separate embedded-media standalone: 79,970,928 bytes; SHA256 `586c07905d157e2a77a2877c727c7c0751665c335c78f4c1ece4a9564dbc9f98`.
- Historical immutable snapshot: `/workspace/scratch/full-combat-audit/final-source-368140ce27`.
- Historical baseline immutable snapshot: `/workspace/scratch/combat-audit-baseline-0962`, commit `0962c5ecc6467be75ffc1a4cbccc39d583e44dac`, digest `d93ee7b6bf`, build `0.7.1.1527`.
- **Servers stopped by manager via SIGTERM**, all browsers closed. Do not assume ports4413/4414 are running. Inspect existing listeners before any restart; use the original serve tool (plain HTTP omits required source transforms):

```sh
node tools/serve.mjs --root /workspace/scratch/combat-audit-baseline-0962 --port 4413 --host 127.0.0.1 --no-open --no-lan
node tools/serve.mjs --root /workspace/scratch/full-combat-audit/final-source-368140ce27 --port 4414 --host 127.0.0.1 --no-open --no-lan
```

Run from `/workspace/full-combat-audit`. The standalone route is `/AshenSpire-standalone.html`; packed is `/AshenSpire.html`. Preserve matching v23 cache links and independent HTML. Do not rebuild merely for metadata.

Durable files:

- `tools/combat-audit/README.md` — bounded coverage/reproduction.
- `tools/combat-audit/proof-index.json` — compact counts, raw proof hashes, exact 92-test command and scope.
- `docs/preview/full-combat-audit/README.md` — permanent eight curated images, packed/standalone distinction.
- `docs/preview/full-combat-audit/VIEWPORT-CAPTURES.md` — exact four viewports/dates: phone390×844, desktop1280×800, wide1920×1080, tablet768×1024; captures use emulation, not physical devices.
- `docs/preview/full-combat-audit/{menu-phone,menu-desktop,menu-wide,menu-tablet,reaver-action,starseer-action,rogue-action-phone,herald-selected-phone}.png`.
- Temporary root README block and `docs/preview/features/full-combat-audit/` are review-only evidence. Mandatory removal uses the official helper immediately before Dev integration. Check the live PR tree for that cleanup; do not delete the permanent gallery.
- Historical raw evidence lived in former-executor scratch, not claimed present now or uploaded: `/workspace/scratch/full-combat-audit/final-current`, `/workspace/scratch/full-combat-audit/browser/integrated-combined-manifest.json` (13 hashed source reports), `/workspace/scratch/full-combat-audit/browser/baseline-combined/combined-manifest.json`, and `/workspace/scratch/full-combat-audit/stances/current-stance-summary.json`. Reproduction commands can generate artifact uploads later.

## Historical CI and preview state at pause

These historical entries explain the state at pause; they are **not current exact-head green claims**:

- d43 feature preview: https://github.com/cehinds/AshenSpire/actions/runs/38659819675 — pending/active at pause.
- d43 real hosted proof: https://github.com/cehinds/AshenSpire/actions/runs/38659820168 — pending/active at pause. Workflow `.github/workflows/combat-audit-hosted-preview.yml` is fixed-branch, read-only, separate from publication; its helper verifies the actual public wrapper/iframe, compiled bytes/identity, Quit/Return and screenshots without injecting fixtures.
- Earlier041 feature preview: https://github.com/cehinds/AshenSpire/actions/runs/38658664143 . This is an earlier run, not d43 proof.
- Last verified download backup, source7067 publication: https://github.com/cehinds/AshenSpire/actions/runs/38656806560/artifacts/11937487358 . Extract `AshenSpire-dev-preview.html`.
- Intended hosted Play URL: https://cehinds.github.io/AshenSpire/branches/feature/FullCombatAudit/latest/ . **NOT VERIFIED at pause.** Local proxy returned CONNECT403; remote real-browser proof was pending. Do not present it as working based only on deploy metadata. Do not bypass network policy.
- Last-known d43 core/four shards, Workbench, receipts and Quick Start were queued; intake pending; Dev preview active. No exact-head failure was known then, and none was called green. Resumed status checks are recorded separately; automatic completion was not treated as authorization during the pause.
- Previous completed Starseer Test artifact, historical only: https://github.com/cehinds/AshenSpire/actions/runs/38643326556/artifacts/11930758581 (`AshenSpire-test-preview.html`). This is not the unmerged full-audit build.

## Earlier resume verification — c54 baseline, 2026-10-15 UTC

Remote head `c54c4728ad2f4c59eea0753ebca6d1f996a0c5af` integrates Dev `3d40c190983069eec8d8a2370fb3f229ac376290`, box `0.7.1.1533`. Its 25-file difference from the pause handoff exactly matches the difference between the old and new Dev bases. PR1996 changes charging-action hit grouping, enemy Smash/Counter Poise fallback, Smash against an attempted Evade, paced Evasion display and enemy move-card configuration. PR2004 adds public feature-route verification. No audit-specific gameplay change was introduced by the fast-forward.

The resume also restores PR2004's missing changelog receipt using its actual committed merge box: `git show da35a73558c10beee5ef29dbe56aa46e3d614232:buildordinal.json` records `0.7.1.1531`. Its entry sits below the newer 1533 receipts, and the in-game projection is regenerated with `node tools/about-changelog.mjs --write`; no build ordinal is changed.

The changed runtime files are `src/engine/{combat,combatCardTactics,combatMatchups,stanceHit}.js`, `src/model/{enemyKnowledgeView,enemyMoveCards,stanceRules}.js` and `src/ui/screens/{bestiary,combat,coop}.js`. The generated changelog also advances with the upstream stamp. The new runtime needs its own bounded compiled-browser checks; the preserved 360-row report cannot establish these later changes.

Fresh targeted checks at `c54c4728ad2f4c59eea0753ebca6d1f996a0c5af` pass **107/107 tests, zero failures, zero skips** across 15 files, including upstream stance/pressure/Evasion/knowledge tests and audit conditional, effect, family and Counter contracts under native and production loaders:

```sh
node --test tests/combat-expansion-martial.test.mjs tests/coop-callouts.test.mjs tests/stance-enemy-pressure.test.mjs tests/stance-evade-matchup.test.mjs tests/stance-paced-hud.test.mjs tests/check-feature-pages.test.mjs tests/stance-hit.test.mjs tests/stance-evade-mode.test.mjs tests/enemy-knowledge-model.test.mjs tests/enemy-knowledge-disclosure.test.mjs tests/combat-audit-runtime.test.mjs tests/combat-audit-cards.test.mjs tests/combat-audit-card-condition-contracts.test.mjs tests/combat-audit-card-effect-contracts.test.mjs tests/combat-audit-conditional-family-contracts.test.mjs
```

Local log: `/workspace/scratch/full-combat-audit/resume-c54-targeted-tests.log`; SHA256 `31e7a42ff242ef76b96e2a360a674d4b2ae7c4c729b141c2da4dcb20f4f59b3e`. No full audit matrix, broad suite or local game rebuild was rerun for this documentation update.

The lead re-inspected all four permanent menu captures: Quit is last and wholly visible, artwork is loaded, and their build/source stamps remain `0.7.1.1530` / `368140ce27`. Tablet uses a smaller centered menu without clipping. These are emulated viewports; their original capture dates remain unchanged.

Resumed hosted investigation confirms d43 feature-preview run `38659819675` succeeded, but hosted-proof run `38659820168` failed after public wrapper/build.txt HTTP404 responses throughout its 12-minute publication wait; it never reached browser verification. That failure is preserved. The intended public Play URL therefore remains unverified. At this record, no feature-preview or hosted-proof run exists for c54; delivery and fresh compiled browser checks remain active work.

## Historical workspace preservation and future coordination

No dirty/unmerged worktree may be discarded. These former-executor paths record historical preservation requirements; inspect the current environment before assuming any are present. Preserve `/workspace/starseer-spell-fix` and its screenshots, dirty `/workspace/AshenSpire`, unmerged historical class-smash/stance worktrees and all audit workers. At the historical pause, disk had about1.2GB free; recheck current disk availability before materializing art or duplicating trees. The preserved local light/common cache was verified at `/workspace/AshenSpire/.art-cache/hd-assets-v23`; the high pack was absent locally. No asset aliases, fabricated editions or test skips were added.

Implementation files have clear owners: lead owns runtime/inventory/fixtures/cards/report; browser worker owns browser harness; menu worker owns menu/value/condition-family/hosted helpers; relic worker owns relic/enemy audit; stance worker owns stance parser/effect helper. Engine edits require manager allocation. Wake an idle/completed worker with a follow-up task rather than assuming a message starts work. All source delivery and merges remain coordinated by the manager.

**Continue from the live delivery state in PR1990.** The manager records integration, promotion and Test results there. The temporary preview block/folder is removed with the official helper before Dev integration; permanent galleries remain. Do not merge `main` or `release`.
