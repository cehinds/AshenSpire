// Owner ruling 2026-11-24 (Ward health buffer): each Ward stack adds +5 Ward HP (`ward.hpPerStack`) on the health bar.
// Damage order: Block > Ward > Poise + Health. Ward loses 1 stack (5 Ward HP) at the start of its holder's turn, and is
// independent of Poise break. Legacy fights saved with `ward.routing: "blockFirst"` retain their saved behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight } from './elementFixture.mjs';
import * as Statuses from '../src/engine/statuses.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';

const FORCE = { combatProfile: { camp: 'spell', school: 'force', damageType: 'arcane' }, tags: ['school:force'] };
const BLUNT = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'blunt', reach: 'contact' }, tags: ['camp:physical', 'damage:blunt'] };
const hit = (combat, target, carrier, base = 20) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });
const ward = (combat, entity, stacks) => Statuses.applyStatus(combat, entity, 'ward', stacks, entity);
const nextTurnStart = (combat, entity) => { entity.fixCoreDecayRound = -1; Statuses.decayAtTurnStart(combat, entity); };

test('Ward is configured as +5 Ward HP per stack, hpBuffer routing, losing 1 stack per turn', () => {
  assert.equal(fixCoreMechanics.ward.hpPerStack, 5);
  assert.equal(fixCoreMechanics.ward.routing, 'hpBuffer');
  assert.equal(fixCoreMechanics.ward.decayPerTurn, 1);
  assert.equal(fixCoreMechanics.ward.breaksAtZeroPoise, undefined);
});

test('2 Ward = 10 Ward HP (Poise untouched); at turn start 1 stack (5 Ward HP) remains, then 0', () => {
  const { combat, player } = fight({ classId: 'reaver', enemies: 1 });
  const basePoise = player.persistentPoise.max;
  ward(combat, player, 2);
  assert.equal(player.wardHp, 10, '+5 Ward HP per stack');
  assert.equal(player.statuses.ward.stacks, 2);
  assert.equal(player.persistentPoise.max, basePoise, 'Poise max unchanged');
  assert.equal(player.persistentPoise.value, basePoise, 'Poise value unchanged');
  nextTurnStart(combat, player);
  assert.equal(player.statuses.ward.stacks, 1, '1 stack decayed');
  assert.equal(player.wardHp, 5, '5 Ward HP remains');
  nextTurnStart(combat, player);
  assert.equal(player.statuses.ward, undefined);
  assert.equal(player.wardHp, undefined);
});

test('order Block > Ward > Poise + Health: Block absorbs first, Ward absorbs 1:1 before Poise + HP, overflow splits', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 40 });
  delete combat.player.combatStance;
  delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;
  enemy.block = 4;
  ward(combat, enemy, 1); // 5 Ward HP
  const receipt = hit(combat, enemy, BLUNT, 30); // base 30 -> 15 -> 18 with Attack stance (1.2x)
  const incoming = receipt.damageReceipt.hits[0].incoming;
  assert.equal(incoming, 18);
  assert.equal(receipt.wardHpBuffer, true);
  assert.equal(receipt.blocked, 4, 'Block first (18 -> 14)');
  assert.equal(receipt.wardHpAbsorbed, 5, 'Ward second (14 -> 9)');
  assert.equal(receipt.poiseMitigated + receipt.hpLoss, 9, 'all 9 overflow goes to Poise + HP');
  assert.ok(receipt.poiseMitigated > 0 && receipt.hpLoss > 0, 'overflow splits between Poise and HP');
});

test('Ward completely absorbing post-Block damage leaves Poise and HP untouched', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 40 });
  delete combat.player.combatStance;
  delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;
  enemy.block = 4;
  ward(combat, enemy, 2); // 10 Ward HP
  const poiseBefore = enemy.persistentPoise.value;
  enemy.hp = enemy.maxHp = 100;
  applyAttackDamage(combat, combat.player, enemy, 20, [], { ...BLUNT, skipRatingBonus: true }); // 12 incoming: 4 Block, 8 Ward
  assert.equal(enemy.block, 0);
  assert.equal(enemy.wardHp, 2, '10 - 8 absorbed = 2 Ward HP remaining');
  assert.equal(enemy.statuses.ward.stacks, 1, 'ceil(2/5) = 1 stack');
  assert.equal(enemy.persistentPoise.value, poiseBefore, 'Poise untouched');
  assert.equal(enemy.hp, 100, 'HP untouched');
});

test('a Force hit on a Ward holder also meets Block > Ward > Poise + Health (overflow splits 50/50)', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 40 });
  delete enemy.combatStance;
  enemy.block = 2;
  ward(combat, enemy, 1); // 5 Ward HP
  const receipt = hit(combat, enemy, FORCE, 30); // 15 incoming -> 2 Block -> 5 Ward -> 8 overflow (50/50)
  assert.equal(receipt.wardHpBuffer, true);
  assert.equal(receipt.blocked, 2);
  assert.equal(receipt.wardHpAbsorbed, 5);
  assert.equal(receipt.poiseMitigated, 4);
  assert.equal(receipt.hpLoss, 4);
});

test('emptying Poise does NOT strip Ward (Ward is independent of Poise break)', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  delete enemy.combatStance;
  enemy.persistentPoise.value = 1;
  enemy.persistentPoise.max = 10;
  ward(combat, enemy, 2); // 10 Ward HP
  enemy.hp = enemy.maxHp = 100;
  // Deal 20 (10 incoming): 10 Ward absorbs all 10; Poise stays 1.
  applyAttackDamage(combat, combat.player, enemy, 20, [], { ...BLUNT, skipRatingBonus: true });
  assert.equal(enemy.wardHp, undefined);
  assert.equal(enemy.statuses.ward, undefined);
  // Now re-apply Ward, then break Poise with a second hit that overflows Ward
  ward(combat, enemy, 1); // 5 Ward HP
  enemy.persistentPoise.value = 1;
  applyAttackDamage(combat, combat.player, enemy, 30, [], { ...BLUNT, skipRatingBonus: true }); // 15 incoming -> 5 Ward -> 10 overflow -> breaks Poise
  assert.ok(enemy.broken);
  // Re-apply Ward while Broken: Ward stays intact
  ward(combat, enemy, 1);
  assert.equal(enemy.wardHp, 5);
  assert.equal(enemy.statuses.ward.stacks, 1);
});

test('the Ward tooltip reads its numbers from config and describes the health buffer', () => {
  const { combat } = fight({ enemies: 1 });
  const text = Statuses.statusDefinition(combat, 'ward').tooltip;
  assert.match(text, /each stack adds 5 Ward HP/);
  assert.match(text, /Block first, then Ward absorbs the rest 1:1 before Poise and HP/);
  assert.match(text, /Lose 1 stack \(5 Ward HP\) at the start of your turn/);
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
