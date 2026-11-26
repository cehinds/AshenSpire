# Enemy level scaling (draft, 2026-11-20)

Owner brief: enemies get tougher as the player climbs floors in an act; elites and bosses sit
higher; bosses must not snowball into 4+ actions.

## What the game does today (Core 2)

- An enemy's level is fixed per enemy (`levelProfile.min`); the floor is ignored.
  - Act 1 minions 1, elites 2, bosses 3; act 2: 2 / 3 / 4; act 3: 3 / 4 / 5 (SPEC §17 table).
- Level only buys attribute points (budget 5 + L) and a little SP/MP. HP does not grow with level.
- Level also adds straight into enemy Precision (×1), accuracy (+L/5) and contest DC (+L).
- Actions per turn = SP pool (tier base 2/3/3 + Dex, Con, Wis, Int shares), spent on 1–2 SP moves.
- The map: 9 floors then the boss on floor 10; elites from floor 3.

## Proposed rule

### Level by act, tier and floor step

Floor step: floors 1–3 = 0, 4–6 = +1, 7–9 = +2.

| Act | Minion (step 0/1/2) | Elite (step 0/1/2) | Boss |
|---|---|---|---|
| 1 Weald | 1 / 2 / 3 | 2 / 3 / 4 | 5 |
| 2 Marches | 3 / 4 / 5 | 4 / 5 / 6 | 8 |
| 3 Reach | 5 / 6 / 7 | 6 / 7 / 8 | 11 |

- Minions sit one level under elites, so the three columns stay in step.
- Decided per fight from `run.actNumber`, `run.floor` and the encounter's tier; no RNG.

### What each floor step buys (minions and elites)

- **+1 level** → +1 attribute point (existing 5 + L budget).
- **Gear upgrade**: weapon +1 AR, armour +1 DR per step (bosses: +2, as if step 2).
- **+1 card** per step, drawn (seeded, no repeats) from the enemy's level-card list.
- **HP**: +8% per step (owner, 2026-11-20).

### Level-card lists (owner, 2026-11-20: build them procedurally)

- `tools/enemy-level-cards.mjs` writes `games/ashenspire/packs/core/enemyLevelCards.json`:
  one list per enemy, editable by hand afterwards, checked by a test.
- Each list mixes two kinds:
  - **Unique**: a heavier take on one of the enemy's own cards (its strongest attack at
    +50% damage, or its block card with a rider), named for the enemy.
  - **Shared**: player cards whose effect an enemy move can express (damage, hits, block,
    simple statuses) and whose attribute or school matches the enemy's top attributes.
- Every level card costs 2 SP when the enemy plays it.
- Bosses draw two level cards (as if step 2).

### Keeping bosses sane

- **SP cap per tier**: minion 2, elite 3, boss 3, applied after gear and relics.
- **Favour two actions**: every card added by a level step costs 2 SP, so a 3 SP boss
  usually plays a 2 + 1 turn, rarely three 1 SP cards.
- **Dex and Wis cap 4 for elites and bosses**: extra points spill to Str, Con, Int.
  Keeps Evasion and SP near today's numbers.
- Precision and contests are gone from Core (owner, 2026-11-20), so their level terms need no cap.

## Suggestions beyond the brief

- Show the level step on the map (a small chevron on floors 4–6, two on 7–9) so the ramp reads.
- Elite drops scale with level step (rarer card on step 2) so fighting the harder elite pays.
- Kill XP already scales with enemy level, so class and weapon XP rise naturally; watch the curve.
- Later: Custom Climb `ascension` can add +1 to every row of the table (it changes nothing today).

## Touches

- SPEC §17 *Enemy levels and stat budget* (table, budget unchanged), new SP cap and Dex/Wis cap.
- `src/engine/runCombat.js` (level per fight), `src/model/gameProfileEnemy.js` (use that level,
  gear step, SP cap), `engine/kernel/gameConfig.js` (`enemyLevel` takes the fight level),
  `games/ashenspire/packs/core/characters.json` (levelProfile ranges), tests
  `tests/enemy-level-budget.test.mjs` plus a new scaling test.
