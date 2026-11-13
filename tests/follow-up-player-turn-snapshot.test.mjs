import test from 'node:test';
import assert from 'node:assert/strict';
import { createFollowMemo, CreateFollowUpReduction } from '../src/ui/models/IntentFollowUpModel.js';

// SPEC 4.9: a follow-up mark never shows a card's outcome before its own beat. The screen freezes each enemy's
// player-turn symbols on the snapshot before the dispatch; these beats then change the row only when they play.
const unknown = { kind: 'unknown' };
const snapshot = () => ({ ents: { e1: { followUps: [unknown, unknown] }, e2: { followUps: [unknown] } }, followPlans: {} });
const reduce = (disp, ...events) => CreateFollowUpReduction(createFollowMemo())(events, disp, {});

test('a player-turn snapshot row survives beats that are not about the follow-ups', () => {
  const disp = snapshot();
  reduce(disp, { type: 'damageDealt', targetId: 'e1', amount: 4 }, { type: 'statusApplied', targetId: 'e1' });
  assert.deepEqual(disp.ents.e1.followUps, [unknown, unknown]);
  assert.deepEqual(disp.ents.e2.followUps, [unknown]);
});

test('enemyStaggered clears the snapshot row of that enemy only, even with no memo row', () => {
  const disp = snapshot();
  reduce(disp, { type: 'enemyStaggered', targetId: 'e1' });
  assert.deepEqual(disp.ents.e1.followUps, []);
  assert.deepEqual(disp.ents.e2.followUps, [unknown]);
});

test('enemyPlanTrimmed shortens the snapshot row by the dropped moves', () => {
  const disp = snapshot();
  reduce(disp, { type: 'enemyPlanTrimmed', sourceId: 'e1', dropped: ['m2'] });
  assert.deepEqual(disp.ents.e1.followUps, [unknown]);
  assert.deepEqual(disp.ents.e2.followUps, [unknown]);
});

// End Turn: every enemy's row is seeded, and an enemy that has not acted yet keeps its row through the others' beats.
test('End Turn: enemy 2 keeps its seeded row while enemy 1 acts, then advances from its own beats', () => {
  const plan = (id) => ({ ids: ['m1', 'm2'], def: null, enemyId: id, combat: null, offset: 0, total: 2, cursor: 0, headDone: false });
  const disp = { ents: { e1: { followUps: [unknown, unknown] }, e2: { followUps: [unknown, unknown] } }, followPlans: { e1: plan('e1'), e2: plan('e2') } };
  const memo = createFollowMemo();
  const reduceRows = CreateFollowUpReduction(memo);
  reduceRows([{ type: 'enemyActorTurnStarted', sourceId: 'e1' }, { type: 'enemyMoveStarted', sourceId: 'e1' }, { type: 'enemyMoveStarted', sourceId: 'e1' }], disp, {});
  assert.equal(disp.ents.e1.followUps.length, 1, 'enemy 1 consumed one slot');
  assert.deepEqual(disp.ents.e2.followUps, [unknown, unknown], 'enemy 2 has not acted: its row is intact');
  reduceRows([{ type: 'enemyActorTurnStarted', sourceId: 'e2' }], disp, {});
  assert.deepEqual(disp.ents.e2.followUps, [unknown, unknown], 'the actor-turn start does not blink the seeded row out');
  reduceRows([{ type: 'enemyMoveStarted', sourceId: 'e2' }], disp, {});
  assert.deepEqual(disp.ents.e2.followUps, [unknown, unknown], 'the head move owns no slot: the row is the same two marks');
  reduceRows([{ type: 'enemyMoveStarted', sourceId: 'e2' }], disp, {});
  assert.equal(disp.ents.e2.followUps.length, 1);
});

test('End Turn: a stagger on the waiting enemy clears its seeded row, and the turn end clears every row', () => {
  const disp = snapshot();
  const reduceRows = reduce.bind(null, disp);
  reduceRows({ type: 'enemyStaggered', targetId: 'e2' });
  assert.deepEqual(disp.ents.e2.followUps, []);
  assert.deepEqual(disp.ents.e1.followUps, [unknown, unknown]);
  reduceRows({ type: 'enemyTurnEnd' });
  assert.deepEqual(disp.ents.e1.followUps, []);
});
