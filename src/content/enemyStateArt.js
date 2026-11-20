// Per-enemy state-art scale. The data lives in content/source/enemyStateArt.json
// and is compiled by tools/content-build.mjs into generated/enemyStateArt.js;
// this file keeps the old export name.
import { enemyStateArt } from './generated/enemyStateArt.js';

export const ENEMY_STATE_SCALE = enemyStateArt;
