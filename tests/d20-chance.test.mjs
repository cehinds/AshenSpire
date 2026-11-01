import test from 'node:test';
import assert from 'node:assert/strict';
import { chanceToD20Target, chanceToD20Steps, d20ModeChance, effectiveD20Percent, rollD20Check } from '../src/engine/d20Chance.js';

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
  assert.ok(Math.abs(d20ModeChance(32, { advantage: true }) - 51) < 1e-9);
  assert.ok(Math.abs(d20ModeChance(32, { disadvantage: true }) - 9) < 1e-9);
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
  const adv = critRollReceipt({ roll: 15, rolls: [15, 4], mode: 'advantage', target: chanceToD20Target(32), chance: 32, effectiveChance: 53.76, success: true });
  assert.equal(adv.dcParts[0].value, 30);
  assert.equal(adv.chance, 51);
});

test('a status roll draws the same dice as before; the advantage figure is worked from the rolled chance in the receipt', async () => {
  const { rollStatusChance } = await import('../src/engine/combatStatusControl.js');
  const { critRollReceipt } = await import('../src/model/rollReceipts.js');
  const rng = seq(4, 17);
  const receipt = rollStatusChance({ rng, emit() {} }, 32, { advantage: true });
  assert.deepEqual([receipt.roll, receipt.target, receipt.chance], [17, 15, 32]);
  assert.equal(receipt.success, true);
  assert.deepEqual(rng.calls, [['statusRecovery', 1, 20], ['statusRecovery', 1, 20]]);
  // 32% rolls as 30%; with advantage it succeeds 1 - 0.7^2 = 51% of the time, not the raw 53.76%.
  const shown = critRollReceipt({ ...receipt, roll: receipt.roll, rolls: receipt.rolls, mode: receipt.mode, chance: 32, success: receipt.success });
  assert.equal(shown.chance, 51);
  assert.equal(shown.dcParts[0].value, 30);
});

test('a distance avoidance preview keeps the authored base; the receipt shows the 5% step it rolls', async () => {
  const { distancePreview, resolveAvoidance } = await import('../src/engine/combatAvoidance.js');
  const { distanceRollReceipt } = await import('../src/model/rollReceipts.js');
  const ctx = { combatExpansionRules: { matchups: { distance: { rangedChance: 32, reachChance: 22, maximumBaseChance: 50 } } } };
  const entity = { combatStance: { maneuver: 'ranged', range: 'ranged' } };
  const melee = { range: 'melee' };
  const shown = distancePreview(ctx, entity, melee);
  assert.equal(shown.eligible, true);
  assert.equal(shown.baseChance, 32);
  assert.equal(distancePreview({ combatExpansionRules: { matchups: { distance: { rangedChance: 0, reachChance: 0, maximumBaseChance: 50 } } } }, entity, melee).eligible, false);
  // Receipt: 32% is shown as the 30% it rolls (target 15).
  const receipt = distanceRollReceipt({ dice: [15], roll: 15, target: chanceToD20Target(32), chance: 32 });
  assert.equal(receipt.dcParts[0].value, 30);
});

test('an avoidance event payload keeps the authored distance chance (reachChance 22 stays 22, not 20)', async () => {
  const { resolveAvoidance } = await import('../src/engine/combatAvoidance.js');
  const ctx = { rng: seq(10), combatExpansionRules: { matchups: {
    distance: { rangedChance: 0, reachChance: 22, maximumBaseChance: 50 },
    evade: { baseDC: 10, die: 20, armorPenalty: { light: 0 }, areaDifficulty: {} } } } };
  const target = { id: 'player', combatStance: { maneuver: 'ranged', range: 'reach' }, statuses: {} };
  const outcome = resolveAvoidance(ctx, { id: 'e1' }, target, { range: 'melee' }, 5);
  assert.equal(outcome.distance.chance, 22, 'payload keeps the authored chance');
  assert.equal(outcome.chance, 22, 'the combined payload chance keeps it too');
  assert.equal(outcome.distance.target, chanceToD20Target(22), 'the roll still meets the 5% step');
  assert.equal(outcome.distance.success, false);
  assert.equal(outcome.distance.target, 17);
});

test('the Crit chance row shows the 5% step the crit d20 rolls', async () => {
  const { combatStatRows } = await import('../src/ui/models/CombatantStatRows.js');
  const text = key => key;
  const rules = [{ tags: ['strike'], base: 0.32, cap: 1, multiplier: 2 }];
  const row = combatStatRows({ kind: 'player', critRules: rules, attributes: {}, attackTagSets: [['strike']] }, text).find(r => r.tipId === 'critChance');
  assert.equal(row.value, '30%');
});

test('an authored buildup chance on a card reads the 5% step it rolls', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { applyCombatExpansionCard } = await import('../src/content/combatExpansionCards.js');
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const reg = createRegistries(contentBundle);
  const card = applyCombatExpansionCard(reg.cards.get('cinderSigil'));
  // Author the same buildup chance at 33%: the face must read the 35% the d20 rolls.
  const authored = JSON.parse(JSON.stringify(card), (key, value) => key === 'chance' && typeof value === 'number' ? 33 : value);
  const detail = (cardFaceLines(authored, null, reg) || []).map(line => line.html.replace(/<[^>]+>/g, ''));
  assert.ok(detail.some(line => /35% chance$/.test(line)), JSON.stringify(detail));
  assert.ok(!detail.some(line => /33% chance/.test(line)), JSON.stringify(detail));
});
