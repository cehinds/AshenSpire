// Authority-owned action reads and success receipts. No storage or UI.
import { createRng } from './rng.js';
import { rollKnowledgeRead, predictionCategory, PREDICTION_CHOICES, concealKnowledgeIntent } from '../model/enemyIntentKnowledge.js';
import { advancePerception, perceptionLevel, perceptionProblems, PERCEPTION_SKILL } from '../model/perception.js';
import { emptyEnemyKnowledge, mergeEnemyKnowledge, enemyKnowledgeProblems, knowledgeKey } from '../model/enemyKnowledgeProfile.js';
import { addKnowledgeCounterBonus, reconcilePerception } from '../model/enemyKnowledgeRun.js';
import { enemyMasteryTarget, enemyKnowledgeRuleProblems } from '../model/enemyKnowledgeRules.js';

export function initializeCombatKnowledge(combat, { rules, encounter = null, bankable = false, profiles = {}, privateSeed = null }) {
  const problems = enemyKnowledgeRuleProblems(rules);
  for (const profile of Object.values(profiles)) problems.push(...enemyKnowledgeProblems(profile));
  const living = observers(combat).filter(row => row.entity?.alive && row.connected);
  for (const owner of living) if (owner.skills?.[PERCEPTION_SKILL]) problems.push(...perceptionProblems(owner.skills[PERCEPTION_SKILL], rules.perception));
  if (typeof bankable !== 'boolean' || (bankable && (!encounter || !knowledgeKey(encounter.id)
    || !Array.isArray(encounter.enemyIds) || !encounter.enemyIds.length || encounter.enemyIds.some(id => !knowledgeKey(id))))) problems.push('Combat learning requires an accepted unique encounter');
  if (problems.length) throw new Error(problems.join('; '));
  if (combat.players instanceof Map && (!Number.isInteger(privateSeed) || privateSeed < 0 || privateSeed > 0xffffffff)) throw new Error('Co-op enemy reads require an injected host-private seed');
  combat.enemyKnowledge = { version: 1, rules: structuredClone(rules), encounter: structuredClone(encounter), bankable,
    nextSerial: 0, owners: {}, ...(combat.players instanceof Map ? { privateSeed,
      readCounters: { enemyIntentVisibility: 0, enemyIntentClue: 0 } } : {}) };
  for (const owner of living) {
    if (owner.skills) owner.skills[PERCEPTION_SKILL] ||= { xp: 0, level: 0, pendingDrafts: 0 };
    combat.enemyKnowledge.owners[owner.id] = newKnowledgeOwner(combat.enemyKnowledge, profiles[owner.id]);
  }
  return combat.enemyKnowledge;
}
// A combat owns a cloned skill ledger. Carry only its cumulative earned XP,
// keyed by the accepted encounter, into the run; retries never pay it twice.
export function reconcileCombatKnowledge(run, combat, ownerId = combat.playerKey || 'player') {
  if (!run.enemyKnowledgeState || !combat.enemyKnowledge) return false;
  const state = combat.enemyKnowledge, owner = state.owners[ownerId];
  if (!owner || !state.encounter || state.encounter.id !== run.enemyKnowledgeState.currentEncounter?.id) throw new Error('Combat learning does not match its run encounter');
  run.enemyKnowledgeState.pending = mergeEnemyKnowledge(owner.pending, run.enemyKnowledgeState.pending);
  reconcilePerception(run, state.encounter.id, owner.earnedXp);
  return true;
}
function observers(combat) {
  if (combat.players instanceof Map) return [...combat.players.entries()].map(([id, seat]) => ({ id, entity: seat.entity,
    skills: seat.skills, attributes: seat.attributes, level: seat.characterLevel || seat.level?.level || seat.level || 1,
    ended: seat.ended, connected: seat.connected !== false })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [{ id: combat.playerKey || 'player', entity: combat.player, skills: combat.skills,
    attributes: combat.attributes, level: combat.characterLevel || 1, ended: false, connected: true }];
}
const observerFor = (combat, id) => observers(combat).find(row => row.id === id);

function newKnowledgeOwner(state, profile = emptyEnemyKnowledge()) {
  const owner = { knowledge: structuredClone(profile), pending: emptyEnemyKnowledge(), earnedXp: 0, feedback: [], counterEnemyIds: [] };
  if (state.bankable && state.encounter) {
    const encounter = state.encounter;
    const entered = { version: 1, enemies: Object.fromEntries(encounter.enemyIds.map(id => [id, {
      target: enemyMasteryTarget(state.rules, id), receipts: { [encounter.id]: { bonus: false } },
    }])) };
    const accepted = mergeEnemyKnowledge(entered, owner.knowledge);
    owner.pending.enemies = Object.fromEntries(Object.entries(accepted.enemies)
      .filter(([, row]) => Object.hasOwn(row.receipts, encounter.id))
      .map(([id, row]) => [id, { target: row.target, receipts: { [encounter.id]: { bonus: row.receipts[encounter.id].bonus } } }]));
    owner.knowledge = accepted;
  }
  return owner;
}
function storeReadCounters(state, rng) {
  if (!Object.hasOwn(state, 'privateSeed')) return;
  const counters = rng.getCounters();
  state.readCounters = { enemyIntentVisibility: counters.enemyIntentVisibility, enemyIntentClue: counters.enemyIntentClue };
}
// Join/rejoin keeps every existing observer's read, prediction and action
// serial. A returning observer receives only reads it has never been given.
export function addKnowledgeObserver(combat, ownerId, profile = emptyEnemyKnowledge()) {
  const state = combat.enemyKnowledge, owner = observerFor(combat, ownerId);
  if (!state || !knowledgeKey(ownerId) || !owner?.entity?.alive || !owner.connected || combat.result) throw new Error('Enemy knowledge observer is unavailable');
  const problems = enemyKnowledgeProblems(profile);
  if (owner.skills?.[PERCEPTION_SKILL]) problems.push(...perceptionProblems(owner.skills[PERCEPTION_SKILL], state.rules.perception));
  if (problems.length) throw new Error(problems.join('; '));
  if (owner.skills) owner.skills[PERCEPTION_SKILL] ||= { xp: 0, level: 0, pendingDrafts: 0 };
  if (!Object.hasOwn(state.owners, ownerId)) state.owners[ownerId] = newKnowledgeOwner(state, profile);
  else state.owners[ownerId].knowledge = mergeEnemyKnowledge(profile, state.owners[ownerId].knowledge);
  const rng = Object.hasOwn(state, 'privateSeed') ? createRng(state.privateSeed, state.readCounters) : combat.rng;
  const selected = combat.enemies.filter(enemy => enemy.alive && enemy.knowledgeAction && !enemy.knowledgeAction.executed && !enemy.knowledgeAction.cancelled)
    .sort((a, b) => a.knowledgeAction.serial - b.knowledgeAction.serial);
  for (const enemy of selected) if (!Object.hasOwn(enemy.knowledgeAction.reads, ownerId)) {
    enemy.knowledgeAction.reads[ownerId] = rollKnowledgeRead(rng, state.rules, { ...owner, perception: perceptionLevel(owner.skills) }, enemy.knowledgeAction.category);
  }
  storeReadCounters(state, rng);
  return state.owners[ownerId];
}

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
    if (!Object.hasOwn(state.owners, owner.id)) state.owners[owner.id] = newKnowledgeOwner(state);
    action.reads[owner.id] = rollKnowledgeRead(rng, state.rules, { ...owner, perception: perceptionLevel(owner.skills) }, category);
  }
  storeReadCounters(state, rng);
  enemy.knowledgeAction = action;
  return true;
}
export function knowledgeIntentProjection(combat, enemy, ownerId = combat.playerKey || 'player') {
  if (!combat.enemyKnowledge) return null;
  // Staggered is a currently public status, even when it cancels an older
  // unread selected action; the old read is retained for committed responses.
  if (enemy.actorIntentRevealed || enemy.intent?.kind === 'staggered') return { exact: true };
  const action = enemy.knowledgeAction;
  const read = action?.reads[ownerId];
  return read?.visibility === 'exact' ? { exact: true, actionSerial: action.serial }
    : { exact: false, intent: concealKnowledgeIntent(read, action?.serial || 0) };
}
export function knowledgePredictionModel(combat, enemy, ownerId = combat.playerKey || 'player') {
  const action = enemy.knowledgeAction, read = action?.reads[ownerId], owner = observerFor(combat, ownerId);
  return { actionSerial: action?.serial || 0, prediction: read?.prediction || null,
    resolved: read?.resolved || false, correct: read?.correct ?? null,
    feedback: structuredClone((combat.enemyKnowledge?.owners[ownerId]?.feedback || []).filter(row => row.enemyInstanceId === enemy.id)),
    eligible: !!(combat.enemyKnowledge && combat.phase === 'player' && !combat.result && enemy.alive
      && enemy.intent?.kind !== 'staggered' && owner?.entity?.alive && owner.connected && !owner.ended
      && !action.executed && !action.cancelled && read?.visibility === 'unknown' && read.prediction === null && !read.resolved) };
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
  if (enemy.intent?.kind === 'staggered') { cancelKnowledgeAction(combat, enemy); return; }
  action.executed = true;
  for (const [ownerId, read] of Object.entries(action.reads)) {
    read.resolved = true;
    read.correct = read.prediction === null ? null : read.prediction === action.category;
    if (read.correct) payPerception(combat, enemy, ownerId, 'prediction');
  }
  feedback(combat, enemy, 'executed');
}
export function cancelKnowledgeAction(combat, enemy) {
  const action = enemy?.knowledgeAction;
  if (!combat.enemyKnowledge || !action || action.executed || action.cancelled) return false;
  action.cancelled = true;
  for (const read of Object.values(action.reads)) { read.resolved = true; read.correct = null; }
  feedback(combat, enemy, 'cancelled');
  return true;
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
export function creditKnowledgeBenefit(combat, source, target, { amount, kind = 'matchup', actionSerial } = {}) {
  if (source?.kind !== 'player' || target?.kind !== 'enemy') return false;
  const ownerId = combat.players instanceof Map ? combat.playerIdForEntity?.(source) : combat.playerKey || 'player';
  return creditKnowledgeResponse(combat, ownerId, target.id, { committed: true, amount, kind,
    actionSerial: kind === 'counter' ? actionSerial : actionSerial ?? target.knowledgeAction?.serial });
}
// An executed reaction or a realized authored advantage reaches this hook.
export function creditKnowledgeImpact(combat, target, amount, matchup = false) {
  const action = combat._abilityAction;
  const counter = action?.meta?.combatCounterReaction;
  if (!counter && !action?.meta?.combatSmashBreak && !matchup) return false;
  return creditKnowledgeBenefit(combat, action?.source, target, { amount, kind: counter ? 'counter' : 'matchup',
    actionSerial: counter ? action.meta.enemyKnowledgeActionSerial : target?.knowledgeAction?.serial });
}
export function recordKnowledgeEvent(combat, event) {
  if (!combat.enemyKnowledge) return;
  if (event.type === 'enemyMoveStarted') resolveKnowledgeAction(combat, combat.enemies.find(row => row.id === event.sourceId));
  if (event.type === 'attackEvaded') creditKnowledgeResponse(combat, event.targetPlayerId || (combat.players instanceof Map ? null : combat.playerKey || 'player'), event.sourceId,
    { committed: true, kind: 'evade', amount: 1, actionSerial: event.enemyActionSerial });
  if (event.type === 'combatAvoidanceResolved' && event.avoided && (event.evade?.success || event.prevention)) creditKnowledgeResponse(combat,
    event.targetPlayerId || (combat.players instanceof Map ? null : combat.playerKey || 'player'), event.sourceId,
    { committed: true, kind: 'evade', amount: 1, actionSerial: event.enemyActionSerial });
  if (event.type === 'enemyDied' || event.type === 'enemyStaggered') {
    const enemy = combat.enemies.find(row => row.id === (event.targetId || event.enemyInstanceId || event.enemyId));
    cancelKnowledgeAction(combat, enemy);
  }
}
export function attachEnemyKnowledge(combat) {
  const inner = combat.emit;
  combat.emit = (type, payload) => { const event = inner(type, payload); recordKnowledgeEvent(combat, event); return event; };
}
