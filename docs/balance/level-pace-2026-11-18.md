# Level pace, 2026-11-18

Owner ruling (`owner-ruling-2026-11-18.md` §14): a player who fights many elites reaches about level 8 by the end of act 3, and every player reaches at least level 4.

Measure with `node tools/level-pace-sim.mjs [seeds]` (zero-dep; walks the real act maps for seeds 1000.., every fight won, mid-range enemy level per act). Policies: **min** takes the path with the fewest elites, **typical** is a random walk, **max** takes the path with the most. A map offers about 0.4 elites per run on the min path, 3.1 typical and 5.9 on the max path, so the elite multiplier is what separates them.

## Level at the end of act 3 (300 seeds; mean [p10 p50 p90])

| Policy | Before | After |
|---|---|---|
| min elites | 3.75 [3 4 4] | 5.15 [5 5 6] |
| typical | 3.95 [4 4 4] | 6.73 [6 7 7] |
| max elites | 4.00 [4 4 4] | 7.96 [7 8 8] |

Per act (after): min 2.43 / 3.90 / 5.15, typical 3.15 / 5.20 / 6.73, max 3.98 / 6.34 / 7.96. Before: min 1.99 / 2.95 / 3.75, typical 2.15 / 3.13 / 3.95, max 2.28 / 3.35 / 4.00. Most levels climbed in one fight: 1 before, 2 after.

## Settings

| Key | Before | After |
|---|---|---|
| `balanceXp.tierMultiplier.elite` | 1.5 | 6 |
| `balanceXp.tierMultiplier.boss` | 2 | 3 |
| `balanceCore.level.xp.growth` | 1.5 | 1.2 |

Everything else is unchanged (`combatWin` 25, kill 10, `combatPowerMultiplier` 0.2, curve base 200, round 10). A flatter curve lifts everyone (the floor); the elite multiplier opens the gap between paths. Pinned by `tests/level-pace-sim.test.mjs`.
