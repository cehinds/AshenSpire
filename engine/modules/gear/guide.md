# Gear module (`gear@1.0.0`)

One equipment model for players and enemies (owner, 2026-10-17), so anything an enemy wears is
real, lootable gear. Every item is a set of **points**; JSON decides what a point is worth.

## Pools

| Pool | Spends on | Common | Uncommon | Rare | Epic |
|---|---|---|---|---|---|
| ratings | AR, DR, Poise | 3 | 4 | 5 | 6 |
| bonus | STR, DEX, CON, WIS, INT, effect tags | 2–3 | 2–4 | 2–5 | 2–6 |

`pools: "merged"` (default, owner 2026-10-17) is one pool sized by `poolSizes.merged`: common 4, uncommon 5, rare 6, epic 7. `mergedShare` splits fill weight by rarity: commons fill AR/DR/Poise only (a few carry one set attribute); uncommon and up split evenly. `pools: "split"` keeps two pools. At most `maxAttributes` (3) attributes per item.
`pointValues` converts points to stats (AR 1, DR 2, Poise 3, attributes 1 per point).

## Tags

Every tag lives in `tags`:

- **Gear-type tags** (`greatsword`, `dagger`, `towerShield`, `robes`…): cost 0; they set fill priority.
- **Effect tags** (`stagger`, `flurry`, `bleed`, `regen`, `light`…): cost points; `modifier` + `amount`
  map to the existing equipment vocabulary (`strike.poise=+3`).
- **Penalty tags** (`heavy`, `unwieldy`, `thin`, `encumbered`): negative cost, refunding a point.

## Fill

Points an item sets in `points` are kept. The rest of each pool is split (largest remainder) by
weights, most specific first:

1. the item's own `weights`
2. the sum of its tags' `weights`, each scaled by the tag's `priority` / 100 (so `heavy` at 80
   steers harder than `regen` at 20; a greatsword's type tag favours STR, AR and Poise)
3. `weights.kinds[kind]`, then `weights.slots[slot]`, then `weights.global`

Changing a pool size, a tag's weights or a priority re-flows every item that left points unset.
`fillTo` picks the target (`max` default, `min`, `none`).

## Pack data (`games/ashenspire/packs/core/gear.json`)

`id`, `name`, `slot`, `kind`, `rarity`, `tags`, optional `points`, optional `weights`,
optional `classes`, and `source` (the CSV row it came from). Regenerate from the CSVs with
`node tools/gear-convert.mjs [--dry]`.

## Validation

Unknown rarity or tag; unknown point keys; more attributes than allowed; set points plus tag
costs above the pool.

## Status

Data, settings, the fill algorithm (`resolveGearItem` in `engine/kernel/gameConfig.js`) and the
validator. Profiles carrying `armorBudget` aggregate converted equipped values through
`gameProfileEquipmentReceipt`; matched items replace legacy self-stat modifiers.
Armor budget, Core: 3 points at rank 1 plus `perRank` 1 point per Smith tier (a shield gains the same per tier in its pool); `perRankStat: "dr"` (Core only) makes each tier's point a DR point, taken from unspent budget; without it tiers just grow the pool; `rarityBonus` per rarity (default 0).
One upgrade tier adds one rank. Weapons retain their rarity pools.

Additional point conversions: HP 10, MP 1, SP 1, Ward 3, Evasion 1 and
Precision 1. Existing AR 1, DR 2, Poise 3 and attribute 1 conversions remain.
Only resolved values contribute; their point counts are never granted again.

## Names

No spaces in `name`: `_` stands for a space and is turned back into one for display (`displayName` in `engine/kernel/gameConfig.js`); `-` is a real hyphen and is kept. `Ember-Starved_Pilgrim` shows as "Ember-Starved Pilgrim". The build refuses names with spaces or symbols.
