## 7. Recorded full-run reports (runsim)

Hand-recorded measurements from `tools/runsim.mjs`, which plays whole runs and
is too slow to regenerate here: `tools/balance.mjs` copies this section
verbatim from `docs/balance-runs.md`, so edit that file and regenerate. Every
table is a report, not a pass band (owner ruling D1, 2026-09-26). Runs are
manual and not part of CI. Seeds are runsim's fixed formula: seed `i` of a
class is `(i * 2654435761) >>> 0` for `i = 1..N`, the same for every class
and every arm.

### 7.1 The Mana-aware A/B (SPEC §5.5.1, FINISH §4)

- **Command:** `node tools/runsim.mjs 50 --mana-ab`
- **Seeds:** `i = 1..50` per class, both arms on the same seeds.
- **Date / tree:** 2026-10-02, commit `7b1945b08` (this branch with `dev`
  merged at `ac6af3251`, after #1478's XP curve), Node v22.22.2.
- **Arms:** OFF is the old no-Mana simulation: before each bot decision the
  Mana pool is raised to the dearest Mana price in hand, so the Mana line is
  paid but never refuses a card. Card damage and every seed are unchanged.
  ON is the shipped game: when nothing in hand is affordable but a card short
  only on Mana would be, the bot drinks an Azure (Mana) flask charge first, as
  a player would. Mana spent counts the fights' own `manaSpent` events.
  The seat order is the tool's fixed default (weald → marches → reach).

| Class | OFF wins | OFF Mana spent / run | ON wins | ON Mana spent / run | Win delta (ON − OFF) |
|---|---|---|---|---|---|
| Reaver | 0/50 (0.0%) | 8.4 | 0/50 (0.0%) | 3.2 | 0.0 pts |
| Starseer | 0/50 (0.0%) | 20.5 | 0/50 (0.0%) | 19.5 | 0.0 pts |
| Rogue | 1/50 (2.0%) | 8.4 | 0/50 (0.0%) | 3.6 | −2.0 pts |
| Herald | 1/50 (2.0%) | 27.5 | 0/50 (0.0%) | 6.9 | −2.0 pts |
| All | 2/200 (1.0%) | 16.2 | 0/200 (0.0%) | 8.3 | −1.0 pts |

Mana the OFF arm had to waive, per run: Reaver 6.4, Starseer 2.7, Rogue 6.3,
Herald 24.1. Azure charges the ON arm drank, per run: Reaver 0.6, Starseer
0.2, Rogue 0.8, Herald 2.9 (the OFF arm drinks none: its pool is never short).
Reading: the Starseer is the one class whose Mana pool already pays for nearly
every Mana card it draws; the Herald would spend about four times the Mana it
can afford even after drinking its Azure charges.

### 7.2 Seat-tier win rates (SPEC §13.3, FINISH §4)

- **Configured multipliers** (`src/content/balance.js`, printed by the tool
  from the live registries, and checked against them by
  `node tools/balance.mjs --check`): `balance.seatTiers` = 1: 1, 2: 1.5,
  3: 1.9; `balance.bossTiers` = 1: hp 0.8 / damage 0.8, 2: hp 2.2 / damage
  1.5, 3: hp 2.2 / damage 1.5.
- **Command:** `node tools/runsim.mjs 300 --seat-tiers --seeded-seats` (the
  per-run seat order a real run draws, SPEC §13.4), and
  `node tools/runsim.mjs 300 --seat-tiers` (the fixed order) for comparison.
- **Seeds:** `i = 1..300` per class, 1,200 runs per command.
- **Date / tree:** 2026-10-02, commit `7b1945b08` (as §7.1), Node v22.22.2.
- A tier's rate is the runs that beat its boss over the runs that reached it.
  A boss row counts the runs that reached that boss; the rest died on the way.

Seeded seat order, per class:

| Class | Tier 1 | Tier 2 | Tier 3 | Full-run wins |
|---|---|---|---|---|
| Reaver | 207/300 (69.0%) | 7/207 (3.4%) | 0/7 (0.0%) | 0/300 |
| Starseer | 218/300 (72.7%) | 4/218 (1.8%) | 0/4 (0.0%) | 0/300 |
| Rogue | 246/300 (82.0%) | 17/246 (6.9%) | 1/17 (5.9%) | 1/300 |
| Herald | 275/300 (91.7%) | 4/275 (1.5%) | 1/4 (25.0%) | 1/300 |
| All | 946/1200 (78.8%) | 32/946 (3.4%) | 2/32 (6.3%) | 2/1200 |

Seeded seat order, per tier and seat (every class pooled):

| Tier | Seat | Enemy HP × | Cleared |
|---|---|---|---|
| 1 | weald | 1.000 | 395/400 (98.8%) |
| 1 | marches | 0.667 | 201/408 (49.3%) |
| 1 | reach | 0.526 | 350/392 (89.3%) |
| 2 | weald | 1.500 | 19/227 (8.4%) |
| 2 | marches | 1.000 | 3/376 (0.8%) |
| 2 | reach | 0.789 | 10/343 (2.9%) |
| 3 | weald | 1.900 | 2/8 (25.0%) |
| 3 | marches | 1.267 | 0/18 (0.0%) |
| 3 | reach | 1.000 | 0/6 (0.0%) |

Seeded seat order, the boss each tier actually fought, with that boss's own
scale (the final tier may send a seat to the null-seat Valkyrie, SPEC §13.5,
whose baseline is the final tier):

| Tier | Seat | Boss | Boss HP × | Boss damage × | Fought | Cleared |
|---|---|---|---|---|---|---|
| 1 | weald | `bossOmen` | 0.800 | 0.800 | 396 | 395 |
| 1 | marches | `a2_bossStitchedKing` | 0.533 | 0.533 | 351 | 201 |
| 1 | reach | `a3_bossFurnaceSaint` | 0.421 | 0.421 | 355 | 350 |
| 2 | weald | `bossOmen` | 3.300 | 2.250 | 194 | 19 |
| 2 | marches | `a2_bossStitchedKing` | 2.200 | 1.500 | 277 | 3 |
| 2 | reach | `a3_bossFurnaceSaint` | 1.737 | 1.184 | 264 | 10 |
| 3 | weald | `bossOmen` | 4.180 | 2.850 | 7 | 2 |
| 3 | marches | `a2_bossStitchedKing` | 2.787 | 1.900 | 13 | 0 |
| 3 | reach | `a3_bossRotValkyrie` | 2.200 | 1.500 | 6 | 0 |

Fixed seat order (weald → marches → reach), per class:

| Class | Tier 1 | Tier 2 | Tier 3 | Full-run wins |
|---|---|---|---|---|
| Reaver | 287/300 (95.7%) | 3/287 (1.0%) | 0/3 (0.0%) | 0/300 |
| Starseer | 298/300 (99.3%) | 0/298 (0.0%) | — | 0/300 |
| Rogue | 300/300 (100.0%) | 11/300 (3.7%) | 1/11 (9.1%) | 1/300 |
| Herald | 293/300 (97.7%) | 3/293 (1.0%) | 2/3 (66.7%) | 2/300 |
| All | 1178/1200 (98.2%) | 17/1178 (1.4%) | 3/17 (17.6%) | 3/1200 |

Fixed seat order, the boss each tier fought:

| Tier | Seat | Boss | Boss HP × | Boss damage × | Fought | Cleared |
|---|---|---|---|---|---|---|
| 1 | weald | `bossOmen` | 0.800 | 0.800 | 1185 | 1178 |
| 2 | marches | `a2_bossStitchedKing` | 2.200 | 1.500 | 840 | 17 |
| 3 | reach | `a3_bossRotValkyrie` | 2.200 | 1.500 | 16 | 3 |

Tolerance, stated: under D1 there is no band, so any recorded rate passes.
What the tables show is that on this tree the tier-2 boss is the wall (3.4% of
the runs that reach tier 2 clear it with the seeded order), and the full-run
rates are far below the 39–85% that #1309, #1381 and #1383 recorded on their
trees. Why they moved is a tuning question for the owner; no balance number was
changed here.
