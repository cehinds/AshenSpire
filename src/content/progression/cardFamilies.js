// src/content/progression/cardFamilies.js — the data is authored in
// content/source/progressionCardFamilies.json; content-build compiles it to
// src/content/generated/progressionCardFamilies.js. Edit the JSON, not this file.
// The whole module is data (forty rows of identity, unlock level, rarity and
// per-rank values); the recipes that read it live in cards.js.
import { progressionCardFamilies } from '../generated/progressionCardFamilies.js';
export const cardFamilies = progressionCardFamilies;
