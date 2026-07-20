// src/model/state.js — run/combat state factories + (de)serialization (SPEC §3.3, §3.12)
//
// State stores INSTANCE data referencing definitions by id only:
//   deck card  = { instanceId, cardId, upgraded }
//   enemy      = { instanceId→id, enemyId, hp, block, statuses{}, poiseMeter, movesHistory[] }
// Saves serialize instances + RNG counters, never definitions.
//
// Headless: no document/window/localStorage/timers.

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
 * balance.startingRunes (default 0).
 */
export function createRunState({ seed, classId, registries }) {
  const classDef = registries.classes.get(classId);
  const idGen = createIdGen('rc');
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    contentVersion: registries.contentVersion,
    seed: seed >>> 0,
    streamCounters: {},
    class: classId,
    floor: 0,
    actNumber: 1,
    mapNodeId: null,
    hp: classDef.maxHp,
    maxHp: classDef.maxHp,
    cinders: registries.balance.startingRunes || 0,
    deck: createDeck(classDef.startingDeck, idGen),
    relics: [classDef.startingRelic],
    flasks: [], // [{ flaskId }] — max slots from balance.flaskSlots (default 3)
    mapGraph: null,
    combatEntered: null,
    history: [],
    modifiers: [], // ascension-style seam (SPEC §10); always empty in v1
  };
}

export function serializeRun(run) {
  return JSON.stringify(run);
}

/**
 * deserializeRun(json) → run object. Throws on parse failure or unknown
 * schemaVersion (save.js in M2 adds archiving + contentVersion checks).
 */
export function deserializeRun(json) {
  const run = JSON.parse(json);
  if (!run || typeof run !== 'object') throw new Error('Corrupt run save');
  if (run.schemaVersion !== RUN_SCHEMA_VERSION) {
    throw new Error(`Unknown run schemaVersion ${run.schemaVersion} (expected ${RUN_SCHEMA_VERSION})`);
  }
  return run;
}

// ---------------------------------------------------------------------------
// Combat entities (instances reference defs by id — SPEC §3.3)
// ---------------------------------------------------------------------------

/**
 * Player combat entity. statuses: { [statusId]: { stacks, duration?, meter? } }.
 */
export function createPlayerCombatEntity({ classId, maxHp, hp, relicIds = [], flasks = [], energyMax = 3 }) {
  return {
    id: 'player',
    kind: 'player',
    classId,
    hp: hp != null ? hp : maxHp,
    maxHp,
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
