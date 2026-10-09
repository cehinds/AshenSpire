# Continue PR integration and channel promotion

**Latest delivery:** read [PR integration delivery](pr-integration-delivery.md) first. It supersedes the historical pending checkpoints below and records the merged Dev/Test/alternative source and exact-head workflows.

Finish the currently active appearance/defaults and README PR, reconcile eligible current PRs and coordinate one verified dev-to-test promotion after the session deliveries land.

## Session and branch

- Chat ID: 01a11843-0b3a-79d2-b6f1-166891a487f6
- Original chat title: Resolve and merge current PRs
- Actual working path: D:/repos/.codex/worktrees/readme-release-screenshots/AshenSpire
- Observed branch: codex/readme-player-guide-20261008
- Main PR: https://github.com/cehinds/AshenSpire/pull/1757

## Accepted requirements

- #1757 makes alternative appearance the default and keeps Classic behind a debug option. Preserve published release screenshot identity when editing README.
- Maintain screenshot capture metadata: channel, full version, source commit, capture date, viewport and pinned playable URL. Keep actual released evidence distinct from new dev/test captures.
- Preserve production player targets, artwork-only behavior, selection reachability, reduced motion and action canvas playback.
- Review each eligible PR at its exact current head, resolve conflicts, regenerate derived metadata and monitor required CI. Never call queued, skipped, cancelled or older-head checks complete.

## Verified checkpoint from this session - 2026-10-09 UTC

