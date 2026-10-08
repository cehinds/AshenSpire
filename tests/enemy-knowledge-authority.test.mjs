import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';
import { snapshotEnemyKnowledgeRules } from '../src/model/enemyKnowledgeRules.js';
import { knowledgePoints } from '../src/model/enemyKnowledgeProfile.js';
import { combatEnemyKnowledgeProblems } from '../src/model/enemyKnowledgeCombat.js';
import { initializeCombatKnowledge, rollEnemyKnowledge, knowledgeIntentProjection, predictEnemyIntent, resolveKnowledgeAction, creditKnowledgeResponse, recordKnowledgeEvent, addKnowledgeObserver } from '../src/engine/enemyKnowledge.js';
const rules = snapshotEnemyKnowledgeRules(); rules.reads.baseExact = 0; rules.reads.baseClue = 0;
const encounter = { id: 'unique-run/1/node/fight', enemyIds: ['soldier'] };
function combat() {
  const c = { rng: createRng(6), phase: 'player', result: null, player: { id: 'player', alive: true }, playerKey: 'player',
    skills: { perception: { xp: 0, level: 0, pendingDrafts: 0 } }, attributes: {}, characterLevel: 1,
    enemies: [{ id: 'e1', enemyId: 'soldier', alive: true, intent: { kind: 'attack', moveId: 'smash', damage: 19, combatProfile: { camp: 'physical', maneuver: 'smash' } } }],
    emit(type, payload) { return { type, ...payload }; } };
  initializeCombatKnowledge(c, { rules, encounter, bankable: true });
  rollEnemyKnowledge(c, c.enemies[0]); return c;
}
let c = combat(), e = c.enemies[0];
assert.equal(knowledgePoints(c.enemyKnowledge.owners.player.pending.enemies.soldier), 1);
const before = JSON.stringify(c);
assert.throws(() => predictEnemyIntent(c, 'player', 'e1', 999, 'Smash'));
assert.throws(() => predictEnemyIntent(c, 'foreign-seat', 'e1', 1, 'Smash'));
assert.throws(() => predictEnemyIntent(c, 'player', 'e1', 1, 'Staggered'));
assert.equal(JSON.stringify(c), before);
predictEnemyIntent(c, 'player', 'e1', 1, 'Smash');
const accepted = JSON.stringify(c);
assert.throws(() => predictEnemyIntent(c, 'player', 'e1', 1, 'Attack'));
for (let n = 0; n < 30; n++) assert.equal(knowledgeIntentProjection(c, e).intent.label, '?');
assert.equal(JSON.stringify(c), accepted);
assert.equal(c.enemyKnowledge.owners.player.earnedXp, 0);
resolveKnowledgeAction(c, e); resolveKnowledgeAction(c, e);
assert.equal(c.enemyKnowledge.owners.player.earnedXp, 1);
assert.equal(knowledgePoints(c.enemyKnowledge.owners.player.pending.enemies.soldier), 1);
creditKnowledgeResponse(c, 'player', 'e1', { committed: true, kind: 'counter', amount: 3, actionSerial: 1 }); creditKnowledgeResponse(c, 'player', 'e1', { committed: true, kind: 'counter', amount: 3, actionSerial: 1 });
assert.equal(c.enemyKnowledge.owners.player.earnedXp, 1);
assert.equal(knowledgePoints(c.enemyKnowledge.owners.player.pending.enemies.soldier), 2);
assert.equal(c.enemyKnowledge.owners.player.feedback.length, 1);
assert.equal(c.enemyKnowledge.owners.player.feedback[0].correct, true);

c = combat(); e = c.enemies[0];
predictEnemyIntent(c, 'player', 'e1', 1, 'Attack'); resolveKnowledgeAction(c, e);
assert.equal(c.enemyKnowledge.owners.player.earnedXp, 0);
assert.equal(e.knowledgeAction.reads.player.correct, false);
creditKnowledgeResponse(c, 'player', 'e1', { committed: true, kind: 'counter', amount: 0, actionSerial: 1 }); assert.equal(c.enemyKnowledge.owners.player.earnedXp, 0);
creditKnowledgeResponse(c, 'player', 'e1', { committed: true, kind: 'matchup', amount: 1, actionSerial: 1 }); assert.equal(c.enemyKnowledge.owners.player.earnedXp, 1);

