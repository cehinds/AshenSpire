import { ashenBlightProblems, ashenBlightCombatProblems } from '../model/ashenBlight.js';
import { statusControlProblems } from '../model/combatStatusState.js';
import { combatExpansionEntityProblems } from '../model/combatTacticsRules.js';
import { combatExpansionRulesProblems } from '../model/combatExpansionRules.js';
import { combatEnemyKnowledgeProblems } from '../model/enemyKnowledgeCombat.js';
import { combatReactionProblems } from '../model/combatReactionState.js';
import { perceptionProblems } from '../model/perception.js';

// A reference table preserves queued ally/source references and Map identity.
// Runtime callbacks, catalogue projections and RNG objects never enter the save.
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function serializeCoopCombatSnapshot(combat) {
  if (!combat?.players || combat._buffer !== null || (combat.queue?.length && !combat.pendingAbilityDiscard && !combat.pendingReaction
    && !(combat.reactionCursor && combat.phase === 'suspended'))) throw new Error('Co-op combat is still resolving');
  const nodes = [], seen = new Map();
  function encode(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Co-op snapshot contains a non-finite number'); return value; }
    if (typeof value !== 'object') throw new Error('Co-op snapshot contains unsupported data');
    if (seen.has(value)) return { ref: seen.get(value) };
    const ref = nodes.length; seen.set(value, ref); nodes.push(null);
    if (value instanceof Map) nodes[ref] = { kind: 'map', entries: [...value].map(([key, item]) => [encode(key), encode(item)]) };
    else if (value instanceof Set) nodes[ref] = { kind: 'set', items: [...value].map(encode) };
    else if (Array.isArray(value)) nodes[ref] = { kind: 'array', items: value.map(encode) };
    else nodes[ref] = { kind: 'object', entries: Object.entries(value).filter(([key, item]) =>
      item !== undefined && typeof item !== 'function' && !forbidden.has(key)
      && !(value === combat && ['registries', 'rng'].includes(key))).map(([key, item]) => [key, encode(item)]) };
    return { ref };
  }
  const snapshot = { version: 1, root: encode(combat), nodes };
  decodeCoopCombatSnapshot(snapshot);
  return snapshot;
}

