// Semantic head/body and authored floor landmarks in source raster pixels.
// The data lives in content/source/enemyBodyLandmarks.json (notes in
// content/source/CONTENT-NOTES.md) and is compiled by tools/content-build.mjs
// into generated/enemyBodyLandmarks.js; this file keeps the old export name.
import { enemyBodyLandmarks } from './generated/enemyBodyLandmarks.js';

export const ENEMY_BODY_LANDMARKS = enemyBodyLandmarks;
