// W25 (owner, 2026-11-14) Lightning: a single-target lightning hit also chains to ONE other living enemy for 50% of the hit; breaking Poise adds
// Shock = max(INT, WIS). Shock: +5% lightning damage taken per stack, 5% per stack to lose an action, -1 per turn, at most 10. It replaces the Shocked
// contest for fights with element rules (the contest keeps its own suite for old fights).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { applyStatus, getStacks, decayAtTurnStart } from '../src/engine/statuses.js';
import { ElementTurnStart, ElementSecondaryPlan, ElementPreviewBreak } from '../src/engine/elementIdentity.js';
import { StatusCapsLifted } from '../src/model/fixCoreMechanics.js';

const SPARK = { combatProfile: { camp: 'spell', school: 'lightning', damageType: 'arcane', magicShare: 1 }, tags: ['school:lightning'], magicShare: 1 };
const hit = (combat, target, carrier = SPARK, base = 10) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });
const stage = (receipt, id) => receipt.damageReceipt.hits[0].sources.find(row => row.id === id);

test('the chain goes to the next living enemy in order, for 50% of the hit, and only from a single-target lightning hit', () => {
  const { combat, enemies, player } = fight({ enemies: 3 });
  const plan = ElementSecondaryPlan(combat, player, enemies[0], SPARK);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].target, enemies[1]);
  assert.equal(stage(hit(combat, enemies[1], plan[0].carrier), 'element-chain').multiplier, 0.5);
  assert.equal(hit(combat, enemies[1], plan[0].carrier).raw, 5);
  enemies[1].alive = false;
  assert.equal(ElementSecondaryPlan(combat, player, enemies[0], SPARK)[0].target, enemies[2], 'a dead enemy is skipped');
  assert.deepEqual(ElementSecondaryPlan(combat, player, enemies[0], { ...SPARK, tags: ['school:lightning', 'targeting:area'] }), [], 'an area card has no one left to chain to');
  assert.deepEqual(ElementSecondaryPlan(combat, player, enemies[0], plan[0].carrier), [], 'a chained hit does not chain again');
  enemies[2].alive = false;
  assert.deepEqual(ElementSecondaryPlan(combat, player, enemies[0], SPARK), [], 'a lone enemy has no one to chain to');
});

test('live: Spark hits its target and chains half to another enemy; the quote of each is what it loses; an old fight does not chain', () => {
  const { combat, enemies } = fight({ enemies: 2 });
  const played = play(combat, 'core.spark', enemies[0].id);
  assert.equal(played.lost.e1, played.row.faceValue, 'shown = dealt');
  assert.ok(played.lost.e2 > 0 && played.lost.e2 < played.lost.e1, 'the other enemy took a smaller hit');
  assert.equal(played.lost.e2, Math.floor(played.lost.e1 / 2), 'half of the hit');
  const old = fight({ enemies: 2, legacy: true });
  assert.equal(play(old.combat, 'core.spark', old.enemies[0].id).lost.e2, 0, 'an old snapshot never chains');
});

test('breaking Poise with lightning adds Shock equal to the larger of INT and WIS; no cap on the stacks held (a fight saved before the no-cap rule stops at 10)', () => {
  for (const [attributes, stacks] of [[{ intelligence: 4, wisdom: 2 }, 4], [{ intelligence: 1, wisdom: 6 }, 6], [{ intelligence: 15, wisdom: 1 }, 15]]) {
    const { combat, enemies } = fight({ enemies: 1, poise: 3, attributes });
    play(combat, 'core.spark', enemies[0].id);
    assert.equal(enemies[0].persistentPoise.value, 0);
    assert.equal(getStacks(enemies[0], 'shock'), stacks, JSON.stringify(attributes));
  }
  const old = fight({ enemies: 1, poise: 3, legacy: true });
  play(old.combat, 'core.spark', old.enemy.id);
  assert.equal(getStacks(old.enemy, 'shock'), 0);
  // Legacy twin: element rules but no `statusCaps` key (a fight saved before 2026-11-15) keeps Shock's cap of 10, at the break and in a forecast.
  const capped = fight({ enemies: 1, poise: 3, attributes: { intelligence: 15, wisdom: 1 }, oldCaps: true });
  play(capped.combat, 'core.spark', capped.enemy.id);
  assert.equal(getStacks(capped.enemy, 'shock'), 10);
});

