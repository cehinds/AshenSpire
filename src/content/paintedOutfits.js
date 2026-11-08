// Painted-outfit art manifest per class. The data lives in
// content/source/paintedOutfits.json (written by tools/painted-outfits-ship.mjs)
// and is compiled by tools/content-build.mjs into generated/paintedOutfits.js;
// this file keeps the old export name.
import { paintedOutfits } from './generated/paintedOutfits.js';

export const PAINTED_OUTFITS = paintedOutfits;
