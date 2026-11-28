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

function withTag(card, cardIds)
{
  const tags = card.tags || [];
  if (!cardIds.includes(card.id) || tags.includes(REACTION_TAG)) return card;
  return {
    ...card,
    tags: [...tags, REACTION_TAG],
  };
}

// A copy of the profile catalog whose named Core cards carry the Reaction tag.
export function ReactionCarrierCatalog(cardIds = REACTION_CARRIER_IDS)
{
  const catalog = structuredClone(gameProfileCatalog);
  const content = catalog.packs[ReactionCarriers.pack].content;
  content.cards = content.cards.map(card => withTag(card, cardIds));
  return catalog;
}

// Resolves a profile author (the Core bundle by default) on the carrier catalog.
export function ReactionCarrierProfile(author = CORE_AUTHOR, cardIds = REACTION_CARRIER_IDS)
{
  return resolveGameAuthor(author, ReactionCarrierCatalog(cardIds));
}