c = combat(); e = c.enemies[0];
predictEnemyIntent(c, 'player', 'e1', 1, 'Smash'); e.alive = false;
recordKnowledgeEvent(c, { type: 'enemyDied', targetId: 'e1' });
resolveKnowledgeAction(c, e);
assert.equal(c.enemyKnowledge.owners.player.earnedXp, 0);
assert.equal(c.enemyKnowledge.owners.player.feedback[0].outcome, 'cancelled');
assert.equal(e.knowledgeAction.reads.player.correct, null);
assert.equal(creditKnowledgeResponse(c, 'player', 'e1', { committed: true, kind: 'matchup', amount: 1, actionSerial: 1 }), false);
assert.equal(c.enemyKnowledge.owners.player.earnedXp, 0);
assert.equal(knowledgePoints(c.enemyKnowledge.owners.player.pending.enemies.soldier), 1);

c = combat(); e = c.enemies[0]; e.intent = { kind: 'staggered' };
const staggeredBefore = JSON.stringify(c);
assert.equal(knowledgeIntentProjection(c, e).exact, true);
assert.throws(() => predictEnemyIntent(c, 'player', 'e1', 1, 'Attack'));
assert.equal(JSON.stringify(c), staggeredBefore);
c = combat(); e = c.enemies[0]; predictEnemyIntent(c, 'player', 'e1', 1, 'Smash');
e.intent = { kind: 'staggered' }; resolveKnowledgeAction(c, e); resolveKnowledgeAction(c, e);
assert.equal(c.enemyKnowledge.owners.player.earnedXp, 0);
assert.equal(e.knowledgeAction.cancelled, true);
assert.equal(c.enemyKnowledge.owners.player.feedback.length, 1);
assert.equal(c.enemyKnowledge.owners.player.feedback[0].outcome, 'cancelled');
assert.deepEqual(combatEnemyKnowledgeProblems(c.enemyKnowledge, c.enemies), []);
c = combat(); e = c.enemies[0]; rollEnemyKnowledge(c, e);
const staleBefore = JSON.stringify(c);
assert.equal(creditKnowledgeResponse(c, 'player', 'e1', { committed: true, kind: 'counter', amount: 1, actionSerial: 1 }), false);
assert.equal(creditKnowledgeResponse(c, 'player', 'e1', { committed: false, kind: 'counter', amount: 1, actionSerial: 2 }), false);
assert.equal(JSON.stringify(c), staleBefore);

c = combat(); e = c.enemies[0];
e.intent = { kind: 'attack', combatProfile: { camp: 'spell' }, delayed: true };
rollEnemyKnowledge(c, e, { charging: true });
predictEnemyIntent(c, 'player', 'e1', 2, 'Casting');
const counters = c.rng.getCounters(), original = structuredClone(e.knowledgeAction);
// A delayed action is not reselected while charging; its read is projected.
for (let n = 0; n < 5; n++) knowledgeIntentProjection(c, e);
assert.deepEqual(e.knowledgeAction, original); assert.deepEqual(c.rng.getCounters(), counters);
e.intent.pending = false; resolveKnowledgeAction(c, e);
assert.equal(c.enemyKnowledge.owners.player.earnedXp, 1);
assert.equal(e.knowledgeAction.reads.player.correct, true);
assert.equal(e.knowledgeAction.serial, 2);

