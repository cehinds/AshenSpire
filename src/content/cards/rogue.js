// src/content/cards/rogue.js — the Rogue pool, authored in content/source/cards/rogueCards.json
// (tools/content-build.mjs compiles it to src/content/generated/cards/rogueCards.js). This
// re-export keeps the module path the rest of the tree imports; the old design
// comments live in content/source/CONTENT-NOTES.md under "## Cards".
import { rogueCards } from '../generated/cards/rogueCards.js';
export { rogueCards };
