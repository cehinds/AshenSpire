// src/engine/combatSnapshot.js — CombatSnapshotService.
//
// A save is a committed combat state, not a replay instruction. Registries,
// RNG, queues, buffers, and runtime methods stay outside persisted data; this
// service validates the versioned model and reconnects those dependencies.

import { emitEvent } from './triggers.js';
import { COMBAT_SNAPSHOT_VERSION, assertCombatSnapshot } from '../model/combatSnapshot.js';

/** Return the JSON-safe state of one fully committed combat turn. */
export function serializeCombatSnapshot(combat) {
  if (!combat || typeof combat !== 'object') throw new Error('Cannot save a missing combat');
  if (combat._buffer !== null || (combat.queue && combat.queue.length)) {
    throw new Error('Combat is still resolving; wait for the action to finish before saving');
  }
  const snapshot = structuredClone({
    version: COMBAT_SNAPSHOT_VERSION,
    equipmentProfileRuleSnapshot: combat.equipmentProfileRuleSnapshot,
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
  });
  assertCombatSnapshot(snapshot);
  return snapshot;
}

/** Restore a snapshot without replaying combat start, draws, or enemy rolls. */
export function restoreCombatSnapshot({ registries, rng, snapshot }) {
  assertCombatSnapshot(snapshot);
  const saved = structuredClone(snapshot);
  const combat = {
    registries,
    rng,
    equipmentProfileRuleSnapshot: saved.equipmentProfileRuleSnapshot,
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
    triggerState: new Map(saved.triggerState),
    _idCounter: saved.idCounter,
    _emitDepth: saved.emitDepth,
  };
  combat.emit = (type, payload) => emitEvent(combat, type, payload);
  combat.enqueue = (action) => combat.queue.push(action);
  combat.nextInstanceId = () => `gen${++combat._idCounter}`;
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
  const snapshot = serializeCombatSnapshot(combat);
  run.loadout = structuredClone(combat.loadout);
  run.flasks = structuredClone(combat.player.flasks);
  run.flaskCharges = structuredClone(combat.player.flaskCharges);
  run.equipmentPoolDeficits = structuredClone(combat.equipmentPoolDeficits);
  for (const field of ['hp', 'mana', 'stamina']) {
    run[field] = combat.player[field];
    const maxField = `max${field[0].toUpperCase()}${field.slice(1)}`;
    run[maxField] = combat.player[maxField];
  }
  run.combatEntered = { nodeId, encounterId, snapshot };
  return snapshot;
}
