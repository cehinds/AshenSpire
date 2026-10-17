# Enemy decks — enemies play like the player

Owner decisions, 2026-10-17. Branch: `feature/enemy-resources` (off `dev`).
Supersedes the weighted `moves` picker for Core; extends SPEC §4.6 / §4.6a / §4.11.
Follows the JSON module system (`docs/ai/json-game-modules/ARCHITECTURE.md`):
rules and defaults in a module, enemy data in packs, everything overridable per bundle.

## Decisions (owner)

1. Enemies are characters: same five attributes (STR/DEX/CON/WIS/INT) as the player.
   HP, SP, MP, AR, DR, PR, Ward, Poise, draw, hand size all come from the
   player's derived-stat rules — no separate formula.
2. Tier sets stat level: minion lower than a new player; elite comparable to the
   player at that act; boss higher base stats.
3. Enemies have a **deck** of the player's card kinds (attack, defend/block, smash,
   counter, sweep, cast). **Size varies per enemy** (typical 6; fewer or more as the
   enemy needs). Cards cost SP/MP exactly as player cards do (stance discounts,
   Reaction tag, output bonus).
4. **Shuffle and draw like the player**: draw pile → hand → play → discard → reshuffle.
5. Planned plays are visible as intents (SPEC §4.11 preview).
6. Healing (owner, 2026-10-17 06:19) — two shapes, chosen by card tags, all JSON:
   - **full**: tag `heal` → costs **2 MP + 3 SP**, heals **10% max HP**.
   - **cheap**: tags `heal` + `exhaust` → lower cost, card exhausts after use.
   Costs, amount and which tags select which shape live in `healRules`; a card's own
   authored cost still wins.
7. Gear and enemy relics add HP and other stats on top, like player equipment/relics.
8. Most minions land at **2 SP**.
9. **JSON-configurable and modular**: every number above is module settings or pack data;
   nothing tuned in JS. Disabling the module falls back to the legacy `moves` picker.

Related decisions from the same session: breaking hit takes full damage;
stagger = −1 SP next turn + Vulnerable 1 (+25% damage taken), now applied to the
enemy's real SP pool; rounding down.

## Module: `engine/modules/enemies/`

```
module.json              id enemies@1.0.0, instances minion/elite/boss      [done]
settings.schema.json                                                        [done]
defaults.json            tiers, gains, deck, stanceCosts, healRules,       [done]
                         stagger, ai
guide.md                                                                    [done]
state.schema.json        per-enemy piles, sp, mp                            [phase 2]
rules.json / cases.json  turn order and behaviour cases                     [phase 3]
```

Status 2026-10-17: module, settings, pack JSON (33 enemies, 105 cards, 6 gear,
5 relics, via `tools/enemy-decks-convert.mjs`), build validator
(`engine/kernel/gameConfig.js` `verifyEnemyContent`), `tests/enemies-module.test.mjs`.
Runtime still plays legacy moves until phases 2–3.

The tier model below was superseded by Core-scale pools: tier `pools` (HP/SP/MP base)
+ `attributeGains` (player levelGains), budgets minion 3–5 / elite 6–8 / boss 9–12.

`defaults.json` (all overridable from `game.json` / bundle):

```json
{
  "tiers": {
    "minion": { "attributeBudget": [8, 12],  "ruleBaseOffsets": { "hp": -36, "stamina": -1, "mana": -1, "draw": -1, "handSize": -3 } },
    "elite":  { "attributeBudget": [14, 18], "ruleBaseOffsets": {} },
    "boss":   { "attributeBudget": [20, 26], "ruleBaseOffsets": { "hp": 40, "stamina": 1, "mana": 1 } }
  },
  "deck": { "min": 3, "max": 15, "typical": 6, "reshuffle": "whenEmpty" },
  "healRules": {
    "match": "mostSpecific",
    "shapes": [
      { "id": "full",  "tags": ["heal"],            "cost": { "mp": 2, "sp": 3 }, "amount": { "percentMaxHp": 10 } },
      { "id": "cheap", "tags": ["heal", "exhaust"], "cost": { "mp": 1, "sp": 1 }, "amount": { "percentMaxHp": 10 }, "exhaust": true }
    ],
    "authoredCostWins": true,
    "rounding": "down"
  },
  "ai": { "lowHpDefendBias": 1.5, "lowHpThreshold": 0.35, "smashIntoBlockBias": 1.3, "healMissingHpBias": 1.0 },
  "fallback": "legacyMoves"
}
```

