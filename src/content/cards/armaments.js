// src/content/cards/armaments.js — the armament cards, authored in content/source/cards/armamentCards.json
// (tools/content-build.mjs compiles it to src/content/generated/cards/armamentCards.js). This
// re-export keeps the module path the rest of the tree imports; the old design
// comments live in content/source/CONTENT-NOTES.md under "## Cards".
import { armamentCards } from '../generated/cards/armamentCards.js';
export { armamentCards };
