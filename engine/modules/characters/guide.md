# Characters module (`characters@1.0.0`)

Players and enemies are the same kind of thing (owner, 2026-10-17): one JSON shape in
`games/ashenspire/packs/core/characters.json`, one stat algorithm, one card pool, one gear pool.
Tags decide which extra block applies and which rules are added.

## Shape

Shared: `id`, `name` (`_` for spaces), `tags`, `attributes` (points you set; kept),
`attributePriority`, optional `priorityWeights` / `variance` / `attributeCaps` / `attributePoints`,
`level` or `levelProfile`, `defaultDeck`, `defaultGear`, `defaultRelics`, `presentation`.

- `character.player` → a `player` block (`specialCardId`, `description`, `legacyMaxHp`).
- `character.enemy` → an `enemy` block (`poiseMax`, `phases`, `firstCard`, `unlockCards`,
  `cardHints` with planner hints per card: `aiWeight`, `maxConsecutive`, `delay`, `costSource`).

## Algorithm

Base rule = the sum of every tag's `tagRules` entry (pools HP/SP/MP and hand); the last tag that sets
`attributeBudget`, `deckSize`, `deckDefault` or `spRange` wins. Then:

- attributes: set points kept, the rest filled by `attributePriority` × rank weights, capped
  (CON ≤ 1), with seeded `variance` for tags that allow it (`character.enemy`)
- stats: `statRules` (HP = 10 + CON×10 + STR×5 + DEX×3 + WIS×2 + INT×1 + 5/level; SP/MP from the
  player's derived-stat rows; AR = STR, DR = DEX, hand + INT), plus gear and relic points
- penalties floor at `penaltyFloor` (SP never below 1)

Class tags (`class.reaver`…) carry each class's base HP, calibrated so legacy max HP is unchanged
with the starting gear (Reaver 84, Starseer 72, Rogue 74, Herald 78).

## Decks

`defaultDeck` entries are mostly pool keys — `{ "pool": "strike", "copies": 3 }` — resolved through
`cardPools.json` by class tag and the gear-type tag of the item in the pool's slot:
`byClass[class][type]` → `byClass[class].default` → `byTag[type]` → `byTag.default`. Plain card ids
or `{ "card": id, "copies": n }` are used as written. Default sizes: players 11, minions 3, elites 5,
bosses 7 (`deckDefault`); `deckSize` allows more or less.

Players and enemies draw from one card pool (`content.cards`): enemy cards are plain player cards
(same fields, tags and validation). Who uses a card is decided only by the decks that reference it.

## Compatibility

The build derives `content.classes` (with `maxHp`, `loadout`, `defaultDeck`) and `content.enemies`
from `characters.json`, so existing code keeps working. Runtime still builds a player's starting deck
from `starterDeck.json`; switching it to `defaultDeck` is a follow-up.

## Tools

`node tools/enemy-decks-convert.mjs` (enemy rows and cards) and `node tools/characters-convert.mjs`
(players, card pools, class HP calibration).
