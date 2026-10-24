// src/content/progression/relics.js — authored in content/source/progressionRelics.json and
// content/source/progressionRelicUnlocks.json; content-build compiles them to
// src/content/generated/progressionRelics.js and progressionRelicUnlocks.js. Edit the JSON, not this file.
// Relic definitions and gates are one independently installable module.
// The whole module is data, so it only re-exports the generated rows.
import { progressionRelics } from '../generated/progressionRelics.js';
import { progressionRelicUnlocks } from '../generated/progressionRelicUnlocks.js';
export { progressionRelics, progressionRelicUnlocks };
