// Theme B of the 2026-11-17 playtest (owner): status and stance rules.
// Rule 1: Counter follows the normal decay rule. Its stacks lose 1 at the owner's turn start, and the armed Counter lasts while they do.
// Rules 2-3: a Defend-stance target holding Block keeps at least 1 Poise against physical hits and Sweeps (and magic while it holds Ward stacks);
// Smash still breaks it, and at 0 Block Poise breaks normally.
// Rule 4: an enemy Counter move (the Gilded Knight's Parry) shows a Counter badge that decays normally and loses 1 on each use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { applyAttackDamage, dealPoiseDamage } from '../src/engine/actions.js';
import { primeEnemyCounter } from '../src/engine/combatCardTactics.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const SLASH = { kind: 'attack', moveId: 'slash', damage: 8, hits: 1,
  combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [], stanceTrigger: false } };

function live({ enemyId = 'wanderingSoldier', rules = null, seed = 511 } = {}) {
  const run = createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [enemyId] });
  if (rules) rules(combat.fixCoreRules);
  const enemy = combat.enemies[0];
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { basePrecisionBonus: 1000, hp: 9999, maxHp: 9999, energy: 99 });
  Object.assign(enemy, { hp: 5000, maxHp: 5000, statuses: {}, ratingSources: [], basePrecisionBonus: 1000 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { combat, enemy };
}
const play = (combat, id, cardId, extra = {}) => { combat.piles.hand.push({ instanceId: id, cardId, ...extra }); dispatch(combat, { type: 'playCard', cardInstanceId: id }); };
const endTurn = combat => { const from = combat.eventLog.length; dispatch(combat, { type: 'endTurn' }); return combat.eventLog.slice(from); };
const attackNext = enemy => {
  enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
  Object.assign(enemy, { maxStamina: 3, stamina: 3, plannedMoves: [] });
  enemy.intent = { ...enemy.intent, ...SLASH };
};

test('rule 1: Counter stacks lose 1 at the owner turn start and the Counter stays armed while stacks remain', () => {
  const { combat, enemy } = live();
  combat.player.counterStacks = 2;
  play(combat, 'c', 'core.counter');
  assert.equal(combat.player.counterStacks, 3);
  attackNext(enemy);
  const first = endTurn(combat);
  assert.equal(first.filter(e => e.type === 'combatCounterTriggered').length, 1, 'the covered hit is answered');
  assert.deepEqual(first.filter(e => e.type === 'counterStacksChanged').map(e => [e.amount, !!e.consumed, !!e.decay]), [[-1, true, false], [-1, false, true]],
    'the hit spends 1, then 1 fades at the turn start');
  assert.equal(combat.player.counterStacks, 1);
  assert.ok(combat.player.combatCounter?.charges > 0, 'the Counter is still armed with 1 stack left (it used to expire at the turn start)');
  attackNext(enemy);
  const second = endTurn(combat);
  const answer = second.find(e => e.type === 'combatCounterTriggered');
  assert.ok(answer, 'the next turn the remaining stack still answers a covered hit');
  assert.deepEqual(answer.counterHits.map(row => row.stacksBefore), [1]);
  assert.equal(combat.player.counterStacks ?? 0, 0);
  assert.equal(combat.player.combatCounter, undefined, 'the Counter ends with its last stack');
});

test('rule 1: with no stack left at the turn start the Counter expires as before', () => {
  const { combat } = live();
  play(combat, 'c', 'core.counter');
  assert.equal(combat.player.counterStacks, 1);
  combat.enemies[0].intent = { ...combat.enemies[0].intent, kind: 'block', damage: undefined, hits: undefined };
  endTurn(combat);
  assert.equal(combat.player.counterStacks ?? 0, 0, 'the one stack fades');
  assert.equal(combat.player.combatCounter, undefined);
});

test('rule 1: a fight saved without counter.armedWhileStacks keeps the old expiry at the turn start', () => {
  const { combat, enemy } = live({ rules: rules => { delete rules.counter.armedWhileStacks; } });
  combat.player.counterStacks = 2;
  play(combat, 'c', 'core.counter');
  attackNext(enemy);
  endTurn(combat);
  assert.equal(combat.player.counterStacks, 1);
  assert.equal(combat.player.combatCounter, undefined, 'old rule: the charge clears although a stack remains');
});

test('rule 1: the shipped data turns the rule on', () => {
  assert.equal(shipped.counter.armedWhileStacks, true);
  assert.equal(shipped.counter.decayPerTurn, 1);
});

// ---- Rules 2-3: the Defend Poise floor ----
const PHYSICAL = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single' } };
const SWEEP = { combatProfile: { camp: 'physical', maneuver: 'sweep', damageType: 'slashing', range: 'melee', targeting: 'single' } };
const SMASH = { combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'blunt', range: 'melee', targeting: 'single' } };
const MAGIC = { combatProfile: { camp: 'spell', maneuver: 'attack', damageType: 'fire', range: 'reach', targeting: 'single', magicShare: 1 } };

