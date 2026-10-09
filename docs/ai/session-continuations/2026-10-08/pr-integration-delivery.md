# PR integration delivery — October 9, 2026 UTC

This status supersedes the historical checkpoints in [the continuation prompt](pr-integration-and-promotion.md). Fetch current refs before continuing: other feature owners may advance shared branches.

## Accepted behavior and implementation

- Alternative appearance is the default. The setting is named **Classic appearance**, appears in Advanced only while the debug flag is on, and preserves the current run/combat state when switched. A saved Classic choice remains valid when its debug-only control is hidden.
- `assets-display/classic`, `assets-display/alternative` and `assets-display/shared` separate display art from common icons/UI. Canonical packed asset IDs remain stable; 470 unchanged export hashes were checked.
- README is a compact player guide with six full published-build badges, prominent play/download links, checkbox features and a current published Release gallery. Release remains **0.7.1.1060**; Dev captures must not be described as Release images.
- AI acknowledgement is prominent. Fonts, system emoji, Electron/dependencies and incomplete flask/landmark/sprite/map provenance are documented honestly in README/CREDITS. Unresolved records remain open; no licence was invented.
- Integrated reward/map fixes retain #1756 ancestry and its original build 1144 evidence. Hand anchors, artwork-only targets, Classic paid Counter actions and alternative animation priority have independent review and scoped tests.

## Delivered branches and PRs

