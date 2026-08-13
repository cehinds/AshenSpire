// src/model/state.js — run/combat state factories + (de)serialization (SPEC §3.3, §3.12)
//
// State stores INSTANCE data referencing definitions by id only:
//   deck card  = { instanceId, cardId, upgraded }
//   enemy      = { instanceId→id, enemyId, hp, block, statuses{}, poiseMeter, movesHistory[] }
// Saves serialize instances + RNG counters, never definitions.
//
// Headless: no document/window/localStorage/timers.

import { createLoadout, runMods, stampDeck, startingDeckRefs } from './loadout.js';
import { graceRefillPlan } from './gracerefill.js';
import { classAttributePreset, defaultCreationModeId, normalizeRunAttributes } from './attributes.js';
import {
  createDerivedStatRuleSnapshot,
  restoreDerivedStatRuleSnapshot,
  deriveStat,
} from './derivedStats.js';

export const RUN_SCHEMA_VERSION = 1;

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
}) {
  const classDef = registries.classes.get(classId);
  const selectedAttributeMode = attributeMode === undefined
    ? defaultCreationModeId(registries)
    : attributeMode;
  const attributes = requestedAttributes === undefined
    ? classAttributePreset(registries, classId, selectedAttributeMode)
    : normalizeRunAttributes({ class: classId, attributeMode: selectedAttributeMode, attributes: requestedAttributes }, registries).attributes;
  const idGen = createIdGen('rc');
  const loadout = createLoadout(registries, classId);
  // Armour can carry `self.maxHp`, so the pool it sets has to be known before
  // hp is filled — the run starts at full, in whatever it starts wearing.
  const oldMaxHp = classDef.maxHp + runMods(registries, loadout, classId).maxHp;
  const run = {
    schemaVersion: RUN_SCHEMA_VERSION,
    contentVersion: registries.contentVersion,
    seed: seed >>> 0,
    streamCounters: {},
    class: classId,
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
  // The table remains authoritative at both doors. The preview enables this
  // data switch so every class starts with the same 3 HP + 3 Mana allocation.
  if (registries.balance && registries.balance.graceRefillAtRunStart === true) {
    for (const flaskId of graceRefillPlan(registries, run).grants) run.flasks.push({ flaskId });
  }
  // Stamp the starting deck with whatever the loadout says. Bare-handed this
  // is a no-op; in an armour set with `defend.block=+2` it is already true of
  // the very first Defend you draw.
  stampDeck(registries, run);
  initializeRunDerivedStats(run, registries, {
    snapshot: derivedStatRuleSnapshot,
    derivedStatOptions,
    preserveDeficits: false,
  });
  return run;
}

function derivedOptions(registries, extra = {}) {
  return {
    ...extra,
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
  const currentRuleset = registries.derivedStatRules.rulesetVersion;
  const existingIsCurrent = existing && existing.rulesetVersion === currentRuleset;
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
  // Optional as a pair only so pre-attribute saves can migrate as one block.
  { key: 'attributeMode', type: 'string', optional: true },
  { key: 'attributes', type: 'object', optional: true },
  // Optional only for the one pre-derived migration at the load door.
  { key: 'derivedStatRuleSnapshot', type: 'object', optional: true },
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

/** validateRunShape(run) → [] when sound, else a list of human-readable problems. */
export function validateRunShape(run) {
  const problems = [];
  for (const f of RUN_SHAPE) {
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
  if (run.energyMax !== undefined && (!Number.isFinite(run.energyMax) || run.energyMax < 0)) problems.push('energyMax must be >= 0');
  if (run.drawPerTurn !== undefined && (!Number.isFinite(run.drawPerTurn) || run.drawPerTurn < 0)) problems.push('drawPerTurn must be >= 0');
  return problems;
}

export function serializeRun(run) {
  return JSON.stringify(run);
}

/**
 * deserializeRun(json) → run object. Throws on parse failure, unknown
 * schemaVersion, or a run that doesn't match RUN_SHAPE (save.js turns any
 * throw here into an archive-and-refuse, so a bad save is never silently lost).
 */
export function deserializeRun(json) {
  const run = JSON.parse(json);
  if (!run || typeof run !== 'object') throw new Error('Corrupt run save');
  if (run.schemaVersion !== RUN_SCHEMA_VERSION) {
    throw new Error(`Unknown run schemaVersion ${run.schemaVersion} (expected ${RUN_SCHEMA_VERSION})`);
  }
  const problems = validateRunShape(run);
  if (problems.length) throw new Error(`Malformed run save: ${problems.join('; ')}`);
  return run;
}

// ---------------------------------------------------------------------------
// Combat entities (instances reference defs by id — SPEC §3.3)
// ---------------------------------------------------------------------------

/**
 * Player combat entity. statuses: { [statusId]: { stacks, duration?, meter? } }.
 */
export function createPlayerCombatEntity({ classId, maxHp, hp, maxMana, mana, maxStamina = 0, stamina, relicIds = [], flasks = [], energyMax = 3, drawPerTurn = 5 }) {
  return {
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
    counters: {
      cardsPlayedThisTurn: 0,
      cardsPlayedThisCombat: 0,
      attacksPlayedThisCombat: 0,
    },
    alive: true,
  };
}

/**
 * Enemy combat entity. `poiseMeter` is the engine-level build-up meter fed by
 * the poiseDamage opcode (SPEC §3.7, §4.4); everything else about Stagger is
 * content data.
 */
export function createEnemyCombatEntity({ instanceId, enemyId, hp, poiseMax }) {
  return {
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
}
