// W25-R: an event can raise a card's rank. The Sleeping Smith's new choice pays 80 cinders only when a card rises.
import { FillUpgradeSlots } from './helpers/rank-up-ready.mjs';
import { OwnCardRank } from '../src/model/cardRank.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { executeAction } from '../src/engine/actions.js';
import { InstanceRank, RankUpCandidates } from '../src/model/rankUpService.js';
import { choiceAffordable, ChoiceUnmetRequirement, commitEventChoice } from '../src/engine/quests.js';
import { eventChoicesWithHistory } from '../src/content/events.js';
import { UpgradeSlots } from '../src/model/cardUpgradeLimits.js';

// Owner 2026-11-23: rank-up needs a fully upgraded card (on by default), so these runs start with every slot used.
const newRun = () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  FillUpgradeSlots(run);
  return run;
};
const effect = { op: 'rankUpCard', random: true, cost: 40 };
const play = (run, picked = null, seen = []) => executeAction({ registries, run, emit: () => {},
  rng: { float: () => 0.5, pick: (_stream, list) => { seen.push(...list); return picked ? list.find(card => card.instanceId === picked.instanceId) : list[0]; } } }, { effect });

test('Sleeping Smith offers the rank-up as one more choice, with its own id and a cinder requirement', () => {
  const smith = registries.events.get('sleepingSmith');
  const choice = smith.choices.find(row => row.effects.some(e => e.op === 'rankUpCard'));
  assert.ok(choice, 'the choice exists');
  assert.deepEqual(choice.requires, { cinders: 80, rankableCard: true });
  assert.equal(smith.choices.length, 4);
});

test('the event raises the picked card one rank, opens a slot, and takes its cinders once', () => {
  const run = newRun(); run.cinders = 100;
  const card = RankUpCandidates(registries, run)[0];
  card.rank = 1; // a "Rank 1" card: slots are rank + 1, so each raise opens one
  FillUpgradeSlots(run, [card]);
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

const smithChoice = () => eventChoicesWithHistory(registries.events.get('sleepingSmith')).find(row => row.effects.some(e => e.op === 'rankUpCard'));

test('with no card able to rise the choice is unavailable, keeps the cinders and does not use the event up', () => {
  const run = newRun(); run.cinders = 100;
  run.gameProfile.modules.progression.cardRanks = false;
  const choice = smithChoice();
  assert.equal(choiceAffordable(choice, run, registries), false);
  assert.equal(ChoiceUnmetRequirement(choice, run, registries), 'rankableCard');
  const historyBefore = JSON.stringify(run.history);
  assert.throws(() => commitEventChoice({ run, registries, rng: { float: () => 0.5, pick: (_s, l) => l[0] } }, { eventId: 'sleepingSmith', choiceId: choice.id }));
  assert.equal(run.cinders, 100);
  assert.equal(JSON.stringify(run.history), historyBefore);
});

test('with a candidate and the cinders the choice is open and commits: rank rises, 80 paid (owner 2026-11-23: doubled)', () => {
  const run = newRun(); run.cinders = 100;
  const choice = smithChoice();
  assert.equal(choiceAffordable(choice, run, registries), true);
  const ranks = run.deck.map(card => OwnCardRank(card));
  commitEventChoice({ run, registries, rng: { float: () => 0.5, pick: (_s, l) => l[0] } }, { eventId: 'sleepingSmith', choiceId: choice.id });
  assert.equal(run.cinders, 20);
  assert.equal(run.deck.reduce((n, card, i) => n + OwnCardRank(card) - ranks[i], 0), 1);
  assert.equal(ChoiceUnmetRequirement(choice, { ...run, cinders: 10 }, registries), 'cinders');
});
