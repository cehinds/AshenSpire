// src/content/companions.js — temporary companions (SPEC §14.3).
//
// A companion travels with the run for `combats` fights, held in
// `run.companions` as { id, combatsLeft }; `combatsLeft` drops by one at each
// combat end (engine/runCombat.js runCombatEnd) and it leaves at 0. One of
// each at a time: the market never offers one already travelling.
//
// WHAT IT DOES IS NOT WRITTEN HERE (Codex on #1376; coordinator ruling). A
// companion's effect is a property rule, as a relic's and a location's are:
// its `family = companion` rows in content/source/tagging.csv name leaves
// under the `companion` branch of `property` in nodes.csv, whose rules live in
// nodeEffects.json with their numbers bound to balance.powers.*. stampTags
// derives `propertyTags`, and the fight mounts it as a `companion` carrier
// (engine/properties.js syncCompanionProperties). validateContent refuses a
// row that writes `triggers` or `modifiers`, and one with no property tag.
//
// `cost` and `combats` are defaults, each with a [NOTE]: Settings → Advanced
// → Shops generates `gameConfig.companions.<id>.<key>` for them.
import { NOTE } from './balance.js';

const NOTES = Object.freeze({
  cost: 'What this companion costs at the market, in cinders.',
  combats: 'How many fights this companion travels with you before it leaves.',
});

export const companions = [
  {
    id: 'hollowSquire', name: 'Hollow Squire',
    blurb: 'A squire without a knight. It raises a shield before you at the start of each fight.',
    cost: 220, combats: 3, [NOTE]: NOTES,
  },
  {
    id: 'emberHound', name: 'Ember Hound',
    blurb: 'A hound of banked coals. It bites at your foes as each of your turns begins.',
    cost: 260, combats: 3, [NOTE]: NOTES,
  },
];
