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
