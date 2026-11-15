// W25-R: an event can raise a card's rank. The Sleeping Smith's new choice pays 40 cinders only when a card rises.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { executeAction } from '../src/engine/actions.js';
import { InstanceRank, RankUpCandidates } from '../src/model/rankUpService.js';
import { UpgradeSlots } from '../src/model/cardUpgradeLimits.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const effect = { op: 'rankUpCard', random: true, cost: 40 };
const play = (run, picked = null, seen = []) => executeAction({ registries, run, emit: () => {},
  rng: { float: () => 0.5, pick: (_stream, list) => { seen.push(...list); return picked ? list.find(card => card.instanceId === picked.instanceId) : list[0]; } } }, { effect });

test('Sleeping Smith offers the rank-up as one more choice, with its own id and a cinder requirement', () => {
  const smith = registries.events.get('sleepingSmith');
  const choice = smith.choices.find(row => row.effects.some(e => e.op === 'rankUpCard'));
  assert.ok(choice, 'the choice exists');
  assert.deepEqual(choice.requires, { cinders: 40 });
  assert.equal(smith.choices.length, 4);
});

test('the event raises the picked card one rank, opens a slot, and takes its cinders once', () => {
  const run = newRun(); run.cinders = 100;
  const card = RankUpCandidates(registries, run)[0];
  const rank = InstanceRank(card), slots = UpgradeSlots(run, card);
  play(run, card);
  assert.equal(InstanceRank(card), rank + 1);
  assert.equal(UpgradeSlots(run, card), slots + 1);
  assert.equal(run.cinders, 60);
});

test('only rankable cards are in the pick, and a purse short of the cost changes nothing', () => {
  const run = newRun(); run.cinders = 100;
  const seen = [];
  play(run, null, seen);
  assert.ok(seen.length > 0 && seen.every(card => RankUpCandidates(registries, run).some(row => row.instanceId === card.instanceId)));
  const poor = newRun(); poor.cinders = 39;
  const before = poor.deck.map(card => InstanceRank(card));
  play(poor);
  assert.deepEqual(poor.deck.map(card => InstanceRank(card)), before);
  assert.equal(poor.cinders, 39);
});

test('a run that cannot rank cards keeps its cinders (the cost is paid only when a card rises)', () => {
  const run = newRun(); run.cinders = 100;
  run.gameProfile.modules.progression.cardRanks = false;
  play(run);
  assert.equal(run.cinders, 100);
});
