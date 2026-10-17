# Possible rewards and level ranges

**16 proposed rewards and four editable level bands.** These are authoring examples, not a production balance change or active item grants. All production bindings remain null.

## Reward catalog

| Reward | Type | Rarity label | Drop levels | Repeat policy |
| --- | --- | --- | --- | --- |
| Travel rations | consumable | common | 1–10 | repeatable |
| Coins | currency | common | 1–10 | repeatable |
| Healing herbs | material | common | 1–10 | repeatable |
| Iron scrap | material | common | 1–10 | repeatable |
| Health draught | consumable | uncommon | 1–10 | repeatable |
| Upgrade stone | upgrade | uncommon | 2–10 | repeatable |
| Regional trinket | equipment | rare | 2–10 | repeatable |
| Survey fragment | map | uncommon | 1–10 | once-per-run |
| Road chart | map | uncommon | 1–10 | once-per-run |
| Forgotten key | access | rare | 4–10 | once-per-run |
| Crafting recipe | recipe | rare | 4–10 | once-per-run |
| Training voucher | training | rare | 2–10 | once-per-run |
| Rest token | rest | uncommon | 1–10 | repeatable |
| Faction favor | reputation | uncommon | 2–10 | repeatable |
| Quest evidence | quest | uncommon | 1–10 | once-per-run |
| Legacy relic | relic | epic | 7–10 | once-per-run |

Edit [rewards.json](gameplay/rewards.json) for definitions and [loot-tables.json](gameplay/loot-tables.json) for probabilities and quantities. Catalog membership does not automatically make a reward drop: only entries in the selected loot table participate. Quest evidence is intentionally not in random loot; other unused definitions are options for later authoring.

- **Rarity is a label**, not a second probability multiplier.
- Weights are relative among eligible rewards. A weight of 0.15 is not automatically a 15% chance.
- `dropLevelRange` controls when a reward may appear. It does not define equipment stats or equip requirements.
- `quantity` is an inclusive integer count. Coin quantities count individual coins.
- Map rewards and unique unlock candidates can be `once-per-run`; saved `claimedRewardIds` prevent another grant in that run. Permanent unlock ownership will need a separate profile-level contract.
- Keys, vouchers, favor, recipes and equipment remain proposed rewards. Actual locks, services, faction IDs and item definitions must be bound before implementation.

## Level bands

| Band | Recommended player | Enemy levels | Reward levels | Placement |
| --- | --- | --- | --- | --- |
| starter | 1–3 | 1–3 | 1–3 | Town, safe camp, blank template |
| frontier | 2–4 | 2–4 | 2–4 | Bridge, forest road, upstream |
| danger | 4–6 | 4–6 | 4–6 | Downstream side area, with a warning |
| legacy | 7–10 | 7–10 | 7–10 | Future dungeon proposal; not placed in this six-tile example |

Edit [level-bands.json](gameplay/level-bands.json), then reference a band from `tile.gameplay.levelBandId`:

```json
{
  "levelBandId": "frontier",
  "encounterPoolId": "forest-encounters",
  "encounterChance": 0.35,
  "lootTableId": "forest-salvage"
}
```

Recommended player levels are guidance, not locks. Area levels stay fixed; enemies do not automatically match the player's level. If a lock is wanted, author it explicitly through entry requirements.

Enemy types declare the levels they support. Choose an eligible enemy type and roll within the intersection of its `levelRange` and the area's `encounterLevelRange`. Group size, encounter chance and difficulty tier remain separate tuning knobs. The legacy band and loot table are dormant proposals; a future legacy tile also needs an encounter pool with appropriately leveled enemies.

## Example loot pools

- **Travel supplies:** rations, coins and rare map rewards.
- **Forest salvage:** herbs, scrap, recovery draughts, trinkets, map fragments and training vouchers.
- **River cache:** coins, supplies, upgrade stones, keys and road charts. Keys become eligible at reward level 4.
- **Legacy vault:** larger coin/material quantities plus recipe and relic candidates; two rolls, with unique claims updated after each grant. Relics become eligible at reward level 7.

For each roll: choose a reward level from the area's range → remove rewards outside that level or already claimed once-per-run → normalize remaining weights → choose a reward → roll quantity → persist a unique claim when applicable. If nothing remains eligible, grant nothing rather than ignoring the rules. The pure eligibility helper is a validation aid, not a wired runtime loot system.

The validator checks integer ordered ranges, level-band references, compatible enemy levels, loot quantity bounds, eligible rewards throughout each placed tile's reward-level range, and saved claimed-reward references. Weather, art and enemy generation are unchanged by rarity labels.