export function decodeCoopCombatSnapshot(snapshot) {
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.nodes) || snapshot.nodes.length > 100000) throw new Error('Malformed co-op combat snapshot');
  const nodes = snapshot.nodes;
  const objects = nodes.map(node => {
    if (!node || !['object', 'array', 'map', 'set'].includes(node.kind)) throw new Error('Invalid co-op snapshot node');
    return node.kind === 'map' ? new Map() : node.kind === 'set' ? new Set() : node.kind === 'array' ? [] : {};
  });
  const decode = value => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
    if (!value || Object.keys(value).length !== 1 || !Number.isSafeInteger(value.ref) || value.ref < 0 || value.ref >= objects.length) throw new Error('Invalid co-op snapshot reference');
    return objects[value.ref];
  };
  nodes.forEach((node, index) => {
    const target = objects[index];
    if (node.kind === 'array' || node.kind === 'set') {
      if (!Array.isArray(node.items)) throw new Error('Invalid co-op snapshot items');
      for (const item of node.items) node.kind === 'set' ? target.add(decode(item)) : target.push(decode(item));
    } else {
      if (!Array.isArray(node.entries)) throw new Error('Invalid co-op snapshot entries');
      const keys = new Set();
      for (const pair of node.entries) {
        if (!Array.isArray(pair) || pair.length !== 2) throw new Error('Invalid co-op snapshot entry');
        if (node.kind === 'map') {
          const key = decode(pair[0]);
          if (target.has(key)) throw new Error('Duplicated co-op snapshot map key');
          target.set(key, decode(pair[1]));
        }
        else {
          const key = pair[0];
          if (typeof key !== 'string' || forbidden.has(key) || keys.has(key)) throw new Error('Invalid co-op snapshot object key');
          keys.add(key); target[key] = decode(pair[1]);
        }
      }
    }
  });
  const combat = decode(snapshot.root);
  if (!(combat?.players instanceof Map) || !combat.players.size || !(combat.triggerState instanceof Map)
    || !Array.isArray(combat.enemies) || !Array.isArray(combat.queue) || !Array.isArray(combat.order)
    || !['player', 'enemy', 'ended', 'suspended'].includes(combat.phase) || ![null, 'victory', 'defeat'].includes(combat.result)
    || !Number.isSafeInteger(combat.turn) || combat.turn < 0 || (combat.turn === 0 && combat.phase !== 'ended')
    || combat._buffer !== null) throw new Error(`Invalid co-op combat state (phase=${combat?.phase}, turn=${combat?.turn}, result=${combat?.result}, players=${combat?.players?.size})`);
  const entities = [...combat.players.values()].map(seat => seat.entity).concat(combat.enemies);
  if (![1, 2].includes(combat.sharedExpansionVersion) || ![1, 2].includes(combat.combatExpansionVersion)) throw new Error('Invalid co-op combat rules version');
  if (combat.breakMeterVersion !== undefined && ![1, 2].includes(combat.breakMeterVersion)) throw new Error('Invalid co-op break meter version');
  if (combat.sharedExpansionVersion === 2) {
    const problems = combatExpansionRulesProblems(combat.combatExpansionRules);
    if (problems.length) throw new Error(problems.join('; '));
  }
  for (const entity of entities) {
    if (!entity || !Number.isFinite(entity.hp) || entity.hp < 0 || !Number.isFinite(entity.maxHp) || entity.maxHp < 1 || entity.hp > entity.maxHp
      || typeof entity.alive !== 'boolean' || !entity.statuses || typeof entity.statuses !== 'object') throw new Error('Invalid co-op combat entity');
    for (const field of ['mana', 'maxMana', 'energy', 'energyMax', 'stamina', 'maxStamina', 'block', 'wardBarrier']) {
      if (entity[field] !== undefined && (!Number.isFinite(entity[field]) || entity[field] < 0)) throw new Error(`Invalid co-op combat entity ${field}`);
    }
    const blightLost = entity.ashenBlight?.thresholdOutcome === 'lost' || entity.ashenBlight?.entries?.some(row => row.outcome === 'lost');
    if (blightLost && (entity.blightTerminal !== true || entity.alive || entity.hp !== 0)) throw new Error('A terminal Blight seat cannot revive');
    if (entity.blightTerminal === true && !blightLost) throw new Error('A Blight elimination requires its committed loss receipt');
    for (const [field, validate] of [['ashenBlight', ashenBlightProblems], ['ashenBlightCombat', ashenBlightCombatProblems]]) {
      if (entity[field] !== undefined) { const problems = validate(entity[field]); if (problems.length) throw new Error(problems.join('; ')); }
    }
    if (entity.combatExpansionVersion !== undefined && ![1, 2].includes(entity.combatExpansionVersion)) throw new Error('Invalid co-op combat entity version');
    const problems = statusControlProblems(entity, entity.id, { required: entity.combatExpansionVersion === 2, rules: combat.combatStatusRules || combat.combatExpansionRules?.statuses });
    if (problems.length) throw new Error(problems.join('; '));
    if (entity.combatExpansionVersion === 2) {
      const tacticalProblems = combatExpansionEntityProblems(entity, entity.id);
      if (entity.kind === 'player') tacticalProblems.push(...ashenBlightProblems(entity.ashenBlight));
      if (tacticalProblems.length) throw new Error(tacticalProblems.join('; '));
    }
  }
  for (const [id, seat] of combat.players) {
    if (typeof id !== 'string' || seat?.id !== id || !combat.order.includes(id) || !seat.piles
      || ['draw', 'hand', 'discard', 'exhaust'].some(pile => !Array.isArray(seat.piles[pile]))) throw new Error('Invalid co-op combat seat');
    const cards = ['draw', 'hand', 'discard', 'exhaust'].flatMap(pile => seat.piles[pile]), seen = new Set();
    for (const card of cards) {
      if (!card || typeof card.instanceId !== 'string' || !card.instanceId || typeof card.cardId !== 'string' || !card.cardId || seen.has(card.instanceId)) throw new Error('Invalid or duplicated co-op card instance');
      seen.add(card.instanceId);
    }
  }
  if (combat.order.length !== combat.players.size || new Set(combat.order).size !== combat.order.length) throw new Error('Invalid co-op seat order');
  const knowledgeProblems = combatEnemyKnowledgeProblems(combat.enemyKnowledge, combat.enemies,
    { ownerIds: new Set(combat.players.keys()), coop: combat.enemyKnowledge !== undefined });
  if (combat.enemyKnowledge?.rules?.perception) for (const [id, seat] of combat.players) {
    if (Object.hasOwn(combat.enemyKnowledge.owners, id)) knowledgeProblems.push(...perceptionProblems(seat.skills?.perception, combat.enemyKnowledge.rules.perception));
  }
  if (knowledgeProblems.length) throw new Error(knowledgeProblems.join('; '));
  const reactionProblems = combatReactionProblems(combat, { ownerIds: new Set(combat.players.keys()) });
  if (reactionProblems.length) throw new Error(reactionProblems.join('; '));
  return combat;
}
