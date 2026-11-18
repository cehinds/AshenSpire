# Level pace, 2026-11-18

Owner ruling (`owner-ruling-2026-11-18.md` §14, revised): XP per fight follows a polynomial that grows with the fight's floor inside the act and with the act. The first enemy of act 1 pays little. Targets at the END of each act, every fight won: act 1 level 2-3, act 2 level 4-6, act 3 level 6-8; low-elite routes at the bottom of a band, elite-heavy routes at the top; no fight climbs more than 2 levels.

Measure with `node tools/level-pace-sim.mjs [seeds]` (zero-dep; walks the real act maps, seeds 1000.., mid-range enemy levels). Policies: **min** takes the path with the fewest elites (0.4 per run), **typical** is a random walk (3.1), **max** takes the most (5.9). The tool prints whether min p10 and max p90 sit inside the bands, and the XP of the first fight.

## Rule

`fight XP = (win + kills) x scale x (floor / floors)^floorExponent x act^actExponent`, then x the tier multiplier (`balanceXp.fightCurve`, `levelup.js fightCurveFactor`). `floors` is the act's boss floor.

## Level at the end of each act (300 seeds; mean [p10 p50 p90])

| Policy | Act | Before (flat, elite x1.5, boss x2) | After |
|---|---|---|---|
| min elites | 1 / 2 / 3 | 1.99 / 2.95 / 3.75 | 2.17 [2 2 3] / 4.42 [4 4 5] / 6.35 [6 6 7] |
| typical | 1 / 2 / 3 | 2.15 / 3.13 / 3.95 | 2.52 [2 2 3] / 4.96 [4 5 6] / 6.92 [6 7 8] |
| max elites | 1 / 2 / 3 | 2.28 / 3.35 / 4.00 | 2.81 [2 3 4] / 5.44 [5 5 6] / 7.43 [7 7 8] |

Most levels in one fight: 1 before, 2 after (a 300-seed typical run once climbs 3; 100 seeds show 2). First fight of act 1 pays about 1.8 XP (was 17 or more).

## Settings

| Key | Before | After |
|---|---|---|
| `balanceXp.fightCurve.scale` | none | 2.7 |
| `balanceXp.fightCurve.floorExponent` | none | 1.8 |
| `balanceXp.fightCurve.actExponent` | none | 1.5 |
| `balanceXp.tierMultiplier.elite` | 1.5 | 3 (owner, after the first pass at 2) |
| `balanceXp.tierMultiplier.boss` | 2 | 1.5 |
| `balanceCore.level.xp.growth` | 1.5 | 1.5 (unchanged) |

The boss multiplier is below the owner's suggested 2-3 on purpose: a boss already stands on the act's last floor, where the curve peaks, and boss 2 or more let a low-elite route climb 3 levels in one fight. Pinned by `tests/level-pace-sim.test.mjs`.

Owner set elite to x3 (boss stays x1.5). Known overshoot: an elite-heavy act 1 can end at level 4 (p90), one above the 2-3 band; lowering `scale` did not remove it without dropping low-elite act 1 below level 2 (p10 1), so scale stays 2.7. Elite-heavy routes end act 3 at about 7-8 (p50 7, p90 8).
