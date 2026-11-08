// src/content/combatExpansionCards.js — the spell tables (data only). The projection
// (applyCombatExpansionCard) is src/model/combatExpansionCardProjection.js.
// The tables are JSON, compiled by content-build to src/content/generated/: the school/damage-type
// row per card id (content/source/combatExpansionCardOverlay.json), the weapon spell profiles
// (combatExpansionSpellProfiles.json), the colorless counters and cantrips added for the
// expansion (content/source/cards/combatExpansionNewCards.json, a card pool), and the lists and
// numbers the projection reads (combatExpansionCardTables.json). The comments that lived here are in
// content/source/CONTENT-NOTES.md under "## Combat expansion tables".
import { combatExpansionCardOverlay } from './generated/combatExpansionCardOverlay.js';
import { combatExpansionSpellProfiles } from './generated/combatExpansionSpellProfiles.js';
import { combatExpansionNewCards } from './generated/cards/combatExpansionNewCards.js';
import { combatExpansionCardTables } from './generated/combatExpansionCardTables.js';
export { combatExpansionCardOverlay, combatExpansionSpellProfiles, combatExpansionNewCards, combatExpansionCardTables };
