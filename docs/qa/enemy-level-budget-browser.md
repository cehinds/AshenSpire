# Enemy level browser validation — 2026-11-08

Local branch: `codex/resume-enemy-level-budget`, based on `origin/feature/OwnerEnemyLevelBudget` at `4d1900638`. This report does not claim the enemy change is merged or published.

## Results

- The branch's 11 changed test files passed: 101 tests. Two fixture readers required CRLF normalization on Windows, committed as `5d2d28003`.
- After the inspector layout fix, enemy budgets, inspector projection and save compatibility passed: 24 tests.
- Chromium at 1280×800 and 390×844: six three-enemy boards, covering a minion, elite and boss in each act; 18 individual enemy inspections. Levels match the act/tier minimum, own points total `5 + level`, every own attribute is at least 1, and totals match own plus gear with the configured zero floor.
- All 18 inspectors display the correct level and exact signed own/gear values. The attribute label and value fit their row and become fully visible when the details pane scrolls. Inspection does not mutate stats.
- At both sizes, real card/target inputs resolve attacks and End Turn completes an enemy turn. Levels, own attributes, gear bonuses and HP maxima remain unchanged. Seed 4's first Strike legally misses (d20 4, total 8 versus Evasion 9); the next Strike damages the enemy.
- `qa:sandbox`: 28 passed, 0 failed, after-tree run. `enemy-level-budget.acceptance.json` holds the criteria. A fresh `--base origin/dev` comparison remains required before opening a visible-change PR.
- No unexpected console errors, page exceptions or failed HTTP requests. Pre-input Chromium vibration restrictions are recorded. Optional sound-sample probes for synthesized cues return 404 by design; the browser test accepts only exact recipe IDs absent from both the sample and art manifests, on this server, with status 404. Other failures remain fatal.

The inspector fix gives the attributes row a stable fact ID and places its full label above its value. This prevents the former desktop and phone ellipsis from hiding the own/gear key.

## Reproduce

Set `PLAYWRIGHT_MODULE` to an existing Playwright installation and optionally `QA_OUT` to an artifact directory, then run:

```text
node tests/enemy-level-budget.browser.mjs
```

`QA_INSPECTION_ONLY=1` and `QA_FLOW_ONLY=1` run the two independently verified parts. They were run separately for this report. The source server binds loopback and closes with the browser. Verified pinned art packs must be present.

For the sandbox, expose Playwright through `NODE_PATH` if it is not locally installed:

```text
npm run qa:sandbox -- docs/qa/enemy-level-budget.acceptance.json --out <artifact directory>
```

## Limits and follow-ups

- These are Chromium viewport tests, not physical-device validation or a full campaign/balance playthrough.
- The HP formula table is not live combat HP; see `enemy-level-budget-pools.md`. Live combat continues to roll the authored registry HP ranges. Do not use the calculated table to claim an HP rebalance shipped.
- Existing overlapping sprite hitboxes can inspect a neighboring fighter: in the seed-4 three-actor fixture, holding the second enemy sprite's center opened the player inspector. Individual inspector checks therefore use real single-enemy fixtures; this does not certify multi-enemy targeting/inspection hitboxes. The older hidden `combatant-info` control also is not a usable test entry point; tests use the visible long-press gesture.
- The CI recovery fix is independently merged as PR #2716, merge commit `0bc1881073e063748a2d4b59a445f8e9bbae1ecc`, after all checks passed. No dev promotion or enemy merge was performed in this continuation.

Local screenshots and detailed receipts: `C:/Users/const/OneDrive/Documents/ChatGPT/AshenSpire2/Artifacts/enemy-levels-20261108/` (`validated`, `flows`, and `sandbox`). Initial screenshots in the parent directory show the truncated label before the fix. Bulk evidence stays outside the repository.
