// cloneRun (src/model/runClone.js) is structuredClone(run) minus the copying
// of the run's pinned game profiles, and must stay indistinguishable from it
// everywhere a caller can look except that identity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneRun } from '../src/model/runClone.js';
import { persistRewardChange } from '../src/model/rewardTransaction.js';

const profile = () => ({ id: 'p', hash: 'sha256:x', modules: { cards: { list: [{ id: 'a' }, { id: 'b' }] } }, foundation: { mode: 'configured' } });
const makeRun = extra => ({ seed: 1, hp: 10, deck: [{ id: 'd1' }], gameProfile: profile(), mapNodeId: null, ...extra });

test('a clone equals structuredClone in content and key order, and shares the profile', () => {
  const run = makeRun({ combatEntered: { nodeId: 'n', encounterId: 'e', snapshot: { turn: 1, gameProfile: profile(), player: { hp: 3 } } } });
  const plain = structuredClone(run), copy = cloneRun(run);
  assert.deepEqual(copy, plain);
  assert.equal(JSON.stringify(copy), JSON.stringify(plain), 'same bytes, so the same save');
  assert.equal(copy.gameProfile, run.gameProfile, 'run profile shared');
  assert.equal(copy.combatEntered.snapshot.gameProfile, run.combatEntered.snapshot.gameProfile, 'snapshot profile shared');
  assert.ok(Object.isFrozen(copy.gameProfile) && Object.isFrozen(copy.gameProfile.modules.cards.list[0]), 'shared profile is deeply frozen');
});

test('everything but the profile is an independent copy', () => {
  const run = makeRun({ combatEntered: { nodeId: 'n', snapshot: { turn: 1, gameProfile: profile(), player: { hp: 3 } } } });
  const copy = cloneRun(run);
  for (const key of ['deck', 'combatEntered']) assert.notEqual(copy[key], run[key]);
  assert.notEqual(copy.combatEntered.snapshot.player, run.combatEntered.snapshot.player);
  copy.deck.push({ id: 'd2' }); copy.combatEntered.snapshot.player.hp = 0; copy.hp = 1;
  assert.deepEqual(run.deck, [{ id: 'd1' }]); assert.equal(run.combatEntered.snapshot.player.hp, 3); assert.equal(run.hp, 10);
  assert.throws(() => { copy.gameProfile.modules.cards.list.push({}); }, TypeError, 'the shared profile cannot be edited through a copy');
});

test('a run whose other fields alias the profile gets the full clone', () => {
  const run = makeRun();
  run.cardRows = run.gameProfile.modules.cards.list; // a field aliasing a profile node
  const copy = cloneRun(run);
  assert.notEqual(copy.gameProfile, run.gameProfile, 'profile copied, not shared');
  assert.equal(copy.cardRows, copy.gameProfile.modules.cards.list, 'the alias survives inside the clone');
  assert.deepEqual(copy, structuredClone(run));
});

test('the sharing decision follows the run as it is now', () => {
  const run = makeRun();
  assert.equal(cloneRun(run).gameProfile, run.gameProfile);
  run.cardRows = run.gameProfile.modules.cards;
  assert.notEqual(cloneRun(run).gameProfile, run.gameProfile);
  delete run.cardRows;
  assert.equal(cloneRun(run).gameProfile, run.gameProfile);
});

test('runs without a pinnable profile are cloned as before', () => {
  for (const run of [{ hp: 1 }, { hp: 1, gameProfile: null }, { hp: 1, gameProfile: { weird: new Date(0) } }, { hp: 1, gameProfile: { n: NaN } }]) {
    const copy = cloneRun(run);
    assert.deepEqual(copy, structuredClone(run));
    if (run.gameProfile) assert.notEqual(copy.gameProfile, run.gameProfile);
  }
  assert.equal(cloneRun(null), null);
});

test('a reward claim that throws rolls the run back through the shared-profile clone', () => {
  const run = makeRun({ gameProfileRewardOffers: { o1: { taken: false } } });
  const profileRef = run.gameProfile;
  assert.throws(() => persistRewardChange(run, 'o1', () => { run.hp = 99; run.deck.push({ id: 'x' }); run.gameProfileRewardOffers.o1.taken = true; throw new Error('refused'); }, () => {}), /refused/);
  assert.equal(run.hp, 10); assert.deepEqual(run.deck, [{ id: 'd1' }]); assert.equal(run.gameProfileRewardOffers.o1.taken, false);
  assert.equal(run.gameProfile, profileRef);
});
