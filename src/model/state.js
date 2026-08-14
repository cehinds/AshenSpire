// src/model/state.js — run/combat state factories + (de)serialization (SPEC §3.3, §3.12)
//
// State stores INSTANCE data referencing definitions by id only:
//   deck card  = { instanceId, cardId, upgraded }
//   enemy      = { instanceId→id, enemyId, hp, block, statuses{}, poiseMeter, movesHistory[] }
//   player     = { …pools…, poiseMeter? — max from the equipment threshold
//                  receipt, value 0 with NO writer (see createPlayerCombatEntity) }
// Saves serialize instances + RNG counters, never definitions.
//
// Headless: no document/window/localStorage/timers.

import { createLoadout, runMods, stampDeck, startingDeckRefs, createEquipmentProfileRuleSnapshot, restoreEquipmentProfileRuleSnapshot, equipmentRequirementReceipt } from './loadout.js';
import { chargeKindForFlask, createFlaskCharges, flaskCapacity } from './gracerefill.js';
import { syncFlaskGrowth } from './flaskgrowth.js';
import { classAttributePreset, defaultCreationModeId, normalizeRunAttributes } from './attributes.js';
import {
  createDerivedStatRuleSnapshot,
  restoreDerivedStatRuleSnapshot,
  deriveStat,
} from './derivedStats.js';
import { resolveStartingKit, startingKitSnapshot } from './startingKits.js';
import { DAMAGE_SCHOOLS } from './schemas.js';

// v3 (2026-08-14): flaskCharges carries its capacity ledger — base, grown,
// granted — and capacity must derive from the three (validateRunShape). v2
// saves lack the ledger and are attributed once at the load door
// (initializeRunFlaskCharges); v1 additionally predates starting kits.
export const RUN_SCHEMA_VERSION = 3;

