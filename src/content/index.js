// src/content/index.js — the content bundle (shape: ENGINE-API §1)
//
// Aggregates every content file into the bundle createRegistries() consumes.
// Adding content = adding a data object in one file here (SPEC §3.1(2)).

import { balance } from './balance.js';
import { statuses } from './statuses.js';
import { stances } from './stances.js';
import { keywords } from './keywords.js';
import { vagabondCards } from './cards/vagabond.js';
import { astrologerCards } from './cards/astrologer.js';
import { prophetCards } from './cards/prophet.js';
import { colorlessCards } from './cards/colorless.js';
import { relics } from './relics.js';
import { flasks } from './flasks.js';
import { act1Enemies } from './enemies/act1.js';
import { act2Enemies } from './enemies/act2.js';
import { act3Enemies } from './enemies/act3.js';
import { act1Encounters, M1_GAUNTLET } from './encounters/act1.js';
import { act2Encounters } from './encounters/act2.js';
import { act3Encounters } from './encounters/act3.js';
import { events } from './events.js';
import { classes, LOCKED_CLASSES } from './classes.js';
import { mapConfigs } from './mapconfig.js';
import { scripts } from './scripts.js';

export const contentBundle = {
  version: '0.1.0-m1',
  balance,
  cards: [...vagabondCards, ...astrologerCards, ...prophetCards, ...colorlessCards],
  relics,
  statuses,
  stances,
  keywords,
  enemies: [...act1Enemies, ...act2Enemies, ...act3Enemies],
  encounters: [...act1Encounters, ...act2Encounters, ...act3Encounters],
  events,
  flasks,
  classes,
  mapConfigs,
  scripts,
};

// Not part of the bundle (UI-only data / M1 flow):
export { M1_GAUNTLET, LOCKED_CLASSES };
