import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { setCombatStance } from '../src/engine/combatMatchups.js';
import { attackHitPreview, previewCardAttackHit } from '../src/engine/stanceHit.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { stanceRules } from '../src/content/stanceRules.js';

// Owner 2026-11-13: Sweep breaks Counter, Smash breaks Defend (damage greater than the Block held before the hit).
function fight({ maneuver = 'smash', amount = 21, block = 19, stance = 'defend', armCounter = false } = {}) {
  const profile = { camp: 'physical', maneuver, damageType: 'slashing' };
  const registries = createRegistries({ ...contentBundle,
    cards: contentBundle.cards.map(card => card.id === 'kilnCleave' ? { ...card, costRule: 'fixed',
      effects: [{ op: 'damage', target: 'enemy', amount, combatProfile: profile }] } : card),
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'gildedKnight' ? { ...enemy, firstMove: 'parry' } : enemy),
  });
  const player = { classId: 'reaver', hp: 200, maxHp: 200, mana: 10, maxMana: 10, energyMax: 10, drawPerTurn: 1,
    deck: [{ instanceId: 'hit1', cardId: 'kilnCleave' }], relicIds: [] };
  const c = createCombat({ registries, rng: createRng(50), combatExpansionVersion: 2, enemyIds: ['gildedKnight', 'wanderingSoldier'], player });
  const enemy = c.enemies[0];
  delete enemy.combatCounter;
  enemy.combatStance = { camp: 'physical', maneuver: stance };
  if (armCounter) enemy.combatCounter = { charges: 1, mode: 'melee', damage: 6, poiseDamage: 0, bonus: 0, carrier: { combatProfile: { camp: 'physical', maneuver: 'counter', damageType: 'slashing' } } };
  enemy.block = block; enemy.wardBlock = 0; enemy.hp = enemy.maxHp = 500;
  enemy.poiseMeter = { value: 0, max: 1000 }; if (enemy.persistentPoise) enemy.persistentPoise.value = enemy.persistentPoise.max = 1000;
  return { c, enemy, play: () => dispatch(c, { type: 'playCard', cardInstanceId: 'hit1', targetId: enemy.id }),
    broken: () => c.eventLog.filter(event => event.type === 'combatStanceBroken') };
}

test('a Smash greater than the Block held breaks a Defend stance', () => {
  const { enemy, play, broken } = fight({ amount: 40, block: 19 });
  play();
  assert.equal(enemy.combatStance, undefined);
  assert.deepEqual(broken().map(e => [e.targetId, e.from, e.by]), [[enemy.id, 'defend', 'smash']]);
});

test('a Smash that does not exceed the Block leaves the Defend stance', () => {
  const { c, enemy, play, broken } = fight({ amount: 1, block: 19 });
  play();
  assert.equal(enemy.combatStance?.maneuver, 'defend');
  assert.equal(broken().length, 0);
  assert.ok(c.eventLog.some(event => event.type === 'damageDealt'));
});

test('a Sweep that lands on a Counter stance clears the armed reply and the stance', () => {
  const { c, enemy, play, broken } = fight({ maneuver: 'sweep', amount: 5, block: 0, stance: 'counter', armCounter: true });
  const hp = c.player.hp;
  play();
  assert.equal(enemy.combatStance, undefined);
  assert.equal(enemy.combatCounter, undefined);
  assert.equal(c.player.hp, hp, 'no reply');
  assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 0);
  assert.deepEqual(broken().map(e => [e.from, e.by]), [['counter', 'sweep']]);
});

test('a Sweep does not break a Defend stance and a Smash does not break a Counter stance', () => {
  const sweep = fight({ maneuver: 'sweep', amount: 40, block: 19, stance: 'defend' });
  sweep.play();
  assert.equal(sweep.broken().length, 0);
  const smash = fight({ maneuver: 'smash', amount: 40, block: 0, stance: 'counter' });
  smash.play();
  assert.equal(smash.broken().length, 0);
});