- Worktree: `D:/repos/.codex/worktrees/readme-release-screenshots/AshenSpire`. Dirty original `D:/repos/.codex/worktrees/73bc/AshenSpire` was preserved.
- Original merged feature head: `0332006844ccfe47fd22b23b56c9f31ab148d5bc`, verified on `origin/codex/readme-player-guide-20261008` before merging. GitHub automatically deleted the feature refs after merging. The original named feature branch was restored and its exact origin SHA verified; the administrative reconciliation branch carries the newer handoff.
- [#1757](https://github.com/cehinds/AshenSpire/pull/1757) merged into Dev as `eefe18448528d631004ec05b038aa12c24de1d15`. [#1756](https://github.com/cehinds/AshenSpire/pull/1756) is also recorded merged through that feature head. All13 fast checks and the final feedback window passed.
- Test's historical promotion merges initially caused GitHub 405. [#1770](https://github.com/cehinds/AshenSpire/pull/1770) reconciled that ancestry with ordinary merges; runtime source was unchanged except generated changelog/receipt. Merged feature head `48b2ae2727ccc276eb5cde4318149a42a7126d41` was verified on `origin/codex/reconcile-test-history-20261008` before merging; Dev merge is `0d66e54817099278e7a877258f7ac9fd20688f1a`. Independent review, all 12 fast checks and the final feedback window passed. The revived named branch will carry this administrative handoff on top of that implementation head.
- [Architecture run37887027644](https://github.com/cehinds/AshenSpire/actions/runs/37887027644) passed, producing Dev bot tip `d18b3423d51b158b503e7e9c4a705c3b5d37dd92`.
- [#1769](https://github.com/cehinds/AshenSpire/pull/1769) promoted that reviewed source to Test. Test merge is `4000288bef3bb0c6284ef30c66b9a7bfd2d03e4c`. Dev/Test trees match at `d6eeb1ad9fe27bfb198d8812e4258fff17feb9b1`.
- Delivered box: **0.7.1.1167 / fe4bd6f5b5**. Local final shipping 12/12, own receipt 2/2 and ordering 877 passed. Historical #1756 receipt remains correctly1144. Later owner deliveries can advance shared branches; the validation below names this promotion's exact source.
- [Full alternative sync37887222175](https://github.com/cehinds/AshenSpire/actions/runs/37887222175) passed all three jobs. Alternative Dev runtime tip is Test's `4000288bef3bb0c6284ef30c66b9a7bfd2d03e4c`; architecture subsequently produced `354296bd725f2a0b8eeeeac8ba718d6cc284845f`. Alternative Test is `1949fe1da6b11d9b580baa2ac18b60d880a3b2ca`, differing from primary Test only in `docs/ARCHITECTURE-CURRENT-DEV.md`.
- Earlier selective Dev sync failed because protected-path restoration removed the new `src/ui/displayAppearance.js` import. No failed temporary merge was published. The full sync repaired the branch; fresh [selective sync37887594656](https://github.com/cehinds/AshenSpire/actions/runs/37887594656) passed policy-tests and sync. Protected paths were not weakened.

## Exact-head hosted validation

Primary Test source is `4000288bef3bb0c6284ef30c66b9a7bfd2d03e4c`:

| Workflow | Run | Status |
| --- | --- | --- |
| Heavy CI | [37887222210](https://github.com/cehinds/AshenSpire/actions/runs/37887222210) | Pending final result |
| Tests | [37887222190](https://github.com/cehinds/AshenSpire/actions/runs/37887222190) | Success, all 8 jobs |
| Preview | [37887222170](https://github.com/cehinds/AshenSpire/actions/runs/37887222170) | Success |
| Windows installer | [37887222180](https://github.com/cehinds/AshenSpire/actions/runs/37887222180) | Success |
| Tutorial / co-op HUD / map / quick screens | [37887222181](https://github.com/cehinds/AshenSpire/actions/runs/37887222181), [37887222189](https://github.com/cehinds/AshenSpire/actions/runs/37887222189), [37887222177](https://github.com/cehinds/AshenSpire/actions/runs/37887222177), [37887222153](https://github.com/cehinds/AshenSpire/actions/runs/37887222153) | Success |
| Pages assembly | [37887222129](https://github.com/cehinds/AshenSpire/actions/runs/37887222129) | Success; Test assembly alone does not deploy |

Alternative Test source is `1949fe1da6b11d9b580baa2ac18b60d880a3b2ca`:

| Workflow | Run | Status |
| --- | --- | --- |
| Heavy CI | [37887468974](https://github.com/cehinds/AshenSpire/actions/runs/37887468974) | Pending final result |
| Tests | [37887460846](https://github.com/cehinds/AshenSpire/actions/runs/37887460846) | Success |
| Preview | [37887458227](https://github.com/cehinds/AshenSpire/actions/runs/37887458227) | Success |
| Windows installer | [37887473670](https://github.com/cehinds/AshenSpire/actions/runs/37887473670) | Success |
| Co-op / tutorial / map / quick screens | [37887471261](https://github.com/cehinds/AshenSpire/actions/runs/37887471261), [37887466939](https://github.com/cehinds/AshenSpire/actions/runs/37887466939), [37887465024](https://github.com/cehinds/AshenSpire/actions/runs/37887465024), [37887462958](https://github.com/cehinds/AshenSpire/actions/runs/37887462958) | Success |

Alternative Dev dispatched workflows at runtime400 all passed: architecture [37887957228](https://github.com/cehinds/AshenSpire/actions/runs/37887957228), receipts [37887954942](https://github.com/cehinds/AshenSpire/actions/runs/37887954942), preview [37887944541](https://github.com/cehinds/AshenSpire/actions/runs/37887944541), map [37887950995](https://github.com/cehinds/AshenSpire/actions/runs/37887950995), quick screens [37887948785](https://github.com/cehinds/AshenSpire/actions/runs/37887948785), tests [37887946701](https://github.com/cehinds/AshenSpire/actions/runs/37887946701) and tutorial [37887952984](https://github.com/cehinds/AshenSpire/actions/runs/37887952984).

Both heavy CI runs passed all66 test jobs, including the layout/motion/mobile obstruction checks fixed in this task. The subsequently created67th job compares platform artifact bytes and remains queued at this checkpoint. The three uploaded digest artifacts were also fetched and compared locally: all nine rows agree across Windows/macOS/Linux for each snapshot. They are preserved in `docs/qa/published-display-1167/ci-digests/`. That evidence does not mislabel the still-queued formal comparison as complete.

Development publication refresh [37890907828](https://github.com/cehinds/AshenSpire/actions/runs/37890907828) passed assembly and deployment on reviewed Dev `d18b3423d51b158b503e7e9c4a705c3b5d37dd92`, authenticated actor `cehinds`, through the normal owner guard. The published badges subsequently returned200 and **0.7.1.1167** on primary Dev/Test and Alternative Dev/Test. Release remains **0.7.1.1060** and Main **0.7.1.810**. All six playable pages and HTML downloads also returned200 in the link sweep; recheck after later owner publications if relying on the latest aliases. Source promotion and actual publication are separate recorded successes. Release/Main branches and tags were not changed.

Automatic publication needs a separate follow-up: four successful bot-dispatched alternative previews produced no `workflow_run` Pages event, while four human-push alternative previews created one within1–3 seconds. Current default Dev workflow names/branch filters match; absent runs are not cancelled queue entries. The sync workflows use `GITHUB_TOKEN` to dispatch previews. [GitHub's recursive-event suppression](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) is the strongest explanation, but the API exposes no skipped-trigger reason, so the cause remains an inference. A durable repair must use a supported completion signal and retain the owner-only manual publication guard. This session uses the reviewed operational refresh above; it does not weaken that guard or claim the automatic path is repaired.

## Reproducible evidence and remaining acceptance

- Original appearance gallery: `docs/preview/display-appearance-0.7.1.1163/`, source `8c5c0ee58583330f619096bcee85c7bb042177af`, digest `9bf504e978`, ten verified PNGs. Desktop1440x1000, phone390x844; both switching directions preserve state and play two cards per viewport. T14 motion 34/34 passed on 1163, including reduced motion.
- Portable recipe `node docs/preview/display-appearance-0.7.1.1163/capture.mjs` was rerun successfully on final 1166 source `0332006844ccfe47fd22b23b56c9f31ab148d5bc`; tracked `integrated-1166-report.json` passes all four solo/co-op/desktop/phone cases, resize anchors and card plays. No JavaScript or required-resource errors; optional sound 404s use synthesis fallback.
- Reward/map evidence: `docs/qa/reward-map-layout/`; tracked `integrated-1166.json`, portable `tools/reward-map-layout-qa.mjs`. 833/1440/390px containment and touch Back/reselect/Enter pass; controls ready 41.3ms; no unexpected request/page errors.
- Release gallery: `docs/preview/releases/0.7.1.1060/`, source `0de2379c95a2eea974b8dbd75d830d3eb03e6583`, digest `73fcb8490b`; creation, map, combat, shop and phone screenshots with manifest hashes and pinned Release link.
- Published browser verification: `docs/qa/published-display-1167/`, pinned `https://cehinds.github.io/AshenSpire/test/1167/`; the capture wrapper exited0 and passed all four desktop/phone/solo/canned-co-op cases, debug-only visibility, state retention, card actions and resize anchors. Two inspected screenshots, report, hash/provenance manifest and PowerShell reproduction wrapper are curated. No JavaScript or required-resource errors; eight optional sound404s use the existing synthesis fallback. The report's build field is explicitly identified as the local reference box; the successful publication assembly and pinned URL establish served identity.
- Live LAN, physical phone/native touch and owner/device acceptance remain unverified. Canned co-op captures and source/package checks do not prove those outcomes.
- Original PR batch #1715/#1720/#1721/#1722 is merged; the owner's approved #1715 reply was posted and its fixed changelog thread resolved. Follow-on owner PR #1767 merged into Dev as `cd045335c933e968501aac37d9c8c07c66dd6b8a` at06:11:27 UTC while this promotion's heavy CI was running. The reaction owner then promoted it through [#1771](https://github.com/cehinds/AshenSpire/pull/1771), Test merge `94b981223072c1473df5e77f42bb3696ebd41571`; that later promotion's CI is their separate delivery. Active #1766/#1768 and draft #1749/#1741/#1740 remain separate deliveries. Preserve their branches and use fresh review/CI before merging.

## Next actions if final checks are still pending

1. Read live job results for both heavy matrices above. Fix concrete failures through an independently reviewed Dev PR, canonical receipt regeneration, architecture sync and fresh Test promotion; retain known-bad controls.
2. Verify remaining Alternative Dev runs and Pages assemblies/publications. Compare actual published full build badges and playable/download responses with 1167; leave Release/Main unchanged.
3. Confirm current refs before reporting exact-head success. Save final results in this status document on the named reconciliation branch, push, and compare its origin SHA. An administrative handoff commit alone does not require another gameplay promotion.

Use the setup and source commands in the continuation prompt. New worktrees, TEMP/TMP and outputs belong on D:. GitHub HTTP 408 can leave origin unchanged; verify `git ls-remote` after pushes. No shared branch was force-pushed and no release tag was created. The development Pages refresh used the existing owner publication guard.
