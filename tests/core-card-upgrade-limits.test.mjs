// Card upgrades 6/7: the free allowance, the stone cost, the 10-upgrade cap and canUpgrade.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { freeAllowance, upgradeCost, canUpgrade, upgradeBasic } from '../src/model/cardUpgradeLimits.js';
import { rollUpgradeStep, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { basicCardKind } from '../src/model/basicCardRule.js';
import { cardTrackLevel } from '../src/model/skills.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const def = (id) => registries.cards.get(id);
// A card rich enough to take ten rolled upgrades, and a helper that grows real steps on it.
const rich = { id: 't.rich', name: 'Rich', type: 'attack', rarity: 'common', cost: 3, staminaCost: 3, manaCost: 4, keywords: [], tags: ['camp:physical'],
  effects: [{ op: 'damage', target: 'enemy', amount: 40 }, { op: 'block', target: 'self', amount: 40 }, { op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 1 }] };
const steps = (n, card = rich) => { const out = []; while (out.length < n) out.push(rollUpgradeStep(card, out, out.length, upgradeStepRng(5, 'rich', out.length))); return out; };
const owned = (n) => ({ instanceId: 'rich', cardId: 't.rich', upgraded: n > 0, ...(n ? { upgradeSteps: steps(n) } : {}) });
const inst = (cardId, count) => ({ instanceId: `i-${cardId}`, cardId, ...(count ? { upgraded: true, upgradeSteps: steps(count) } : {}) });
// A ranked card carrying the blade school: not Basic, so it earns 1 + R.
const blade = { id: 't.blade', name: 'Bladework', type: 'attack', rank: 1, tags: ['blade'] };

test('upgradeBasic: common non-spells and cantrips only', () => {
  for (const id of ['core.strike', 'core.hammerBlow', 'core.cinderDart', 'core.cantrip', 'core.mendingTouch']) assert.equal(upgradeBasic(def(id)), true, id);
  for (const id of ['core.stunningBlow', 'core.ironbreaker', 'core.cometLance', 'core.starfall', 'core.reaverSpecial', 'core.starseerSpecial', 'core.manaSurge']) assert.equal(upgradeBasic(def(id)), false, id);
  // The Adept rule is untouched: it still calls a martial uncommon Basic.
  assert.equal(basicCardKind(newRun(), def('core.stunningBlow')), 'Basic');
});

test('F is 1 for Basic and cantrips; 1 + R for every other card', () => {
  const run = newRun();
  run.skills = { 'item:blade': { level: 4, xp: 0 } };
  assert.equal(cardTrackLevel(registries, run, blade), 4);
  assert.equal(freeAllowance(run, blade, registries), 5);
  for (const id of ['core.strike', 'core.hammerBlow', 'core.cinderDart']) assert.equal(freeAllowance(run, def(id), registries), 1, id);
  run.skills['item:blade'].level = 10;
  assert.equal(freeAllowance(run, blade, registries), 11);
  assert.equal(freeAllowance(run, { ...blade, tags: ['unrelated'] }, registries), 1, 'a track whose schools do not match gives R = 0');
  run.skills['item:blade'].level = 0;
  assert.equal(freeAllowance(run, blade, registries), 1);
});

test('R is the highest matching track, not the sum', () => {
  const run = newRun();
  run.skills = { 'item:blade': { level: 3 }, 'item:other': { level: 9 } };
  assert.equal(cardTrackLevel(registries, run, blade), 3);
});

test('a Basic card: first upgrade free, second 1 stone, up to the cap of 10 then null', () => {
  const run = newRun();
  const costs = Array.from({ length: 11 }, (_, count) => upgradeCost(run, owned(count), rich, registries));
  assert.deepEqual(costs, [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, null]);
});

test('upgrade number n is free while n <= F, then 1 stone', () => {
  const run = newRun();
  run.skills = { 'item:blade': { level: 2 } };
  const notBasic = { ...rich, rarity: 'uncommon' };
  const costs = Array.from({ length: 11 }, (_, count) => upgradeCost(run, { ...owned(count) }, notBasic, registries));
  assert.deepEqual(costs, [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, null]);
});

test('a card with no eligible step left is maxed: null cost, refused as maxed', () => {
  const run = newRun(); run.smithingStones = 9;
  const maxed = { instanceId: 'm', cardId: 'core.strike', upgraded: true, upgradeSteps: [] };
  const strike = registries.cards.get('core.strike');
  while (true) { const s = rollUpgradeStep(strike, maxed.upgradeSteps, maxed.upgradeSteps.length, upgradeStepRng(run.seed, 'm', maxed.upgradeSteps.length)); if (!s) break; maxed.upgradeSteps.push(s); }
  assert.ok(maxed.upgradeSteps.length < 10);
  assert.equal(upgradeCost(run, maxed, strike, registries), null);
  const verdict = canUpgrade(registries, run, maxed);
  assert.deepEqual([verdict.ok, verdict.code], [false, 'maxed']);
});

test('an old upgraded:true instance with no list counts as one upgrade', () => {
  const run = newRun();
  assert.equal(upgradeCost(run, { cardId: 'core.strike', upgraded: true }, def('core.strike'), registries), 1);
});

test('canUpgrade: free, paid, short of stones, armament-owned, capped and missing', () => {
  const run = newRun();
  run.smithingStones = 0;
  const free = canUpgrade(registries, run, inst('core.strike', 0));
  assert.deepEqual([free.ok, free.cost, free.free, free.n], [true, 0, true, 1]);
  const short = canUpgrade(registries, run, inst('core.strike', 1));
  assert.deepEqual([short.ok, short.code, short.cost], [false, 'stones', 1]);
  run.smithingStones = 1;
  const paid = canUpgrade(registries, run, inst('core.strike', 1));
  assert.deepEqual([paid.ok, paid.cost, paid.free, paid.n], [true, 1, false, 2]);
  assert.equal(canUpgrade(registries, run, inst('core.strike', 10)).code, 'cap');
  assert.equal(canUpgrade(registries, run, { ...inst('core.strike', 0), sourceArmamentId: 'x' }).code, 'armament');
  assert.equal(canUpgrade(registries, run, { ...inst('core.strike', 0), grantedBy: 'x' }).code, 'armament');
  assert.equal(canUpgrade(registries, run, { instanceId: 'z', cardId: 'no.such' }).code, 'missing');
});