test('the Block comparison is strict: more breaks, equal or less holds (21 vs 20, 21 vs 21, 21 vs 23)', () => {
  // The fixture's Smash has 21 damage before matchups; the pool the hit meets is read back from the receipt.
  const seen = {};
  for (const block of [14, 15, 17]) {
    const f = fight({ amount: 21, block }); f.play();
    const d = f.c.eventLog.find(e => e.type === 'damageDealt' && e.sourceId === 'player');
    const held = d.blocked + d.blockRemaining;
    seen[held] = f.enemy.combatStance === undefined;
    assert.equal(f.broken().length, 21 > held ? 1 : 0, `Block ${held}`);
  }
  assert.deepEqual(seen, { 20: true, 21: false, 23: false });
});

test('the same break applies to a player target and never to a staggered stance', async () => {
  const { breakStanceOnHit } = await import('../src/engine/combatMatchups.js');
  const { c } = fight();
  const carrier = maneuver => ({ combatProfile: { camp: 'physical', maneuver, damageType: 'slashing' } });
  const enemy = c.enemies[0];
  c.player.combatStance = { camp: 'physical', maneuver: 'counter' };
  c.player.combatCounter = { charges: 1, mode: 'melee' };
  const event = breakStanceOnHit(c, enemy, c.player, carrier('sweep'), { blockBefore: 0, incoming: 5 });
  assert.deepEqual([event.from, event.by, event.targetId], ['counter', 'sweep', 'player']);
  assert.equal(c.player.combatStance, undefined);
  assert.equal(c.player.combatCounter, undefined);
  c.player.combatStance = { camp: 'physical', maneuver: 'defend' };
  assert.equal(breakStanceOnHit(c, enemy, c.player, carrier('smash'), { blockBefore: 19, incoming: 19 }), null);
  assert.equal(breakStanceOnHit(c, enemy, c.player, carrier('smash'), { blockBefore: 19, incoming: 21 })?.from, 'defend');
  c.player.combatStance = { maneuver: 'staggered' };
  assert.equal(breakStanceOnHit(c, enemy, c.player, carrier('sweep'), { blockBefore: 0, incoming: 9 }), null);
});

test('a broken Counter move leaves the enemy intent at once: the next planned follow-up becomes the intent', () => {
  const { c, enemy, play } = fight({ maneuver: 'sweep', amount: 5, block: 0, stance: 'counter', armCounter: true });
  assert.equal(enemy.intent.moveId, 'parry');
  enemy.plannedMoves = [{ moveId: 'thrust', sp: 1 }];
  const ai = c.rng.getCounters().enemyAI || 0;
  play();
  assert.equal(enemy.intent.moveId, 'thrust');
  assert.deepEqual(enemy.plannedMoves, []);
  const gone = c.eventLog.find(event => event.type === 'enemyMoveUnavailable' && event.sourceId === enemy.id);
  assert.deepEqual([gone.moveId, gone.resource, gone.reason], ['parry', 'stance', 'stanceBroken']);
  assert.equal(c.rng.getCounters().enemyAI || 0, ai, 'no enemyAI draw');
});

test('a broken Counter move with no follow-up leaves the enemy with no move', () => {
  const { c, enemy, play } = fight({ maneuver: 'sweep', amount: 5, block: 0, stance: 'counter', armCounter: true });
  enemy.plannedMoves = [];
  play();
  assert.equal(enemy.intent.moveId, null);
  assert.equal(enemy.intent.kind, 'idle');
  assert.equal(enemy.combatStance, undefined);
  assert.equal(c.eventLog.filter(event => event.type === 'enemyMoveUnavailable').length, 1);
});


// Owner 2026-11-13: same-stance Precision streak (stanceRules.sameStancePrecisionPerRepeat), Core 2 fight.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const card = maneuver => ({ skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver, range: 'melee', damageType: 'slashing' } });
function core2() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  delete combat.player.combatStance; delete combat.player.stanceStreak;
  return { combat, target: combat.enemies[0] };
}
const streakPart = hit => hit.precisionParts?.find(part => part.label === 'same-stance streak')?.value ?? 0;
const matching = (combat, target, carrier) => profileDamageReceipt(combat, combat.player, target, 10, carrier).damageReceipt.hits[0].sources.some(row => row.id === 'matching-stance');

