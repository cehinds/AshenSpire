import { spellTraditions as rules } from '../content/generated/spellTraditions.js';
import { statRow } from './statRows.js';
import { statRowValue } from './derivedStats.js';
import { PrAttributeView } from './fixCoreMechanics.js';
import { t } from './strings.js';

const traditionIds = Object.freeze(Object.keys(rules.traditions));
const tagIds = card => (card?.cardTags ?? card?.tags ?? []).map(tag => typeof tag === 'string' ? tag : tag.id);

export function SpellSchool(card) {
  const tags = tagIds(card);
  return card?.combatProfile?.school || card?.school
    || tags.find(tag => tag.startsWith('school:'))?.slice(7)
    || (Object.hasOwn(rules.schools, card?.damageSchool) ? card.damageSchool : null)
    || 'arcane';
}

export function CardSpellTraditions(card) {
  const explicit = tagIds(card).filter(tag => tag.startsWith('tradition:')).map(tag => tag.slice(10));
  return explicit.length ? traditionIds.filter(id => explicit.includes(id))
    : [...(rules.schools[SpellSchool(card)] || rules.schools.arcane)];
}

export function SpellTraditionsActive(ctx) {
  return ctx?.fixCoreRules ? ctx.fixCoreRules.spellTraditionsVersion === rules.version
    : ctx?.gameProfile?.modules?.effects?.spellTraditionsVersion === rules.version;
}

export function SpellScalingValue(attributes, card) {
  return Math.max(0, ...CardSpellTraditions(card).map(id => Number(attributes?.[rules.traditions[id].attribute]) || 0));
}

function spellRow(ctx, entity) {
  const enemy = entity?.kind === 'enemy';
  return statRow(ctx?.registries, {
    derivedStatRuleSnapshot: enemy ? null : ctx?.derivedStatRuleSnapshot,
    class: enemy ? null : entity?.classId,
  }, 'pr');
}

function evaluateSpellRow(row, ctx, entity, attributes, card) {
  const read = card && SpellTraditionsActive(ctx)
    ? { ...attributes, intelligence: SpellScalingValue(attributes, card) }
    : PrAttributeView(ctx, attributes);
  const level = entity?.kind === 'enemy' ? 1 : ctx?.characterLevel || 1;
  return statRowValue(row, { attributes: read, level, statId: 'pr', lenientAttributes: true }).value;
}

export function SpellRowValue(ctx, entity, attributes, card = null) {
  const row = spellRow(ctx, entity);
  return row ? evaluateSpellRow(row, ctx, entity, attributes, card) : 0;
}

export function TraditionSpellPower(ctx, entity, card, previous) {
  if (!SpellTraditionsActive(ctx)) return previous;
  const definition = card?.cardId && ctx.registries?.cards?.has?.(card.cardId) ? ctx.registries.cards.get(card.cardId) : null;
  if (definition) card = { ...definition, ...card };
  const attributes = entity?.attributes || (entity?.kind === 'enemy' ? {} : ctx.attributes) || {};
  const row = spellRow(ctx, entity);
  if (!row) return previous;
  const intrinsic = entity?.kind === 'enemy' ? Number(entity.ratings?.pr) || 0
    : evaluateSpellRow(row, ctx, entity, attributes, null);
  return Math.max(0, previous - intrinsic + evaluateSpellRow(row, ctx, entity, attributes, card));
}

// The words live in uiStrings.csv (card.tradition.*), not in spellTraditions.json:
// a one-tradition card wears that tradition's name, a shared card wears "Spell".
export function SpellTraditionLabel(card) {
  const traditions = CardSpellTraditions(card);
  return t(traditions.length === 1 ? `card.tradition.${traditions[0]}` : 'card.tradition.shared');
}


export function SpellPoolRole(card) {
  if (rules.roles?.[card.id]) return rules.roles[card.id];
  const effects = card.effects || [];
  return effects.some(effect => effect.op === 'damage'
    || effect.op === 'applyStatus' && rules.offensiveStatuses.includes(effect.status)
      && !['self', 'ally', 'allAllies'].includes(effect.target)) ? 'offense' : 'support';
}
// Normalize each eligible role group, so changing the number of cards does
// not quietly change the tradition's offense/support ratio.
export function SpellPoolWeights(cards, tradition) {
  const target = rules.traditions[tradition];
  const counts = { offense: 0, support: 0 };
  for (const card of cards) if (CardSpellTraditions(card).includes(tradition)) counts[SpellPoolRole(card)]++;
  return Object.fromEntries(cards.map(card => {
    const role = SpellPoolRole(card);
    return [card.id, CardSpellTraditions(card).includes(tradition) ? target[role] / counts[role] : 0];
  }));
}
