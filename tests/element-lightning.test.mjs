// Owner 2026-10-31 (SPEC 4.7 "Lightning, Shocked, Damp and Bedrock"): Spark, the lightning tag's +1 Precision against metal,
// the Shocked contest, Bedrock, the own-element x1.25 floor and the metal material data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { attackHitPreview } from '../src/engine/stanceHit.js';
import { applyStatus } from '../src/engine/statuses.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { getStacks } from '../src/engine/statuses.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { beginLightningHit, finishLightningHit, wearsMetal, lightningPrecisionBonus, shockContestPreview, seedElementStatuses } from '../src/engine/elementLightning.js';
import { enemyMoveCarrier } from '../src/engine/combatCardTactics.js';
import { equipmentCardModel } from '../src/model/equipmentCard.js';
import { isLightning, affinityTags, withAffinity, ownElementAmount, dampBurnStacks, shockedPenalty, carrierElement, scaleOwnElementActions } from '../src/engine/elementRules.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight({ classId = 'starseer', enemyId = 'wanderingSoldier' } = {}) {
  const run = createRunState({ registries: reg, classId, seed: 5, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(5), enemyIds: [enemyId] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 0, barrier: 0, persistentPoise: { value: 0, max: 20 }, attributes: { strength: 2, dexterity: 2, constitution: 2, wisdom: 1, intelligence: 1 }, level: 1 });
  delete enemy.combatStance; delete enemy.combatCounter;
  combat.player.energy = 9; combat.player.mana = 9;
  return { combat, player: combat.player, enemy };
}
// Pin the next contest dice (stream combatContest); anything else stays seeded.
function pinContestDice(combat, ...dice) {
  const real = combat.rng.int.bind(combat.rng), queue = [...dice];
  combat.rng.int = (stream, lo, hi) => (stream === 'combatContest' && queue.length ? queue.shift() : real(stream, lo, hi));
}
const SPARK = { cardId: 'core.spark', tags: ['school:lightning', 'rank.cantrip'], rank: 1 };
const dcOf = (combat, enemy) => shockContestPreview(combat, combat.player, enemy, SPARK).dc;

test('Spark is a Core cantrip: 3 Lightning magic damage (4 upgraded), 1 SP, no Mana, lightning tag', () => {
  const card = reg.cards.get('core.spark');
  assert.ok(card.tags.includes('rank.cantrip') && card.tags.includes('school:lightning'));
  assert.deepEqual([card.staminaCost, card.manaCost, card.damageSchool], [1, 0, 'magic']);
  assert.equal(card.effects[0].amount, 3);
  assert.equal(card.upgrade.effects[0].amount, 4);
  assert.ok(isLightning(card));
});

test('Spark deals 3 base damage (plus the caster\'s attributes, like every Core spell) and its face reads the same as Frost Nip', () => {
  const play = id => {
    const { combat, enemy } = fight();
    const hand = combat.piles.hand[0];
    hand.cardId = id; hand.upgraded = false;
    primeAccuracyRolls(combat);
    const row = previewCard(combat, hand.instanceId, enemy.id).values.find(v => v.op === 'damage');
    dispatch(combat, { type: 'playCard', cardInstanceId: hand.instanceId, targetId: enemy.id });
    return { row, dealt: 500 - enemy.hp };
  };
  const spark = play('core.spark'), nip = play('core.frostNip');
  assert.equal(spark.row.splitBase, 3, 'printed damage 3');
  assert.equal(spark.row.damageReceipt.hits[0].sources.find(s => s.id === 'base').amount, 3);
  assert.equal(spark.row.faceValue, nip.row.faceValue, 'the face matches the other 3-damage cantrip');
  assert.equal(spark.dealt, spark.row.faceValue, 'the face is what the hit does');
});

test('metal material: weapons, shields and plate or mail carry it; wood, cloth and leather do not', () => {
  const metal = ['straightSword', 'greatsword', 'dagger', 'buckler', 'kiteShield', 'towerShield'];
  for (const id of metal) assert.equal(reg.equipment.armaments.find(x => x.id === id)?.material, 'metal', id);
  for (const id of ['shortbow', 'torch', 'ashStaff', 'goldboughBranch']) assert.notEqual(reg.equipment.armaments.find(x => x.id === id)?.material, 'metal', id);
  assert.ok(reg.equipment.armour.some(x => x.material === 'metal'), 'some armour is metal');
  assert.ok(reg.equipment.armour.some(x => x.material !== 'metal'), 'some armour is not metal');
});