test('the streak amount is data', () => {
  assert.equal(stanceRules.sameStancePrecisionPerRepeat, 1);
});

test('three Sweeps in a row: Precision +0, +1, +2 and x1.25 from the second; the preview equals the live hit', () => {
  const { combat, target } = core2();
  const seen = [];
  for (const carrier of [card('sweep'), card('sweep'), card('sweep')]) {
    const preview = previewCardAttackHit(combat, combat.player, target, carrier);
    setCombatStance(combat, combat.player, carrier);
    const live = attackHitPreview(combat, combat.player, target, carrier);
    assert.equal(streakPart(preview), streakPart(live), 'preview streak = live streak');
    assert.equal(preview.accuracy, live.accuracy, 'preview Precision = live Precision');
    seen.push([streakPart(live), matching(combat, target, carrier)]);
  }
  assert.deepEqual(seen, [[0, false], [1, true], [2, true]]);
});

test('changing stance, or a non-offensive card, resets the streak', () => {
  const { combat, target } = core2();
  for (const maneuver of ['sweep', 'sweep']) setCombatStance(combat, combat.player, card(maneuver));
  assert.equal(combat.player.stanceStreak, 2);
  setCombatStance(combat, combat.player, card('smash'));
  assert.equal(combat.player.stanceStreak, 1);
  assert.equal(streakPart(attackHitPreview(combat, combat.player, target, card('smash'))), 0);
  setCombatStance(combat, combat.player, card('smash'));
  assert.equal(streakPart(attackHitPreview(combat, combat.player, target, card('smash'))), 1);
  setCombatStance(combat, combat.player, card('defend'));
  assert.equal(combat.player.stanceStreak, 0);
  setCombatStance(combat, combat.player, card('smash'));
  assert.equal(combat.player.stanceStreak, 1);
});

test('played through dispatch, each repeat counts once (not once per stance call)', () => {
  const { combat, target } = core2();
  combat.player.energy = combat.player.stamina = combat.player.energyMax = combat.player.maxStamina = 30;
  const strikes = combat.piles.hand.filter(row => row.cardId === 'core.strike');
  assert.ok(strikes.length >= 2, 'the opening hand holds repeats of one Attack');
  const parts = [];
  for (const row of strikes.slice(0, 3)) {
    dispatch(combat, { type: 'playCard', cardInstanceId: row.instanceId, targetId: target.id });
    parts.push(streakPart(combat.eventLog.filter(e => e.type === 'attackHit' || e.type === 'attackMissed').at(-1)));
  }
  assert.deepEqual(parts, parts.map((_, i) => i));
});

test('preview equals live for a three-hit Smash on a Defend stance, and the preview mutates nothing', () => {
  for (const block of [10, 40]) {
    const { combat, target } = core2();
    Object.assign(target, { hp: 500, maxHp: 500, block, statuses: {}, persistentPoise: { value: 200, max: 200 }, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
    delete target.combatCounter;
    target.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
    // The round's one advantage stagger is already spent, so only the stance break changes later hits.
    (combat.gameProfileInterrupts ||= {})[`${combat.turn}:${target.id}`] = 99;
    const carrier = card('smash');
    const before = structuredClone({ stance: target.combatStance, block: target.block, hp: target.hp });
    const preview = previewDamageHits(combat, combat.player, target, 12, [], carrier, 3);
    assert.deepEqual({ stance: target.combatStance, block: target.block, hp: target.hp }, before, 'no state change');
    for (let i = 0; i < 3; i++) { primeAccuracyRolls(combat); applyAttackDamage(combat, combat.player, target, 12, [], carrier); }
    assert.equal(500 - target.hp, preview.hpLoss, `Block ${block}: preview hp loss = live hp loss`);
    // Block 10 is beaten by the first 12-damage hit, so the stance bonus ends; Block 40 is not, so the stance holds.
    assert.equal(target.combatStance?.maneuver, block === 10 ? undefined : 'defend');
  }
});
