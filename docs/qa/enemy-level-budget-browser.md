# Enemy level browser validation — 2026-11-08

Local branch: `codex/resume-enemy-level-budget`; remote branch: `feature/OwnerEnemyLevelBudget`; [PR #2717](https://github.com/cehinds/AshenSpire/pull/2717). The enemy change is open for review; it is not merged. Hosted preview validation remains outstanding; consult the PR for current CI results.

Final browser source: `7befd137c`, with the then-current dev integrated. Later bundler integration `6486df0ee` integrates dev `83752606d`; its conflict retained the new compiler helper API and Windows newline normalization; 27 bundler/counter tests passed. Subsequent dev changes require their own integration verification.

## Results

- The branch's 11 changed test files passed: 101 tests. Two fixture readers required CRLF normalization on Windows, committed as `5d2d28003`.
- Final focused Node gate: 168 tests passed, including the affected enemy files, historical-save regression, inspector projection, sandbox and overhead geometry. Style lint and compiled game-profile checks passed.
- Chromium at 1280×800 and 390×844: six three-enemy boards, covering a minion, elite and boss in each act; 18 individual enemy inspections. Levels match the act/tier minimum, own points total `5 + level`, every own attribute is at least 1, and totals match own plus gear with the configured zero floor.
- All 18 inspectors display the correct level and exact signed own/gear values. The attribute label and value fit their row and become fully visible when the details pane scrolls. Inspection does not mutate stats.
- At both sizes, real card/target inputs resolve attacks and End Turn completes an enemy turn. Levels, own attributes, gear bonuses and HP maxima remain unchanged. Seed 4's first Strike legally misses (d20 4, total 8 versus Evasion 9); the next Strike damages the enemy.
- `qa:sandbox`: 38 passed, 0 failed, including crowded inspection and pointer-ownership criteria. Before opening the PR, the original 28 criteria ran against both dev `c52fea524` (12 PASS / 16 expected FAIL) and the integrated enemy branch (28 PASS / 0 FAIL). The baseline was a preserved managed worktree instead of the sandbox's temporary-worktree deletion path. `enemy-level-budget.acceptance.json` holds the final criteria.
- No unexpected console errors, page exceptions or failed HTTP requests. Pre-input Chromium vibration restrictions are recorded. Optional sound-sample probes for synthesized cues return 404 by design; the browser test accepts only exact recipe IDs absent from both the sample and art manifests, on this server, with status 404. Other failures remain fatal.

The inspector fix gives the attributes row a stable fact ID and places its full label above its value. This prevents the former desktop and phone ellipsis from hiding the own/gear key.

## Follow-up fixes and review

- The overlapping input region was transparent player health-row padding over an enemy. Only painted tracks, values and badges now receive meter input. `tests/combat-hud-hitbox.browser.mjs` failed before the change (`player` instead of `e2`), then passed at 1280×800, 390×844, 1920×1080 and 768×1024. It uses actual mouse/touch long presses to inspect both the enemy and the player's HP track, then targets a Strike through the former overlap. Visible HP tracks retain their own input ownership.
- Sandbox holds accept an optional normalized `position` so the receipt reproduces the body point at 50%/60% rather than pressing a different visible control at the element center. Invalid/out-of-box positions fail validation.
- Independent review found that the initial budget rule changed old saved profiles' tier budgets. The correction preserves authored points and the last applicable explicit tag budget; only unbudgeted new enemy tags use player progression. A real historical profile fixture now verifies exact seeded stats in new encounters and restored fights. The reviewer independently compared all 33 historical enemies across five seeds against the old resolver: exact match.
- Independent re-review found no remaining actionable findings in the save fix, hitbox fix, sandbox extension or first integration conflict resolution.

## Reproduce

Set `PLAYWRIGHT_MODULE` to an existing Playwright installation and optionally `QA_OUT` to an artifact directory, then run:

```text
node tests/enemy-level-budget.browser.mjs
```

`QA_INSPECTION_ONLY=1` and `QA_FLOW_ONLY=1` run the two parts separately. The final run executed both together: six boards, 18 inspectors and two attack/turn flows passed. The source server binds loopback and closes with the browser. Verified pinned art packs must be present.

For the sandbox, expose Playwright through `NODE_PATH` if it is not locally installed:

```text
npm run qa:sandbox -- docs/qa/enemy-level-budget.acceptance.json --out <artifact directory>
```

## Limits and follow-ups

- These are Chromium viewport tests, not physical-device validation or a full campaign/balance playthrough.
- The HP formula table is not live combat HP; see `enemy-level-budget-pools.md`. Live combat continues to roll the authored registry HP ranges. Do not use the calculated table to claim an HP rebalance shipped.
- The hitbox regression covers one deterministic three-enemy formation at four viewport sizes, not every possible arrangement. The older hidden `combatant-info` control is not a test entry point; tests use visible long-press gestures.
- The CI recovery fix is independently merged as PR #2716, merge commit `0bc1881073e063748a2d4b59a445f8e9bbae1ecc`, after all checks passed. No dev promotion or enemy merge was performed in this continuation.

Local screenshots and detailed receipts: `C:/Users/const/OneDrive/Documents/ChatGPT/AshenSpire2/Artifacts/enemy-levels-20261108/` (`validated`, `flows`, and `sandbox`). Initial screenshots in the parent directory show the truncated label before the fix. Bulk evidence stays outside the repository.

Final receipts: `C:/Users/const/OneDrive/Documents/ChatGPT/AshenSpire2/Artifacts/enemy-pr-20261108/` (`final-browser`, `final-hitbox`, `final-sandbox`). Review screenshots and their [capture record](../preview/features/enemy-level-budget/README.md) are committed under `docs/preview/features/enemy-level-budget/`.

## Remaining session work

- Owner backlog #8 (status saves) explicitly waits for the enemy-level change to merge; it is not implemented by this PR.
- #2709 still records the owner choice between 70px and 58px phone HUD bars for three enemies. Its visual overlap is separate from the transparent-padding input fix here.
- #2706's spell redesign still records owner decisions pending. #2694's approved review-branch pipeline remains open; do not silently substitute the old direct dev→test promotion path.
- CI fix #2716 is already merged. The latest live queue also contains promotion PR #2719, owned by the other active workflow; this continuation did not duplicate or merge it.
