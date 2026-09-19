import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardPlan, rewardClaimStatus } from '../src/model/rewardplan.js';

const offer = { cinders: 40, cardIds: ['frostNova', 'starstoneArc', 'scholarsInsight'], flaskId: 'healing', relicId: 'whetstoneFragment' };

test('a fresh offer is all available, with the card choice still required', () => {
  const plan = rewardPlan(offer, { flaskSlotsFree: 1, armamentSlotsFree: 1 });
  const claim = rewardClaimStatus(plan);
  assert.deepEqual(claim.rows.map((r) => [r.kind, r.state]), [['cinders', 'available'], ['card', 'available'], ['flask', 'available'], ['relic', 'available']]);
  assert.deepEqual([claim.total, claim.claimed, claim.available, claim.skipped, claim.blocked], [4, 0, 4, 0, 0]);
  assert.deepEqual(claim.requiredChoice, { kind: 'card', key: 'card', count: 3 });
  assert.ok(Object.isFrozen(claim) && Object.isFrozen(claim.rows[0]));
});

test('claims, skips and blocked rows are counted separately', () => {
  const plan = rewardPlan(offer, { flaskSlotsFree: 0, armamentSlotsFree: 1 });
  const claim = rewardClaimStatus(plan, { cinders: 'taken', relic: 'skipped' });
  assert.deepEqual(claim.rows.map((r) => r.state), ['taken', 'available', 'blocked', 'skipped']);
  assert.deepEqual([claim.claimed, claim.available, claim.blocked, claim.skipped], [1, 1, 1, 1]);
});

test('a skill draft is a keyed choice row ahead of the card offer (plan phase 4b)', () => {
  const plan = rewardPlan({ ...offer, skillDrafts: [{ skillId: 'item:blade', level: 2, cardIds: ['quickCut', 'lowBlow', 'cheapShot'] }] }, { flaskSlotsFree: 1 });
  assert.deepEqual(plan.rows.map((r) => r.key), ['cinders', 'skillDraft:item:blade:0', 'card', 'flask', 'relic']);
  const claim = rewardClaimStatus(plan);
  assert.deepEqual(claim.requiredChoice, { kind: 'skillDraft', key: 'skillDraft:item:blade:0', count: 3 }, 'the draft is the first choice waiting');
  assert.deepEqual(rewardClaimStatus(plan, { 'skillDraft:item:blade:0': 'taken' }).requiredChoice, { kind: 'card', key: 'card', count: 3 }, 'then the card offer');
  assert.equal(rewardClaimStatus(plan, { 'skillDraft:item:blade:0': 'taken', card: 'skipped' }).requiredChoice, null);
});

test('no required choice once the card is taken, or when only one card is offered', () => {
  const plan = rewardPlan(offer, { flaskSlotsFree: 1 });
  assert.equal(rewardClaimStatus(plan, { card: 'taken' }).requiredChoice, null);
  assert.equal(rewardClaimStatus(rewardPlan({ cardIds: ['frostNova'] })).requiredChoice, null);
  assert.equal(rewardClaimStatus(rewardPlan({})).total, 0);
});
