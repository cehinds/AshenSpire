// src/model/state.js — run/combat state factories + (de)serialization (SPEC §3.3, §3.12)
//
// State stores INSTANCE data referencing definitions by id only:
//   deck card  = { instanceId, cardId, upgraded }
//   enemy      = { instanceId→id, enemyId, hp, block, statuses{}, poiseMeter, movesHistory[] }
// Saves serialize instances + RNG counters, never definitions.
//
// Headless: no document/window/localStorage/timers.

import { createLoadout, runMods, stampDeck } from './loadout.js';
import { graceRefillPlan } from './gracerefill.js';

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
export function createRunState({ seed, classId, registries }) {
  const classDef = registries.classes.get(classId);
  const idGen = createIdGen('rc');
  const loadout = createLoadout(registries, classId);
  // Armour can carry `self.maxHp`, so the pool it sets has to be known before
  // hp is filled — the run starts at full, in whatever it starts wearing.
  const maxHp = classDef.maxHp + runMods(registries, loadout, classId).maxHp;
  const maxMana = classDef.maxMana;
  const run = {
    schemaVersion: RUN_SCHEMA_VERSION,
    contentVersion: registries.contentVersion,
    seed: seed >>> 0,
    streamCounters: {},
    class: classId,
    floor: 0,
    actNumber: 1,
    mapNodeId: null,
    hp: maxHp,
    maxHp,
    mana: maxMana,
    maxMana,
    cinders: registries.balance.startingCinders || 0,
    deck: createDeck(classDef.startingDeck, idGen),
    loadout,
    relics: [classDef.startingRelic],
    flasks: [], // [{ flaskId }] — max slots from balance.flaskSlots (default 3)
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
  // IT SHIPS OFF, AND THAT IS A RULING, NOT AN OVERSIGHT. His LIVE instruction
  // was "flasks should refill automatically at graces" — graces. Starting the
  // run with the same set is a second balance change stacked on one already
  // measured at +15.7 points of win rate (`tools/runsim.mjs --grace-ab`), and
  // deciding that inside a branch he asked to be about shrines would be a build
  // settling a balance question. So: BUILT, DECLARED, and OFF by one boolean —
  // `balance.graceRefillAtRunStart`. Nothing is dropped and nothing is decided.
  // Flipping it is a data edit and no code; the selftest proves the flip works.
  if (registries.balance && registries.balance.graceRefillAtRunStart === true) {
    for (const flaskId of graceRefillPlan(registries, run).grants) run.flasks.push({ flaskId });
  }
  // Stamp the starting deck with whatever the loadout says. Bare-handed this
  // is a no-op; in an armour set with `defend.block=+2` it is already true of
  // the very first Defend you draw.
  stampDeck(registries, run);
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
  { key: 'floor', type: 'number' },
  { key: 'actNumber', type: 'number' },
  { key: 'hp', type: 'number' },
  { key: 'maxHp', type: 'number' },
  // Optional only for save compatibility. save.js migrates a pre-mana run to
  // its class-authored full pool before handing it to the game.
  { key: 'mana', type: 'number', optional: true },
  { key: 'maxMana', type: 'number', optional: true },
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
export function createPlayerCombatEntity({ classId, maxHp, hp, maxMana, mana, relicIds = [], flasks = [], energyMax = 3 }) {
  return {
    id: 'player',
    kind: 'player',
    classId,
    hp: hp != null ? hp : maxHp,
    maxHp,
    mana: mana != null ? mana : maxMana,
    maxMana,
    block: 0,
    energy: 0,
    energyMax,
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
