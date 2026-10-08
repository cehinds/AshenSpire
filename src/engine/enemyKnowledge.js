// Authority-owned action reads and success receipts. No storage or UI.
import { createRng } from './rng.js';
import { rollKnowledgeRead, predictionCategory, PREDICTION_CHOICES, concealKnowledgeIntent } from '../model/enemyIntentKnowledge.js';
import { advancePerception, perceptionLevel, PERCEPTION_SKILL } from '../model/perception.js';
import { emptyEnemyKnowledge, mergeEnemyKnowledge, enemyKnowledgeProblems, knowledgeKey } from '../model/enemyKnowledgeProfile.js';
import { addKnowledgeCounterBonus } from '../model/enemyKnowledgeRun.js';
import { enemyMasteryTarget, enemyKnowledgeRuleProblems } from '../model/enemyKnowledgeRules.js';

export function initializeCombatKnowledge(combat, { rules, encounter = null, bankable = false, profiles = {}, privateSeed = null }) {
  const problems = enemyKnowledgeRuleProblems(rules);
  for (const profile of Object.values(profiles)) problems.push(...enemyKnowledgeProblems(profile));
  if (typeof bankable !== 'boolean' || (bankable && (!encounter || !knowledgeKey(encounter.id)
    || !Array.isArray(encounter.enemyIds) || !encounter.enemyIds.length || encounter.enemyIds.some(id => !knowledgeKey(id))))) problems.push('Combat learning requires an accepted unique encounter');
  if (problems.length) throw new Error(problems.join('; '));
  if (combat.players instanceof Map && (!Number.isInteger(privateSeed) || privateSeed < 0 || privateSeed > 0xffffffff)) throw new Error('Co-op enemy reads require an injected host-private seed');
  combat.enemyKnowledge = { version: 1, rules: structuredClone(rules), encounter: structuredClone(encounter), bankable,
    nextSerial: 0, owners: {}, ...(combat.players instanceof Map ? { privateSeed,
      readCounters: { enemyIntentVisibility: 0, enemyIntentClue: 0 } } : {}) };
  for (const owner of observers(combat)) combat.enemyKnowledge.owners[owner.id] = {
    knowledge: structuredClone(profiles[owner.id] || emptyEnemyKnowledge()), pending: emptyEnemyKnowledge(), earnedXp: 0,
    feedback: [], counterEnemyIds: [],
  };
  if (bankable && encounter) for (const owner of Object.values(combat.enemyKnowledge.owners)) {
    const entered = { version: 1, enemies: Object.fromEntries(encounter.enemyIds.map(id => [id, {
      target: enemyMasteryTarget(rules, id), receipts: { [encounter.id]: { bonus: false } },
    }])) };
    const accepted = mergeEnemyKnowledge(entered, owner.knowledge);
    owner.pending.enemies = Object.fromEntries(Object.entries(accepted.enemies)
      .filter(([, row]) => Object.hasOwn(row.receipts, encounter.id))
      .map(([id, row]) => [id, { target: row.target, receipts: { [encounter.id]: { bonus: row.receipts[encounter.id].bonus } } }]));
    owner.knowledge = accepted;
  }
  return combat.enemyKnowledge;
}
function observers(combat) {
  if (combat.players instanceof Map) return [...combat.players.entries()].map(([id, seat]) => ({ id, entity: seat.entity,
    skills: seat.skills, attributes: seat.attributes, level: seat.characterLevel || seat.level?.level || seat.level || 1,
    ended: seat.ended, connected: seat.connected !== false })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [{ id: combat.playerKey || 'player', entity: combat.player, skills: combat.skills,
    attributes: combat.attributes, level: combat.characterLevel || 1, ended: false, connected: true }];
}
const observerFor = (combat, id) => observers(combat).find(row => row.id === id);

function feedback(combat, enemy, outcome) {
  for (const [id, read] of Object.entries(enemy.knowledgeAction?.reads || {})) {
    if (!read.prediction) continue;
    const owner = combat.enemyKnowledge.owners[id];
    if (!owner) continue;
    owner.feedback.push({ enemyInstanceId: enemy.id, enemyId: enemy.enemyId, actionSerial: enemy.knowledgeAction.serial,
      prediction: read.prediction, correct: read.correct, outcome });
    if (owner.feedback.length > 12) owner.feedback.shift();
  }
}
export function rollEnemyKnowledge(combat, enemy, { charging = false } = {}) {
  const state = combat.enemyKnowledge;
  if (!state) return false;
  if (enemy.knowledgeAction && !enemy.knowledgeAction.executed && !enemy.knowledgeAction.cancelled) feedback(combat, enemy, 'cancelled');
  const category = predictionCategory(enemy.intent, enemy.intent?.combatProfile, { charging });
  const rng = Object.hasOwn(state, 'privateSeed') ? createRng(state.privateSeed, state.readCounters) : combat.rng;
  const action = { serial: ++state.nextSerial, category, executed: false, reads: {} };
  for (const owner of observers(combat).filter(row => row.entity?.alive && row.connected)) {
    if (!Object.hasOwn(state.owners, owner.id)) state.owners[owner.id] = { knowledge: emptyEnemyKnowledge(), pending: emptyEnemyKnowledge(), earnedXp: 0, feedback: [], counterEnemyIds: [] };
    action.reads[owner.id] = rollKnowledgeRead(rng, state.rules, { ...owner, perception: perceptionLevel(owner.skills) }, category);
  }
  if (Object.hasOwn(state, 'privateSeed')) {
    const counters = rng.getCounters();
    state.readCounters = { enemyIntentVisibility: counters.enemyIntentVisibility, enemyIntentClue: counters.enemyIntentClue };
  }
  enemy.knowledgeAction = action;
  return true;
}
export function knowledgeIntentProjection(combat, enemy, ownerId = combat.playerKey || 'player') {
  if (!combat.enemyKnowledge) return null;
  // Staggered is a currently public status, even when it cancels an older
  // unread selected action; the old read is retained for committed responses.
  if (enemy.intent?.kind === 'staggered') return { exact: true };
  const action = enemy.knowledgeAction;
  const read = action?.reads[ownerId];
  return read?.visibility === 'exact' ? { exact: true, actionSerial: action.serial }
    : { exact: false, intent: concealKnowledgeIntent(read, action?.serial || 0) };
}
export function predictEnemyIntent(combat, ownerId, enemyId, serial, maneuver) {
  const owner = observerFor(combat, ownerId);
  const enemy = combat.enemies.find(row => row.id === enemyId);
  const action = enemy?.knowledgeAction;
  const read = action?.reads[ownerId];
  if (!combat.enemyKnowledge || combat.phase !== 'player' || combat.result || !owner?.entity?.alive || !owner.connected || owner.ended
    || !enemy?.alive || enemy.intent?.kind === 'staggered' || !Number.isSafeInteger(serial) || serial < 1 || serial !== action?.serial || action.executed || action.cancelled
    || read?.visibility !== 'unknown' || read.prediction !== null || read.resolved || !PREDICTION_CHOICES.includes(maneuver)) throw new Error('Prediction is unavailable for this observer and action');
  read.prediction = maneuver;
  combat.emit?.('intentPredictionAccepted', { ownerId, enemyInstanceId: enemyId, actionSerial: serial, prediction: maneuver });
  return { accepted: true, actionSerial: serial, prediction: maneuver };
}
function payPerception(combat, enemy, ownerId, reason) {
  const state = combat.enemyKnowledge;
  const read = enemy.knowledgeAction?.reads[ownerId];
  const owner = observerFor(combat, ownerId);
  if (!read || read.visibility !== 'unknown' || read.credited || !owner?.skills || !state.owners[ownerId]) return false;
  read.credited = true;
  owner.skills[PERCEPTION_SKILL] ||= { xp: 0, level: 0, pendingDrafts: 0 };
  const amount = state.rules.perception.correctPredictionXp;
  const award = advancePerception(owner.skills[PERCEPTION_SKILL], state.rules.perception, amount);
  state.owners[ownerId].earnedXp += amount;
  combat.emit?.('perceptionGained', { ownerId, enemyInstanceId: enemy.id, actionSerial: enemy.knowledgeAction.serial, reason, ...award });
  return true;
}
export function resolveKnowledgeAction(combat, enemy) {
  const action = enemy?.knowledgeAction;
  if (!combat.enemyKnowledge || !action || action.executed || action.cancelled || !enemy.alive) return;
  action.executed = true;
  for (const [ownerId, read] of Object.entries(action.reads)) {
    read.resolved = true;
    read.correct = read.prediction === null ? null : read.prediction === action.category;
    if (read.correct) payPerception(combat, enemy, ownerId, 'prediction');
  }
  feedback(combat, enemy, 'executed');
}
// Called only after a real avoidance, retaliation or realized matchup benefit.
// Preparing a card, computing a preview and arming a reaction never call it.
export function creditKnowledgeResponse(combat, ownerId, enemyId, receipt) {
  const state = combat.enemyKnowledge;
  if (!state || receipt?.committed !== true || !(receipt.amount > 0) || !['evade', 'counter', 'matchup'].includes(receipt.kind)) return false;
  const enemy = combat.enemies.find(row => row.id === enemyId);
  const owner = state.owners[ownerId];
  if (!enemy?.knowledgeAction?.reads[ownerId] || !owner || enemy.knowledgeAction.cancelled
    || receipt.actionSerial !== enemy.knowledgeAction.serial) return false;
  const paid = payPerception(combat, enemy, ownerId, 'response');
  if (state.bankable && state.encounter && !owner.counterEnemyIds.includes(enemy.enemyId)) {
    owner.counterEnemyIds.push(enemy.enemyId);
    owner.pending = addKnowledgeCounterBonus(owner.pending, state.encounter, enemy.enemyId,
      enemyMasteryTarget(state.rules, enemy.enemyId), owner.knowledge);
    owner.knowledge = mergeEnemyKnowledge(owner.pending, owner.knowledge);
  }
  return paid;
}
export function recordKnowledgeEvent(combat, event) {
  if (!combat.enemyKnowledge) return;
  if (event.type === 'enemyMoveStarted') resolveKnowledgeAction(combat, combat.enemies.find(row => row.id === event.sourceId));
  if (event.type === 'attackEvaded') creditKnowledgeResponse(combat, event.targetPlayerId || combat.playerKey || 'player', event.sourceId,
    { committed: true, kind: 'evade', amount: 1, actionSerial: event.enemyActionSerial });
  if (event.type === 'enemyDied') {
    const enemy = combat.enemies.find(row => row.id === (event.targetId || event.enemyInstanceId || event.enemyId));
    if (enemy?.knowledgeAction && !enemy.knowledgeAction.executed && !enemy.knowledgeAction.cancelled) {
      enemy.knowledgeAction.cancelled = true;
      for (const read of Object.values(enemy.knowledgeAction.reads)) { read.resolved = true; read.correct = null; }
      feedback(combat, enemy, 'cancelled');
    }
  }
}
export function attachEnemyKnowledge(combat) {
  const inner = combat.emit;
  combat.emit = (type, payload) => { const event = inner(type, payload); recordKnowledgeEvent(combat, event); return event; };
}
