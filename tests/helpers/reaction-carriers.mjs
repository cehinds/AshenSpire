import { readFileSync } from 'node:fs';
import { gameProfileCatalog } from '../../src/content/generated/gameProfiles.js';
import { resolveGameAuthor } from '../../engine/kernel/gameConfig.js';

const FIXTURE_URL = new URL('../fixtures/reaction-carriers.json', import.meta.url);
const ReactionCarriers = JSON.parse(readFileSync(FIXTURE_URL, 'utf8'));
const CORE_AUTHOR = Object.freeze({
  formatVersion: 1,
  core: ReactionCarriers.core,
  modules: {},
});

export const REACTION_TAG = ReactionCarriers.tag;
export const REACTION_CARRIER_IDS = Object.freeze([...ReactionCarriers.cards]);

// Tags the named Core cards of a catalog copy in place, so a copy made in another realm
// (the production bundle) keeps its own objects.
export function TagReactionCarriers(catalog, cardIds = REACTION_CARRIER_IDS)
{
  for (const card of catalog.packs[ReactionCarriers.pack].content.cards)
  {
    if (!cardIds.includes(card.id) || card.tags.includes(REACTION_TAG)) continue;
    card.tags.push(REACTION_TAG);
  }
  return catalog;
}

// A copy of the profile catalog whose named Core cards carry the Reaction tag.
export function ReactionCarrierCatalog(cardIds = REACTION_CARRIER_IDS)
{
  return TagReactionCarriers(structuredClone(gameProfileCatalog), cardIds);
}

// Resolves a profile author (the Core bundle by default) on the carrier catalog.
export function ReactionCarrierProfile(author = CORE_AUTHOR, cardIds = REACTION_CARRIER_IDS)
{
  return resolveGameAuthor(author, ReactionCarrierCatalog(cardIds));
}
