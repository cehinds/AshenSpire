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
- **Date / tree:** 2026-10-02, commit `8105bcf19` (`dev` at `c2a01514b` plus
  the `--mana-ab` / `--seat-tiers` flags), Node v22.22.2.
- **Arms:** OFF is the old no-Mana simulation: before each bot decision the
  Mana pool is raised to the dearest Mana price in hand, so the Mana line is
  paid but never refuses a card. Card damage and every seed are unchanged.
  ON is the shipped game. Mana spent counts the fights' own `manaSpent` events.
  The seat order is the tool's fixed default (weald → marches → reach).

| Class | OFF wins | OFF Mana spent / run | ON wins | ON Mana spent / run | Win delta (ON − OFF) |
|---|---|---|---|---|---|
| Reaver | 0/50 (0.0%) | 8.5 | 0/50 (0.0%) | 2.6 | 0.0 pts |
| Starseer | 0/50 (0.0%) | 19.9 | 0/50 (0.0%) | 19.3 | 0.0 pts |
| Rogue | 0/50 (0.0%) | 8.1 | 0/50 (0.0%) | 2.4 | 0.0 pts |
| Herald | 2/50 (4.0%) | 27.9 | 0/50 (0.0%) | 4.1 | −4.0 pts |
| All | 2/200 (1.0%) | 16.1 | 0/200 (0.0%) | 7.1 | −1.0 pts |

Mana the OFF arm had to waive, per run: Reaver 6.5, Starseer 2.2, Rogue 6.2,
Herald 24.7. Reading: the Starseer is the one class whose Mana pool already
pays for nearly every Mana card it draws; the Herald would spend about seven
times the Mana it can afford.

### 7.2 Seat-tier win rates (SPEC §13.3, FINISH §4)

- **Configured multipliers** (`src/content/balance.js`, printed by the tool
  from the live registries): `balance.seatTiers` = 1: 1, 2: 1.5, 3: 1.9;
  `balance.bossTiers` = 1: hp 0.8 / damage 0.8, 2: hp 2.2 / damage 1.5,
  3: hp 2.2 / damage 1.5.
- **Command:** `node tools/runsim.mjs 300 --seat-tiers --seeded-seats` (the
  per-run seat order a real run draws, SPEC §13.4), and
  `node tools/runsim.mjs 300 --seat-tiers` (the fixed order) for comparison.
- **Seeds:** `i = 1..300` per class, 1,200 runs per command.
- **Date / tree:** 2026-10-02, commit `8105bcf19`, Node v22.22.2.
- A tier's rate is the runs that beat its boss over the runs that reached it.

Seeded seat order, per class:

| Class | Tier 1 | Tier 2 | Tier 3 | Full-run wins |
|---|---|---|---|---|
| Reaver | 207/300 (69.0%) | 4/207 (1.9%) | 0/4 (0.0%) | 0/300 |
| Starseer | 218/300 (72.7%) | 0/218 (0.0%) | — | 0/300 |
| Rogue | 241/300 (80.3%) | 16/241 (6.6%) | 5/16 (31.3%) | 5/300 |
| Herald | 262/300 (87.3%) | 3/262 (1.1%) | 2/3 (66.7%) | 2/300 |
| All | 928/1200 (77.3%) | 23/928 (2.5%) | 7/23 (30.4%) | 7/1200 |

Seeded seat order, per tier and seat (every class pooled), with the scale the
configured rows give that fight:

| Tier | Seat | Enemy HP × | Boss HP × | Boss damage × | Cleared |
|---|---|---|---|---|---|
| 1 | weald | 1.000 | 0.800 | 0.800 | 391/400 (97.8%) |
| 1 | marches | 0.667 | 0.533 | 0.533 | 184/408 (45.1%) |
| 1 | reach | 0.526 | 0.421 | 0.421 | 353/392 (90.1%) |
| 2 | weald | 1.500 | 3.300 | 2.250 | 11/220 (5.0%) |
| 2 | marches | 1.000 | 2.200 | 1.500 | 6/377 (1.6%) |
| 2 | reach | 0.789 | 1.737 | 1.184 | 6/331 (1.8%) |
| 3 | weald | 1.900 | 4.180 | 2.850 | 4/8 (50.0%) |
| 3 | marches | 1.267 | 2.787 | 1.900 | 2/8 (25.0%) |
| 3 | reach | 1.000 | 2.200 | 1.500 | 1/7 (14.3%) |

Fixed seat order (weald → marches → reach), per class:

| Class | Tier 1 | Tier 2 | Tier 3 | Full-run wins |
|---|---|---|---|---|
| Reaver | 287/300 (95.7%) | 2/287 (0.7%) | 0/2 (0.0%) | 0/300 |
| Starseer | 298/300 (99.3%) | 0/298 (0.0%) | — | 0/300 |
| Rogue | 300/300 (100.0%) | 2/300 (0.7%) | 0/2 (0.0%) | 0/300 |
| Herald | 282/300 (94.0%) | 1/282 (0.4%) | 1/1 (100.0%) | 1/300 |
| All | 1167/1200 (97.3%) | 5/1167 (0.4%) | 1/5 (20.0%) | 1/1200 |

Tolerance, stated: under D1 there is no band, so any recorded rate passes.
What the tables show is that on this tree the tier-2 boss is the wall (2.5% of
the runs that reach tier 2 clear it with the seeded order), and the full-run
rates are far below the 39–85% that #1309, #1381 and #1383 recorded on their
trees. Why they moved is a tuning question for the owner; no balance number was
changed here.
