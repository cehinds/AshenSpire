# Enemy decks — enemies play like the player

Owner decisions, 2026-10-17. Branch: `feature/enemy-resources` (off `dev`).
Supersedes the weighted `moves` picker for Core; extends SPEC §4.6 / §4.6a / §4.11.

## Decisions (owner)

1. Enemies are characters: same five attributes (STR/DEX/CON/WIS/INT) as the player.
   HP, SP, MP, AR, DR, PR, Ward, Poise, draw, hand size all come from the
   player's `derivedStatRules` (`src/content/derivedStats.js`) — no separate formula.
2. Tier sets stat level:
   - minion → lower than a new player
   - elite → comparable to the player at that act
   - boss → higher base stats
3. Enemies have a **deck of ~6 cards** using the player's card kinds:
   attack, defend/block, smash, counter, sweep, cast. Cards cost SP/MP exactly as
   player cards do (`applyActionCosts`, stance discounts, Reaction tag, output bonus).
4. **Shuffle and draw like the player**: draw pile → hand → play → discard → reshuffle.
5. Enemy plays are visible: planned cards show as intents (SPEC §4.11 preview).
6. Healing costs 2–3 SP/MP (heal ≤5 → 2, heal ≥6 → 3) unless the card authors its own cost.
7. Gear and enemy relics add HP (and other stats) on top, like player equipment/relics.
8. Most minions land at **2 SP**.

Related decisions from the same session (core-0.8.0-feedback.md follow-up):
breaking hit takes full damage; stagger = −1 SP next turn + Vulnerable 1
(+25% damage taken) — now applies to enemies' real SP pool; rounding down.

## Stat model

Enemy stats = player rules + a **tier profile** (new, content-owned):

```js
// src/content/enemyTiers.js (new)
export const ENEMY_TIERS = {
  minion: { attributeBudget: [8, 12],  bases: { hp: -36, stamina: -1, mana: -1, draw: -1, handSize: -3 } },
  elite:  { attributeBudget: [14, 18], bases: {} },
  boss:   { attributeBudget: [20, 26], bases: { hp: +40, stamina: +1, mana: +1 } },
};
```

- `bases` offsets each rule row's `base` (player HP base 51 → minion 15 + CON).
- Each enemy authors `attributes` (sum inside its tier's budget); validator enforces.
- Level growth uses the same `perLevel` terms (enemy `levelProfile`).
- Gear/relics resolve through the player's modifier path (`resolveRelicModifiers`,
  equipment pool bonuses) so one code path derives both.
- Tier comes from `enemyTier()` (`src/model/encounterTier.js`); an explicit `tier` field may override.
- Targets (tests hold these): minion SP 2 (most), elite SP 3, boss SP 4; minion HP within ±10% of today's authored range.

## Deck model

```js
// per enemy, replaces `moves`
deck: ['soldierSlash', 'soldierSlash', 'soldierGuard', 'soldierSmash', 'soldierBrace', 'warcry'],
gear: ['rustedMail'],   // optional
relics: [],             // optional, enemy relic registry
firstCard: 'warcry',    // optional opener (replaces firstMove)
```

- Enemy cards live in the card registry (new `src/content/cards/enemies.js`), owner `enemy`,
  same schema as player cards; never offered as rewards.
- Turn: refill SP/MP → draw to hand → AI plans plays within SP/MP → intents show
  the plan → plays resolve in the enemy phase → discard → reshuffle when empty.
- AI: score each affordable card (damage/defense/heal value × situational weights:
  low HP → defend/heal, player block high → smash, etc.); keep it deterministic
  from the `enemyAI` RNG stream. Reuse `extendEnemyQueue` budget logic, drawing
  candidates from the hand instead of `def.moves`.
- Delayed/charging cards keep `delay` semantics.

## Conversion

- ~19 enemies, ~60 moves → map each move to a card by intent/stance;
  build 6-card decks preserving each enemy's identity (signature move kept, ×1).
- Heal-riders (Drain, Golden Guard, Sap Mend…) become cast cards at 2–3 SP/MP.
- Keep a compatibility reader for saves holding `plannedMoves`/`moveId` mid-fight.

## UI

- Enemy mini-HUD: SP and MP pips; Inspect shows deck, discard, hand count, gear, relics.
- Intent shows each planned card with its cost.

## Phases (one PR each, owner review before dev)

1. Stat derivation: tier profiles, enemy attributes through `deriveStat`, gear/relic hooks. Tests.
2. Enemy card registry + deck/draw/discard state on the enemy entity; snapshot/save.
3. Planner on hand + SP/MP; heal cost rule; stagger hits enemy SP.
4. Content conversion (all acts) + balance report regen.
5. UI: pips, multi-card intents, Inspect deck view.

## Files

- `src/content/derivedStats.js` (read), `src/content/enemyTiers.js` (new)
- `src/model/state.js` `createEnemyCombatEntity`, `src/model/actionCosts.js` `enemyPoolOf`
- `src/engine/combat.js` `rollIntents`, `src/engine/combatRoundsAdapter.js` `extendEnemyQueue` / `takePlannedMove`
- `src/content/enemies/act1-3.js`, `src/content/cards/enemies.js` (new)
- `src/model/enemyMoveCards.js` (becomes enemy card view)
- tests: `enemy-action-pool`, `action-costs-formula`, new `enemy-deck`, `enemy-tier-stats`
