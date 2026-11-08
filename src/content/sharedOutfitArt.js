// Shared outfit-set art manifest. The data lives in
// content/source/sharedOutfitArt.json and is compiled by tools/content-build.mjs
// into generated/sharedOutfitArt.js; this file keeps the old export name and
// the shallow freeze it always had.
import { sharedOutfitArt } from './generated/sharedOutfitArt.js';

export const SHARED_OUTFIT_ART = Object.freeze(sharedOutfitArt);
