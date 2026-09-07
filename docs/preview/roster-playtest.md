# Roster integration playtest

Run from `work/roster`. All commands below completed successfully on the integrated source checkout. No content tuning occurred during this test.

## Campaigns

`node tools/runsim.mjs 3 --deep`: 12 campaigns, fixed seeds `i * 2654435761 >>> 0` for i=1..3 per class. Reaver, Starseer, Rogue and Herald each completed 2/3 campaigns. Eight victories and four defeats; 288 fights, 113 flask uses, 68 graces and 26 event choices. No crashes. This is integration coverage, not an estimated win rate: no equivalent baseline campaign was run. The greedy bot picks the first terminal, so direct alternative-boss coverage follows.

The bot recorded 25.6 level-ups/run versus the existing 10–20 acceptance reference and no gated quest steps. These are reported limitations; this task did not rebalance levels or prove quest-chain completion.

## Direct alternative bosses and continuation

`node ../../outputs/roster-integration-probe.mjs`: all seven new bosses against all four unmodified starting class kits at seed719. After one committed end-turn, save through JSON and restore with current registry and RNG counters; compare JSON-normalized snapshots and counters after every subsequent bot action until victory or defeat. All 28 matched and resolved (9 victories,19 defeats). These starting kits are intentionally unprogressed even against Act3 bosses; results are not route difficulty measurements. 49 actual Dodge rolls and 61 actual healing-flask uses occurred. Initial probe compared undefined in-memory properties against JSON-omitted properties; comparison now uses the persisted JSON representation on both sides.

| Class | Boss | Result | Turns |
|---|---|---|---:|
| reaver | bellKeeper | victory | 17 |
| reaver | thornMatriarch | victory | 20 |
| reaver | glassRegent | defeat | 21 |
| reaver | marrowOrganist | defeat | 15 |
| reaver | furnaceSaint | defeat | 15 |
| reaver | hollowAstronomer | defeat | 11 |
| reaver | ashheartDragon | defeat | 13 |
| starseer | bellKeeper | victory | 12 |
| starseer | thornMatriarch | victory | 14 |
| starseer | glassRegent | defeat | 13 |
| starseer | marrowOrganist | defeat | 8 |
| starseer | furnaceSaint | defeat | 7 |
| starseer | hollowAstronomer | defeat | 7 |
| starseer | ashheartDragon | defeat | 6 |
| rogue | bellKeeper | victory | 12 |
| rogue | thornMatriarch | victory | 13 |
| rogue | glassRegent | defeat | 17 |
| rogue | marrowOrganist | defeat | 13 |
| rogue | furnaceSaint | defeat | 15 |
| rogue | hollowAstronomer | defeat | 11 |
| rogue | ashheartDragon | defeat | 10 |
| herald | bellKeeper | victory | 9 |
| herald | thornMatriarch | victory | 9 |
| herald | glassRegent | defeat | 10 |
| herald | marrowOrganist | victory | 12 |
| herald | furnaceSaint | defeat | 11 |
| herald | hollowAstronomer | defeat | 8 |
| herald | ashheartDragon | defeat | 10 |

## Focused checks

- `node tests/branchingBosses.test.mjs`: 6 passed, including real LAN selected terminal, original legacy boss assignment and actual save loading without RNG changes.
- `node tests/armamentTrading.test.mjs`: 8 passed, including both shipped weapon-art purchases and real smith installation, atomic refusal and persisted mount/stock state.
- `node tools/flask-intent-smoke.mjs`: 9 passed, explicit host healing action spends exactly one charge and broadcasts its resulting state.
- `node tests/framework.test.mjs`: 82 passed, including repeated Dodge success/failure and insufficient resources at all three weight classes; ordinary Block semantics retained.

Weapon-art purchase/install coverage is through the focused tests, not purchases made by the campaign bot. Browser presentation and new sprite playback are separate parent-agent checks.
