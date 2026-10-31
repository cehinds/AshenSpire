import { fixCoreEnabled, fixCoreStatusDefinition } from './fixCoreMechanics.js';
import { keyFor as fixCoreRulesKey, fixCoreRules } from './fixCoreRulesCache.js';

// UI wording is separate from the versioned mechanic source: changing a label
// must not invalidate saved rules. Adapt only known legacy wording here, never
// the versioned mechanic definitions (whose prose is part of old-save pins).
const LEGACY_TOOLTIPS = Object.freeze({
  burn: 'At the start of its turn, loses HP equal to Burn stacks (ignores Block). One stack burns out each turn.',
  crimsonBlight: 'At the start of its turn, loses HP equal to Blight stacks (ignores Block). Stacks do not tick down; the Blight expires entirely after 3 turns. Re-applying adds stacks and refreshes the duration.',
});
function present(ctx, id, definition, holder) {
  const resolved = fixCoreStatusDefinition(ctx, id, definition, holder);
  return presentationWording(ctx, id, resolved, fixCoreEnabled(ctx), resolved !== definition);
}
function presentationWording(ctx, id, resolved, core, changedDefinition = false) {
  if (!resolved || typeof resolved !== 'object') return resolved;
  const display = text => {
    if (typeof text !== 'string') return text;
    if (id === 'evade' && core && changedDefinition) return text.replace(/\bfixed Evasion\b/g, 'Evasion');
    if (id === 'burn' && core && text === LEGACY_TOOLTIPS.burn) return text.replace(' One stack burns out each turn.', '');
    if (id === 'crimsonBlight' && (core || ctx?.combatExpansionVersion >= 2) && text === LEGACY_TOOLTIPS.crimsonBlight) return text.replace(
      'the Blight expires entirely after 3 turns. Re-applying adds stacks and refreshes the duration.',
      'the Blight expires entirely after {decay.duration} turns.');
    return text;
  };
  const tooltip = display(resolved.tooltip), description = display(resolved.description);
  return tooltip === resolved.tooltip && description === resolved.description ? resolved : { ...resolved, tooltip, description };
}

// Memoised front, same discipline as fixCoreRulesCache. The answer is a pure
// function of: whether FixCore is on (three ctx fields), the raw rules and the
// holder's attachment rows (the key fixCoreRulesCache already uses), the status
// id, and the base definition the row is spread from. All of it is keyed as
// JSON, never on object identity. A definition that cannot round-trip through
// JSON (a function, undefined, NaN, a class instance) is not cached at all, and
// neither is an answer that is the caller's own definition (FixCore off).
// Entries are deep-frozen copies; each call gets a fresh top-level object.
const CACHE_MAX = 256;
const cache = new Map();
const presentationContexts = new WeakMap();

export function inheritStatusPresentationContext(source, target) {
  const saved = presentationContexts.get(source);
  if (saved && target && typeof target === 'object') presentationContexts.set(target, saved);
  return target;
}

export function statusPresentationContext(def, context = {}) {
  const saved = presentationContexts.get(def);
  if (!saved || context.coreStatusAuthority || context.fixCoreRules || context.gameProfile) return context;
  // Read through the combat without copying its snapshot into each tooltip.
  // Explicit caller options (including foundation instance semantics) win.
  return Object.assign(Object.create(saved.context), context, { statusHolder: saved.holder });
}

function plain(value) {
  let ok = true;
  const text = JSON.stringify(value, (key, inner) => {
    if (inner === undefined || typeof inner === 'function' || typeof inner === 'symbol' || typeof inner === 'bigint') ok = false;
    else if (typeof inner === 'number' && !Number.isFinite(inner)) ok = false;
    else if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const proto = Object.getPrototypeOf(inner);
      if (proto !== Object.prototype && proto !== null) ok = false;
    }
    return inner;
  });
  return ok ? text : null;
}

