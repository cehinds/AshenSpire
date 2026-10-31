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
- `attributeOffset` (optional) is added to each enemy attribute after gear and relic bonuses and floored at 0; the tier budget check ignores it
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

## Deck editing

`deckEditing` sets copy limits; unlimited copies are earned by character tags:

- `training.basic` (all classes start with it): unlimited basic-rank combat maneuvers — starter
  cards with an attack/defend/counter/smash/sweep maneuver, and whatever the strike, defend, counter,
  smash, sweep and evade pools give this character for its weapon. Ten Strikes and a weapon art is legal.
- `training.graduate`: unlimited cantrips (starter-rank spells).

Weapon arts, class specials (`owned`) and anything picked up count only the copies owned; `owned`
wins over `unlimited`. `deckCopyLimit()` in the kernel is the one check the deck editor reads.

## Compatibility

The build derives `content.classes` (with `maxHp`, `loadout`, `defaultDeck`) and `content.enemies`
from `characters.json`, so existing code keeps working. Runtime still builds a player's starting deck
from `starterDeck.json`; switching it to `defaultDeck` is a follow-up.

## Tools

`node tools/enemy-decks-convert.mjs` (enemy rows and cards) and `node tools/characters-convert.mjs`
(players, card pools, class HP calibration).

## Feature modules

Optional rules live in their own modules (owner 2026-10-17) so each can be kept in or left out of
Core. All are selected by the Core bundle; turn one off with `{ "modules": { "<id>": false } }` in
`game.json`.

| Module | What it adds | Off |
|---|---|---|
| `attribute-variance` | seeded stat spread between copies of a character | identical copies |
| `heal-rules` | tag-matched heal costs and amounts | heal cards not cost-checked |
| `stagger` | poise-break penalty (SP loss, Vulnerable) | data only |
| `enemy-visibility` | hide SP/MP etc. unless a tag reveals them | everything visible |
| `enemy-relics` | attribute relics on enemies (Ashen Blight Core) | no enemy relics |
| `card-pools` | weapon-type resolution of deck pool keys | pools give class/default cards |
| `deck-training` | training tags unlock unlimited basic copies | owned copies only |
| `reward-ranks` | card rewards mostly rank 1+, owned basics skipped | rewards ignore rank |

`characterSettings(modules)` is the one view the kernel, tools and tests read; a missing module
leaves its field `null`.

## Player hand size

A player's starting hand stays owned by the cards module (`cards.handBase`, mirrored in
`stats.handBase`) plus INT, the authority the run already reads. `tagRules.<tag>.hand` and
`statRules.hand` size enemy hands only; giving players a second hand-size authority would let the
two disagree.
