// src/model/registries.js — typed id → definition registries, deep-frozen (SPEC §3.3)
//
// createRegistries(contentBundle) loads all content into typed, deep-frozen
// registries keyed by id. Cross-references are by id only; getters THROW on
// unknown ids (dangling ids are caught earlier by model/validate.js).
//
// Headless: no document/window/localStorage/timers.

import { REGISTRY_TYPES, PASSIVE_KEYS } from './schemas.js';
import { applyCardMods } from './loadout.js';
import { deriveStat, resolveDerivedStatRules } from './derivedStats.js';
import { resolveRelicModifiers } from './relicModifiers.js';

function applyBasicCardProfile(def, profile) {
  if (!profile) return def;
  const tags = [...(profile.tags || [])];
  const effects = (def.effects || []).map((effect) => (
    effect.op === 'damage' ? { ...effect, tags } : { ...effect }
  ));
  return {
    ...def,
    name: profile.displayName,
    icon: profile.icon,
    flavor: profile.flavor || def.flavor,
    damageSchool: profile.damageSchool,
    exposureBuildupPerHit: profile.exposureBuildupPerHit,
    cardTags: tags,
    effects,
    equipmentProfileId: profile.id,
    equipmentRole: profile.role,
  };
}

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
  attributes: 'attribute',
  creationModes: 'creation mode',
  cards: 'card',
  resources: 'resource',
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
  registries.attributeRules = deepFreeze({ ...(bundle.attributeRules || {}) });
  // One object, not a copied settings shadow. The run snapshots the resolved
  // result; authoring and validation still point at this exact content object.
  registries.derivedStatRules = deepFreeze(bundle.derivedStatRules || {});

  const mapConfigs = deepFreeze({ ...(bundle.mapConfigs || {}) });
  registries.mapConfigs = mapConfigs;
  registries.mapConfig = (act) => {
    const cfg = mapConfigs[act];
    if (!cfg) throw new Error(`Unknown mapConfig for act '${act}'`);
    return cfg;
  };

  // Armaments/armour are tables, not id→def registries: pieces are looked up
  // by (slot, class) far more often than by bare id, and armour ids repeat
  // across classes on purpose. They ride along frozen, like balance.
  registries.equipment = deepFreeze({ ...(bundle.equipment || {}) });
  registries.tags = deepFreeze([...(bundle.tags || [])]);

  // Visual scaling domains use the same derived-stat engine as run creation.
  // They are content potential (the largest legal creation allocation), not a
  // gameplay cap and not a second formula in the HUD.
  const attributeIds = registries.attributes.ids();
  const creationCeiling = Math.max(0, ...registries.creationModes.all().map((mode) => mode.maximum || 0));
  const ceilingAttributes = Object.fromEntries(attributeIds.map((id) => [id, creationCeiling]));
  const rules = resolveDerivedStatRules(registries.derivedStatRules, { attributeIds, classFields: ['maxHp', 'hpPerConTier'] });
  let hpEquipmentBonus = 0;
  for (const piece of [...(registries.equipment.armour || []), ...(registries.equipment.armaments || [])]) {
    for (const raw of (piece && piece.mods) || []) {
      const match = /^self\.maxHp=\+?(-?\d+)$/.exec(String(raw).trim());
      if (match) hpEquipmentBonus = Math.max(hpEquipmentBonus, Number(match[1]));
    }
  }
  const domainRows = registries.classes.all().map((classDef) => {
    const relic = resolveRelicModifiers(registries, [classDef.startingRelic], { attributes: ceilingAttributes });
    return {
      hp: deriveStat(rules, 'hp', { attributes: ceilingAttributes, classDef }).value + relic.resources.hp.total + hpEquipmentBonus,
      mana: deriveStat(rules, 'mana', { attributes: ceilingAttributes, classDef }).value + relic.resources.mana.total,
      stamina: deriveStat(rules, 'stamina', { attributes: ceilingAttributes, classDef }).value + relic.resources.stamina.total,
    };
  });
  // Player Poise potential — the largest stagger threshold a loadout can
  // state: per equipment slot, the best authored piece whose kind that slot
  // accepts, plus every authored relic bonus. Content potential like hp above
  // (not a legality proof — it does not check class fit, only slot fit): an
  // equipment-table edit moves this ceiling, a code edit never does (Law 0
  // clause 1). Not a derived stat: poise is summed from equipment rows, so it
  // is derived here from the same tables the receipt reads
  // (model/statProjection.js playerPoiseThresholdReceipt), not from
  // derivedStatRules.
  const poisePieces = [
    ...((registries.equipment.armaments || []).map((p) => ({ kind: p.kind, poiseThreshold: p.poiseThreshold }))),
    ...((registries.equipment.armour || []).map((p) => ({ kind: 'armor', poiseThreshold: p.poiseThreshold }))),
  ];
  let poiseDomain = 0;
  for (const slot of registries.equipment.slots || []) {
    let best = 0;
    for (const piece of poisePieces) {
      if ((slot.kinds || []).includes(piece.kind) && Number.isFinite(piece.poiseThreshold) && piece.poiseThreshold > best) best = piece.poiseThreshold;
    }
    poiseDomain += best;
  }
  for (const relic of registries.relics.all()) {
    const add = relic.passives && relic.passives.poiseThresholdAdd;
    if (Number.isFinite(add) && add > 0) poiseDomain += add;
  }
  registries.statDomains = deepFreeze({
    hp: Math.max(...domainRows.map((row) => row.hp)),
    mana: Math.max(...domainRows.map((row) => row.mana)),
    stamina: Math.max(...domainRows.map((row) => row.stamina)),
    poise: poiseDomain,
  });

  // What can be earned. A table, like equipment — evaluated against saved
  // progress by model/unlocks.js, never by anything in here.
  registries.unlocks = deepFreeze([...(bundle.unlocks || [])]);

  registries.scripts = Object.freeze({ ...(bundle.scripts || {}) });
  registries.contentVersion = String(bundle.version || bundle.contentVersion || '0');

  return Object.freeze(registries);
}

