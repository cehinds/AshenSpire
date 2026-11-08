// Defeated-pose art manifest (enemy and outfit kill poses). The data lives in
// content/source/defeatedArt.json and is compiled by tools/content-build.mjs
// into generated/defeatedArt.js; this file keeps the old export name.
import { defeatedArt } from './generated/defeatedArt.js';

export const DEFEATED_ART = defeatedArt;
