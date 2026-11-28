# Simple Combat ruleset (draft plan)

Goal: a simpler core. Every old mechanic stays in the engine and comes back by editing JSON.

## How the toggles work

- Flags are flipped in place in `games/ashenspire/bundles/core/bundle.json` (owner's choice).
- Each old mechanic comes back by setting its flag on again; every flag gets a `$note`.
- Toggles use the module system that already exists (`engine/modules/<id>`, `gameModule(run, id)`).
- Where an engine path ignores its module flag today (Poise, stance benefits), the flag gets wired in.
- Proof per step: with the flags on, a seeded run's output is unchanged.

## What the simple ruleset turns off

| Mechanic | Today | Simple |
|---|---|---|
| Poise / Stagger | every enemy has `poiseMax`; 20 card ops | off (`stagger:false`, new `poise:false`) |
| Enemy turn | SP pool, several planned moves | one move per turn; a move may pair 2 of attack / block / buff / heal |
| Ranks | rank 1-10 per card, rank-up bonuses | off; rarity only (common, uncommon, rare) |
| Upgrades | hand block + procedural steps, 3 choices | one hand-authored upgrade per card |
| Stances | 6 maneuvers, 2-way matchups, built-in bonuses | 4: attack, defend, smash, skill |
| Stance bonuses | +20% dmg, +50% Block, same-stance discount | none by default; only from rare tags on cards, relics, armaments |

## New stance rules

- Attack beats smash, smash beats defend, defend beats attack: the winner's damage or Block gets +25%.
- The loser is unchanged.
- Skill is neutral: it never wins or loses (powers, buffs, utility).
- Spells keep their school but take one of the four stances.
- Counter, sweep, evade, prepared become tags that add stacks.

## Cards

- Most cards: one effect (damage, block, add a tag, or one effect). Two effects are rare.
- Base scale (owner, 2026-11-27): a basic Strike deals 6, a basic Block gives 5.
- One-effect cards average about 1.3x that per energy.
- Enemy moves pair at most 2 of attack / block / buff / heal.
- A new, smaller hand-authored set (about 30 per class), each card with one authored upgrade.
- The old 273 cards stay in the files, switched off by a card-pool flag.

## Delivery, one PR each

1. Wire the missing flags (Poise, stance benefits, ranks, enemy action count). No gameplay change with flags on.
2. Stance triangle and skill stance; old stances become tags.
3. Enemy single-action turns; rewrite enemy moves.
4. Ranks off, single upgrade path.
5. New card set, one class per PR (Reaver, Rogue, Starseer, Herald, colorless).
6. Balance pass with the sim suite.