// ---------------------------------------------------------------------------
// Relic passives (SPEC PASSIVE_KEYS) — data lookups over owned relic defs.
//
// The key is a string typed at nine call sites and a mis-typed one returns
// 1 / 0 / false — a defect that behaves exactly like a relic whose passive is
// simply not very good. PASSIVE_KEYS says which strings are real, so it does the
// saying: named once, with the legal set, and the caller still gets its default
// rather than a thrown boot. Until this the set had NO reader in the whole tree
// (tools/closedsets.mjs) — the vocabulary was decoration while the relic
// schema's hand-typed copy was the law.
// ---------------------------------------------------------------------------

const PASSIVE_SET = new Set(PASSIVE_KEYS);
const unknownPassives = new Set();
function knownPassive(key) {
  if (PASSIVE_SET.has(key) || unknownPassives.has(key)) return;
  unknownPassives.add(key);
  console.error(`[passives] '${key}' is not a relic passive — it will always read as the default. Legal: ${PASSIVE_KEYS.join(', ')}`);
}

/** Product of a multiplicative passive across owned relics (default 1). */
export function passiveMult(registries, relicIds, key) {
  knownPassive(key);
  let m = 1;
  for (const id of relicIds || []) {
    const p = registries.relics.get(id).passives;
    if (p && typeof p[key] === 'number') m *= p[key];
  }
  return m;
}

/** Sum of an additive passive across owned relics (default 0). */
export function passiveSum(registries, relicIds, key) {
  knownPassive(key);
  let s = 0;
  for (const id of relicIds || []) {
    const p = registries.relics.get(id).passives;
    if (p && typeof p[key] === 'number') s += p[key];
  }
  return s;
}

/** True if any owned relic sets the boolean passive. */
export function passiveFlag(registries, relicIds, key) {
  knownPassive(key);
  for (const id of relicIds || []) {
    const p = registries.relics.get(id).passives;
    if (p && p[key] === true) return true;
  }
  return false;
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
  const mods = instanceOrRef.mods;
  const profileId = instanceOrRef.profileId;
  const hasCarrier = typeof instanceOrRef.damageSchool === 'string' || Number.isInteger(instanceOrRef.exposureBuildupPerHit);
  if (!instanceOrRef.upgraded && !(mods && mods.length) && !profileId && !hasCarrier) return base;

  let cache = resolveCache.get(registries);
  if (!cache) {
    cache = new Map();
    resolveCache.set(registries, cache);
  }
  // Equipment numbers live on the INSTANCE (see model/loadout.js), so the key
  // has to include them — two Strikes can differ if one was drawn before a
  // mid-combat weapon swap and the other after.
  const key = `${cardId}|${instanceOrRef.upgraded ? 1 : 0}|${profileId || ''}|${mods ? mods.join(',') : ''}|${instanceOrRef.damageSchool || ''}|${instanceOrRef.exposureBuildupPerHit ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let result = base;
  if (instanceOrRef.upgraded) result = mergeUpgrade(base);
  if (profileId) {
    const profile = ((registries.equipment || {}).basicCardProfiles || []).find((p) => p.id === profileId);
    result = applyBasicCardProfile(result, profile);
  }
  if (mods && mods.length) {
    const eq = registries.equipment || {};
    result = deepFreeze(
      applyCardMods(result, mods, {
        modFields: eq.modFields || {},
        limits: (registries.balance.equipment || {}).limits || {},
      })
    );
  }
  if (hasCarrier) {
    result = deepFreeze({
      ...result,
      ...(typeof instanceOrRef.damageSchool === 'string' ? { damageSchool: instanceOrRef.damageSchool } : {}),
      ...(Number.isInteger(instanceOrRef.exposureBuildupPerHit) ? { exposureBuildupPerHit: instanceOrRef.exposureBuildupPerHit } : {}),
    });
  }
  cache.set(key, result);
  return result;
}

/** The upgrade half of resolveCard, split out so mods can layer on top. */
function mergeUpgrade(base) {
  const up = base.upgrade || {};
  return deepFreeze({
    ...base,
    ...up,
    name: up.name != null ? up.name : `${base.name}+`,
    keywords: up.keywords != null ? up.keywords : base.keywords || [],
    effects: up.effects != null ? up.effects : base.effects,
    textTemplate: up.textTemplate != null ? up.textTemplate : base.textTemplate,
    upgraded: true,
  });
}
