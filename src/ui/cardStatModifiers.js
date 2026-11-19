import { combatStatusRules } from '../content/combatStatusRules.js';
import { statuses } from '../content/statuses.js';
import { constantFormulaValue, isFormula } from '../model/formulas.js';
import { chanceToD20Steps } from '../model/d20Chance.js';

const attributes = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom'];
export const CARD_STAT_MODIFIER_IDS = Object.freeze([
  ...attributes, 'hp', 'mp', 'poise', 'damage', 'sp', 'handsize', 'gold', 'xp',
]);

const shippedStatuses = new Map(statuses.map(status => [status.id, status]));
const legacyAttributes = { strength: 'attackDamageAdd', dexterity: 'blockAdd' };
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
export function CardStatModifierTags(definition, registries) {
  const activeStatuses = registries == null ? shippedStatuses : registries.statuses;
  const tags = new Set();
  const add = (stat, delta) => {
    if (Number.isFinite(delta) && delta !== 0) tags.add(`${delta > 0 ? 'buff' : 'debuff'}:${stat}`);
  };

  const classifyStatus = id => {
    const status = registryRow(activeStatuses, id);
    if (!status) return;
    if (id === 'barrier') add('poise', 1);
    const modifiers = status.modifiers || {};
    if (modifiers.meterMaxGrowthDisabled === true) add('poise', -1);
    // Legacy Strength/Dexterity stacks use dedicated combat modifiers.
    if (Object.hasOwn(legacyAttributes, id)) add(id, modifiers[legacyAttributes[id]]);
    if (id !== 'strength') add('damage', modifiers.attackDamageAdd);
    for (const mult of [modifiers.damageDealtMult, modifiers.spellDamageDealtMult]) {
      if (Number.isFinite(mult)) add('damage', mult - 1);
    }
  };

  const activeLinks = new Set();
  if (definition?.id) activeLinks.add(definition.id);
  function scan(effects, depth) {
    if (!Array.isArray(effects)) return;
    for (const effect of effects) {
      switch (effect?.op) {
        case 'changeAttribute':
          if (attributes.includes(effect.attribute)) add(effect.attribute, constantFormulaValue(effect.amount));
          break;
        case 'applyStatus':
          if (effectCanGrant(effect.stacks, 1)
            || registryRow(activeStatuses, effect.status)?.stackMode === 'unique') classifyStatus(effect.status);
          break;
        case 'buildup': {
          if (typeof effect.chance === 'number' && !chanceToD20Steps(effect.chance)) break;
          if (!effectCanGrant(effect.amount)) break;
          const rules = registries?.combatStatusRules || combatStatusRules;
          const gauge = Object.hasOwn(rules.statuses || {}, effect.status) ? rules.statuses[effect.status] : null;
          if (!gauge) break;
          classifyStatus(gauge.activeStatus);
          for (const [id, amount] of Object.entries(gauge.grants || {})) if (amount > 0) classifyStatus(id);
          break;
        }
        case 'gainBarrier':
          if (effectCanGrant(effect.amount)) classifyStatus('barrier');
          break;
        case 'loseMaxHpPct':
          add('hp', -constantFormulaValue(effect.pct));
          break;
        case 'grantCardCharge':
          if (effectCanGrant(effect.damage)) add('damage', 1);
          break;
        case 'castLinkedSpell': {
          if (depth >= maxLinkedDepth || activeLinks.has(effect.card)) break;
          const linked = registryRow(registries?.cards, effect.card);
          if (!linked) break;
          activeLinks.add(effect.card);
          scan(linked.effects, depth + 1);
          activeLinks.delete(effect.card);
          break;
        }
      }
    }
  }
  scan(definition?.effects, 0);
  // Combat powers can also grant modifiers when their active combo triggers.
  scan(definition?.comboHook?.effects, 0);
  return [...tags];
}
