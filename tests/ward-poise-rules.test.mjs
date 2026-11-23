// Owner ruling 2026-11-18 section 20 (Ward): each Ward stack adds +5 max Poise (and that much current Poise); while a character holds Ward a hit
// goes Block, then Poise absorbs 100% until it is 0, then HP. Ward loses 1 stack (ward.decayPerTurn) at the start of its holder's turn, and the
// +5 max Poise leaves with it. When Poise reaches 0 every Ward stack is removed. Without Ward the post-Block split is 25/75 (Force 50/50).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import * as Statuses from '../src/engine/statuses.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';

const FORCE = { combatProfile: { camp: 'spell', school: 'force', damageType: 'arcane' }, tags: ['school:force'] };
const BLUNT = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'blunt', reach: 'contact' }, tags: ['camp:physical', 'damage:blunt'] };
const hit = (combat, target, carrier, base = 20) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });
const ward = (combat, entity, stacks) => Statuses.applyStatus(combat, entity, 'ward', stacks, entity);
const nextTurnStart = (combat, entity) => { entity.fixCoreDecayRound = -1; Statuses.decayAtTurnStart(combat, entity); };

test('Ward is configured as +5 max Poise per stack, losing 1 stack per turn, and breaking at 0 Poise', () => {
  assert.equal(fixCoreMechanics.ward.poisePerStack, 5);
  assert.equal(fixCoreMechanics.ward.decayPerTurn, 1);
  assert.equal(fixCoreMechanics.ward.breaksAtZeroPoise, true);
  assert.equal(fixCoreMechanics.ward.routing, 'blockFirst');
});

test('2 Ward = +10 max Poise; at the holder\'s next turn start 1 stack and +5 remain, then none and base Poise returns', () => {
  // Use a class without a Ward-granting staff: this assertion isolates Ward's own decay.
  const { combat, player } = fight({ classId: 'reaver', enemies: 1 });
  const base = player.persistentPoise.max;
  ward(combat, player, 2);
  assert.equal(player.persistentPoise.max, base + 10, '+5 per stack');
  assert.equal(player.persistentPoise.value, base + 10, 'and that much current Poise');
  nextTurnStart(combat, player);
  assert.equal(player.statuses.ward.stacks, 1, 'only 1 stack decays');
  assert.equal(player.persistentPoise.max, base + 5, 'its +5 max Poise leaves with it');
  assert.equal(player.persistentPoise.value, base + 5, 'current Poise is clamped to the new maximum');
  nextTurnStart(combat, player);
  assert.equal(player.statuses.ward, undefined);
  assert.equal(player.persistentPoise.max, base, 'max Poise is back to base');
  assert.equal(player.persistentPoise.value, base);
});

test('a hit on a Ward holder goes Block, then Poise absorbs 100% until it is 0, then HP', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.block = 4;
  ward(combat, enemy, 1);
  enemy.persistentPoise.value = 8; // 3 held plus the Ward's +5
  const receipt = hit(combat, enemy, BLUNT);
  const incoming = receipt.damageReceipt.hits[0].incoming;
  assert.equal(receipt.wardBlockFirst, true);
  assert.equal(receipt.blocked, 4, 'Block first');
  assert.equal(receipt.poiseMitigated, Math.min(8, incoming - 4), 'Poise absorbs the whole rest, 1:1, up to what it holds');
  assert.equal(receipt.hpLoss, Math.max(0, incoming - 4 - 8), 'only what Poise cannot hold reaches HP');
});

test('a Force hit on a Ward holder is also 100% Poise after Block (Ward overrides the 50/50)', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 40 });
  ward(combat, enemy, 1);
  const receipt = hit(combat, enemy, FORCE);
  assert.equal(receipt.wardBlockFirst, true);
  assert.equal(receipt.hpLoss, 0);
  assert.equal(receipt.poiseMitigated, receipt.damageReceipt.hits[0].incoming);
});

test('a hit that empties Poise strips every Ward stack and its max Poise; the next hit goes Block then the normal 25/75 (Force 50/50)', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  ward(combat, enemy, 3);
  const base = enemy.persistentPoise.max - 15;
  assert.equal(enemy.persistentPoise.barrierBonus, 15, '+5 per stack');
  enemy.persistentPoise.value = 4;
  play(combat, 'cometFragment', enemy.id);
  assert.equal(enemy.statuses.ward, undefined, 'every Ward stack is gone');
  assert.equal(enemy.persistentPoise.barrierBonus || 0, 0);
  assert.equal(enemy.persistentPoise.max, base, 'the +15 max Poise went with it');
  assert.equal(enemy.persistentPoise.value, 0);
  // Poise refilled, no Ward: the next hit meets Block, then the plain split.
  enemy.persistentPoise.value = 40; enemy.persistentPoise.max = 40; enemy.broken = false; enemy.block = 3;
  const blunt = hit(combat, enemy, BLUNT);
  assert.equal(blunt.wardRouted, undefined);
  const leftBlunt = blunt.damageReceipt.hits[0].incoming - 3;
  assert.equal(blunt.blocked, 3);
  assert.equal(blunt.hpLoss, Math.floor(leftBlunt * 0.75), '75% to HP');
  const force = hit(combat, enemy, FORCE);
  const leftForce = force.damageReceipt.hits[0].incoming - 3;
  assert.equal(force.poiseMitigated, leftForce - Math.floor(leftForce * 0.5), '50% to Poise');
  assert.equal(force.hpLoss, Math.floor(leftForce * 0.5), '50% to HP');
});

test('the Ward tooltip reads its numbers from config and says Ward breaks at 0 Poise', () => {
  const { combat } = fight({ enemies: 1 });
  const text = Statuses.statusDefinition(combat, 'ward').tooltip;
  assert.match(text, /each stack adds 5 maximum and current Poise/);
  assert.match(text, /Block first, then Poise absorbs the whole rest/);
  assert.match(text, /Lose 1 Ward at the start of your turn/);
  assert.match(text, /When your Poise reaches 0, all Ward is lost/);
});

test('every card that grants Ward carries the Reaction tag (Mote Shield)', () => {
  const { combat } = fight({ enemies: 1 });
  const grants = effect => effect.op === 'gainWard' || (effect.op === 'applyStatus' && effect.status === 'ward');
  const cards = combat.registries.cards.all().filter(card => [...(card.effects || []), ...(card.upgrade?.effects || [])].some(grants));
  assert.ok(cards.some(card => card.id === 'core.moteShield'), 'Mote Shield grants Ward');
  // Owner ruling 2026-11-21 (Unranked starters): the two starter Ward cantrips are not Reactions (Reaction weighs 3, which would rank them).
  const notReactions = new Set(['core.arcaneWard', 'core.glimmerVeil']);
  for (const card of cards) assert.ok(notReactions.has(card.id) ? !card.tags.includes('trait:reaction') : card.tags.includes('trait:reaction'), card.id);
});