test('lightning tag: +1 Precision against a target using metal, none against one that is not', () => {
  const { combat, enemy } = fight();
  assert.equal(lightningPrecisionBonus(combat, enemy, SPARK), 0);
  enemy.material = 'metal';
  assert.equal(lightningPrecisionBonus(combat, enemy, SPARK), 1);
  assert.equal(lightningPrecisionBonus(combat, enemy, { cardId: 'core.strike', tags: ['camp:physical'] }), 0, 'a non-lightning card gets no bonus');
});

test('wearsMetal reads the worn equipment: the Reaver in plate wears metal, the Starseer in robes does not', () => {
  const a = fight({ classId: 'reaver' }), b = fight({ classId: 'starseer' });
  const worn = (f) => f.combat.player && wearsMetal(f.combat, f.combat.player);
  assert.equal(worn(a), true, 'reaver');
  assert.equal(worn(b), false, 'starseer');
});

test('Shocked contest: d20 + stacks x (INT + WIS + rank) against Poise + STR + DEX + CON + level; success adds 1 Shocked after HP loss', () => {
  const { combat, player, enemy } = fight();
  enemy.persistentPoise.value = 3;
  const preview = shockContestPreview(combat, player, enemy, SPARK);
  assert.equal(preview.dc, 3 + 2 + 2 + 2 + 1, 'DC: poise 3 + STR 2 + DEX 2 + CON 2 + level 1');
  assert.equal(preview.bonus, 0, 'no Shocked stacks yet: the d20 stands alone');
  pinContestDice(combat, 20);
  const hit = beginLightningHit(combat, player, enemy, SPARK);
  assert.equal(hit.contest.total, 20); assert.equal(hit.contest.passed, true);
  assert.equal(finishLightningHit(combat, player, enemy, hit, 0), 0, 'no HP loss, no Shocked');
  assert.equal(getStacks(enemy, 'shocked'), 0);
  assert.equal(finishLightningHit(combat, player, enemy, hit, 3), 1);
  assert.equal(getStacks(enemy, 'shocked'), 1);
});

test('Shocked contest failure: a low die leaves the target unshocked', () => {
  const { combat, player, enemy } = fight();
  pinContestDice(combat, 2);
  const hit = beginLightningHit(combat, player, enemy, SPARK);
  assert.equal(hit.contest.passed, false);
  finishLightningHit(combat, player, enemy, hit, 3);
  assert.equal(getStacks(enemy, 'shocked'), 0);
});

test('Shocked stacks multiply the caster mix: 2 stacks x (INT + WIS + rank) lifts a low die over the DC', () => {
  const { combat, player, enemy } = fight();
  enemy.statuses.shocked = { stacks: 2 };
  const preview = shockContestPreview(combat, player, enemy, SPARK);
  const mix = preview.bonus / 2;
  assert.ok(mix >= 1, 'the mix includes the card rank');
  pinContestDice(combat, Math.max(1, preview.dc - preview.bonus));
  const hit = beginLightningHit(combat, player, enemy, SPARK);
  assert.equal(hit.contest.total, Math.max(1, preview.dc - preview.bonus) + preview.bonus);
  assert.equal(hit.contest.passed, hit.contest.total >= preview.dc);
});

test('Damp target: the caster rolls with advantage and keeps the higher die', () => {
  const { combat, player, enemy } = fight();
  enemy.statuses.damp = { stacks: 1 };
  pinContestDice(combat, 3, 17);
  const hit = beginLightningHit(combat, player, enemy, SPARK);
  assert.equal(hit.contest.mode, 'advantage');
  assert.deepEqual(hit.contest.dice, [3, 17]);
  assert.equal(hit.contest.roll, 17);
});

test('Caster in metal rolls with disadvantage (lower die); advantage and disadvantage cancel', () => {
  const { combat, player, enemy } = fight({ classId: 'reaver' });
  assert.equal(wearsMetal(combat, player), true);
  pinContestDice(combat, 17, 4);
  const hit = beginLightningHit(combat, player, enemy, SPARK);
  assert.equal(hit.contest.mode, 'disadvantage');
  assert.equal(hit.contest.roll, 4);
  enemy.statuses.damp = { stacks: 1 };
  pinContestDice(combat, 9);
  const both = beginLightningHit(combat, player, enemy, SPARK);
  assert.equal(both.contest.mode, 'normal');
  assert.deepEqual(both.contest.dice, [9]);
});

test('A natural 1 on the kept die while wearing metal is a backlash: the damage goes to the caster and nothing is shocked', () => {
  const { combat, player, enemy } = fight({ classId: 'reaver' });
  pinContestDice(combat, 1, 15);
  const hit = beginLightningHit(combat, player, enemy, SPARK);
  assert.equal(hit.backlash, true);
  assert.equal(hit.contest.passed, false);
  finishLightningHit(combat, player, enemy, hit, 3);
  assert.equal(getStacks(enemy, 'shocked'), 0);
  // The same 1 without metal is only a failed roll.
  const plain = fight({ classId: 'starseer' });
  pinContestDice(plain.combat, 1);
  assert.equal(beginLightningHit(plain.combat, plain.player, plain.enemy, SPARK).backlash, false);
});

