// Starting boons are authored with the rest of character creation in JSON,
// compiled by tools/content-build.mjs, and validated through the bundle door.
import { characterCreation } from './generated/characterCreation.js';

export const KEEPSAKES = characterCreation.keepsakes;
