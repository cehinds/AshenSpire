// Permanent, repeatable character-level choices. Authored in
// content/source/feats.json (notes in content/source/CONTENT-NOTES.md, "Feats");
// content-build compiles it to src/content/generated/feats.js. Edit the JSON.
import { feats as authoredFeats } from './generated/feats.js';
export const feats = Object.freeze(authoredFeats);
