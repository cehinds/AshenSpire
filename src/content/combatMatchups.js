// Shared tactical numbers and tag riders; balance exposes these same objects.
// Authored in content/source/combatIntent.json, combatMatchups.json and
// combatExpansionMatchups.json (notes in content/source/CONTENT-NOTES.md,
// "Combat matchups"); content-build compiles them to src/content/generated/.
// Edit the JSON, not this file. The "$note" keys are the [NOTE] blocks.
import { combatIntent } from './generated/combatIntent.js';
import { combatMatchups } from './generated/combatMatchups.js';
import { combatExpansionMatchups } from './generated/combatExpansionMatchups.js';
export { combatIntent, combatMatchups, combatExpansionMatchups };