- [x] Source implementation: alternative appearance is the default; the toggle is named **Classic appearance**, shown in Advanced only with the debug flag on. It preserves combat/run state. Classic, alternative and shared art libraries are under `assets-display/`.
- [x] Verified origin checkpoint: `6071186d51dcd737f0ebb13a12e3a1f26fd7fc49` on `codex/readme-player-guide-20261008`, compared with `git ls-remote`. This worktree is `D:/repos/.codex/worktrees/readme-release-screenshots/AshenSpire`; the dirty original `73bc` checkout was preserved. The branch tracks its named origin branch.
- [x] Independent reviews: hand-anchor resize coordination, incoming paid-card/reaction integration and the visible/hidden-frame fixture were reviewed. Scoped review checks passed 49/49; the fixture's 16 combinations passed separately.
- [x] Local validation: focused integration tests 57/57, component catalog tests 48/48, shipped checks 12/12, own receipt 2/2, promotion receipts 25/25 and changelog ordering 874 checks. Both branch histories and 28 pinned historical ordering exceptions are retained. The two missing alternative promotion receipts (#1699/#1709) use verified merged builds 1060/1068.
- [x] Packaged browser evidence: build **0.7.1.1163**, digest **9bf504e978**; desktop 1440x1000 and phone 390x844 switch both ways, retain run/combat state, play two cards per viewport and restore the resting anchor after resize. Co-op canned snapshots are identical. Ten image hashes match. The T14 motion probe passed 34/34 on this build, including all reduced-motion modes.
- [ ] Latest-head GitHub gates: the fixture-only push restarted CI; verify PR #1757's current head. Its preceding 6071186d51 snapshot had 12/13 active checks green at the last read, with discovered group 3/4 still running and no failures. Required skips remain skips. Read fresh results before merging.
- [ ] Merge #1757 into Dev, then settle architecture-sync and batch one Dev-to-Test promotion after eligible owners' deliveries.
- [ ] Verify exact Test heavy CI, previews, installer and alternative sync/dispatched checks. Release/Main/tags stay owner-only.
- [ ] Live LAN, native touch and owner/device acceptance were not established by the canned co-op and emulated phone capture.

The shared prompt package is incorporated through a merge of `origin/codex/session-continuations-20261008` (both `7a317010d1` and `3178fd1b59`). This documentation changes no build identity. A newer checkpoint commit on the same named feature branch carries these notes; fetch that branch and verify its current SHA rather than treating the older recorded checkpoint as its permanent tip.

### Integration update after the checkpoint

Latest Dev `f785dc0eb1271ae03849f00c165d0645dca308f0` (Molten River #1763 plus successful architecture sync) is incorporated. The independently reviewed reward/map branch `c01f7559d059737ee7bac09e4c2fca826efccdcc` (#1756) is also being carried by #1757; retain its ancestry and original build 1144 evidence. Only metadata conflicts required manual resolution. The combined appearance/map/reward/frame suite passes 57/57; the review independently tested the reward head with 56 passing checks. Fresh integrated source-browser QA passes containment at 833/1440/390px and the complete touch Back/reselect/Enter flow, with controls ready at 41.3ms and no page or unexpected request errors. The final rebuilt box and #1757 receipt target **0.7.1.1166 / 3f8943d50c**. Shipping verification, current-head CI and merge/promotion remain pending until recorded below or in a newer task status.

The original appearance gallery remains accurately attributed to build 1163; the newer runtime changes affect map/reward presentation and the generated changelog, not the captured combat appearance. The portable capture recipe can check the current built artifact without changing that historical gallery. The latest card branch received independent source review at `3d5bea6fe5b979e4873fa09ce53ff02d95df7c24`: 42 tests plus 813 model assertions pass, and its missing rank preview was added. Conflict reconciliation, final packaged evidence and current-head CI are still required for #1766. #1767 reaction implementation is still an active owner delivery with failing/pending gates; do not merge it prematurely.

### Dev delivery and Test-history reconciliation

- [x] #1757 merged into Dev as `eefe18448528d631004ec05b038aa12c24de1d15`; GitHub also records #1756 merged through feature head `0332006844ccfe47fd22b23b56c9f31ab148d5bc`. All 13 fast checks passed, and the final feedback window had no new review findings.
- [x] Architecture-sync [run 37884916962](https://github.com/cehinds/AshenSpire/actions/runs/37884916962) succeeded for that merge, producing Dev bot tip `b4205fc71ee313bdba1c36ab97f7caf9694b708f`.
- [x] Portable packaged checks also pass all four solo/co-op desktop/phone cases and both resize checks on build1166; their tracked report is beside the build1163 gallery. Shipped integrity passes 12/12. Historical images remain correctly attributed.
- [ ] Promotion [#1769](https://github.com/cehinds/AshenSpire/pull/1769) is initially blocked by GitHub's history conflict. Test tip `11fbaff51cd32d03166027c76611739b8b9fcf00` contains two promotion merges absent from Dev. Git2.55's merge tree equals Dev's tree `5d5033bc6beaf1dd2739b1ab7530e49734eb01ec`, but GitHub returned405.
- [ ] Reconciliation [#1770](https://github.com/cehinds/AshenSpire/pull/1770), branch `codex/reconcile-test-history-20261008`, carries Test ancestry through ordinary merges. Source head `327ad5f50b18b3dd145618540bb33314d1fcff7a` has no gameplay changes relative to Dev; its final own receipt/build is **1167 / fe4bd6f5b5**, with shipped12/12, order877 and own2/2. Independent history/evidence/receipt review is clear. Verify its final origin head and fast CI, merge, settle the fresh architecture run, then reuse #1769.
- [ ] Dev's separate selective alternative sync [run37884917040](https://github.com/cehinds/AshenSpire/actions/runs/37884917040) failed because its protected UI restoration removed newly imported `src/ui/displayAppearance.js` from the temporary merge. No failed merge was published. Check the full Test-triggered sync, which must deliver the reviewed shared snapshot while preserving any newer variant edits; after it succeeds, rerun the selective sync if needed and verify current alternative runs. Do not weaken protected-path checks to conceal this.

Pull the named reconciliation branch for the latest delivery checkpoint. The original appearance feature branch remains preserved on origin. Test/alternative heavy CI, preview/installer delivery and owner/device acceptance are still pending.

### Durable source and reproduction

- Appearance model/controller: `src/model/displayAppearance.js`, `src/ui/displayAppearance.js`; settings entry and UI strings use `classicAppearance` with the **Classic appearance** label.
- Anchors and shared hand: `src/ui/components/battlefieldStage.js`, `src/ui/components/hand.js`, `src/ui/models/HandLayout.js`; `handlayoutchange` publishes completed matching geometry before the cached resting edge is updated.
- Paid action identity: `src/ui/models/PlayedCombatCard.js`, `src/model/combatAnimation.js`, combat/coop screens. Alternative class actions retain priority; Classic Counter preparation uses the effective committed receipt and expansion version.
- Reachability: `tools/screenreach.mjs`, `tests/screenreach-overlap-fixture.test.mjs`; hidden player plates are tested through reachable exposed artwork. Known-bad plants remain active.
- Curated evidence and recipe: `docs/preview/display-appearance-0.7.1.1163/README.md`, `manifest.json`, `report.json`, ten PNGs and `capture.mjs`. Capture source commit is `8c5c0ee58583330f619096bcee85c7bb042177af`; subsequent test/document changes leave the runtime digest unchanged.
- README Release gallery remains **0.7.1.1060** at `docs/preview/releases/0.7.1.1060/`. All six published-channel badges returned 200; do not relabel Dev evidence as Release. The README is compact and includes build links, images, checkbox features, AI acknowledgement and third-party/unresolved provenance.

Run from the repository root, using a D: worktree and D: TEMP/TMP. Set `CHROME` to Edge/Chromium if auto-discovery needs help. These standard commands require no ignored memo/cache scripts:

```text
node tools/fetch-art.mjs
node tools/launch.mjs --build-only
node tools/verify-shipped.mjs
node tools/about-changelog.mjs --check-order
node tools/receipts.mjs --check --pr 1757
node tools/receipts.mjs --check --since origin/test
node tools/display-art-library.mjs
node --test tests/screenreach-overlap-fixture.test.mjs tests/combat-counter-animation.test.mjs tests/display-appearance.test.mjs
node tests/run-node.mjs --discovered-only --shard 2/4
node docs/preview/display-appearance-0.7.1.1163/capture.mjs
node tools/motion-probe.mjs --seed T14
node tools/screenreach.mjs --dist --only 390x650
```

The recorded T14 run served the built artifact with the canonical motion sampler and waited for painted/decoded art; the standard motion command above serves the current source. Final Test CI must prove its own exact head. A local short-phone sweep saw no covered player controls in mounted combat states, but two unrelated screens timed out; do not quote that local sweep as a complete green gate.

GitHub upload remediation: an HTTP 408 did not update origin. A verified successful retry used `git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 -c http.lowSpeedLimit=1 -c http.lowSpeedTime=300 push origin codex/readme-player-guide-20261008`. Compare local HEAD with `git ls-remote origin refs/heads/codex/readme-player-guide-20261008` after every delivery.

## Current work and evidence

PR #1757 was open on codex/readme-player-guide-20261008. Build 1163 and fresh desktop/phone captures were reported ready; a timed-out push was verified against origin and then successfully retried. CI exposed an outdated extracted screenreach fixture test; the chat is updating it to cover both visible frames and artwork-only targets.
tests/screenreach-overlap-fixture.test.mjs now passed its targeted local test. Motion probe reported 34 passed, 0 failed and reduced-motion checks passed. That is scoped evidence, not proof all hosted CI passed. The listed chat cwd (73bc) differs from its actual command worktree; use the latter.
Open PR inventory at review: #1767 reactions, #1766 cards, #1763 Molten River, #1757 defaults/README, #1756 reward overlap/mobile map, #1749 simulator self-tests, #1741 alternative knowledge and #1740 alternative expansion. #1756 belongs to an idle chat excluded from this messaging batch; inspect its PR under your existing integration remit without claiming its session was active.

## Continue in this order

1. Finish and push the screenreach fixture test update. Confirm the exact remote SHA via ls-remote; HTTP timeouts alone do not prove upload.
2. Refresh current PR states, required checks, reviews and conflicts. Identify overlapping changes in anchors, layered appearance, formula displays, reactions and receipts.
3. Integrate the continuation package from codex/session-continuations-20261008 into dev if it has not landed. Cherry-pick its documentation commit into your existing reviewed integration PR, or open a separate documentation PR. Preserve review and receipt requirements in the PR that carries it.
4. Establish a landing order from actual dependencies. Keep each feature owner responsible for its changes; do not silently overwrite local branches. Other sessions are being directly messaged with their prompt and origin delivery instructions.
5. Review and merge #1757 and other eligible work with merge commits. If an owner branch still has failing gates, retain its remote recoverable checkpoint and report the precise blocker.
6. After the final eligible dev merge, wait for latest architecture-sync success and verify the covered tip or its bot commit. Reuse any open dev-to-test PR and recheck immediately before merge.
7. Check exact test-head heavy CI, sync-alternatives and alternative dev/test dispatched workflows. Reconcile protected-path overlaps in a dedicated D: worktree and rerun sync.
8. Record the integrated source SHA, promotion SHA, resulting alternative SHAs, workflow links and outstanding owner/device acceptance. Leave release/main/tagging to the owner.

## Coordinate overlapping changes

Coordinate with all five other prompts in this folder. #1757 and rear-sprite work overlap heavily; compare actual art selection and anchor changes before landing. Card/formula and reaction commits may require new package captures after integration. Batch promotion once after the last eligible merge to avoid repeated full matrices.

## Latest progress recorded by the session

> Build **1163** passes the final desktop and phone capture. I also corrected line endings in the capture metadata. The GitHub upload timed out, so I’m verifying the remote branch before treating the push as complete.

> The remote branch is still on the older commit. I’m retrying with a buffered upload; the build checks and screenshot evidence are ready locally.

> GitHub now has the verified build **1163** changes on [PR #1757](https://github.com/cehinds/AshenSpire/pull/1757). I’m waiting for its final checks and review feedback before merging, then promoting Dev to Test.

> CI caught an outdated test that extracted part of the old player-frame fixture. I’m updating it to exercise both visible frames and artwork-only targets. The game build and captured visuals are unchanged.

## Recover the repository state

You are continuing an existing owner-authorized task. Treat this as a detailed handoff, and carry the intended work through its remaining validation and repository delivery. Snapshot date: October 8, 2026, America/Anchorage. Chat history and branch state can advance after this snapshot; inspect the latest origin refs before relying on any status.

Read CONTRIBUTING.md, DEVELOPER.md, SPEC.md, docs/ai/AI-ROUTING.md and the task contracts. Work only in D:/repos/.codex/worktrees; put state, logs and authoring outputs under D:/repos/.codex. Preserve dirty primary checkouts, credentials, live databases, existing art caches and unrelated session work.

Start with git status --short, git branch --show-current, git rev-parse HEAD, git remote -v and git fetch origin. Confirm this is cehinds/AshenSpire and the right worktree. A chat's sidebar cwd may differ from its command cwd. On detached HEAD, create a named codex branch at that HEAD before committing; do not discard local work. Do not assume the local branch is pushed just because a PR exists.

## Preserve work on origin and complete the merge

The owner explicitly asked every active session to deliver its local branches to origin so a new AI can continue after pulling. Commit task-owned source and curated evidence, push the named feature branch with upstream tracking, and compare git rev-parse HEAD with git ls-remote origin refs/heads/<branch>. Push all task-owned continuation branches that contain needed work; record each remote and base. Keep unfinished but coherent work recoverable on a feature branch with clearly recorded blockers.

“Origin” is the remote, not a merge destination. Use a reviewed PR into origin/dev for regular game changes, or origin/alternative/dev for variant-only changes. Do not directly merge unfinished/failing work into a shared integration branch. Use merge commits when repository gates permit. Never force-push shared branches or sweep another session's files into your commit. Do not publish release/main or create release tags.

Read the current independent review requirement and obtain a real review using its permitted path. For generated receipts, follow CONTRIBUTING.md and the CHANGELOG header: build; point the authored receipt at the box ordinal plus one; run node tools/about-changelog.mjs --write; rebuild; verify matching box/receipt and canonical build identity. Commit the generated source/ordinal required by the repository, never built HTML, caches or temporary bundles. Sparse checkout must contain every canonical identity input.

Keep the PR mergeable as dev advances, fix concrete review/CI findings and recheck its latest head. After eligible merges, coordinate one batched dev-to-test promotion with the PR integration chat. Wait for architecture-sync to settle and validate the exact dev head before promotion. Verify test heavy CI and sync-alternatives, preserve protected alternative paths, and check both alternative channel workflows. A pushed branch, green scoped tests, merged dev PR and completed test promotion are separate states.

## Save the next AI handoff

Before finishing, update this task prompt or add a task-owned status document linked from it. Save in Git:

- The exact original objective, latest accepted decisions, implemented behavior and still-pending owner choices.
- Every relevant repository, base branch, feature branch, local HEAD, verified origin SHA, PR URL, merge SHA and promotion SHA.
- Source and contract file paths, generated-file owners and commands, dependency order and overlaps with the other sessions.
- Reproducible setup/build/test/browser commands, exit codes, tested SHAs, curated screenshots, console/request health, workflow URLs and actual results.
- Remaining failures with error text and reproduction, unresolved owner/device acceptance, and the very next actions in priority order.
- Required assets through published pins and repo paths. Localhost previews and ignored .codex logs do not survive a pull; preserve editable source and concise evidence in the repository.

A new AI should be able to fetch origin, create a D: worktree for the recorded branch, pull with --ff-only after confirming the branch, read this folder and continue without access to the old chat, temporary screenshot attachments, live PIDs or your local art cache. Do not embed credentials or entire raw tool/session transcripts.

## Completion report

Report separate checkboxes for source implementation, verified origin push, independent review, current-head validation, dev or alternative/dev merge, test and alternative promotion/CI, and owner/device acceptance where needed. Cite exact SHAs, PRs and workflows. If a merge is blocked, keep the work pushed and give the precise failing gate and next fix; do not mislabel that checkpoint as integrated delivery.
