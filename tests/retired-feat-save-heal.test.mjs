// Crit feats retired 2026-11-20 (owner: crits and Precision are gone from Core). A run saved by an older
// build while a class milestone offered one still names it in run.classMilestoneOffers and in the pending
// reward row; loadRun drops it (and its paired choice entries) before the reference check, so the save is
// not archived. Falsify: remove the dropRetiredFeatOptions call from loadRun and the reference check reports
// "class milestone feat 'reaverKeenBlade' is unknown".
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { RETIRED_FEAT_IDS, dropRetiredFeatOptions } from '../src/engine/save.js';

const registries = createRegistries(contentBundle);
const known = id => registries.classSkillFeats.some(feat => feat.id === id);
const offer = (options, receiptId) => ({ receiptId, classId: 'reaver', skillId: 'class:reaver', level: 1, requiredLevel: 1,
  rewardKind: 'feat', options, choiceIds: options.map((id, i) => `${receiptId}:${i}:${id}`), abilityRanks: options.map(() => 1) });

test('every retired feat id is gone from content and every kept feat still resolves', () => {
  for (const id of RETIRED_FEAT_IDS) assert.equal(known(id), false, id);
  assert.ok(known('reaverIronFooting'));
});

test('a saved feat offer keeps its live options, and the offer and pending row stay identical', () => {
  const live = offer(['reaverIronFooting', 'reaverKeenBlade', 'reaverBloodDiscipline'], 'class:reaver:1:feat');
  const run = { classMilestoneOffers: { [live.receiptId]: structuredClone(live) },
    pendingReward: { rewards: { classMilestoneRewards: [structuredClone(live)] } } };
  dropRetiredFeatOptions(run);
  const kept = run.classMilestoneOffers[live.receiptId], row = run.pendingReward.rewards.classMilestoneRewards[0];
  assert.deepEqual(kept.options, ['reaverIronFooting']);
  assert.deepEqual(kept.choiceIds, [live.choiceIds[0]], 'paired choice ids follow their option');
  assert.deepEqual(kept.abilityRanks, [1]);
  assert.deepEqual(row, kept, 'the pending row still matches its offer, which the run validator requires');
  assert.ok(row.options.every(known));
});

test('a row left with no live option is removed; its offer is kept as saved', () => {
  const dead = offer(['reaverMasteryFocus'], 'class:reaver:8:feat');
  const cards = { receiptId: 'class:reaver:2:cards', rewardKind: 'cards', options: ['strike'] };
  const run = { classMilestoneOffers: { [dead.receiptId]: structuredClone(dead) },
    pendingReward: { rewards: { classMilestoneRewards: [structuredClone(dead), cards] } } };
  dropRetiredFeatOptions(run);
  assert.deepEqual(run.classMilestoneOffers[dead.receiptId], dead, 'no row reads it, and deleting it could orphan its grant');
  assert.deepEqual(run.pendingReward.rewards.classMilestoneRewards, [cards], 'non-feat rows are untouched');
});

test('an offer whose grant was already taken is never touched, even with a retired option in it', () => {
  const taken = offer(['reaverIronFooting', 'reaverKeenBlade'], 'class:reaver:1:feat');
  const run = { classMilestoneOffers: { [taken.receiptId]: structuredClone(taken) },
    classMilestones: { 'class:reaver:1': { grants: { feat: { id: taken.receiptId, state: 'taken', selection: { id: 'reaverKeenBlade' } } } } } };
  dropRetiredFeatOptions(run);
  assert.deepEqual(run.classMilestoneOffers[taken.receiptId], taken, 'classMilestoneProblems needs the taken selection to stay in offer.options');
});

test('healing is idempotent: a healed save loads the same the second time', () => {
  const live = offer(['reaverIronFooting', 'reaverKeenBlade'], 'class:reaver:1:feat');
  const run = { classMilestoneOffers: { [live.receiptId]: structuredClone(live) },
    pendingReward: { rewards: { classMilestoneRewards: [structuredClone(live)] } } };
  dropRetiredFeatOptions(run);
  const once = structuredClone(run);
  dropRetiredFeatOptions(run);
  assert.deepEqual(run, once);
});

test('an unknown feat id that was never retired is left for the reference check to refuse', () => {
  const odd = offer(['notARealFeat'], 'class:reaver:1:feat');
  const run = { classMilestoneOffers: { [odd.receiptId]: structuredClone(odd) },
    pendingReward: { rewards: { classMilestoneRewards: [structuredClone(odd)] } } };
  dropRetiredFeatOptions(run);
  assert.deepEqual(run.pendingReward.rewards.classMilestoneRewards[0].options, ['notARealFeat']);
});