function presentationKey(ctx, id, definition, holder) {
  try {
    const rules = fixCoreRulesKey(ctx, holder, null), base = plain(definition);
    if (rules === null || base === null) return null;
    return JSON.stringify([ctx?.combatExpansionVersion ?? 0, ctx?.fixCoreRules?.version ?? 0,
      ctx?.gameProfile?.modules?.effects?.fixCoreVersion ?? 0, rules, String(id), base]);
  } catch { return null; }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

export function statusPresentationDefinition(ctx, id, definition, holder = null) {
  const key = definition && typeof definition === 'object' ? presentationKey(ctx, id, definition, holder) : null;
  if (key === null) {
    const result = present(ctx, id, definition, holder);
    if (result && result !== definition) presentationContexts.set(result, { context: ctx, holder,
      definition: presentationContexts.get(definition)?.definition || definition });
    return result;
  }
  let hit = cache.get(key);
  if (!hit) {
    const resolved = present(ctx, id, definition, holder);
    if (resolved === definition || !resolved || typeof resolved !== 'object') return resolved;
    hit = deepFreeze(structuredClone(resolved));
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, hit);
  }
  const result = { ...hit };
  presentationContexts.set(result, { context: ctx, holder,
    definition: presentationContexts.get(definition)?.definition || definition });
  return result;
}

/** Test seam: the number of distinct stored answers. */
export const statusPresentationCacheSize = () => cache.size;
export const clearStatusPresentationCache = () => cache.clear();

export function resolveStatusPresentationDefinition(def, context = {}) {
  context = statusPresentationContext(def, context);
  if (context.coreStatusAuthority?.enabled === false) {
    const original = presentationContexts.get(def)?.definition;
    return presentationWording(context, def.id, original ? { ...original, name: def.name } : def, false);
  }
  const saved = context.coreStatusAuthority?.definitions?.[def.id];
  if (saved) return { ...def, ...saved, name: def.name };
  return fixCoreEnabled(context) || context.combatExpansionVersion >= 2
    ? statusPresentationDefinition(context, def.id, def, context.statusHolder ?? null) : def;
}

// These are the two clock exceptions in engine/statuses.js: Precision clears
// its temporary part at owner turn end, and Evade decays at owner turn start.
const clockFor = def => def.id === 'precision' ? 'temporaryOwnerTurnEnd'
  : def.decay === 'perTurnEnd' || def.id === 'evade' ? 'stackOwnerTurnStart'
    : typeof def.decay === 'object' && Number.isFinite(def.decay?.duration) ? 'timerOwnerTurnStart' : null;

export function coreStatusLifecycle(def, context = {}) {
  context = statusPresentationContext(def, context);
  const saved = context.coreStatusAuthority;
  if (saved?.enabled === false) return null;
  if (saved) return { overrides: saved.overrideIds.includes(def.id), decayAmount: saved.decayAmount,
    clock: saved.clocks?.[def.id] ?? clockFor(def) };
  if (!fixCoreEnabled(context)) return null;
  const rules = fixCoreRules(context, context.statusHolder ?? null).statuses;
  return { overrides: Boolean(rules.overrides?.[def.id]), decayAmount: rules.decayAmount, clock: clockFor(def) };
}

/** Small detached preview receipt: only statuses the card can mention. */
export function coreStatusPresentation(context, card, effects = card.effects) {
  if (!fixCoreEnabled(context)) return { enabled: false };
  const ids = new Set(), visited = new Set();
  const walk = value => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (['applyStatus', 'buildup'].includes(value.op) && context.registries.statuses.has(value.status)) ids.add(value.status);
    for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child);
  };
  walk(card.effects);
  walk(effects);
  for (const key of ['counterPayload', 'upcast', 'schoolEffect']) walk(card[key]);
  const statuses = fixCoreRules(context).statuses;
  const definitions = Object.fromEntries([...ids].map(id => [id,
    statusPresentationDefinition(context, id, context.registries.statuses.get(id))]));
  return structuredClone({ enabled: true, definitions, overrideIds: Object.keys(statuses.overrides || {}), decayAmount: statuses.decayAmount,
    clocks: Object.fromEntries([...ids].map(id => [id, clockFor(definitions[id])])) });
}
