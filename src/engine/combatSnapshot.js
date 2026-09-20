// src/engine/combatSnapshot.js — CombatSnapshotService.
//
// A save is a committed combat state, not a replay instruction. Registries,
// RNG, queues, buffers, and runtime methods stay outside persisted data; this
// service validates the versioned model and reconnects those dependencies.

import { validateFoundationSnapshot } from './combatRules.js';
import { emitEvent } from './triggers.js';
import { syncLoadoutProperties, syncRelicProperties, syncClassProperties } from './properties.js';
import { stampPlayerPoiseMax } from '../model/state.js';
import { playerPoiseThresholdReceipt } from '../model/statProjection.js';
import { attachSkillXp } from './skillXp.js';
import { COMBAT_SNAPSHOT_VERSION, assertCombatSnapshot } from '../model/combatSnapshot.js';

/**
 * A fight saved before plan phase 2 keyed its relic gates `relic:<owner>:<id>:<i>`;
 * the mount scan that replaced it keys them `property:<owner>:relic:<id>:<i>`.
 * The rename is carried here rather than left to sort itself out, because what
 * those keys hold is `once` and `limitPerTurn` — a Forsaken Medallion that had
 * already spent its one opening strike would spend it again on the turn the
 * player reloaded, which is the save reading as a small refund.
 *
 * ONE-WAY AND LOSSLESS: each old key names exactly one new key, the new form is
 * never rewritten, and a snapshot with neither form is untouched. It stays until
 * no save in the wild predates the move; it costs one pass over a map that holds
 * a few dozen entries.
 */
const RELIC_GATE_KEY = /^relic:(.+):([^:]+):(\d+)$/;
function carryRelicGateKeys(entries) {
  if (!Array.isArray(entries)) return entries;
  return entries.map((entry) => {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string') return entry;
    const m = RELIC_GATE_KEY.exec(entry[0]);
    return m ? [`property:${m[1]}:relic:${m[2]}:${m[3]}`, entry[1]] : entry;
  });
}

/** Return the JSON-safe state of one fully committed combat turn. */
export function serializeCombatSnapshot(combat) {
  if (!combat || typeof combat !== 'object') throw new Error('Cannot save a missing combat');
  if (combat._buffer !== null || (combat.queue && combat.queue.length)) {
    throw new Error('Combat is still resolving; wait for the action to finish before saving');
  }
  const snapshot = structuredClone({
    version: COMBAT_SNAPSHOT_VERSION,
    ...(combat.ratingsRules ? { ratingsRules: combat.ratingsRules } : {}),
    ...(combat.ratingAttributeScale !== undefined ? { ratingAttributeScale: combat.ratingAttributeScale } : {}),
    ...(combat.handRules ? { handRules: combat.handRules, pendingDiscardDraw: combat.pendingDiscardDraw || 0 } : {}),
    ...(combat.foundation ? { foundation: combat.foundation } : {}),
    equipmentProfileRuleSnapshot: combat.equipmentProfileRuleSnapshot,
    equipmentAttackSlotCount: combat.equipmentAttackSlotCount,
    removedAttackSlotIds: combat.removedAttackSlotIds,
    itemUpgradeLevels: combat.itemUpgradeLevels,
    itemMounts: combat.itemMounts,
    equipmentPoolDeficits: combat.equipmentPoolDeficits,
    equipmentChanged: !!combat.equipmentChanged,
    turn: combat.turn,
    phase: combat.phase,
    result: combat.result,
    handMax: combat.handMax,
    drawPerTurn: combat.drawPerTurn,
    player: combat.player,
    enemies: combat.enemies,
    loadout: combat.loadout,
    attributes: combat.attributes,
    swapCostRule: combat.swapCostRule,
    swapsLeft: combat.swapsLeft,
    piles: combat.piles,
    eventLog: combat.eventLog,
    triggerState: [...combat.triggerState.entries()],
    idCounter: combat._idCounter,
    emitDepth: combat._emitDepth,
    // The skill ledger the fight was handed and the XP receipt it has paid so
    // far (plan phase 4a): a fight resumed mid-way keeps what it earned.
    skills: combat.skills,
    skillXp: combat.skillXp,
    coreTags: combat.coreTags,
  });
  assertCombatSnapshot(snapshot);
  return snapshot;
}

/** Restore a snapshot without replaying combat start, draws, or enemy rolls. */
/**
 * `fallbackAttackSlotCount` is the RUN's birth quota, for a snapshot written
 * before that field existed. The run is the authority — save.js recovers it at
 * the load door from the run's own deck — and the snapshot carrying a copy is
 * an optimisation, so the read falls back rather than the migration writing
 * into stored data. Healing the snapshot instead would make migration
 * non-idempotent for a current one, which tools/weapon-card-packages.mjs is
 * right to assert against: a load must not rewrite a snapshot it understands.
 */