/** One hit of `base` from the player on an enemy in `stance` holding `block` Block, 3 Poise (Defend's -25% Poise taken spares none of 3) and `ward` Ward stacks. */
function defendHit(carrier, { block = 2, ward = 0, stance = 'defend', base = 200, rules = null } = {}) {
  const { combat, enemy } = live({ rules });
  Object.assign(enemy, { block, persistentPoise: { value: 3, max: 5 }, statuses: ward ? { ward: { stacks: ward } } : {} });
  enemy.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
  const from = combat.eventLog.length, hp = enemy.hp;
  applyAttackDamage(combat, combat.player, enemy, base, [], { ...structuredClone(carrier), skipRatingBonus: true });
  const events = combat.eventLog.slice(from);
  return { combat, enemy, poise: enemy.persistentPoise.value, broke: events.some(e => e.type === 'poiseBroken' && e.targetId === enemy.id), hpLost: hp - enemy.hp };
}

test('rule 2: in Defend with Block above 0 a physical hit or a Sweep leaves at least 1 Poise, and costs the same HP', () => {
  for (const [name, carrier] of [['physical', PHYSICAL], ['sweep', SWEEP]]) {
    const held = defendHit(carrier);
    assert.equal(held.poise, 1, `${name}: poise = max(poise - poiseDamage, 1)`);
    assert.equal(held.broke, false, `${name}: Poise does not break`);
    const before = defendHit(carrier, { rules: rules => { delete rules.stanceBenefits.defend.poiseFloorWhileBlock; } });
    assert.equal(before.poise, 0, `${name}: the same hit broke Poise before the rule`);
    assert.equal(held.hpLost, before.hpLost, `${name}: the floor spares Poise only, never HP`);
  }
});

test('rule 2 edge: at exactly 0 Block a physical hit breaks Poise normally', () => {
  const r = defendHit(PHYSICAL, { block: 0 });
  assert.equal(r.poise, 0);
  assert.equal(r.broke, true);
});

test('rule 2: a Smash still breaks Poise while Block remains, with or without Ward stacks', () => {
  for (const ward of [0, 2]) {
    const r = defendHit(SMASH, { block: 2, ward });
    assert.equal(r.poise, 0, `ward ${ward}`);
    assert.equal(r.broke, true, `ward ${ward}`);
  }
});

test('rule 2: magic still breaks Poise in Defend with Block when no Ward stacks are held', () => {
  const r = defendHit(MAGIC, { block: 2 });
  assert.equal(r.poise, 0);
  assert.equal(r.broke, true);
});

test('rule 2: another stance with Block gets no floor', () => {
  const r = defendHit(PHYSICAL, { stance: 'attack' });
  assert.equal(r.poise, 0);
  assert.equal(r.broke, true);
});

test('rule 3: in Defend with Block and Ward stacks a magic hit cannot break Poise either', () => {
  const r = defendHit(MAGIC, { block: 2, ward: 1 });
  assert.equal(r.poise, 1);
  assert.equal(r.broke, false);
  const physical = defendHit(PHYSICAL, { block: 2, ward: 1 });
  assert.equal(physical.poise, 1, 'physical keeps the floor with Ward too');
  const before = defendHit(MAGIC, { block: 2, ward: 1, rules: rules => { delete rules.stanceBenefits.defend.poiseFloorWardMagic; } });
  assert.equal(before.poise, 0, 'without poiseFloorWardMagic magic breaks it');
});

test('rule 3 edge: Ward stacks with 0 Block give no floor, to magic or to a physical hit', () => {
  for (const carrier of [MAGIC, PHYSICAL]) {
    const r = defendHit(carrier, { block: 0, ward: 1 });
    assert.equal(r.poise, 0);
    assert.equal(r.broke, true);
  }
});

test('rules 2-3: a Poise rider riding a physical hit keeps the floor; one riding a Smash does not', () => {
  const { combat, enemy } = live();
  Object.assign(enemy, { block: 3, persistentPoise: { value: 4, max: 5 }, statuses: {} });
  enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  dealPoiseDamage(combat, enemy, 10, { source: combat.player, carrier: PHYSICAL });
  assert.equal(enemy.persistentPoise.value, 1);
  dealPoiseDamage(combat, enemy, 10, { source: combat.player, carrier: SMASH });
  assert.equal(enemy.persistentPoise.value, 0);
});

