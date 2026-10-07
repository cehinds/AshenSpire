// src/framework/costs.js — cost compilation and atomic alternative-cost
// payment (framework contract: Cost compilation).
//
// Damage and cost are separate property families: Physical does not imply
// Stamina, and Magic does not imply Mana — costs come only from cost.* rows.

import { hasProperty } from './compiler.js';
import { COST_MODES } from './schema.js';

export class CostError extends Error {
  constructor(cardId, message) {
    super(`costs ${cardId}: ${message}`);
    this.name = 'CostError';
  }
}

const COST_RESOURCE = Object.freeze({
  'cost.action': 'action',
  'cost.stamina': 'stamina',
  'cost.mana': 'mana',
});

/** Repeat limiters (framework contract): a cost entry, cooldown, once-per-turn, Exhaust, or Seal. */
export function repeatLimiters(card, profile) {
  const limiters = [];
  for (const entry of profile.entries) if (entry.amount > 0) limiters.push(`cost.${entry.resource}`);
  if (hasProperty(card, 'lifecycle.exhaust')) limiters.push('lifecycle.exhaust');
  if (hasProperty(card, 'lifecycle.seal')) limiters.push('lifecycle.seal');
  for (const [key, value] of Object.entries(card.overrides || {})) {
    if ((key === 'cooldown' || key === 'oncePerTurn') && value) limiters.push(key);
  }
  return limiters;
}

/**
 * compileCosts(compiledCard, context) -> CostProfile
 * context.modifiers: List<{resource, delta} | {resource, set}> from equipment,
 * runes, relics and statuses — data rows, applied in the order given by the
 * compiler's precedence sort, never functions.
 */
export function compileCosts(card, context = {}) {
  const entries = [];
  for (const prop of card.properties) {
    const resource = COST_RESOURCE[prop.propertyId];
    if (resource) entries.push({ resource, amount: prop.parameters.amount ?? 1 });
  }
  const alternatives = [];
  const altProp = card.properties.find((p) => p.propertyId === 'cost.alternative');
  if (altProp) {
    const options = altProp.parameters.options;
    if (!Array.isArray(options) || options.length === 0) {
      throw new CostError(card.id, 'cost.alternative present with no complete option');
    }
    for (const option of options) {
      if (!Array.isArray(option.entries) || option.entries.length === 0) {
        throw new CostError(card.id, 'alternative option has no entries');
      }
      alternatives.push({ mode: 'ALL_REQUIRED', entries: option.entries.map((e) => ({ ...e })) });
    }
  }

  for (const mod of context.modifiers || []) {
    const entry = entries.find((e) => e.resource === mod.resource);
    if (!entry) continue;
    if (mod.set != null) entry.amount = mod.set;
    else entry.amount = Math.max(0, entry.amount + (mod.delta || 0));
  }

  const profile = {
    mode: alternatives.length ? 'CHOOSE_ONE' : 'ALL_REQUIRED',
    entries,
    alternatives,
    minimumLimiter: context.minimumLimiter,
  };
  if (!COST_MODES.includes(profile.mode)) throw new CostError(card.id, `bad mode ${profile.mode}`);

  if (hasProperty(card, 'lifecycle.recall.afterUse')) {
    if (repeatLimiters(card, profile).length === 0) {
      throw new CostError(card.id, 'Recall After Use requires at least one repeat limiter');
    }
  }
  return profile;
}

/**
 * payAlternativeCost — reserve, confirm, then commit atomically. `wallet` is a
 * plain {resource: amount} object; `confirmTarget` may veto; on veto or any
 * failure the wallet is untouched.
 */
export function payAlternativeCost(card, option, wallet, { confirmTarget = () => true } = {}) {
  if (!option || !Array.isArray(option.entries) || option.entries.length === 0) {
    throw new CostError(card.id, 'alternative option is not complete');
  }
  for (const entry of option.entries) {
    if ((wallet[entry.resource] ?? 0) < entry.amount) {
      throw new CostError(card.id, `cannot pay ${entry.amount} ${entry.resource}`);
    }
  }
  if (!confirmTarget()) return { paid: false, wallet };
  const next = { ...wallet };
  for (const entry of option.entries) next[entry.resource] -= entry.amount;
  return { paid: true, wallet: next };
}
