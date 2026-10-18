// src/content/cards/herald.js — the Herald pool, authored in content/source/cards/heraldCards.json
// (tools/content-build.mjs compiles it to src/content/generated/cards/heraldCards.js). This
// re-export keeps the module path the rest of the tree imports; the old design
// comments live in content/source/CONTENT-NOTES.md under "## Cards".
import { heraldCards } from '../generated/cards/heraldCards.js';
export { heraldCards };
