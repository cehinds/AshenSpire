// src/model/registries.js — typed id → definition registries, deep-frozen (SPEC §3.3)
//
// createRegistries(contentBundle) loads all content into typed, deep-frozen
// registries keyed by id. Cross-references are by id only; getters THROW on
// unknown ids (dangling ids are caught earlier by model/validate.js).
//
// Headless: no document/window/localStorage/timers.

import { REGISTRY_TYPES } from './schemas.js';

/** Recursively freeze a value in place (functions and frozen values skipped). */
export function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function makeRegistry(typeName, defs) {
  const byId = new Map();
  for (const def of defs || []) {
    if (!def || typeof def.id !== 'string') {
      throw new Error(`Every ${typeName} def must have a string id (got ${JSON.stringify(def && def.id)})`);
    }
    if (byId.has(def.id)) {
      throw new Error(`Duplicate ${typeName} id '${def.id}'`);
    }
    byId.set(def.id, deepFreeze(def));
  }
  return Object.freeze({
    type: typeName,
    size: byId.size,
    get(id) {
      const d = byId.get(id);
      if (!d) throw new Error(`Unknown ${typeName} id '${id}'`);
      return d;
    },
    has(id) {
      return byId.has(id);
    },
    ids() {
      return [...byId.keys()];
    },
    all() {
      return [...byId.values()];
    },
  });
}

// Bundle key → registry property + singular type name for error messages.
const TYPE_SINGULAR = {
  cards: 'card',
  relics: 'relic',
  statuses: 'status',
  stances: 'stance',
  keywords: 'keyword',
  enemies: 'enemy',
  encounters: 'encounter',
  events: 'event',
  flasks: 'flask',
  classes: 'class',
};

/**
 * createRegistries(contentBundle) → frozen registries object.
 *
 * contentBundle = {
 *   version?: string,                    // contentVersion (SPEC §3.12)
 *   cards?: [], relics?: [], statuses?: [], stances?: [], keywords?: [],
 *   enemies?: [], encounters?: [], events?: [], flasks?: [], classes?: [],
 *   balance?: {},                        // flat constants (SPEC §3.3)
 *   mapConfigs?: { [actNumber]: {...} },
 *   scripts?: { [name]: function },      // budgeted escape hatch (SPEC §3.1(6))
 * }
 *
 * Missing collections default to empty. Duplicate ids throw.
 *
 * Result shape:
 *   registries.cards.get(id) / .has(id) / .ids() / .all() / .size
 *   ... same for relics, statuses, stances, keywords, enemies, encounters,
 *       events, flasks, classes
 *   registries.balance              — deep-frozen constants object
 *   registries.mapConfig(act)       — throws on unknown act
 *   registries.scripts              — frozen { name: fn }
 *   registries.contentVersion       — string
 */
export function createRegistries(contentBundle) {
  const bundle = contentBundle || {};
  const registries = {};

  for (const type of REGISTRY_TYPES) {
    registries[type] = makeRegistry(TYPE_SINGULAR[type], bundle[type]);
  }

  registries.balance = deepFreeze({ ...(bundle.balance || {}) });

  const mapConfigs = deepFreeze({ ...(bundle.mapConfigs || {}) });
  registries.mapConfigs = mapConfigs;
  registries.mapConfig = (act) => {
    const cfg = mapConfigs[act];
    if (!cfg) throw new Error(`Unknown mapConfig for act '${act}'`);
    return cfg;
  };

  registries.scripts = Object.freeze({ ...(bundle.scripts || {}) });
  registries.contentVersion = String(bundle.version || bundle.contentVersion || '0');

  return Object.freeze(registries);
}

// ---------------------------------------------------------------------------
// Card resolution — definitions vs instances (SPEC §3.3, §4.3)
// ---------------------------------------------------------------------------

// Cache resolved upgrade merges per registries object.
const resolveCache = new WeakMap();

/**
 * resolveCard(registries, cardInstanceOrRef) → effective (frozen) card def.
 *
 * Accepts anything with { cardId, upgraded? }. For upgraded cards the
 * `upgrade` partial override is merged over the base def:
 *   - scalar fields (cost, textTemplate, ...) replace the base value
 *   - `effects` REPLACES the base effects array entirely when present
 *   - `keywords` REPLACES the base keywords entirely when present (list the
 *     full upgraded set — this is what lets an upgrade remove Exhaust)
 *   - `name` defaults to base name + '+'
 */
export function resolveCard(registries, instanceOrRef) {
  const cardId = instanceOrRef.cardId;
  const base = registries.cards.get(cardId);
  if (!instanceOrRef.upgraded) return base;

  let cache = resolveCache.get(registries);
  if (!cache) {
    cache = new Map();
    resolveCache.set(registries, cache);
  }
  let merged = cache.get(cardId);
  if (merged) return merged;

  const up = base.upgrade || {};
  merged = {
    ...base,
    ...up,
    name: up.name != null ? up.name : `${base.name}+`,
    keywords: up.keywords != null ? up.keywords : base.keywords || [],
    effects: up.effects != null ? up.effects : base.effects,
    textTemplate: up.textTemplate != null ? up.textTemplate : base.textTemplate,
    upgraded: true,
  };
  deepFreeze(merged);
  cache.set(cardId, merged);
  return merged;
}