test('rules 2-3: the shipped data turns the floor on', () => {
  assert.equal(shipped.stanceBenefits.defend.poiseFloorWhileBlock, 1);
  assert.equal(shipped.stanceBenefits.defend.poiseFloorWardMagic, 1);
});

// ---- Rule 4: the enemy Counter badge ----
// Seed 1 opens the Gilded Knight's fight on Parry (intent block, counterDamage 6): its Counter is armed for the player phase.
const gilded = rules => live({ enemyId: 'gildedKnight', seed: 1, rules });
const badgeEvents = (events, enemy) => events.filter(e => e.type === 'counterStacksChanged' && e.targetId === enemy.id).map(e => [e.amount, !!e.consumed, !!e.decay]);

test('rule 4: the Gilded Knight Parry arms its Counter with a Counter badge of 1', () => {
  const { enemy } = gilded();
  assert.equal(enemy.intent?.moveId, 'parry');
  assert.ok(enemy.combatCounter?.charges > 0);
  assert.equal(enemy.counterStacks, 1);
});

test('rule 4: the badge drops by 1 when the Counter is used, and the return is unchanged by it', () => {
  const { combat, enemy } = gilded();
  const from = combat.eventLog.length;
  play(combat, 'x', 'core.strike', {});
  const events = combat.eventLog.slice(from);
  const answer = events.find(e => e.type === 'combatCounterTriggered' && e.sourceId === enemy.id);
  assert.ok(answer, 'the Parry answers the strike');
  assert.deepEqual(badgeEvents(events, enemy), [[-1, true, false]]);
  assert.equal(enemy.counterStacks ?? 0, 0);
  // A fight saved without the key: its enemy never held a badge (the fight is made before the rules are edited, so drop the one granted).
  const plain = gilded(rules => { delete rules.counter.enemyBadgeStacks; });
  delete plain.enemy.counterStacks;
  const before = plain.combat.eventLog.length;
  play(plain.combat, 'x', 'core.strike', {});
  const old = plain.combat.eventLog.slice(before).find(e => e.type === 'combatCounterTriggered' && e.sourceId === plain.enemy.id);
  assert.equal(answer.amount, old.amount, 'the badge does not scale the enemy return');
  assert.equal(answer.counterStacks, 0);
});

test('rule 4: an unused badge decays by 1 at the enemy turn start and its Counter ends with it', () => {
  const { combat, enemy } = gilded();
  const events = endTurn(combat);
  assert.deepEqual(badgeEvents(events, enemy).slice(0, 1), [[-1, false, true]], 'the badge fades at the enemy turn start');
  assert.notEqual(enemy.intent?.moveId, 'parry', 'Parry cannot repeat (maxConsecutive 1)');
  assert.equal(enemy.counterStacks ?? 0, 0);
  assert.equal(enemy.combatCounter, undefined);
});

test('rule 4 edge: a badge above 1 is not a second answer; a use takes 1 and spends the charge, the rest fades 1 per enemy turn start', () => {
  const { combat, enemy } = gilded(rules => { rules.counter.enemyBadgeStacks = 3; });
  enemy.counterStacks = 3;
  play(combat, 'x', 'core.strike', {});
  assert.equal(enemy.counterStacks, 2, 'a use takes 1');
  assert.equal(enemy.combatCounter?.charges ?? 0, 0, 'the charge is spent: one answer per arming, as before');
  const events = endTurn(combat);
  assert.deepEqual(badgeEvents(events, enemy)[0], [-1, false, true]);
  assert.equal(enemy.counterStacks, 1);
  assert.equal(enemy.combatCounter, undefined, 'a spent Counter does not stay armed on the badge');
});

test('rule 4 edge: a fight saved without counter.enemyBadgeStacks grants no badge', () => {
  const { combat, enemy } = gilded(rules => { delete rules.counter.enemyBadgeStacks; });
  delete enemy.counterStacks;
  primeEnemyCounter(combat, enemy, registries.enemies.get('gildedKnight').moves.parry, 'parry');
  assert.ok(enemy.combatCounter?.charges > 0);
  assert.equal(enemy.counterStacks ?? 0, 0);
});

test('rule 4: the shipped data turns the badge on', () => {
  assert.equal(shipped.counter.enemyBadgeStacks, 1);
});