test('the contest is logged as a roll receipt: total vs DC', () => {
  const { combat, player, enemy } = fight();
  const seen = [];
  const emit = combat.emit.bind(combat);
  combat.emit = (type, payload) => { seen.push({ type, ...payload }); return emit(type, payload); };
  pinContestDice(combat, 12);
  beginLightningHit(combat, player, enemy, SPARK);
  const event = seen.find(e => e.type === 'contestPassed' || e.type === 'contestFailed');
  assert.ok(event, 'a contest event was emitted');
  assert.equal(event.total, 12); assert.equal(event.dc, dcOf(combat, enemy));
});

test('Bedrock absorbs one lightning hit per stack and is then gone; the next hit contests normally', () => {
  const { combat, player, enemy } = fight();
  enemy.statuses.bedrock = { stacks: 2 };
  for (const left of [1, 0]) {
    const hit = beginLightningHit(combat, player, enemy, SPARK);
    assert.equal(hit.absorbed, true); assert.equal(hit.contest, null);
    assert.equal(getStacks(enemy, 'bedrock'), left);
    assert.equal(finishLightningHit(combat, player, enemy, hit, 3), 0);
  }
  pinContestDice(combat, 10);
  assert.equal(beginLightningHit(combat, player, enemy, SPARK).absorbed, false);
  assert.equal(getStacks(enemy, 'shocked'), 0);
});

test('Bedrock does not absorb a hit that is not lightning', () => {
  const { combat, player, enemy } = fight();
  enemy.statuses.bedrock = { stacks: 2 };
  assert.equal(beginLightningHit(combat, player, enemy, { cardId: 'core.cinderDart', tags: ['school:fire'] }), null);
  assert.equal(getStacks(enemy, 'bedrock'), 2);
});

test('an earth-element enemy opens the fight with 3 Bedrock; other enemies start without it', () => {
  const { combat, enemy } = fight();
  assert.equal(getStacks(enemy, 'bedrock'), 0);
  enemy.element = 'earth';
  assert.equal(seedElementStatuses(combat, enemy, reg.enemies.get(enemy.enemyId)), 3);
  assert.equal(getStacks(enemy, 'bedrock'), 3);
  assert.equal(seedElementStatuses(combat, enemy, null), 0, 'seeding twice adds nothing');
});

test('Shocked is -1 Precision per stack; Damp halves Burn applied to its holder', () => {
  const { enemy } = fight();
  enemy.statuses.shocked = { stacks: 3 };
  assert.equal(shockedPenalty(enemy), 3);
  assert.equal(dampBurnStacks(enemy, 4), 4, 'not Damp: unchanged');
  enemy.statuses.damp = { stacks: 1 };
  assert.equal(dampBurnStacks(enemy, 4), 2);
  assert.equal(dampBurnStacks(enemy, 3), 1);
  assert.equal(dampBurnStacks(enemy, 1), 1, 'at least 1');
});

test('own-element bonus: x1.25 floored, only for a matching element, never below the printed amount', () => {
  assert.equal(ownElementAmount(8, 'fire', 'fire'), 10);
  assert.equal(ownElementAmount(3, 'fire', 'fire'), 3, 'floor(3.75) = 3');
  assert.equal(ownElementAmount(2, 'fire', 'fire'), 2);
  assert.equal(ownElementAmount(10, 'fire', 'frost'), 10);
  assert.equal(ownElementAmount(10, null, 'fire'), 10);
  assert.equal(carrierElement({ damageType: 'lightning' }), 'lightning');
  assert.equal(carrierElement({ tags: ['school:frost'] }), 'frost');
});

const accuracy = (combat, enemy, carrier) => attackHitPreview(combat, combat.player, enemy, carrier).accuracy;
const CARD = { cardId: 'core.spark', tags: ['camp:spell', 'maneuver:casting', 'school:lightning'], damageSchool: 'magic' };
test('Precision: a lightning spell gains +1 against a metal target, and each Shocked stack on the caster costs 1', () => {
  const { combat, player, enemy } = fight();
  const base = accuracy(combat, enemy, CARD);
  enemy.material = 'metal';
  assert.equal(accuracy(combat, enemy, CARD), base + 1, 'metal target, lightning card');
  assert.equal(accuracy(combat, enemy, { ...CARD, tags: ['camp:spell', 'maneuver:casting', 'school:fire'] }), base, 'metal target, fire card');
  enemy.material = undefined;
  player.statuses.shocked = { stacks: 2 };
  assert.equal(accuracy(combat, enemy, CARD), base - 2, 'two Shocked stacks');
  const parts = attackHitPreview(combat, player, enemy, CARD).precisionParts;
  assert.equal(parts.reduce((sum, p) => sum + p.value, 0), accuracy(combat, enemy, CARD), 'the receipt parts add up');
});

