import { MAX_CARD_RANK } from '../../model/state.js';
import { CARD_ART_ELEMENTS } from '../cardArtComposition.js';
import { proceduralCardArt } from '../proceduralCardArt.js';

export const BUILDER_TYPES = Object.freeze(['attack', 'smash', 'sweep', 'counter', 'defend', 'evade', 'skill']);
export const BUILDER_ELEMENTS = Object.freeze(Object.keys(CARD_ART_ELEMENTS));
export const BUILDER_RANK_MAX = MAX_CARD_RANK;
export const BUILDER_PREVIEW_ID = 'card-art-builder-preview';
const invalid = code => { const error = new Error(code); error.code = code; throw error; };

/** Validate the editor's minimal, portable input; no asset choices live here. */
export function normalizeBuilderInput({ type, tags = [], rank } = {}) {
  if (!BUILDER_TYPES.includes(type)) invalid('type');
  if (!Number.isInteger(rank) || rank < 1 || rank > BUILDER_RANK_MAX) invalid('rank');
  if (!Array.isArray(tags) || tags.length > 128 || tags.some(tag => typeof tag !== 'string' || tag.length > 100 || !/^[\w:.-]+$/.test(tag))) invalid('tags');
  return { type, tags: [...new Set(tags)].sort(), rank };
}

/** Form choices become canonical tags, not a second art-selection formula. */
export function builderInputFromControls({ type, category, element = '', utility = '', delivery = 'melee', statuses = [], extraTags = '', rank }) {
  if (!['physical', 'spell'].includes(category)) invalid('category');
  if (element && !BUILDER_ELEMENTS.includes(element)) invalid('element');
  if (!['', 'heal', 'draw', 'cleanse'].includes(utility)) invalid('utility');
  if (!['melee', 'projectile'].includes(delivery)) invalid('delivery');
  const tags = [`camp:${category}`, ...(type === 'skill' ? [] : [`maneuver:${type}`]),
    ...(element ? [`element:${element}`] : []), ...(utility ? [`effect:${utility}`] : []),
    ...(category === 'spell' ? [`delivery:${delivery}`] : []), ...statuses.map(id => `status:${id}`),
    ...extraTags.split(/[\s,]+/).filter(Boolean)];
  return normalizeBuilderInput({ type, tags, rank });
}

/** Transient renderer definition only: never added to a registry or saved run. */
export function createBuilderPreview(registries, value, { name, text }) {
  const input = normalizeBuilderInput(value);
  const composition = proceduralCardArt(input, { registries });
  const definition = { id: BUILDER_PREVIEW_ID, name, textTemplate: text, rank: input.rank,
    type: input.type === 'skill' ? 'skill' : 'attack', cardTags: [...input.tags], effects: [],
    kindIds: [input.type === 'skill' ? 'classification.skill' : 'classification.attack'],
    cost: 0, staminaCost: 0, manaCost: 0, rarity: 'common', class: 'colorless' };
  return { input, composition, definition };
}

export function builderInputJson(input) {
  return JSON.stringify(normalizeBuilderInput(input), null, 2) + '\n';
}
