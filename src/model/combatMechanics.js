// src/model/combatMechanics.js — pure resolver for parent->child combat mechanic definitions.
// Compiled defaults live in src/content/generated/combatMechanics.js (from content/source/mechanics/*.json).
// Score Studio and tests may pass an in-memory authored map to ResolveMechanicsTable to preview edits live.

import { combatMechanics as GENERATED_MECHANICS } from '../content/generated/combatMechanics.js';

const cloneValue = (value) => (value && typeof value === 'object' ? structuredClone(value) : value);

/**
 * Resolve a raw map of `{ [id]: { extends?: parentId, ...fields } }` into:
 *   - `resolved`: effective field values per mechanic id (inheriting any omitted field from its parent chain)
 *   - `authored`: raw authored entries (without resolved parent fields)
 *   - `inheritedFrom`: per mechanic id, `{ [field]: sourceMechanicId }` for every field inherited from an ancestor
 *   - `parents`: `{ [id]: parentId | null }`
 * Refuses unknown parents and inheritance cycles by name.
 */
export function ResolveMechanicsTable(rawEntries = {}) {
  const authored = {};
  const parents = {};
  for (const [id, entry] of Object.entries(rawEntries || {})) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`mechanics/${id}: entry must be a JSON object`);
    }
    if (entry.extends !== undefined && entry.extends !== null && (typeof entry.extends !== 'string' || !entry.extends.trim())) {
      throw new Error(`mechanics/${id}: 'extends' must be a non-empty mechanic id string`);
    }
    authored[id] = cloneValue(entry);
    parents[id] = entry.extends || null;
  }

  const resolved = {};
  const inheritedFrom = {};
  const visiting = new Set();

  const resolveOne = (id) => {
    if (resolved[id]) return resolved[id];
    if (visiting.has(id)) throw new Error(`mechanics/${id}: inheritance cycle detected`);
    const entry = authored[id];
    const parentId = parents[id];
    if (parentId && !Object.hasOwn(authored, parentId)) {
      throw new Error(`mechanics/${id}: unknown parent '${parentId}'`);
    }
    visiting.add(id);
    const parentResolved = parentId ? resolveOne(parentId) : null;
    const parentInherited = parentId ? inheritedFrom[parentId] : null;
    visiting.delete(id);

    const out = {};
    const from = {};
    if (parentResolved) {
      for (const [key, value] of Object.entries(parentResolved)) {
        out[key] = cloneValue(value);
        from[key] = parentInherited?.[key] || parentId;
      }
    }
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'extends') continue;
      out[key] = cloneValue(value);
      delete from[key];
    }
    resolved[id] = out;
    inheritedFrom[id] = from;
    return out;
  };

  for (const id of Object.keys(authored)) resolveOne(id);
  return { resolved, authored, inheritedFrom, parents };
}

/** Active combat mechanics table from a combat/run/profile context, or the compiled default. */
export function CombatMechanicsOf(ctx = null) {
  return ctx?.combatMechanics || ctx?.gameProfile?.combatMechanics || GENERATED_MECHANICS;
}

/** Effective resolved row for `id` (or null if absent). */
export function MechanicRule(id, ctx = null) {
  const table = CombatMechanicsOf(ctx);
  return table?.resolved?.[id] || null;
}

/** True when a card carries an active Wither limit under the current combat mechanics table. */
export function EffectiveWitherLimit(def, ctx = null) {
  const rule = MechanicRule('wither', ctx);
  if (rule && rule.enabled === false) return null;
  if (Number.isSafeInteger(def?.wither) && def.wither >= 1) return def.wither;
  return null;
}

/** Effective costGrowth config for a card, inheriting defaults from `costGrowth` / `costGrowth.shared`. */
export function EffectiveCostGrowth(def, ctx = null) {
  if (!def?.costGrowth) return null;
  const parentRule = MechanicRule('costGrowth', ctx);
  if (parentRule && parentRule.enabled === false) return null;
  const raw = def.costGrowth;
  const isShared = raw.perCard === true || raw.scope === 'card' || (raw.scope === undefined && raw.perCard === undefined && parentRule?.scope === 'card');
  const baseRule = isShared ? (MechanicRule('costGrowth.shared', ctx) || parentRule) : parentRule;
  const stamina = raw.stamina ?? baseRule?.stamina ?? 0;
  const mana = raw.mana ?? baseRule?.mana ?? 0;
  if (!(stamina > 0) && !(mana > 0)) return null;
  return {
    ...raw,
    stamina,
    mana,
    perUse: raw.perUse ?? baseRule?.perUse ?? 1,
    max: raw.max ?? baseRule?.maxSteps ?? 3,
    uncapped: raw.uncapped ?? baseRule?.uncapped ?? false,
    perCard: isShared,
    scope: isShared ? 'card' : 'instance',
  };
}

/**
 * Effective Pierce guard-interaction rules, inheriting from `guardInteraction` -> `pierce`.
 * Returns null when disabled via `guardInteraction.enabled === false` or `pierce.enabled === false`.
 * Preserves historical per-fight saved `fixCoreRules.pierce` defaults without backfilling newer keys.
 */
export function EffectivePierceRules(fixCoreRulesObj = null, ctx = null) {
  const rule = MechanicRule('pierce', ctx);
  if (rule && rule.enabled === false) return null;
  if (fixCoreRulesObj) return { enabled: true, mode: rule?.mode || 'bypass', ...(fixCoreRulesObj.pierce || {}) };
  return { ...(rule || {}) };
}

/**
 * Effective Smash-vs-Defensive guard-interaction rules, inheriting from `guardInteraction` -> `smashVsDefensive`.
 * Returns null when disabled via `guardInteraction.enabled === false` or `smashVsDefensive.enabled === false`.
 * Preserves historical per-fight saved `fixCoreRules.smashVsDefensive` defaults without backfilling newer keys.
 * Attaches the resolved `blockBreak` sibling rule as `flatBreak` for `"flatBreak"` and `"both"` modes.
 */
export function EffectiveSmashGuardRules(fixCoreRulesObj = null, ctx = null) {
  const rule = MechanicRule('smashVsDefensive', ctx);
  if (rule && rule.enabled === false) return null;
  const flatBreak = MechanicRule('blockBreak', ctx);
  const resolvedFlat = flatBreak && flatBreak.enabled !== false ? flatBreak : null;
  if (fixCoreRulesObj) {
    return {
      enabled: true,
      mode: rule?.mode || 'multiplier',
      ...(fixCoreRulesObj.smashVsDefensive || {}),
      flatBreak: resolvedFlat,
    };
  }
  return {
    ...(rule || {}),
    flatBreak: resolvedFlat,
  };
}

/**
 * Flat Block removed before normal Block absorption (when `blockBreak` is enabled).
 * Reads explicit `carrier.blockBreak` (if > 0) or derives from `smashRule.mode` (`"flatBreak"` | `"both"`).
 */
export function EffectiveBlockBreakAmount(carrier, rawAmount = 0, smashRule = null, ctx = null) {
  const rule = MechanicRule('blockBreak', ctx);
  if (rule && rule.enabled === false) return 0;
  const explicit = Number(carrier?.blockBreak);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  if (smashRule && (smashRule.mode === 'flatBreak' || smashRule.mode === 'both') && smashRule.flatBreak) {
    const ratio = Number(smashRule.flatBreak.blockBreakRatio) || 0;
    return Math.max(0, Math.floor(Math.max(0, Number(rawAmount) || 0) * ratio));
  }
  return 0;
}
