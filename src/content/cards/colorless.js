// src/content/cards/colorless.js — the colorless / status / curse cards, authored in content/source/cards/colorlessCards.json
// (tools/content-build.mjs compiles it to src/content/generated/cards/colorlessCards.js). This
// re-export keeps the module path the rest of the tree imports; the old design
// comments live in content/source/CONTENT-NOTES.md under "## Cards".
import { colorlessCards } from '../generated/cards/colorlessCards.js';
export { colorlessCards };
