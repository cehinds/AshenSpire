import { combatStatusRules } from '../content/combatStatusRules.js';
import { statuses } from '../content/statuses.js';
import { constantFormulaValue, isFormula } from '../model/formulas.js';
import { chanceToD20Steps } from '../model/d20Chance.js';
import { primaryEffectIndex } from '../model/cardRank.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { statusPresentationContext } from '../model/statusPresentation.js';

const attributes = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom'];
export const CARD_STAT_MODIFIER_IDS = Object.freeze([
  ...attributes, 'hp', 'mp', 'poise', 'damage', 'sp', 'handsize', 'gold', 'xp',
]);

const shippedStatuses = new Map(statuses.map(status => [status.id, status]));
const legacyAttributes = { strength: 'attackDamageAdd', dexterity: 'blockAdd', wisdom: 'poiseAdd', intelligence: 'magicDamageAdd' };
const maxLinkedDepth = 8;

function registryRow(registry, id) {
  if (typeof id !== 'string') return undefined;
  if (Array.isArray(registry)) return registry.find(row => row.id === id);
  return registry?.has?.(id) ? registry.get(id) : undefined;
}

function effectCanGrant(amount, defaultAmount = 0) {
  const constant = constantFormulaValue(amount ?? defaultAmount);
  return constant === undefined ? isFormula(amount) : constant > 0;
}

/** Extract presentation tags from the effective card payload without evaluating combat state. */
export function CardEffectArtFacts(definition, registries, tags = []) {
  const activeStatuses = registries == null ? shippedStatuses : registries.statuses;
  const modifiers = new Set();
  const add = (tags, stat, delta) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    const tag = `${delta > 0 ? 'buff' : 'debuff'}:${stat}`;
    modifiers.add(tag);
    tags.add(tag);
  };

  const classifyStatus = (tags, id) => {
    const status = registryRow(activeStatuses, id);
    if (!status) return;
    if (id === 'barrier') add(tags, 'poise', 1);
    // The combat presentation registry masks Weak's legacy damage modifier in
    // FixCore, where the active rule changes Attack rating instead.
    if (id === 'weak') {
      const context = statusPresentationContext(status);
      if (fixCoreEnabled(context)) {
        add(tags, 'damage', fixCoreRules(context, context.statusHolder).statuses.weakARMultiplier - 1);
        return;
      }
    }
    const modifiers = status.modifiers || {};
    if (modifiers.meterMaxGrowthDisabled === true) add(tags, 'poise', -1);
    // Legacy Strength/Dexterity stacks use dedicated combat modifiers.
    if (Object.hasOwn(legacyAttributes, id)) add(tags, id, modifiers[legacyAttributes[id]]);
    if (id !== 'strength') add(tags, 'damage', modifiers.attackDamageAdd);
    for (const mult of [modifiers.damageDealtMult, modifiers.spellDamageDealtMult]) {
      if (Number.isFinite(mult)) add(tags, 'damage', mult - 1);
    }
  };

  const activeLinks = new Set();
  if (definition?.id) activeLinks.add(definition.id);
  function scan(effects, depth, tags = new Set()) {
    if (!Array.isArray(effects)) return tags;
    for (const effect of effects) {
      if (effect?.op === 'heal' && effectCanGrant(effect.amount)) tags.add('effect:heal');
      if (effect?.op === 'shuffleDiscardIntoDraw' || (effect?.op === 'draw' && effectCanGrant(effect.amount, 1))) tags.add('effect:draw');
      if (effect?.op === 'removeStatus' && effect.target === 'self' && (effect.amount === undefined || effectCanGrant(effect.amount))) tags.add('effect:cleanse');
      switch (effect?.op) {
        case 'changeAttribute':
          if (attributes.includes(effect.attribute)) add(tags, effect.attribute, constantFormulaValue(effect.amount));
          break;
        case 'applyStatus':
          if (effectCanGrant(effect.stacks, 1)
            || registryRow(activeStatuses, effect.status)?.stackMode === 'unique') {
            if (typeof effect.status === 'string') tags.add(`status:${effect.status}`);
            classifyStatus(tags, effect.status);
          }
          break;
        case 'buildup': {
          if (typeof effect.chance === 'number' && !chanceToD20Steps(effect.chance)) break;
          if (!effectCanGrant(effect.amount)) break;
          if (typeof effect.status === 'string') tags.add(`status:${effect.status}`);
          const rules = registries?.combatStatusRules || combatStatusRules;
          const gauge = Object.hasOwn(rules.statuses || {}, effect.status) ? rules.statuses[effect.status] : null;
          if (!gauge) break;
          classifyStatus(tags, gauge.activeStatus);
          for (const [id, amount] of Object.entries(gauge.grants || {})) if (amount > 0) classifyStatus(tags, id);
          break;
        }
        case 'gainBarrier':
          if (effectCanGrant(effect.amount)) classifyStatus(tags, 'barrier');
          break;
        case 'loseMaxHpPct':
          add(tags, 'hp', -constantFormulaValue(effect.pct));
          break;
        case 'grantCardCharge':
          if (effectCanGrant(effect.damage)) add(tags, 'damage', 1);
          break;
        case 'castLinkedSpell': {
          if (depth >= maxLinkedDepth || activeLinks.has(effect.card)) break;
          const linked = registryRow(registries?.cards, effect.card);
          if (!linked) break;
          activeLinks.add(effect.card);
          scan(linked.effects, depth + 1, tags);
          activeLinks.delete(effect.card);
          break;
        }
      }
    }
    return tags;
  }
  const effects = Array.isArray(definition?.effects) ? definition.effects : [];
  const authored = effects.map(effect => scan([effect], 0));
  const declaredMain = tags.filter(tag => tag.startsWith('main:')).map(tag => tag.slice('main:'.length));
  const utilityFocus = tags.map(tag => tag.replace(/^fx:/, 'effect:')).filter(tag => tag.startsWith('effect:'));
  const matches = focus => authored.findIndex(facts => focus.some(tag => facts.has(tag)));
  const main = [matches(declaredMain), matches(utilityFocus), primaryEffectIndex({ effects })].find(index => index >= 0)
    ?? authored.findIndex(facts => facts.size > 0);
  const secondary = new Set(authored.flatMap((tags, i) => i === main ? [] : [...tags]));
  for (const tag of scan(definition?.comboHook?.effects, 0)) secondary.add(tag);
  return { modifiers: [...modifiers], tags: [...new Set([...(authored[main] || []), ...secondary])], secondary: [...secondary] };
}

/** Extract presentation modifier tags without evaluating combat state. */
export function CardStatModifierTags(definition, registries) {
  return CardEffectArtFacts(definition, registries).modifiers;
}
