import test from 'node:test';
import assert from 'node:assert/strict';
import { chanceToD20Target, chanceToD20Steps, effectiveD20Percent, rollD20Check } from '../src/engine/d20Chance.js';

const seq = (...values) => { const calls = []; return { calls, int(stream, lo, hi) { calls.push([stream, lo, hi]); return values.shift(); } }; };

test('percent maps to a d20 target in 5% steps', () => {
  const expected = { 0: 21, 3: 20, 5: 20, 12: 19, 15: 18, 50: 11, 97: 2, 100: 1 };
  for (const [p, t] of Object.entries(expected)) assert.equal(chanceToD20Target(Number(p)), t, `p=${p}`);
  assert.equal(chanceToD20Steps(-5), 0);
  assert.equal(chanceToD20Steps(250), 20);
  assert.equal(chanceToD20Steps(NaN), 0);
});

test('advantage keeps the high die, disadvantage the low die, both cancel', () => {
  const adv = rollD20Check(seq(4, 17), 'misc', 50, { advantage: true });
  assert.deepEqual([adv.roll, adv.rolls, adv.mode], [17, [4, 17], 'advantage']);
  const dis = rollD20Check(seq(4, 17), 'misc', 50, { disadvantage: true });
  assert.deepEqual([dis.roll, dis.mode], [4, 'disadvantage']);
  const rng = seq(9, 20);
  const both = rollD20Check(rng, 'misc', 50, { advantage: true, disadvantage: true });
  assert.deepEqual([both.roll, both.rolls, both.mode], [9, [9], 'normal']);
  assert.equal(rng.calls.length, 1);
  assert.deepEqual(rng.calls[0], ['misc', 1, 20]);
});

test('success is d20 >= target; 100% always succeeds, 0% never does', () => {
  assert.equal(rollD20Check(seq(17), 's', 15).success, false);
  assert.equal(rollD20Check(seq(18), 's', 15).success, true);
  assert.equal(rollD20Check(seq(1), 's', 100).success, true);
  assert.equal(rollD20Check(seq(20), 's', 0).success, false);
});

test('the displayed chance is the rolled chance, in 5% steps', () => {
  assert.equal(effectiveD20Percent(32), 30);
  assert.equal(effectiveD20Percent(33), 35);
  assert.equal(effectiveD20Percent(0), 0);
  assert.equal(effectiveD20Percent(98), 100);
  assert.equal(effectiveD20Percent(250), 100);
  assert.equal(effectiveD20Percent(-4), 0);
  assert.equal(effectiveD20Percent(NaN), 0);
  // The shown percent and the rolled target agree: a 30% check succeeds on 15 or more, exactly 15 faces of 20.
  assert.equal(chanceToD20Target(effectiveD20Percent(32)), 15);
  assert.equal(21 - chanceToD20Target(effectiveD20Percent(32)), effectiveD20Percent(32) / 5);
});

test('a d20 chance receipt shows the rolled 5% chance, not the authored percent', async () => {
  const { critRollReceipt, percentRollReceipt, distanceRollReceipt } = await import('../src/model/rollReceipts.js');
  const crit = critRollReceipt({ roll: 17, rolls: [17], target: chanceToD20Target(32), chance: 32, success: true });
  assert.equal(crit.dcParts[0].value, 30);
  assert.equal(crit.dc, 15);
  assert.equal(crit.chance, undefined);
  const status = percentRollReceipt({ roll: 14, rolls: [14], target: chanceToD20Target(33), chance: 33, success: false }, 'statusChance');
  assert.equal(status.dcParts[0].value, 35);
  assert.equal(status.dc, 14);
  const distance = distanceRollReceipt({ dice: [9], roll: 9, target: chanceToD20Target(32), chance: 32 });
  assert.equal(distance.dcParts[0].value, 30);
  // Advantage: the suffix is the rolled chance with advantage, from the rounded base (30 -> 51%), not the raw 32.
  const adv = critRollReceipt({ roll: 15, rolls: [15, 4], mode: 'advantage', target: chanceToD20Target(32), chance: 32, effectiveChance: 51, success: true });
  assert.equal(adv.dcParts[0].value, 30);
  assert.equal(adv.chance, 51);
});
