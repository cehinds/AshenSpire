// Card upgrades 7/7: plan (inert, deterministic) and commit (re-plans, refuses a stale quote, spends, appends).
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { planCardUpgrade, commitCardUpgrade } from '../src/model/cardUpgradeService.js';
import { upgradeCount, upgradeStepsOf } from '../src/model/cardUpgrade.js';
import { projectGameCard } from '../src/model/gameProfile.js';

const newRun = (seed = 511) => createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const strikeOf = (run) => run.deck.find((c) => c.cardId === 'core.strike');
const damage = (def) => def.effects.find((e) => e.op === 'damage').amount;

test('plan is inert: it changes nothing and a repeat returns the same quote', () => {
  const run = newRun(); run.smithingStones = 3;
  const before = JSON.stringify(run);
  const a = planCardUpgrade(run, registries, strikeOf(run).instanceId);
  const b = planCardUpgrade(run, registries, strikeOf(run).instanceId);
  assert.equal(JSON.stringify(run), before);
  assert.deepEqual(a, b);
  assert.deepEqual([a.ok, a.n, a.cost, a.free], [true, 1, 0, true]);
  assert.ok(a.step && a.before && a.after);
  assert.equal(a.before.name, 'Strike');
  assert.equal(a.after.upgraded, true);
});

test('the same seed gives the same step; another run seed can differ', () => {
  const steps = new Set();
  for (let seed = 1; seed <= 40; seed += 1) {
    const run = newRun(seed);
    const quote = planCardUpgrade(run, registries, strikeOf(run).instanceId);
    assert.deepEqual(quote.step, planCardUpgrade(newRun(seed), registries, strikeOf(run).instanceId).step);
    steps.add(JSON.stringify(quote.step));
  }
  assert.ok(steps.size > 1, 'the roll varies with the seed');
});

test('commit equals the preview: stones spent, step appended, face matches the quote', () => {
  const run = newRun(); run.smithingStones = 2;
  const card = strikeOf(run);
  const quote = planCardUpgrade(run, registries, card.instanceId);
  const receipt = commitCardUpgrade(run, registries, quote);
  assert.deepEqual(receipt, { instanceId: card.instanceId, step: quote.step, n: 1, spentStones: 0 });
  assert.equal(run.smithingStones, 2, 'the first upgrade is free');
  assert.equal(card.upgraded, true);
  assert.deepEqual(card.upgradeSteps, [quote.step]);
  assert.deepEqual(JSON.parse(JSON.stringify(projectGameCard(run, card))), JSON.parse(JSON.stringify(quote.after)));
  // The second upgrade costs a stone and plans from the first step.
  const second = planCardUpgrade(run, registries, card.instanceId);
  assert.deepEqual([second.n, second.cost, second.free], [2, 1, false]);
  commitCardUpgrade(run, registries, second);
  assert.equal(run.smithingStones, 1);
  assert.equal(upgradeCount(card), 2);
  assert.deepEqual(card.upgradeSteps[0], quote.step);
  assert.equal(projectGameCard(run, card).name, 'Strike+2');
});

test('a stale quote is refused and changes nothing', () => {
  const run = newRun(); run.smithingStones = 2;
  const card = strikeOf(run);
  const quote = planCardUpgrade(run, registries, card.instanceId);
  commitCardUpgrade(run, registries, quote); // the card is now at 1 upgrade: the old quote is stale
  const snapshot = JSON.stringify(run);
  assert.throws(() => commitCardUpgrade(run, registries, quote), /out of date/);
  assert.equal(JSON.stringify(run), snapshot);
  const fresh = planCardUpgrade(run, registries, card.instanceId);
  assert.throws(() => commitCardUpgrade(run, registries, { ...fresh, step: { k: 'dmg', n: 99 } }), /out of date/);
  assert.throws(() => commitCardUpgrade(run, registries, { ...fresh, cost: 0 }), /out of date/);
  assert.equal(JSON.stringify(run), snapshot);
});

test('short of stones: the plan still previews, the commit refuses and spends nothing', () => {
  const run = newRun(); run.smithingStones = 0;
  const card = strikeOf(run);
  commitCardUpgrade(run, registries, planCardUpgrade(run, registries, card.instanceId));
  const quote = planCardUpgrade(run, registries, card.instanceId);
  assert.deepEqual([quote.ok, quote.code, quote.cost], [false, 'stones', 1]);
  assert.ok(quote.step && quote.after, 'a preview is still offered');
  assert.throws(() => commitCardUpgrade(run, registries, quote), /Smithing Stone/);
  assert.equal(run.smithingStones, 0);
  assert.equal(upgradeCount(card), 1);
});

test('the 10-upgrade cap: ten commits, then a refusal', () => {
  const run = newRun(); run.smithingStones = 50;
  const card = strikeOf(run);
  for (let i = 1; i <= 10; i += 1) assert.equal(commitCardUpgrade(run, registries, planCardUpgrade(run, registries, card.instanceId)).n, i);
  assert.equal(run.smithingStones, 50 - 9);
  const capped = planCardUpgrade(run, registries, card.instanceId);
  assert.deepEqual([capped.ok, capped.code, capped.step], [false, 'cap', null]);
  assert.throws(() => commitCardUpgrade(run, registries, capped), /10 upgrades/);
  assert.equal(upgradeStepsOf(card).length, 10);
  assert.equal(projectGameCard(run, card).name, 'Strike+10');
});

test('unknown, armament-owned and sideboard cards', () => {
  const run = newRun();
  assert.equal(planCardUpgrade(run, registries, 'nope').code, 'missing');
  assert.throws(() => commitCardUpgrade(run, registries, planCardUpgrade(run, registries, 'nope')));
  const bound = run.deck.find((c) => c.grantedBy || c.sourceArmamentId);
  if (bound) assert.equal(planCardUpgrade(run, registries, bound.instanceId).code, 'armament');
  const spare = { instanceId: 'side-1', cardId: 'core.strike', upgraded: false };
  run.sideboard = [spare];
  assert.equal(planCardUpgrade(run, registries, 'side-1').ok, true);
});

test('a card with an authored upgrade takes it as step 1; one without rolls', () => {
  const run = newRun();
  const pommel = { instanceId: 'p', cardId: 'core.pommelStrike', upgraded: false };
  run.deck.push(pommel);
  assert.deepEqual(planCardUpgrade(run, registries, 'p').step, { k: 'authored' });
  const bare = registries.cards.get('core.defend');
  assert.equal(!!bare.upgrade, false);
  const defend = run.deck.find((c) => c.cardId === 'core.defend');
  assert.notEqual(planCardUpgrade(run, registries, defend.instanceId).step.k, 'authored');
  assert.equal(damage(planCardUpgrade(run, registries, 'p').after) > damage(planCardUpgrade(run, registries, 'p').before), true);
});
