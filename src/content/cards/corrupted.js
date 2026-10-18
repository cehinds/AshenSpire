// src/content/cards/corrupted.js — the corrupted cards, authored in content/source/cards/corruptedCards.json
// (tools/content-build.mjs compiles it to src/content/generated/cards/corruptedCards.js). This
// re-export keeps the module path the rest of the tree imports; the old design
// comments live in content/source/CONTENT-NOTES.md under "## Cards".
import { corruptedCards } from '../generated/cards/corruptedCards.js';
export { corruptedCards };
