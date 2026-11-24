# Reward rarity rates, 2026-11-21

Owner ruling: card reward rarity odds are one table for every class; rare is under 10% from every source; the chance a specific card is offered falls as rarity rises (common > uncommon > rare). `balance.rewards.rarityWeightsByClass` is removed. The table lives in `content/source/balanceRewards.json` and mirrors `content/source/scoring.json` -> `rewards.rarityWeights`; `src/model/validate/rewardSchedule.js` enforces both rules.

## The table (weights sum to 100)

| Source | Common | Uncommon | Rare |
|---|---|---|---|
| normal | 65 | 30 | 5 |
| elite | 57 | 35 | 8 |
| boss | 52 | 39 | 9 |

## Pools

Pool = cards in the class's `cardPool` (what `rollCardRewardIds` draws from), by rarity.

| Class | Common | Uncommon | Rare |
|---|---|---|---|
| reaver | 46 | 55 | 16 |
| rogue | 50 | 55 | 16 |
| starseer | 49 | 57 | 17 |
| herald | 47 | 53 | 13 |

## Per-card chance per offered slot (weight / pool size, as % of the slot)

Rarity is rolled first, then a card is picked within the rarity, so a specific card's chance is weight / pool size. Element affinity (Herald, Starseer) reweights picks within a rarity and is not counted.

| Class | Source | Common | Uncommon | Rare | Order |
|---|---|---|---|---|---|
| reaver | normal | 1.413% | 0.545% | 0.312% | ok |
| reaver | elite | 1.239% | 0.636% | 0.500% | ok |
| reaver | boss | 1.130% | 0.709% | 0.562% | ok |
| rogue | normal | 1.300% | 0.545% | 0.312% | ok |
| rogue | elite | 1.140% | 0.636% | 0.500% | ok |
| rogue | boss | 1.040% | 0.709% | 0.562% | ok |
| starseer | normal | 1.327% | 0.526% | 0.294% | ok |
| starseer | elite | 1.163% | 0.614% | 0.471% | ok |
| starseer | boss | 1.061% | 0.684% | 0.529% | ok |
| herald | normal | 1.383% | 0.566% | 0.385% | ok |
| herald | elite | 1.213% | 0.660% | 0.615% | ok |
| herald | boss | 1.106% | 0.736% | 0.692% | ok |

All twelve class and source rows hold the order with the weights as set in scoring.json, so none was adjusted. Rare shares are 5%, 8% and 9%, each under 10%. Tightest margin: herald boss, uncommon 0.736% against rare 0.692%.

Skill drafts (`rollSkillDraftIds`) read the same table over the rarities the skill level unlocks, filtered by school, so their per-card chances differ and are not covered here.
