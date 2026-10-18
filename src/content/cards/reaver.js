// src/content/cards/reaver.js — the Reaver pool, authored in content/source/cards/reaverCards.json
// (tools/content-build.mjs compiles it to src/content/generated/cards/reaverCards.js). This
// re-export keeps the module path the rest of the tree imports; the old design
// comments live in content/source/CONTENT-NOTES.md under "## Cards".
import { reaverCards } from '../generated/cards/reaverCards.js';
export { reaverCards };
