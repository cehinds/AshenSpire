// One school-to-tradition policy for combat, card faces, tags and reward pools.
import { spellTraditions as rules } from '../content/generated/spellTraditions.js';

export const SPELL_TRADITION_IDS = Object.freeze(Object.keys(rules.traditions));
const tagIds = card => (card?.cardTags ?? card?.tags ?? []).map(tag => typeof tag === 'string' ? tag : tag.id);
export function spellSchool(card) {
  const tags = tagIds(card);
  return card?.combatProfile?.school || card?.school
    || tags.find(tag => tag.startsWith('school:'))?.slice(7)
    || (Object.hasOwn(rules.schools, card?.damageSchool) ? card.damageSchool : null)
    || 'arcane';
}
export function cardSpellTraditions(card) {
  const explicit = tagIds(card).filter(tag => tag.startsWith('tradition:')).map(tag => tag.slice(10));
  return explicit.length ? SPELL_TRADITION_IDS.filter(id => explicit.includes(id))
    : [...(rules.schools[spellSchool(card)] || rules.schools.arcane)];
}
export function spellTraditionsActive(ctx) {
  // A saved fight owns its rule flag, including its absence. Before combat,
  // the immutable profile effects module is the version boundary.
  return ctx?.fixCoreRules ? ctx.fixCoreRules.spellTraditionsVersion === rules.version
    : ctx?.gameProfile?.modules?.effects?.spellTraditionsVersion === rules.version;
}
export function spellScalingValue(attributes, card) {
  return Math.max(0, ...cardSpellTraditions(card).map(id => Number(attributes?.[rules.traditions[id].attribute]) || 0));
}
export function traditionSpellPower(ctx, entity, card, previous) {
  if (!spellTraditionsActive(ctx)) return previous;
  const definition = card?.cardId && ctx.registries?.cards?.has?.(card.cardId) ? ctx.registries.cards.get(card.cardId) : null;
  if (definition) card = { ...definition, ...card };
  const attrs = entity?.attributes || ctx.attributes || {};
  // Keep non-attribute modifiers and equipment scoping; replace only the old
  // intrinsic max(INT,WIS). Enemies previously used authored spell ratings.
  const intrinsic = entity?.kind === 'enemy' ? Number(entity.ratings?.pr) || 0
    : Math.max(Number(attrs.intelligence) || 0, Number(attrs.wisdom) || 0);
  return Math.max(0, previous - intrinsic + spellScalingValue(attrs, card));
}
export function spellPoolRole(card) {
  if (rules.roles?.[card.id]) return rules.roles[card.id];
  const effects = card.effects || [];
  return effects.some(effect => effect.op === 'damage'
    || effect.op === 'applyStatus' && rules.offensiveStatuses.includes(effect.status)
      && !['self', 'ally', 'allAllies'].includes(effect.target)) ? 'offense' : 'support';
}
// Normalize each eligible role group, so changing the number of cards does
// not quietly change the tradition's offense/support ratio.
export function spellPoolWeights(cards, tradition) {
  const target = rules.traditions[tradition];
  const counts = { offense: 0, support: 0 };
  for (const card of cards) if (cardSpellTraditions(card).includes(tradition)) counts[spellPoolRole(card)]++;
  return Object.fromEntries(cards.map(card => {
    const role = spellPoolRole(card);
    return [card.id, cardSpellTraditions(card).includes(tradition) ? target[role] / counts[role] : 0];
  }));
}
export function spellTraditionLabel(card) {
  const traditions = cardSpellTraditions(card);
  return traditions.length === 1 ? rules.traditions[traditions[0]].label : 'Spell';
}
