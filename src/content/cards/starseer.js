// src/content/cards/starseer.js — the Starseer pool, authored in content/source/cards/starseerCards.json
// (tools/content-build.mjs compiles it to src/content/generated/cards/starseerCards.js). This
// re-export keeps the module path the rest of the tree imports; the old design
// comments live in content/source/CONTENT-NOTES.md under "## Cards".
import { starseerCards } from '../generated/cards/starseerCards.js';
export { starseerCards };