- `ruleBaseOffsets` shift each derived-stat row's `base` (player HP base 51 → minion 15 + CON).
- Tier from `enemyTier()` (`src/model/encounterTier.js`); an enemy's own `tier` overrides.
- Targets held by cases/tests: most minions SP 2, elites 3, bosses 4; minion HP within ±10% of today.

## Pack data: `games/ashenspire/packs/core/`

- `enemies.json` — one row per enemy:
  ```json
  { "id": "wanderingSoldier", "tier": "minion",
    "attributes": { "strength": 3, "dexterity": 3, "constitution": 0, "wisdom": 1, "intelligence": 1 },
    "deck": ["soldierSlash", "soldierSlash", "soldierGuard", "soldierSmash", "soldierBrace", "warcry"],
    "firstCard": "warcry", "gear": ["rustedMail"], "relics": [],
    "art": "...", "size": "medium", "levelProfile": { "min": 1, "max": 4 } }
  ```
  `deck` length is free within the module's `deck.min`/`deck.max`.
- `enemyCards.json` — enemy cards, same schema as `cards.json`, `owner: "enemy"`,
  never offered as rewards. Can also reference shared player cards by id.
- `enemyGear.json`, `enemyRelics.json` — same modifier vocabulary as player
  equipment/relics (`self.maxHp=+4`, `self.maxStamina=+1`, …).
- Validator: unknown card/gear/relic ids, deck size outside bounds, attribute sum
  outside tier budget → refuse at build.

## Engine

- Turn: refill SP/MP → draw to hand → plan affordable plays (AI weights from
  settings, deterministic `enemyAI` RNG) → intents → enemy phase plays → discard →
  reshuffle when draw pile empty.
- Reuse `extendEnemyQueue` budget logic with candidates = hand, priced by
  `applyActionCosts` + heal-cost rule; MP and SP both tracked.
- Stats via `deriveStat` with tier offsets; gear/relics through the player's
  modifier resolution, so one path derives both.
- Delayed/charging cards keep `delay` semantics.
- Saves: piles on the enemy entity; reader accepts old `plannedMoves`/`moveId` mid-fight.
- Module disabled → legacy `moves` picker unchanged.

## Conversion

- ~19 enemies / ~60 moves in `src/content/enemies/act1-3.js` → `enemies.json` +
  `enemyCards.json`; decks keep each enemy's identity (signature card ×1).
- Heal-riders (Drain, Golden Guard, Sap Mend…) become `heal` cards: `full` shape for
  elites/bosses; minions (2 SP) can only afford the `cheap` + `exhaust` shape, so
  their heals are one-offs per shuffle.
- `healRules.shapes` match on card tags, so any pack can add shapes (e.g. `heal`+`ritual`).

## UI

- Enemy mini-HUD: SP and MP pips; Inspect shows deck/draw/discard counts, gear, relics.
- Intent shows each planned card with its cost.

## Phases (one PR each, owner review before dev)

1. Module skeleton + settings/defaults + stat derivation (tiers, gear/relic hooks) + cases.
2. Enemy card schema/registry, pack loaders + validator; deck/draw/discard state; save.
3. Planner on hand + SP/MP; heal-cost rule; stagger hits enemy SP.
4. Content conversion (all acts) to pack JSON; balance report regen.
5. UI: pips, multi-card intents, Inspect deck view.

## Touch points

- `src/content/derivedStats.js` (read), `src/model/derivedStats.js` `deriveStat`
- `src/model/state.js` `createEnemyCombatEntity`, `src/model/actionCosts.js` `enemyPoolOf`
- `src/engine/combat.js` `rollIntents`, `src/engine/combatRoundsAdapter.js` `extendEnemyQueue` / `takePlannedMove`
- `src/model/enemyMoveCards.js` → enemy card view
- `games/ashenspire/bundles/core/bundle.json`, resolver output `src/content/generated/gameProfiles.js` (generated; do not hand-edit)
- tests: `enemy-action-pool`, `action-costs-formula`, new `enemy-deck`, `enemy-tier-stats`, module `cases.json`
