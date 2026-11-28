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
const FIRE = { combatProfile: { camp: 'spell', school: 'fire', damageType: 'arcane', magicShare: 1 } };
const BLUNT = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'blunt', reach: 'contact' }, tags: ['camp:physical', 'damage:blunt'] };
// Owner ruling 2026-11-28: damage is 1:1 (no base-damage scale), so a hit meets the layers as dealt.
const HIT_DAMAGE = 10;
const OVERFLOW_HIT_DAMAGE = 15;
const hit = (combat, target, carrier, base = HIT_DAMAGE) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });
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
  enemy.ratings.poise = 6;
  enemy.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  ward(combat, enemy, 1);
  enemy.persistentPoise = { value: 6, max: 6 };
  const receipt = hit(combat, enemy, BLUNT, 30);
  const incoming = receipt.damageReceipt.hits[0].incoming;
  assert.equal(receipt.wardHpBuffer, true);
  assert.equal(receipt.blocked, 4);
  assert.equal(receipt.wardHpAbsorbed, 5);
  assert.equal(receipt.poiseMitigated, 3, 'Counter mitigates half the six Poise from the overflow');
  assert.equal(receipt.hpLoss, incoming - 4 - 5 - 3);
  assert.ok(receipt.hpLoss > 0, 'the fixture leaves positive HP damage after all three layers');
  const stages = receipt.damageReceipt.hits[0].sources.map(row => row.id);
  assert.ok(stages.indexOf('block') < stages.indexOf('ward-hp'));
  assert.ok(stages.indexOf('ward-hp') < stages.indexOf('poise-mitigation'));
});

test('Ward completely absorbing post-Block damage leaves Poise and HP untouched', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 40 });
  delete combat.player.combatStance;
  delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;
  enemy.block = 4;
  enemy.combatStance = { maneuver: 'prepared', camp: 'spell', range: 'reach' };
  ward(combat, enemy, 3);
  enemy.persistentPoise = { value: enemy.ratings.poise, max: enemy.ratings.poise };
  const poiseBefore = enemy.persistentPoise.value;
  enemy.hp = enemy.maxHp = 100;
  const quoted = hit(combat, enemy, BLUNT);
  assert.equal(quoted.blocked, 4);
  assert.ok(quoted.wardHpAbsorbed > 0 && quoted.wardHpAbsorbed < 15);
  assert.equal(quoted.poiseMitigated, 0);
  assert.equal(quoted.poiseDrain, 0);
  applyAttackDamage(combat, combat.player, enemy, HIT_DAMAGE, [], { ...BLUNT, skipRatingBonus: true });
  assert.equal(enemy.block, 0);
  assert.equal(enemy.wardHp, 15 - quoted.wardHpAbsorbed);
  assert.equal(enemy.statuses.ward.stacks, Math.ceil(enemy.wardHp / 5));
  assert.equal(enemy.persistentPoise.value, poiseBefore, 'Poise untouched');
  assert.equal(enemy.hp, 100, 'HP untouched');
});

test('full Ward absorbs Fire before its attached Poise drain, including with full Block', () => {
  for (const [block, stacks, fullyProtected] of [[4, 3, true], [30, 3, true], [4, 1, false]]) {
    const { combat, enemy } = fight({ enemies: 1, poise: 20, attributes: { intelligence: 4 } });
    delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;
    const unprotected = hit(combat, enemy, FIRE, OVERFLOW_HIT_DAMAGE);
    assert.ok(unprotected.element.poiseAdded > 0, 'control: Fire drains additional Poise without a buffer');
    enemy.block = block;
    ward(combat, enemy, stacks);
    const startingPoise = enemy.persistentPoise.value;
    const startingWard = enemy.wardHp;
    const startingHp = enemy.hp;
    const quote = hit(combat, enemy, FIRE, OVERFLOW_HIT_DAMAGE);
    const packet = quote.damageReceipt.hits[0];
    assert.equal((quote.wardHpAbsorbed ?? 0) === packet.incoming - quote.blocked, fullyProtected);
    if (fullyProtected) assert.equal(quote.element.poiseAdded, 0, 'Ward shields Poise completely');
    else assert.ok(quote.element.poiseAdded > 0, 'the overflowing Fire drains additional Poise');
    applyAttackDamage(combat, combat.player, enemy, OVERFLOW_HIT_DAMAGE, [], { ...FIRE, skipRatingBonus: true });
    assert.equal(enemy.wardHp ?? 0, startingWard - (quote.wardHpAbsorbed ?? 0));
    assert.equal(enemy.persistentPoise.value, startingPoise - quote.poiseDrain);
    assert.equal(enemy.hp, startingHp - quote.hpLoss);
  }
});

test('saved Force routing still splits Ward overflow 50/50', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 40 });
  delete enemy.combatStance;
  // The original hpBuffer policy predated inherent weapon Poise (50e1bc28db6).
  combat.fixCoreRules.poise = { drain: 'prevented', breakRule: 'broken', brokenDamageMultiplier: 1, breakStatusStacks: 2 };
  enemy.block = 2;
  ward(combat, enemy, 1); // 5 Ward HP
  enemy.persistentPoise = { value: 40, max: 40 };
  const receipt = hit(combat, enemy, FORCE, OVERFLOW_HIT_DAMAGE); // 15 incoming -> 2 Block -> 5 Ward -> 8 overflow (50/50)
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
  // Deal 10: 10 Ward absorbs all 10; Poise stays 1.
  applyAttackDamage(combat, combat.player, enemy, HIT_DAMAGE, [], { ...BLUNT, skipRatingBonus: true });
  assert.equal(enemy.wardHp, undefined);
  assert.equal(enemy.statuses.ward, undefined);
  // Now re-apply Ward, then break Poise with a second hit that overflows Ward
  ward(combat, enemy, 1); // 5 Ward HP
  enemy.persistentPoise.value = 1;
  applyAttackDamage(combat, combat.player, enemy, OVERFLOW_HIT_DAMAGE, [], { ...BLUNT, skipRatingBonus: true }); // 15 incoming -> 5 Ward -> 10 overflow -> breaks Poise
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

test('no Ward card is a Reaction, Mote Shield included', () => {
  const { combat } = fight({ enemies: 1 });
  const grants = effect => effect.op === 'gainWard' || (effect.op === 'applyStatus' && effect.status === 'ward');
  const cards = combat.registries.cards.all().filter(card => [...(card.effects || []), ...(card.upgrade?.effects || [])].some(grants));
  assert.ok(cards.some(card => card.id === 'core.moteShield'), 'Mote Shield grants Ward');
  // Owner ruling 2026-11-28: Mote Shield is no longer a Reaction; the starter Ward cantrips never were (2026-11-21).
  const authoredWard = cards.find(card => card.id === 'custom.card_mwx2mb6p');
  assert.ok(authoredWard, 'the owner-authored Ward grants Ward');
  for (const card of cards) assert.ok(!card.tags.includes('trait:reaction'), card.id);
});
