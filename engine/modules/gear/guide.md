# Gear module (`gear@1.0.0`)

One equipment model for players and enemies (owner, 2026-10-17), so anything an enemy wears is
real, lootable gear. Every item is a set of **points**; JSON decides what a point is worth.

## Pools

| Pool | Spends on | Common | Uncommon | Rare | Epic |
|---|---|---|---|---|---|
| ratings | AR, DR, Poise | 3 | 4 | 5 | 6 |
| bonus | STR, DEX, CON, WIS, INT, effect tags | 2–3 | 2–4 | 2–5 | 2–6 |

`pools: "split"` (module default) keeps them apart. `pools: "merged"` (Core) makes one pool of
both sizes, shared by `mergedShare`. At most `maxAttributes` (3) attributes per item.
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
validator. Player equipment at runtime still reads `content/source/weapons.csv` and
`outfits.csv`; switching the runtime to resolved gear is a follow-up.