/** Deterministic instance-id generator ('p1', 'p2', ... for prefix 'p'). */
export function createIdGen(prefix = 'i') {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export function createCardInstance(cardId, upgraded = false, idGen) {
  return { instanceId: idGen ? idGen() : `c_${cardId}_${Math.floor(Math.random() * 1e9)}`, cardId, upgraded: !!upgraded };
}

/** Build a deck of card instances from an array of card ids. */
export function createDeck(cardIds, idGen = createIdGen('d')) {
  return cardIds.map((cardId) => createCardInstance(cardId, false, idGen));
}

// ---------------------------------------------------------------------------
// Run state (SPEC §3.12 save shape)
// ---------------------------------------------------------------------------

/**
 * createRunState({ seed, classId, registries }) → new run at floor 0, act 1.
 * Starting deck/relic/HP come from the class def; cinders from
 * balance.startingCinders (default 0).
 */
export function createRunState({
  seed,
  classId,
  registries,
  attributeMode = undefined,
  attributes: requestedAttributes = undefined,
  derivedStatOptions = {},
  derivedStatRuleSnapshot = undefined,
  startingKitId = undefined,
  profileMeta = {},
}) {
  const classDef = registries.classes.get(classId);
  const selectedAttributeMode = attributeMode === undefined
    ? defaultCreationModeId(registries)
    : attributeMode;
  const attributes = requestedAttributes === undefined
    ? classAttributePreset(registries, classId, selectedAttributeMode)
    : normalizeRunAttributes({ class: classId, attributeMode: selectedAttributeMode, attributes: requestedAttributes }, registries).attributes;
  const idGen = createIdGen('rc');
  const startingKit = resolveStartingKit(registries, classId, startingKitId, profileMeta);
  const loadout = createLoadout(registries, classId, startingKit);
  for (const [slotId, itemId] of Object.entries({ rightHand: startingKit.rightHand, leftHand: startingKit.leftHand })) {
    if (!itemId) continue;
    const piece = (registries.equipment.armaments || []).find((row) => row.id === itemId);
    const receipt = equipmentRequirementReceipt(registries, piece, attributes);
    if (!receipt.ok) {
      const failed = receipt.failures[0];
      throw new Error(`${startingKit.id}.${slotId}: ${itemId} requires ${failed.attributeId} ${failed.required} (got ${failed.actual})`);
    }
  }
  // Armour can carry `self.maxHp`, so the pool it sets has to be known before
  // hp is filled — the run starts at full, in whatever it starts wearing.
  const oldMaxHp = classDef.maxHp + runMods(registries, loadout, classId).maxHp;
  const run = {
    schemaVersion: RUN_SCHEMA_VERSION,
    contentVersion: registries.contentVersion,
    seed: seed >>> 0,
    streamCounters: {},
    class: classId,
    startingKitId: startingKit.id,
    startingKitSnapshot: startingKitSnapshot(startingKit),
    attributeMode: selectedAttributeMode,
    attributes,
    floor: 0,
    actNumber: 1,
    mapNodeId: null,
    hp: oldMaxHp,
    maxHp: oldMaxHp,
    cinders: registries.balance.startingCinders || 0,
    deck: startingDeckRefs(registries, loadout, classId).map((ref) => ({ ...createCardInstance(ref.cardId, false, idGen), ...ref })),
    loadout,
    relics: [classDef.startingRelic],
    flasks: [], // [{ flaskId }] — max slots from balance.flaskSlots
    flaskCharges: createFlaskCharges(registries.balance, classDef.startingFlaskAllocation),
    seedString: null, // set by the orchestrator right after creation (display/replay)
    mapGraph: null,
    combatEntered: null,
    history: [],
    modifiers: [], // ascension-style seam (SPEC §10); always empty in v1
  };
  // "and each character should start with those" — Constantine, 2026-08-08, the
  // FOURTH clause of the flask parenthesis, and it is here because it was very
  // nearly lost. His sentence was quoted to me tonight with this clause missing
  // from the quote; the ledger (`commons/decisions/directions.md` D10) has it.
  //
  // The table remains authoritative at both doors. Each class starts with its
  // class-authored HP/Mana split within the fixed three-charge capacity.
  // Crimson/Azure start full in that allocation. Utility
  // consumables remain in run.flasks and are never synthesized here.
  // Stamp the starting deck with whatever the loadout says. Bare-handed this
  // is a no-op; in an armour set with `defend.block=+2` it is already true of
  // the very first Defend you draw.
  initializeRunDerivedStats(run, registries, {
    snapshot: derivedStatRuleSnapshot,
    derivedStatOptions,
    preserveDeficits: false,
  });
  stampDeck(registries, run);
  // The growth chain binds from birth: a starting relic carrying a
  // balance.flaskGrowth row grows the maximum before the first node.
  syncFlaskGrowth(registries, run);
  return run;
}

function derivedOptions(registries, extra = {}) {
  const statLayer = (layer) => {
    if (!layer || typeof layer !== 'object') return layer;
    const { equipmentProfiles, ...stats } = layer;
    return stats;
  };
  return {
    ...extra,
    modeModifiers: statLayer(extra.modeModifiers),
    runModifiers: Array.isArray(extra.runModifiers) ? extra.runModifiers.map(statLayer) : statLayer(extra.runModifiers),
    explicitOverride: statLayer(extra.explicitOverride),
    authority: 'host',
    attributeIds: registries.attributes.ids(),
    classFields: ['maxHp', 'maxMana'],
  };
}

/**
 * Resolve the host-owned rule snapshot into the run's authoritative outputs.
 * Existing current pools preserve their deficit during the one legacy
 * migration. Once a snapshot exists, restores validate and trust the persisted
 * outputs so a later content edit cannot rewrite a climb in progress.
 */
export function initializeRunDerivedStats(run, registries, {
  snapshot = undefined,
  derivedStatOptions = {},
  preserveDeficits = true,
} = {}) {
  const existing = snapshot || run.derivedStatRuleSnapshot;
  run.equipmentProfileRuleSnapshot = run.equipmentProfileRuleSnapshot
    ? restoreEquipmentProfileRuleSnapshot(run.equipmentProfileRuleSnapshot, registries)
    : createEquipmentProfileRuleSnapshot(registries, derivedStatOptions);
  const currentRuleset = registries.derivedStatRules.rulesetVersion;
  const existingIsCurrent = existing && existing.rulesetVersion === currentRuleset;
  if (existingIsCurrent && run.derivedStatRuleSnapshot) {
    const restored = restoreDerivedStatRuleSnapshot(existing, derivedOptions(registries));
    const classDef = registries.classes.get(run.class);
    for (const [key, statId] of [['energyMax', 'energy'], ['drawPerTurn', 'draw']]) {
      const value = run[key];
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Persisted ${key} must be a non-negative integer under its derived-stat snapshot`);
      }
      const expected = deriveStat(restored.rules, statId, { attributes: run.attributes, classDef }).value;
      if (value !== expected) throw new Error(`Persisted ${key} ${value} contradicts derived-stat snapshot value ${expected}`);
    }
  }
  if (existingIsCurrent && run.derivedStatRuleSnapshot
    && run.maxHp !== undefined && run.hp !== undefined
    && run.maxMana !== undefined && run.mana !== undefined
    && run.maxStamina !== undefined && run.stamina !== undefined
    && run.energyMax !== undefined && run.drawPerTurn !== undefined) {
    restoreDerivedStatRuleSnapshot(existing, derivedOptions(registries));
    return run;
  }

  // v1 carried class-authored 40/60/80 Mana pools. It is readable so its
  // current/max ratio can be migrated, but it is never retained as authority.
  if (existing && !existingIsCurrent) restoreDerivedStatRuleSnapshot(existing, derivedOptions(registries));
  const receipt = existingIsCurrent
    ? restoreDerivedStatRuleSnapshot(existing, derivedOptions(registries))
    : createDerivedStatRuleSnapshot(registries.derivedStatRules, derivedOptions(registries, derivedStatOptions));
  const classDef = registries.classes.get(run.class);
  const rules = receipt.rules;
  const hp = deriveStat(rules, 'hp', { attributes: run.attributes, classDef });
  const mana = deriveStat(rules, 'mana', { attributes: run.attributes, classDef });
  const stamina = deriveStat(rules, 'stamina', { attributes: run.attributes, classDef });
  const energy = deriveStat(rules, 'energy', { attributes: run.attributes, classDef });
  const draw = deriveStat(rules, 'draw', { attributes: run.attributes, classDef });
  const hpBonus = run.loadout ? runMods(registries, run.loadout, run.class).maxHp : 0;

  const oldHpMax = run.maxHp;
  const oldHp = run.hp;
  const oldManaMax = run.maxMana;
  const oldMana = run.mana;
  run.derivedStatRuleSnapshot = structuredClone(receipt);
  run.maxHp = hp.value + hpBonus;
  run.maxMana = mana.value;
  run.maxStamina = stamina.value;
  run.energyMax = energy.value;
  run.drawPerTurn = draw.value;
  if (preserveDeficits && Number.isFinite(oldHpMax) && Number.isFinite(oldHp)) {
    run.hp = Math.max(0, run.maxHp - Math.max(0, oldHpMax - oldHp));
  } else run.hp = run.maxHp;
  if (preserveDeficits && Number.isFinite(oldManaMax) && oldManaMax > 0 && Number.isFinite(oldMana)) {
    const legacyRatio = Math.max(0, Math.min(1, oldMana / oldManaMax));
    run.mana = Math.max(0, Math.min(run.maxMana, Math.round(legacyRatio * run.maxMana)));
  } else run.mana = run.maxMana;
  run.stamina = run.maxStamina;
  return run;
}

/**
 * The persisted run shape, declared once (SPEC §3.12). Keeps the save contract
 * data-driven instead of implied by whatever createRunState happens to set, and
 * gives deserializeRun something to check so a parseable-but-malformed save is
 * refused at load (→ save.js archives it) rather than crashing mid-run.
 *
 * `nullable` fields are legitimately null before their first use. Unlisted keys
 * are allowed through untouched — this is a floor, not a whitelist.
 */
export const RUN_SHAPE = [
  { key: 'contentVersion', type: 'string' },
  { key: 'seed', type: 'number' },
  { key: 'streamCounters', type: 'object' },
  { key: 'class', type: 'string' },
  { key: 'startingKitId', type: 'string' },
  { key: 'startingKitSnapshot', type: 'object' },
  // Optional as a pair only so pre-attribute saves can migrate as one block.
  { key: 'attributeMode', type: 'string', optional: true },
  { key: 'attributes', type: 'object', optional: true },
  // Optional only for the one pre-derived migration at the load door.
  { key: 'derivedStatRuleSnapshot', type: 'object', optional: true },
  { key: 'equipmentProfileRuleSnapshot', type: 'object', optional: true },
  { key: 'floor', type: 'number' },
  { key: 'actNumber', type: 'number' },
  { key: 'hp', type: 'number' },
  { key: 'maxHp', type: 'number' },
  // Optional only for save compatibility. save.js migrates a pre-mana run to
  // its class-authored full pool before handing it to the game.
  { key: 'mana', type: 'number', optional: true },
  { key: 'maxMana', type: 'number', optional: true },
  { key: 'stamina', type: 'number', optional: true },
  { key: 'maxStamina', type: 'number', optional: true },
  { key: 'energyMax', type: 'number', optional: true },
  { key: 'drawPerTurn', type: 'number', optional: true },
  { key: 'cinders', type: 'number' },
  { key: 'deck', type: 'array' },
  { key: 'relics', type: 'array' },
  { key: 'flasks', type: 'array' },
  { key: 'history', type: 'array' },
  { key: 'modifiers', type: 'array' },
  // Optional so a run saved before equipment existed still loads; save.js
  // heals it with a fresh loadout rather than refusing the save.
  { key: 'loadout', type: 'object', optional: true },
  { key: 'seedString', type: 'string', nullable: true },
  { key: 'mapNodeId', type: 'string', nullable: true },
  { key: 'mapGraph', type: 'object', nullable: true },
  { key: 'combatEntered', type: 'object', nullable: true },
];

function typeOk(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type; // 'string' | 'number'
}

/** validateRunShape(run) → [] when sound, else a list of human-readable problems.
 *  `legacy` admits v1 saves (pre-starting-kit); `preLedger` admits v1/v2 saves
 *  (pre-capacity-ledger). deserializeRun derives both from schemaVersion. */
export function validateRunShape(run, { legacy = false, preLedger = legacy } = {}) {
  const problems = [];
  for (const f of RUN_SHAPE) {
    if (legacy && (f.key === 'startingKitId' || f.key === 'startingKitSnapshot')) continue;
    const v = run[f.key];
    if (v === undefined) {
      if (!f.optional) problems.push(`missing '${f.key}'`);
      continue;
    }
    if (v === null) {
      if (!f.nullable) problems.push(`'${f.key}' is null`);
      continue;
    }
    if (!typeOk(v, f.type)) problems.push(`'${f.key}' should be ${f.type}`);
  }
  const modeAbsent = run.attributeMode === undefined;
  const attributesAbsent = run.attributes === undefined;
  if (modeAbsent !== attributesAbsent) problems.push('attributeMode and attributes must both be present or both be absent');
  if (!attributesAbsent && typeOk(run.attributes, 'object')) {
    for (const [id, value] of Object.entries(run.attributes)) {
      if (!Number.isInteger(value)) problems.push(`attributes.${id} must be an integer`);
    }
  }
  // Deck entries are the ids the run is rebuilt from — the one nested shape
  // worth checking, since a bad entry breaks combat rather than the load.
  if (Array.isArray(run.deck)) {
    const bad = run.deck.findIndex((c) => !c || typeof c.cardId !== 'string' || typeof c.instanceId !== 'string');
    if (bad !== -1) problems.push(`deck[${bad}] is not { instanceId, cardId }`);
    for (let i = 0; i < run.deck.length; i++) {
      const card = run.deck[i];
      if (!card) continue;
      const schoolAbsent = card.damageSchool === undefined;
      const buildupAbsent = card.exposureBuildupPerHit === undefined;
      if (schoolAbsent !== buildupAbsent) problems.push(`deck[${i}] damageSchool and exposureBuildupPerHit must both be present or both be absent`);
      if (!schoolAbsent && !DAMAGE_SCHOOLS.includes(card.damageSchool)) problems.push(`deck[${i}].damageSchool '${card.damageSchool}' is unknown`);
      if (!buildupAbsent && (!Number.isInteger(card.exposureBuildupPerHit) || card.exposureBuildupPerHit < 0)) problems.push(`deck[${i}].exposureBuildupPerHit must be a non-negative integer`);
    }
  }
  if (Number.isFinite(run.hp) && Number.isFinite(run.maxHp) && run.maxHp <= 0) {
    problems.push('maxHp must be > 0');
  }
  if (run.maxMana !== undefined && (!Number.isFinite(run.maxMana) || run.maxMana <= 0)) {
    problems.push('maxMana must be > 0');
  }
  if (Number.isFinite(run.mana) && Number.isFinite(run.maxMana) && (run.mana < 0 || run.mana > run.maxMana)) {
    problems.push('mana must be between 0 and maxMana');
  }
  const staminaAbsent = run.stamina === undefined;
  const maxStaminaAbsent = run.maxStamina === undefined;
  if (staminaAbsent !== maxStaminaAbsent) problems.push('stamina and maxStamina must both be present or both be absent');
  if (run.maxStamina !== undefined && (!Number.isFinite(run.maxStamina) || run.maxStamina < 0)) problems.push('maxStamina must be >= 0');
  if (Number.isFinite(run.stamina) && Number.isFinite(run.maxStamina) && (run.stamina < 0 || run.stamina > run.maxStamina)) {
    problems.push('stamina must be between 0 and maxStamina');
  }
  if (run.flaskCharges !== undefined) {
    const f = run.flaskCharges;
    if (!f || !Number.isInteger(f.capacity) || f.capacity <= 0
      || !Number.isInteger(f.hp) || f.hp < 0 || !Number.isInteger(f.mana) || f.mana < 0
      || f.hp + f.mana !== f.capacity
      || !Number.isInteger(f.hpCurrent) || f.hpCurrent < 0 || f.hpCurrent > f.hp
      || !Number.isInteger(f.manaCurrent) || f.manaCurrent < 0 || f.manaCurrent > f.mana) {
      problems.push('flaskCharges must satisfy hp + mana = capacity with bounded current counts');
    }
    // `grown` — what the growth chain currently contributes (model/flaskgrowth.js).
    // Optional on pre-ledger saves only; syncFlaskGrowth treats absent as zero.
    const grownSound = f && f.grown && typeof f.grown === 'object'
      && Number.isInteger(f.grown.hp) && f.grown.hp >= 0
      && Number.isInteger(f.grown.mana) && f.grown.mana >= 0;
    if (f && f.grown !== undefined && !grownSound) {
      problems.push('flaskCharges.grown must be { hp, mana } non-negative integers when present');
    }
    // THE CAPACITY LEDGER — capacity is one stored number fed by two doors
    // (model/flaskgrowth.js, THE DOORS), and this is the check that it stays
    // accountable: base (born, createFlaskCharges) + grown (possession door)
    // + granted (moment door) must equal what is stored. A capacity no ledger
    // can explain is refused BY NAME — that red is the machine form of the
    // two-doors warning that used to live only in prose (SPEC §5.5.2): a
    // "cleanup" that re-derives capacity from the chain alone now fails the
    // first save it touches instead of silently deleting every keepsake charge.
    // Pre-ledger saves (v1/v2) carry no base/granted; they are admitted only
    // through the migration door (preLedger), where initializeRunFlaskCharges
    // attributes them once, by the stated rule, before the run is ever re-saved.
    if (f && f.base === undefined && f.granted === undefined) {
      if (!preLedger) problems.push('flaskCharges is missing its capacity ledger (base, granted) — required at this schema version');
    } else if (f) {
      const baseSound = Number.isInteger(f.base) && f.base > 0;
      const grantedSound = Number.isInteger(f.granted) && f.granted >= 0;
      if (!baseSound) problems.push('flaskCharges.base must be a positive integer');
      if (!grantedSound) problems.push('flaskCharges.granted must be a non-negative integer');
      if (!grownSound) {
        problems.push('flaskCharges.grown must be present beside the capacity ledger');
      } else if (baseSound && grantedSound && Number.isInteger(f.capacity)
        && f.capacity !== f.base + f.grown.hp + f.grown.mana + f.granted) {
        problems.push(`flaskCharges.capacity ${f.capacity} is not accounted for by its parts — `
          + `base ${f.base} + grown ${f.grown.hp + f.grown.mana} + granted ${f.granted} `
          + `= ${f.base + f.grown.hp + f.grown.mana + f.granted}`);
      }
    }
  }
  if (run.energyMax !== undefined && (!Number.isInteger(run.energyMax) || run.energyMax < 0)) problems.push('energyMax must be a non-negative integer');
  if (run.drawPerTurn !== undefined && (!Number.isInteger(run.drawPerTurn) || run.drawPerTurn < 0)) problems.push('drawPerTurn must be a non-negative integer');
  return problems;
}

export function serializeRun(run) {
  return JSON.stringify(run);
}

export function initializeRunFlaskCharges(run, registries) {
  if (!run.flaskCharges) {
    const allocation = registries.classes.get(run.class).startingFlaskAllocation;
    run.flaskCharges = createFlaskCharges(registries.balance, allocation);
    const legacy = run.flasks || [];
    run.flaskCharges.hpCurrent = Math.min(run.flaskCharges.hp, legacy.filter((f) => f && chargeKindForFlask(registries, f.flaskId) === 'hp').length);
    run.flaskCharges.manaCurrent = Math.min(run.flaskCharges.mana, legacy.filter((f) => f && chargeKindForFlask(registries, f.flaskId) === 'mana').length);
    run.flasks = (run.flasks || []).filter((f) => f && chargeKindForFlask(registries, f.flaskId) == null);
  }
  // ═══ THE ONE-TIME ATTRIBUTION — pre-ledger saves (v1/v2), stated, not
  // silent. A v2 save stores capacity with no ledger: chain growth always
  // wrote `grown`, but the moment door (op addFlaskCapacity — keepsakes,
  // event effects) recorded nothing. The rule, in full:
  //   base    = the current authored balance.flaskCapacity, clamped to
  //             capacity − grownTotal — the best witness available for what
  //             the vessel was born holding, never allowed to invent charges.
  //   granted = capacity − grownTotal − base — every charge that base and the
  //             chain's own ledger cannot account for is attributed to the
  //             moment door, because the moment door was the untracked one.
  // Honest defaults of the clamp: a balance retuned UP since the save yields
  // base = capacity − grownTotal and granted 0 (the save keeps its capacity,
  // nothing is invented); a keepsake surplus lands in granted, which is where
  // it came from. Runs once per save, before the run can be re-serialized;
  // from then on validateRunShape enforces capacity === base + grown + granted.
  {
    const f = run.flaskCharges;
    if (f.base === undefined && f.granted === undefined) {
      const grownTotal = f.grown && Number.isInteger(f.grown.hp) && Number.isInteger(f.grown.mana)
        ? f.grown.hp + f.grown.mana
        : 0;
      if (grownTotal >= f.capacity) {
        // The chain's own ledger cannot fit under the stored capacity — that is
        // corruption of exactly the class this ledger polices, not a migration.
        throw new Error(`flaskCharges.grown total ${grownTotal} meets or exceeds capacity ${f.capacity} — pre-ledger save is unaccountable`);
      }
      f.base = Math.min(flaskCapacity(registries.balance), f.capacity - grownTotal);
      f.granted = f.capacity - grownTotal - f.base;
    }
  }
  // Loaded runs re-derive the chain here — the load door. A save carrying a
  // relic whose growth row was authored after it was written grows on load;
  // a save whose growth source no longer exists shrinks back, currents bounded.
  syncFlaskGrowth(registries, run);
  return run.flaskCharges;
}

/**
 * deserializeRun(json) → run object. Throws on parse failure, unknown
 * schemaVersion, or a run that doesn't match RUN_SHAPE (save.js turns any
 * throw here into an archive-and-refuse, so a bad save is never silently lost).
 */
export function deserializeRun(json) {
  const run = JSON.parse(json);
  if (!run || typeof run !== 'object') throw new Error('Corrupt run save');
  const legacy = run.schemaVersion === 1;
  const preLedger = legacy || run.schemaVersion === 2; // v2: no flaskCharges capacity ledger yet
  if (!preLedger && run.schemaVersion !== RUN_SCHEMA_VERSION) {
    throw new Error(`Unknown run schemaVersion ${run.schemaVersion} (expected ${RUN_SCHEMA_VERSION})`);
  }
  const problems = validateRunShape(run, { legacy, preLedger });
  if (problems.length) throw new Error(`Malformed run save: ${problems.join('; ')}`);
  if (preLedger) {
    run.migratedFromRunSchemaVersion = run.schemaVersion;
    run.schemaVersion = RUN_SCHEMA_VERSION;
  }
  return run;
}

// ---------------------------------------------------------------------------
// Combat entities (instances reference defs by id — SPEC §3.3)
// ---------------------------------------------------------------------------

/**
 * Player combat entity. statuses: { [statusId]: { stacks, duration?, meter? } }.
 *
 * `poiseMax` (optional) stamps the player's Poise vessel — the REAL-BUT-EMPTY
 * seat: max is the equipment/relic stagger threshold (createCombat derives it
 * from playerPoiseThresholdReceipt), value is 0 and HAS NO WRITER — the engine
 * deals Poise damage to enemies only (actions.js dealPoiseDamage gates on
 * kind). The vessel exists so the HUD can tell the truth he asked to see
 * ("poise (very skinny bar) under the health bar", D10.4; "should also effect
 * player too", D17 q5); the mechanics that will one day move the value —
 * stagger, resistance, poise damage against players — are combat design dealt
 * elsewhere and deliberately NOT introduced by this seat. 0 stamps NO meter:
 * a zero-threshold player has no vessel, and the HUD's refusal path renders
 * it ABSENT rather than as an empty trough.
 */
export function createPlayerCombatEntity({ classId, maxHp, hp, maxMana, mana, maxStamina = 0, stamina, relicIds = [], flasks = [], flaskCharges = null, energyMax, drawPerTurn, poiseMax = 0 }) {
  if (!Number.isInteger(energyMax) || energyMax < 0) throw new Error('Player combat entity requires stamped non-negative integer energyMax');
  if (!Number.isInteger(drawPerTurn) || drawPerTurn < 0) throw new Error('Player combat entity requires stamped non-negative integer drawPerTurn');
  const entity = {
    id: 'player',
    kind: 'player',
    classId,
    hp: hp != null ? hp : maxHp,
    maxHp,
    mana: mana != null ? mana : maxMana,
    maxMana,
    stamina: stamina != null ? stamina : maxStamina,
    maxStamina,
    block: 0,
    energy: 0,
    energyMax,
    drawPerTurn,
    statuses: {},
    stanceId: null,
    relicIds: [...relicIds],
    flasks: flasks.map((f) => ({ ...f })),
    flaskCharges: flaskCharges ? { ...flaskCharges } : null,
    counters: {
      cardsPlayedThisTurn: 0,
      cardsPlayedThisCombat: 0,
      attacksPlayedThisCombat: 0,
    },
    alive: true,
  };
  stampPlayerPoiseMax(entity, poiseMax);
  return entity;
}

/**
 * stampPlayerPoiseMax(entity, max) — the ONE way the player's Poise vessel is
 * (re)sized, at entity creation and at the single mid-fight door equipment
 * moves through (doSwapArmament). Max only: the accumulated value rides —
 * today it is always 0 because nothing writes it, and this helper must keep
 * being value-preserving so the future writer's build-up survives a swap.
 * A non-positive max REMOVES the meter: no vessel, the HUD refusal renders
 * ABSENT (never an empty trough).
 */
export function stampPlayerPoiseMax(entity, max) {
  if (Number.isInteger(max) && max > 0) {
    const value = entity.poiseMeter ? Math.max(0, Math.min(entity.poiseMeter.value, max)) : 0;
    entity.poiseMeter = { value, max };
  } else {
    delete entity.poiseMeter;
  }
}

/**
 * Enemy combat entity. `poiseMeter` is the engine-level build-up meter fed by
 * the poiseDamage opcode (SPEC §3.7, §4.4); everything else about Stagger is
 * content data.
 */
export function createEnemyCombatEntity({ instanceId, enemyId, hp, poiseMax, arcaneExposure, damageResistanceBySchool }) {
  const entity = {
    id: instanceId,
    kind: 'enemy',
    enemyId,
    hp,
    maxHp: hp,
    block: 0,
    statuses: {},
    poiseMeter: { value: 0, max: poiseMax },
    movesHistory: [],
    intent: null,
    pendingMove: null, // delayed-move commitment: { moveId, resolveOnTurn }
    skipNextTurn: false, // set by a poise-meter fill; consumed by the enemy turn
    unlockedMoves: [],
    alive: true,
  };
  if (arcaneExposure) entity.arcaneExposure = arcaneExposure.mode === 'configured'
    ? { ...structuredClone(arcaneExposure), value: 0 }
    : { mode: 'immune' };
  if (damageResistanceBySchool) entity.damageResistanceBySchool = { ...damageResistanceBySchool };
  return entity;
}
