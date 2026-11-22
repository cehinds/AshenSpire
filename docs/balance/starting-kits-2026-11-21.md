# Starting kits, 2026-11-21

Measured with `node tools/combat-power-report.mjs` under the 2026-11-21 scoring weights (`content/source/scoring.json`, including `effectCount`).
Rank 0 = Unranked (cp <= 0); Rank 1 = cp 1-4. The deck recipe lives in `games/ashenspire/packs/core/starterDeck.json` (`classDecks`).
The weapon art is granted by the starting weapon. Budget: `scoring.starter.budget` (cards 9-11, at most 2 special, no card above Rank 2,
sum of max(raw, -2) at most 20), checked by `tests/core-starting-decks.test.mjs`.

## Reaver

| Card | Copies | Rarity | Raw | CP | Rank |
|---|---|---|---|---|---|
| Strike (`core.strike`) | 4 | common | -3 | -3 | 0 |
| Defend (`core.defend`) | 4 | common | 0 | 0 | 0 |
| Sundering Art (`core.reaverSpecial`) | 1 | uncommon | -7 | -9 | 0 |
| Sundering Hew (`greatswordSunderingHew`) | 1 | rare | 9 | 4 | 1 |

Armour (default outfit): raw 0, cp 0, rank 0.

Budget totals: 10 cards, 2 special, max rank 1, raw total -1 (limit 20).

## Rogue

| Card | Copies | Rarity | Raw | CP | Rank |
|---|---|---|---|---|---|
| Strike (`core.strike`) | 4 | common | -3 | -3 | 0 |
| Defend (`core.defend`) | 4 | common | 0 | 0 | 0 |
| Quick Guard (`core.rogueSpecial`) | 1 | uncommon | -3 | -5 | 0 |
| Twin Fang (`twinFang`) | 1 | rare | 9 | 4 | 1 |

Armour (default outfit): raw 0, cp 0, rank 0.

Budget totals: 10 cards, 2 special, max rank 1, raw total -1 (limit 20).

## Starseer

| Card | Copies | Rarity | Raw | CP | Rank |
|---|---|---|---|---|---|
| Arcane Spark (`core.cantrip`) | 4 | common | 0 | 0 | 0 |
| Arcane Ward (`core.arcaneWard`) | 1 | common | 0 | 0 | 0 |
| Glimmer Veil (`core.glimmerVeil`) | 1 | common | 0 | 0 | 0 |
| Stone Sigil (`core.stoneSigil`) | 1 | common | -3 | -3 | 0 |
| Ashen Shell (`core.ashenShell`) | 1 | common | -4 | -4 | 0 |
| Star Spark (`core.starseerSpecial`) | 1 | uncommon | -1 | -3 | 0 |
| Blight Touch (`blightTouch`) | 1 | rare | 7 | 2 | 1 |

Armour (default outfit): raw 0, cp 0, rank 0.

Budget totals: 10 cards, 2 special, max rank 1, raw total 2 (limit 20).

## Herald

| Card | Copies | Rarity | Raw | CP | Rank |
|---|---|---|---|---|---|
| Arcane Spark (`core.cantrip`) | 4 | common | 0 | 0 | 0 |
| Arcane Ward (`core.arcaneWard`) | 1 | common | 0 | 0 | 0 |
| Glimmer Veil (`core.glimmerVeil`) | 1 | common | 0 | 0 | 0 |
| Stone Sigil (`core.stoneSigil`) | 1 | common | -3 | -3 | 0 |
| Ashen Shell (`core.ashenShell`) | 1 | common | -4 | -4 | 0 |
| Lasting Resolve (`core.heraldSpecial`) | 1 | uncommon | -4 | -6 | 0 |
| Blight Touch (`blightTouch`) | 1 | rare | 7 | 2 | 1 |

Armour (default outfit): raw 0, cp 0, rank 0.

Budget totals: 10 cards, 2 special, max rank 1, raw total 1 (limit 20).


## Caster Mana (owner, 2026-11-22)

Arcane Spark costs 1 SP + 1 MP (3 damage, no keywords; cantrips may cost up to 1 MP). Casters get 3 MP per fight and no Mana back each turn (`resources.manaPerTurn` 0), shared with Arcane Ward, Glimmer Veil, the class spell and Blight Touch, so in long fights most Sparks wait for Mana.