test('Shock held beyond the old cap: further breaks keep adding, and shown = dealt at 30 stacks (+150% lightning damage taken)', () => {
  const { combat, enemies } = fight({ enemies: 1 });
  const target = enemies[0];
  const plain = hit(combat, target, SPARK, 100).hpLoss;
  target.statuses.shock = { stacks: 30 };
  assert.equal(StatusCapsLifted(combat), true);
  assert.equal(stage(hit(combat, target, SPARK, 100), 'element-shock').multiplier, 2.5);
  assert.equal(hit(combat, target, SPARK, 100).hpLoss, Math.floor(plain * 2.5));
  const previewed = ElementPreviewBreak(combat, combat.player, target, 'lightning');
  assert.equal(previewed, 0);
  assert.ok(getStacks(target, 'shock') > 30, 'a previewed break stacks past the old cap too');
});

test('Shock: +5% lightning damage taken per stack, nothing for other elements', () => {
  const { combat, enemies } = fight({ enemies: 1 });
  const target = enemies[0];
  const plain = hit(combat, target, SPARK, 100).hpLoss;
  target.statuses.shock = { stacks: 6 };
  assert.equal(stage(hit(combat, target, SPARK, 100), 'element-shock').multiplier, 1.3);
  assert.equal(hit(combat, target, SPARK, 100).hpLoss, Math.floor(plain * 1.3));
  assert.equal(stage(hit(combat, target, { combatProfile: { camp: 'physical', damageType: 'slashing' } }, 100), 'element-shock'), undefined);
});

test('Shock: 5% per stack to lose the action; an enemy skips its turn, the player starts with 1 less Stamina; one stack wears off per turn', () => {
  const { combat, enemies, player } = fight({ enemies: 1 });
  const enemy = enemies[0];
  enemy.statuses.shock = { stacks: 3 };
  const pcts = [];
  combat.rng.chance = (stream, pct) => { assert.equal(stream, 'elements'); pcts.push(pct); return true; };
  ElementTurnStart(combat, enemy);
  assert.deepEqual(pcts, [15], '5% x 3');
  assert.equal(enemy.skipNextTurn, true, 'its next action is cancelled');
  player.statuses.shock = { stacks: 1 };
  ElementTurnStart(combat, player);
  assert.equal(player.pendingActionLoss, 1, 'the next turn starts with 1 less Stamina');
  combat.rng.chance = () => false;
  enemy.skipNextTurn = false;
  ElementTurnStart(combat, enemy);
  assert.equal(enemy.skipNextTurn, false, 'a passed roll keeps the action');
  decayAtTurnStart(combat, enemy);
  assert.equal(getStacks(enemy, 'shock'), 2, 'one stack per turn');
});

test('Shock caps at 10 and the Shocked contest does not run for a fight with element rules', () => {
  const { combat, enemies } = fight({ enemies: 1 });
  applyStatus(combat, enemies[0], 'shock', 4, combat.player);
  assert.equal(getStacks(enemies[0], 'shock'), 4);
  const before = combat.rng.getCounters().combatContest || 0;
  play(combat, 'core.spark', enemies[0].id);
  assert.equal(combat.rng.getCounters().combatContest || 0, before, 'no contest dice');
  assert.equal(getStacks(enemies[0], 'shocked'), 0);
});

test('review #2822: the chained hit has its own contact, so its Block record never overwrites the first target\'s', () => {
  const { combat, enemies, player } = fight({ enemies: 2 });
  const receipt = { blockBefore: 7 };
  const carrier = { ...SPARK, expansionContact: { index: 0, receipt } };
  const [row] = ElementSecondaryPlan(combat, player, enemies[0], carrier);
  assert.notEqual(row.carrier.expansionContact, carrier.expansionContact);
  assert.notEqual(row.carrier.expansionContact.receipt, receipt);
  row.carrier.expansionContact.receipt.blockBefore = 0; // what the chained hit's applyProfileDamage records
  assert.equal(receipt.blockBefore, 7, 'the first target keeps the Block its hit met');
  assert.equal(row.carrier.expansionContact.index, 0, 'the planned contact flags carry over');
});