export function restoreCombatSnapshot({ registries, rng, snapshot, fallbackAttackSlotCount, fallbackRemovedAttackSlotIds }) {
  assertCombatSnapshot(snapshot);
  const saved = structuredClone(snapshot);
  if (saved.foundation) validateFoundationSnapshot(saved.foundation);
  const combat = {
    registries,
    rng,
    ...(saved.ratingsRules ? { ratingsRules: saved.ratingsRules } : {}),
    ...(saved.ratingAttributeScale !== undefined ? { ratingAttributeScale: saved.ratingAttributeScale } : {}),
    ...(saved.handRules ? { handRules: saved.handRules, pendingDiscardDraw: saved.pendingDiscardDraw || 0 } : {}),
    foundation: saved.foundation || null,
    equipmentProfileRuleSnapshot: saved.equipmentProfileRuleSnapshot,
    removedAttackSlotIds: saved.removedAttackSlotIds ?? structuredClone(fallbackRemovedAttackSlotIds || []),
    equipmentAttackSlotCount: Number.isFinite(saved.equipmentAttackSlotCount)
      ? saved.equipmentAttackSlotCount
      : (Number.isFinite(fallbackAttackSlotCount) ? fallbackAttackSlotCount : undefined),
    itemUpgradeLevels: saved.itemUpgradeLevels || Object.fromEntries(
      Object.entries(saved.armamentLevels || {}).map(([id, level]) => [`armament/${id}`, level]),
    ),
    // Absent on a snapshot written before mounts existed, and left absent:
    // every reader treats a missing map as "nothing done", and writing `{}`
    // here would rewrite a snapshot the load already understood.
    itemMounts: saved.itemMounts,
    equipmentPoolDeficits: saved.equipmentPoolDeficits,
    equipmentChanged: saved.equipmentChanged,
    turn: saved.turn,
    phase: saved.phase,
    result: saved.result,
    handMax: saved.handMax,
    drawPerTurn: saved.drawPerTurn,
    player: saved.player,
    enemies: saved.enemies,
    loadout: saved.loadout,
    attributes: saved.attributes,
    swapCostRule: saved.swapCostRule,
    swapsLeft: saved.swapsLeft,
    piles: saved.piles,
    queue: [],
    eventLog: saved.eventLog,
    _buffer: null,
    triggerState: new Map(carryRelicGateKeys(saved.triggerState)),
    _idCounter: saved.idCounter,
    _emitDepth: saved.emitDepth,
    // A snapshot written before the ledger existed resumes with an empty one:
    // the gates read level 0 and the receipt starts here, as createCombat's do.
    skills: saved.skills ?? {},
    skillXp: saved.skillXp ?? {},
    coreTags: Array.isArray(saved.coreTags) ? saved.coreTags : [],
  };
  combat.emit = (type, payload) => emitEvent(combat, type, payload);
  combat._emitEvent = emitEvent;
  // The one listener createCombat hooks on the bus, hooked again here: the
  // raw emitter alone would record no XP for the rest of the restored fight.
  attachSkillXp(combat);
  combat.enqueue = (action) => combat.queue.push(action);
  combat.nextInstanceId = () => `gen${++combat._idCounter}`;
  // Property mounts are never saved (definitions are not persisted): they are
  // re-derived from the restored loadout and relics, exactly as createCombat
  // derives them.
  syncLoadoutProperties(combat);
  syncRelicProperties(combat);
  syncClassProperties(combat);
  // The player's poise max is RE-DERIVED, never trusted from the save (plan
  // phase 8): a fight saved before the formula changed keeps its accumulated
  // value and takes the receipt's max — Constitution, body armour, relics —
  // exactly as a fresh fight would (stampPlayerPoiseMax clamps the value).
  if (!combat.ratingsRules && combat.player && combat.loadout) {
    stampPlayerPoiseMax(combat.player, playerPoiseThresholdReceipt(registries, {
      loadout: combat.loadout, relics: combat.player.relicIds || [], class: combat.player.classId,
      itemUpgradeLevels: combat.itemUpgradeLevels || {}, attributes: combat.attributes || null,
      derivedStatRuleSnapshot: combat.derivedStatRuleSnapshot || null,
    }).value);
  }
  return combat;
}

/**
 * Commit the one exact-snapshot record the run and slot summary both project.
 * Storage and RNG stamping remain createSaveManager responsibilities.
 */
export function commitCombatSnapshot({ run, combat, nodeId, encounterId }) {
  if (!run || typeof run !== 'object') throw new Error('Cannot save combat without a run');
  if (typeof nodeId !== 'string' || !nodeId) throw new Error('Combat save requires nodeId');
  if (typeof encounterId !== 'string' || !encounterId) throw new Error('Combat save requires encounterId');
  // A FINISHED FIGHT IS NOT A RESUME POINT. Restoring a snapshot whose result
  // is already set mounts a battlefield with nothing left to kill: no dispatch
  // reaches the branch that ends the combat, so the run never reaches its
  // spoils and the save cannot be played out of. The screen that used to allow
  // this (combat's menu stayed live through the victory hand-off and beat) no
  // longer does; this is the invariant itself, so no future caller can either.
  if (combat && combat.result) throw new Error(`Cannot save a combat that has already ended ('${combat.result}')`);
  const snapshot = serializeCombatSnapshot(combat);
  run.loadout = structuredClone(combat.loadout);
  run.flasks = structuredClone(combat.player.flasks);
  run.flaskCharges = structuredClone(combat.player.flaskCharges);
  run.equipmentPoolDeficits = structuredClone(combat.equipmentPoolDeficits);
  run.itemUpgradeLevels = structuredClone(combat.itemUpgradeLevels || {});
  delete run.armamentLevels;
  for (const field of ['hp', 'mana', 'stamina']) {
    run[field] = combat.player[field];
    const maxField = `max${field[0].toUpperCase()}${field.slice(1)}`;
    run[maxField] = combat.player[maxField];
  }
  run.combatEntered = { nodeId, encounterId, snapshot };
  return snapshot;
}