function coop(order) {
  const c = combat(); delete c.enemyKnowledge; delete c.enemies[0].knowledgeAction;
  c.players = new Map(order.map(id => [id, { entity: { id: 'player', alive: true }, skills: { perception: { xp: 0, level: 0, pendingDrafts: 0 } }, attributes: {}, characterLevel: 1 }]));
  initializeCombatKnowledge(c, { rules: snapshotEnemyKnowledgeRules(), encounter, bankable: true, privateSeed: 8612 });
  rollEnemyKnowledge(c, c.enemies[0]); return c;
}
const a = coop(['z', 'a']), b = coop(['a', 'z']);
assert.deepEqual(a.enemies[0].knowledgeAction, b.enemies[0].knowledgeAction);
assert.equal(a.rng.getCounters().enemyIntentVisibility, 1); // only the discarded solo fixture read
assert.equal(a.enemyKnowledge.readCounters.enemyIntentVisibility, 2);
assert.equal(a.enemyKnowledge.readCounters.enemyIntentClue, 2);
const originalJoinAction = structuredClone(a.enemies[0].knowledgeAction);
a.players.set('new', { entity: { id: 'player', alive: true }, skills: { perception: { xp: 0, level: 0, pendingDrafts: 0 } }, attributes: {}, characterLevel: 1 });
addKnowledgeObserver(a, 'new');
assert.equal(a.enemyKnowledge.readCounters.enemyIntentVisibility, 3);
assert.equal(a.enemies[0].knowledgeAction.serial, originalJoinAction.serial);
for (const id of ['a', 'z']) assert.deepEqual(a.enemies[0].knowledgeAction.reads[id], originalJoinAction.reads[id]);
assert.equal(knowledgePoints(a.enemyKnowledge.owners.new.pending.enemies.soldier), 1);
const joined = JSON.stringify(a);
addKnowledgeObserver(a, 'new'); assert.equal(JSON.stringify(a), joined);
assert.throws(() => addKnowledgeObserver(a, 'foreign'), /unavailable/); assert.equal(JSON.stringify(a), joined);
a.players.get('new').connected = false; rollEnemyKnowledge(a, a.enemies[0]);
assert.equal(a.enemies[0].knowledgeAction.reads.new, undefined);
a.players.get('new').connected = true; const reconnectCounter = a.enemyKnowledge.readCounters.enemyIntentVisibility;
addKnowledgeObserver(a, 'new'); assert.equal(a.enemyKnowledge.readCounters.enemyIntentVisibility, reconnectCounter + 1);
const reconnected = JSON.stringify(a); addKnowledgeObserver(a, 'new'); assert.equal(JSON.stringify(a), reconnected);
assert.deepEqual(combatEnemyKnowledgeProblems(a.enemyKnowledge, a.enemies, { coop: true }), []);
assert.throws(() => initializeCombatKnowledge(a, { rules, encounter, privateSeed: null }), /host-private/);
// Every owner has a separate tactical bonus cap and only the responding owner pays.
const u = coop(['a', 'z']);
u.enemies[0].knowledgeAction.reads.a.visibility = 'unknown';
creditKnowledgeResponse(u, 'a', 'e1', { committed: true, kind: 'evade', amount: 1, actionSerial: 1 });
assert.equal(u.enemyKnowledge.owners.a.earnedXp, 1);
assert.equal(u.enemyKnowledge.owners.z.earnedXp, 0);
assert.equal(knowledgePoints(u.enemyKnowledge.owners.a.pending.enemies.soldier), 2);
assert.equal(knowledgePoints(u.enemyKnowledge.owners.z.pending.enemies.soldier), 1);
assert.deepEqual(combatEnemyKnowledgeProblems(u.enemyKnowledge, u.enemies, { ownerIds: new Set(['a', 'z']), enemyIds: new Set(['soldier']), coop: true }), []);
const malformed = structuredClone(u.enemyKnowledge);
malformed.owners.a.earnedXp = 999;
assert.ok(combatEnemyKnowledgeProblems(malformed, u.enemies, { coop: true }).length);
for (const counters of [{}, { enemyIntentVisibility: 2 }, { enemyIntentVisibility: 2, enemyIntentClue: 3 },
  { enemyIntentVisibility: 0, enemyIntentClue: 0 }, { enemyIntentVisibility: 2, enemyIntentClue: 2, enemyAI: 1 }]) {
  const missingCounters = structuredClone(u.enemyKnowledge); missingCounters.readCounters = counters;
  assert.ok(combatEnemyKnowledgeProblems(missingCounters, u.enemies, { coop: true }).length);
}
const malformedEnemies = structuredClone(u.enemies);
malformedEnemies[0].knowledgeAction.reads.a.visibility = 'exact';
assert.ok(combatEnemyKnowledgeProblems(u.enemyKnowledge, malformedEnemies, { coop: true }).length);
assert.ok(combatEnemyKnowledgeProblems(undefined, u.enemies).length);
const savedExecuted = combat();
predictEnemyIntent(savedExecuted, 'player', 'e1', 1, 'Smash');
resolveKnowledgeAction(savedExecuted, savedExecuted.enemies[0]);
assert.deepEqual(combatEnemyKnowledgeProblems(savedExecuted.enemyKnowledge, savedExecuted.enemies), []);
for (const mutate of [
  read => { read.correct = false; },
  read => { read.correct = null; },
  read => { read.visibility = 'clue'; read.label = 'Magic?'; read.prediction = null; read.correct = null; read.credited = false; },
]) {
  const bad = structuredClone(savedExecuted.enemies); mutate(bad[0].knowledgeAction.reads.player);
  assert.ok(combatEnemyKnowledgeProblems(savedExecuted.enemyKnowledge, bad).length);
}
const premature = combat(); premature.enemies[0].knowledgeAction.reads.player.resolved = true;
assert.ok(combatEnemyKnowledgeProblems(premature.enemyKnowledge, premature.enemies).length);
assert.throws(() => initializeCombatKnowledge(u, { rules, bankable: true, encounter: null, privateSeed: 1 }), /unique encounter/);
console.log('PASS enemy knowledge authority helpers: inert/rejected predictions, execution-only XP, delay continuity and independent owner caps');
