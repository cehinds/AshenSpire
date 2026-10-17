# Enemies module (`enemies@1.0.0`)

Enemies are characters (owner, 2026-10-17): the player's five attributes, pools from the
same per-point gains, and a deck of the player's card kinds that shuffles and draws like
the player's. Plan and decisions: [docs/plans/enemy-decks.md](../../../docs/plans/enemy-decks.md).

**Status:** data, settings and the build validator are implemented. The configured combat
adapter (drawing, planning, paying, heal shapes at runtime) is phases 2–3 of the plan; until
it lands, combat still plays the legacy `moves` from `src/content/enemies/act1-3.js`
(`fallback: "legacyMoves"`).

## Settings (`defaults.json`)

| Setting | Meaning |
|---|---|
| `include` | Tiers this profile fields (`minion`, `elite`, `boss`). |
| `attributeGains` | Per-point gains; mirror the player's `stats.json` `levelGains` (CON → +10 HP, +0.5 SP; WIS → +1 MP; INT → +1 hand; STR → AR; DEX → DR). |
| `tiers.<tier>.pools` | Base HP/SP/MP before attributes. Every tier starts at 2 SP and 0 MP; CON and WIS raise them. |
| `tiers.<tier>.attributeBudget` | Points to assign. All five attributes start at 0; each enemy assigns freely (owner 2026-10-17): minion 4, elite 5, boss 6–7. CON stays small; enemies are hard already. |
| `tiers.<tier>.spRange` | Optional. Allowed derived SP; build fails outside it. Unset by default. |
| `tiers.<tier>.hand` / `deckSize` | Base hand size and deck size range for the tier. |
| `deck` | Global deck bounds and reshuffle/draw rules. |
| `stanceCosts` | Default SP/MP per maneuver for cards with no authored cost. |
| `healRules` | Tag-matched heal shapes. `heal` → 3 SP + 2 MP, 10% max HP. `heal` + `exhaust` → 1 SP + 1 MP, 10%, exhausts. Most specific match wins; an authored cost wins over a shape unless the card says `costSource: "healRules"`. Add shapes by tag set. |
| `stagger` | Break penalty on an enemy: −1 SP next turn, Vulnerable 1 (+25% damage taken). |
| `ai` | Planner weights (card `aiWeight`, low-HP defend/heal bias, smash into block). |
| `rounding` | `down` (default), `nearest`, `up` for derived pools. |

Override any of them from `game.json`:

```json
{ "modules": { "enemies": { "healRules": { "shapes": [ { "id": "full", "tags": ["heal"], "cost": { "sp": 2, "mp": 2 }, "amount": { "percentMaxHp": 15 }, "exhaust": false } ] } } } }
```

Arrays replace; objects merge.

## Pack content (`games/ashenspire/packs/core/`)

- `enemies.json`: `id`, `name`, `tier`, `attributes`, `deck` (card ids, any length inside the
  bounds; duplicates are copies), optional `firstCard`, `unlockCards`, `gear`, `relics`,
  `phases` (`unlockCards`, heal steps use `rule: "healRules"`), plus presentation fields.
- `enemyCards.json`: `id`, `name`, `owner: "enemy"`, `enemy`, `type`, `staminaCost`,
  `manaCost`, `costSource` (`stance` | `healRules` | `authored`), `tags`, `effects`,
  optional `delay`, `aiWeight`, `maxConsecutive`, `textTemplate`. A deck may also name a
  player card id.
- `enemyGear.json`, `enemyRelics.json`: `id`, `name`, `modifiers` (`self.maxHp=+12`), `text`.

## Validation (build fails on)

Unknown card/gear/relic ids; duplicate ids; deck size outside the tier and global bounds;
attribute total outside the tier budget; a deck card costing more SP or MP than the enemy's
pools can ever hold; a `healRules` card whose cost disagrees with its matched shape.

## Regenerating from legacy moves

`node tools/enemy-decks-convert.mjs [--dry]` rebuilds the four pack files from
`src/content/enemies/act1-3.js` (HP matched to the old ranges with gear and relics).
After conversion the JSON is the source of truth; hand edits are expected.

## Disabled

`"enemies": false` in `game.json` turns the module off; the pack data is ignored and enemies
play their legacy weighted moves. The `current` bundle does not select this module.
