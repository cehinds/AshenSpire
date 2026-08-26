// src/model/combatSnapshot.js — versioned, DOM-free exact-combat save shape.
//
// The snapshot is persisted inside run.combatEntered.snapshot. This module
// owns what that data means and how it is validated; engine/combat.js owns the
// runtime methods detached for storage and reattached after loading.

export const COMBAT_SNAPSHOT_VERSION = 1;

const PHASES = Object.freeze(['player', 'enemy', 'ended']);
const RESULTS = Object.freeze([null, 'victory', 'defeat']);
const SNAPSHOT_PILES = Object.freeze(['draw', 'hand', 'discard', 'exhaust']);

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function entityProblems(entity, path, { player = false } = {}) {
  const problems = [];
  if (!record(entity)) return [`${path} must be an object`];
  if (!nonEmptyString(entity.id)) problems.push(`${path}.id must be a non-empty string`);
  if (entity.kind !== (player ? 'player' : 'enemy')) problems.push(`${path}.kind must be '${player ? 'player' : 'enemy'}'`);
  const defKey = player ? 'classId' : 'enemyId';
  if (!nonEmptyString(entity[defKey])) problems.push(`${path}.${defKey} must be a non-empty string`);
  for (const key of ['hp', 'maxHp', 'block']) {
    if (!finite(entity[key])) problems.push(`${path}.${key} must be finite`);
  }
  if (finite(entity.maxHp) && entity.maxHp <= 0) problems.push(`${path}.maxHp must be positive`);
  if (finite(entity.hp) && finite(entity.maxHp) && (entity.hp < 0 || entity.hp > entity.maxHp)) {
    problems.push(`${path}.hp must be between 0 and maxHp`);
  }
  if (!record(entity.statuses)) problems.push(`${path}.statuses must be an object`);
  if (typeof entity.alive !== 'boolean') problems.push(`${path}.alive must be boolean`);
  return problems;
}

function cardProblems(card, path) {
  if (!record(card)) return [`${path} must be an object`];
  const problems = [];
  if (!nonEmptyString(card.instanceId)) problems.push(`${path}.instanceId must be a non-empty string`);
  if (!nonEmptyString(card.cardId)) problems.push(`${path}.cardId must be a non-empty string`);
  if (typeof card.upgraded !== 'boolean') problems.push(`${path}.upgraded must be boolean`);
  return problems;
}

/** Return field-addressed problems; an empty array means the stored shape is sound. */
export function combatSnapshotProblems(snapshot) {
  if (!record(snapshot)) return ['snapshot must be an object'];
  const problems = [];
  if (snapshot.version !== COMBAT_SNAPSHOT_VERSION) problems.push(`version must be ${COMBAT_SNAPSHOT_VERSION}`);
  if (!Number.isInteger(snapshot.turn) || snapshot.turn < 1) problems.push('turn must be a positive integer');
  if (!PHASES.includes(snapshot.phase)) problems.push(`phase must be one of ${PHASES.join(', ')}`);
  if (!RESULTS.includes(snapshot.result)) problems.push("result must be null, 'victory', or 'defeat'");
  if ((snapshot.phase === 'ended') !== (snapshot.result !== null)) problems.push('phase/result must describe the same ended state');
  for (const key of ['handMax', 'drawPerTurn', 'swapsLeft', 'idCounter']) {
    if (!Number.isInteger(snapshot[key]) || snapshot[key] < 0) problems.push(`${key} must be a non-negative integer`);
  }
  if (snapshot.emitDepth !== 0) problems.push('emitDepth must be 0 at a committed save boundary');
  if (typeof snapshot.equipmentChanged !== 'boolean') problems.push('equipmentChanged must be boolean');
  if (!record(snapshot.equipmentPoolDeficits)) problems.push('equipmentPoolDeficits must be an object');
  if (snapshot.loadout !== null && !record(snapshot.loadout)) problems.push('loadout must be an object or null');
  if (snapshot.attributes !== null && !record(snapshot.attributes)) problems.push('attributes must be an object or null');
  if (!record(snapshot.swapCostRule)) problems.push('swapCostRule must be an object');
  if (!Array.isArray(snapshot.eventLog)) problems.push('eventLog must be an array');
  if (!Array.isArray(snapshot.triggerState)
      || snapshot.triggerState.some((entry) => !Array.isArray(entry) || entry.length !== 2 || !nonEmptyString(entry[0]))) {
    problems.push('triggerState must be an array of [key, value] entries');
  }

  problems.push(...entityProblems(snapshot.player, 'player', { player: true }));
  if (!Array.isArray(snapshot.enemies)) problems.push('enemies must be an array');
  else snapshot.enemies.forEach((enemy, index) => problems.push(...entityProblems(enemy, `enemies[${index}]`)));

  if (!record(snapshot.piles)) problems.push('piles must be an object');
  else {
    const seen = new Set();
    for (const pile of SNAPSHOT_PILES) {
      const cards = snapshot.piles[pile];
      if (!Array.isArray(cards)) {
        problems.push(`piles.${pile} must be an array`);
        continue;
      }
      cards.forEach((card, index) => {
        problems.push(...cardProblems(card, `piles.${pile}[${index}]`));
        if (record(card) && nonEmptyString(card.instanceId)) {
          if (seen.has(card.instanceId)) problems.push(`card instance '${card.instanceId}' appears in more than one pile position`);
          seen.add(card.instanceId);
        }
      });
    }
  }
  return problems;
}

/** Throw with a stable field-addressed reason, then return the original value. */
export function assertCombatSnapshot(snapshot) {
  const problems = combatSnapshotProblems(snapshot);
  if (problems.length) throw new Error(`Malformed combat snapshot: ${problems.join('; ')}`);
  return snapshot;
}

/** Validate content references after registries exist at the run load door. */
export function combatSnapshotReferenceProblems(snapshot, registries) {
  if (snapshot == null) return [];
  const problems = [];
  const has = (registry, id, path) => {
    if (nonEmptyString(id) && !registry.has(id)) problems.push(`${path} '${id}' is unknown`);
  };
  has(registries.classes, snapshot.player?.classId, 'player.classId');
  for (const id of snapshot.player?.relicIds || []) has(registries.relics, id, 'player.relicIds');
  for (const flask of snapshot.player?.flasks || []) has(registries.flasks, flask?.flaskId, 'player.flasks.flaskId');
  if (snapshot.player?.stanceId != null) has(registries.stances, snapshot.player.stanceId, 'player.stanceId');
  for (const id of Object.keys(snapshot.player?.statuses || {})) has(registries.statuses, id, 'player.statuses');
  for (let index = 0; index < (snapshot.enemies || []).length; index++) {
    const enemy = snapshot.enemies[index];
    has(registries.enemies, enemy?.enemyId, `enemies[${index}].enemyId`);
    for (const id of Object.keys(enemy?.statuses || {})) has(registries.statuses, id, `enemies[${index}].statuses`);
  }
  for (const pile of SNAPSHOT_PILES) {
    for (const card of snapshot.piles?.[pile] || []) has(registries.cards, card?.cardId, `piles.${pile}.cardId`);
  }
  return problems;
}

export const COMBAT_SNAPSHOT_PHASES = PHASES;
export const COMBAT_SNAPSHOT_RESULTS = RESULTS;
export const COMBAT_SNAPSHOT_PILES = SNAPSHOT_PILES;