test('Damp halves Burn applied to its holder through applyStatus; a dry target takes it all', () => {
  const { combat, player, enemy } = fight();
  applyStatus(combat, enemy, 'burn', 4, player);
  const dry = getStacks(enemy, 'burn');
  assert.ok(dry >= 3, 'a dry target takes the Burn (less any Poise buildup resistance)');
  const wet = fight();
  wet.enemy.statuses.damp = { stacks: 1 };
  applyStatus(wet.combat, wet.enemy, 'burn', 4, wet.player);
  assert.ok(getStacks(wet.enemy, 'burn') <= Math.ceil(dry / 2), 'Damp halves what was applied');
  assert.ok(getStacks(wet.enemy, 'burn') >= 1);
});

test('authored enemies: the Charred Colossus (earth) spawns with 3 Bedrock, the Stitch Crab with 2 Damp, the Wandering Soldier with neither', () => {
  const colossus = fight({ enemyId: 'charredColossus' }).enemy, crab = fight({ enemyId: 'stitchCrab' }).enemy, soldier = fight().enemy;
  assert.equal(reg.enemies.get('charredColossus').element, 'earth');
  assert.equal(getStacks(colossus, 'bedrock'), 3);
  assert.equal(getStacks(crab, 'damp'), 2);
  assert.equal(getStacks(soldier, 'bedrock') + getStacks(soldier, 'damp'), 0);
});

test('elemental affinity: an infused armament adds N element tags to its card; an enemy\'s attuned weapon gets floor(N x 1.25)', () => {
  const sword = reg.equipment.armaments.find(x => x.id === 'straightSword');
  assert.deepEqual(affinityTags(sword), [], 'no affinity, no tags');
  const infused = withAffinity(withAffinity(sword, 'lightning', 2), 'lightning', 2);
  assert.deepEqual(infused.affinity, { element: 'lightning', count: 4 });
  assert.deepEqual(affinityTags(infused), Array(4).fill('element:lightning'));
  assert.equal(affinityTags(infused, { enemy: true }).length, 5, 'floor(4 x 1.25)');
  assert.equal(affinityTags(withAffinity(sword, 'fire', 3), { enemy: true }).length, 3, 'floor(3.75)');
  const before = equipmentCardModel(reg, sword).tags.length;
  const card = equipmentCardModel(reg, infused);
  assert.equal(card.tags.length, before + 4);
  assert.equal(card.tags.filter(t => t.value === 'element:lightning').length, 4);
  assert.equal(sword.affinity, undefined, 'the original piece is untouched');
});

test('own-element bonus on a planned enemy move: Lantern Moth (lightning) wing sparks scale damage and stacks by 1.25, floored; a foreign element does not', () => {
  const { combat, enemy } = fight({ enemyId: 'lanternMoth' });
  const def = reg.enemies.get('lanternMoth'), move = def.moves.wingSparks;
  const carrier = enemyMoveCarrier(enemy, move, 'wingSparks', combat);
  assert.equal(carrierElement(carrier), 'lightning');
  const actions = [{ effect: { op: 'damage', target: 'player', amount: 8, hits: 2 } }, { effect: { op: 'applyStatus', target: 'player', status: 'weak', stacks: 3 } },
    { effect: { op: 'block', target: 'self', amount: 3 } }, { effect: { op: 'draw', amount: 2 } }];
  assert.strictEqual(scaleOwnElementActions(combat, enemy, carrier, actions, def), actions, 'no element on the enemy: nothing changes');
  enemy.element = 'fire';
  assert.strictEqual(scaleOwnElementActions(combat, enemy, carrier, actions, def), actions, 'a fire enemy casting lightning: no bonus');
  enemy.element = 'lightning';
  const scaled = scaleOwnElementActions(combat, enemy, carrier, actions, def).map(a => a.effect);
  assert.equal(scaled[0].amount, 10, 'damage 8 x 1.25');
  assert.equal(scaled[0].hits, 2, 'hits are not scaled');
  assert.equal(scaled[1].stacks, 3, 'floor(3 x 1.25) = 3');
  assert.equal(scaled[2].amount, 3);
  assert.equal(scaled[3].amount, 2, 'draw is not an effect amount');
  assert.equal(actions[0].effect.amount, 8, 'the planned actions are not mutated');
});
