// Theme B of the 2026-11-17 playtest (owner): status and stance rules.
// Rule 1: Counter follows the normal decay rule. Its stacks lose 1 at the owner's turn start, and the armed Counter lasts while they do.
// Rules 2-3: a Defend-stance target holding Block keeps at least 1 Poise against physical hits and Sweeps (and magic while it holds Ward stacks);
// Smash still breaks it, and at 0 Block Poise breaks normally.
// Rule 4: an enemy Counter move (the Gilded Knight's Parry) shows a Counter badge that decays normally and loses 1 on each use.
// Rule 5: stance weaknesses. A Prepared target takes x1.25 from melee hits, an Idle one (no stance) x1.25 from every hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { applyAttackDamage, dealPoiseDamage, drainFixCorePoise } from '../src/engine/actions.js';
import { clearCombatCounter } from '../src/engine/combatMatchups.js';
import { primeEnemyCounter } from '../src/engine/combatCardTactics.js';
import { combatHealthModel } from '../src/ui/models/CombatHealthModel.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const SLASH = { kind: 'attack', moveId: 'slash', damage: 8, hits: 1,
  combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [], stanceTrigger: false } };

function live({ enemyId = 'wanderingSoldier', rules = null, seed = 511, classId = 'reaver' } = {}) {
  const run = createRunState({ registries, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
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

function historicalDefendPoise(rules) {
  // 256bfc86d0e and 31cf36edcea: asserted before the weapon-Poise and HP-buffer Ward rules.
  rules.poise = { drain: 'prevented', breakRule: 'broken', brokenDamageMultiplier: 1.5 };
  rules.ward = { enabled: false, poisePerStack: 5, routing: 'blockFirst' };
}

test('rule 3: in Defend with Block and Ward stacks a magic hit cannot break Poise either', () => {
  const r = defendHit(MAGIC, { block: 2, ward: 1, rules: historicalDefendPoise });
  assert.equal(r.poise, 1);
  assert.equal(r.broke, false);
  const physical = defendHit(PHYSICAL, { block: 2, ward: 1, rules: historicalDefendPoise });
  assert.equal(physical.poise, 1, 'physical keeps the floor with Ward too');
  const before = defendHit(MAGIC, { block: 2, ward: 1, rules: rules => { historicalDefendPoise(rules); delete rules.stanceBenefits.defend.poiseFloorWardMagic; } });
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

test('rule 4 edge: a badge above 1 is not a second answer; a use takes 1 and spends the charge, and the rest goes when the spent Counter ends', () => {
  const { combat, enemy } = gilded(rules => { rules.counter.enemyBadgeStacks = 3; });
  enemy.counterStacks = 3;
  play(combat, 'x', 'core.strike', {});
  assert.equal(enemy.counterStacks, 2, 'a use takes 1');
  assert.equal(enemy.combatCounter?.charges ?? 0, 0, 'the charge is spent: one answer per arming, as before');
  endTurn(combat);
  assert.equal(enemy.combatCounter, undefined, 'a spent Counter does not stay armed on the badge');
  assert.equal(enemy.counterStacks ?? 0, 0, 'and the badge goes with the Counter it counted');
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

test('rule 4: the enemy Counter badge tooltip states what the badge does, not the player stack return', () => {
  const enemyBadge = combatHealthModel({ counterStacks: 1, counterDecay: 1, enemyCounter: true }).badges.find(row => row.kind === 'counter');
  assert.equal(enemyBadge.value, 1);
  assert.match(enemyBadge.help, /answers your next covered hit/);
  assert.doesNotMatch(enemyBadge.help, /% of the hit per stack/);
  const playerBadge = combatHealthModel({ counterStacks: 1, counterDecay: 1 }).badges.find(row => row.kind === 'counter');
  assert.match(playerBadge.help, /% of the hit per stack/);
});

// ---- Rule 5: stance weaknesses ----
const RANGED = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'piercing', range: 'ranged', targeting: 'single' } };
const REACH = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'piercing', range: 'reach', targeting: 'single' } };
/** The receipt of one `base` hit from the player on an enemy holding `stance` (null: none), with no Block or Poise in the way. */
function weaknessReceipt(carrier, stance, { base = 40, rules = null } = {}) {
  const { combat, enemy } = live({ rules });
  Object.assign(enemy, { block: 0, persistentPoise: { value: 0, max: 0 }, statuses: {} });
  if (stance) enemy.combatStance = { maneuver: stance, camp: stance === 'casting' ? 'spell' : 'physical', range: 'melee' };
  else delete enemy.combatStance;
  return profileDamageReceipt(combat, combat.player, enemy, base, { ...structuredClone(carrier), skipRatingBonus: true });
}
const weaknessStage = receipt => receipt.damageReceipt.hits[0].sources.find(row => row.id === 'stance-weakness');
// Owner ruling 2026-11-28 ships Prepared neutral; these fights keep the x1.25 melee weakness to cover the mechanic.
const PREPARED_MELEE_WEAKNESS = 1.25;
function withPreparedWeakness(rules)
{
  const prepared = rules.stanceBenefits.prepared;
  rules.stanceBenefits.prepared = { ...prepared, meleeDamageTakenMultiplier: PREPARED_MELEE_WEAKNESS };
}

test('rule 5: a Prepared target takes x1.25 from a melee hit, and nothing extra from a ranged, reach or magic hit', () => {
  // A Sweep does not beat Prepared, so the weakness is the only stance term here (Attack and Smash: the next test).
  const melee = weaknessReceipt(SWEEP, 'casting', { rules: withPreparedWeakness });
  assert.equal(weaknessStage(melee)?.multiplier, 1.25, 'the receipt lists the Stance weakness stage');
  assert.equal(weaknessStage(weaknessReceipt(RANGED, 'casting', { rules: withPreparedWeakness })), undefined);
  const off = weaknessReceipt(SWEEP, 'casting', { rules: rules => { delete rules.stanceBenefits.prepared.meleeDamageTakenMultiplier; } });
  assert.equal(melee.hpLoss, Math.floor(off.hpLoss * 1.25), 'shown = dealt: the hit is 1.25x the same hit without the rule');
  for (const carrier of [RANGED, REACH, MAGIC]) {
    const on = weaknessReceipt(carrier, 'casting', { rules: withPreparedWeakness });
    const without = weaknessReceipt(carrier, 'casting', { rules: rules => { delete rules.stanceBenefits.prepared.meleeDamageTakenMultiplier; } });
    assert.equal(on.hpLoss, without.hpLoss, `${carrier.combatProfile.range}/${carrier.combatProfile.camp}: no Prepared weakness`);
  }
});

// Owner ruling 2026-11-28 ships Attack's damage factor as 1; this fight keeps 1.2 for these pins.
const ATTACK_STANCE_FACTOR = 1.2;
function withAttackFactor(rules, adjust = null)
{
  const attack = rules.stanceBenefits.attack;
  rules.stanceBenefits.attack = { ...attack, damageMultiplier: ATTACK_STANCE_FACTOR };
  withPreparedWeakness(rules);
  adjust?.(rules);
}

test('decision 1: an advantage over Prepared and its melee weakness never stack; the hit takes the larger', () => {
  const dropWeakness = rules => withAttackFactor(rules, () =>
  {
    delete rules.stanceBenefits.prepared.meleeDamageTakenMultiplier;
  });
  const setWeakness = multiplier => rules => withAttackFactor(rules, () =>
  {
    rules.stanceBenefits.prepared.meleeDamageTakenMultiplier = multiplier;
  });
  for (const carrier of [PHYSICAL, SMASH]) {
    const name = carrier.combatProfile.maneuver;
    const both = weaknessReceipt(carrier, 'casting', { rules: withAttackFactor }), advantageOnly = weaknessReceipt(carrier, 'casting', { rules: dropWeakness });
    assert.equal(both.hpLoss, advantageOnly.hpLoss, `${name}: x1.25 in all, not x1.5625`);
    const advantageStage = both.damageReceipt.hits[0].sources.find(row => row.id === 'stance-advantage' || row.id === 'smash-vs-defensive');
    assert.equal(advantageStage, undefined, `${name}: the advantage adds nothing over an equal weakness`);
    const bigger = weaknessReceipt(carrier, 'casting', { rules: setWeakness(1.5) });
    assert.ok(Math.abs(bigger.hpLoss - advantageOnly.hpLoss / 1.25 * 1.5) <= 1, `${name}: a larger weakness wins (x1.5): ${bigger.hpLoss}`);
    const smaller = weaknessReceipt(carrier, 'casting', { rules: setWeakness(1.1) });
    assert.equal(smaller.hpLoss, advantageOnly.hpLoss, `${name}: a smaller weakness leaves the x1.25 advantage`);
  }
});

// 40 x 1.1, then the advantage stage's 1.25 / 1.1, must floor to 50 at the shipped Attack factor of 1.
const SMALL_WEAKNESS = 1.1;
const ADVANTAGE_OVER_SMALL_WEAKNESS_HIT = 50;
test('an advantage over a smaller weakness floors to its exact product, without float drift', () =>
{
  const setSmallWeakness = rules =>
  {
    rules.stanceBenefits.prepared.meleeDamageTakenMultiplier = SMALL_WEAKNESS;
  };
  const smaller = weaknessReceipt(PHYSICAL, 'casting', { rules: setSmallWeakness });
  assert.equal(smaller.hpLoss, ADVANTAGE_OVER_SMALL_WEAKNESS_HIT);
});

test('rule 5: an Idle target (no stance) takes x1.25 from every hit, melee, ranged and magic', () => {
  for (const carrier of [PHYSICAL, RANGED, MAGIC]) {
    const on = weaknessReceipt(carrier, null);
    const without = weaknessReceipt(carrier, null, { rules: rules => { delete rules.stanceBenefits.neutral.damageTakenMultiplier; } });
    assert.ok(without.hpLoss > 0);
    assert.equal(on.hpLoss, Math.floor(without.hpLoss * 1.25), `${carrier.combatProfile.range}/${carrier.combatProfile.camp}`);
  }
});

test('rule 5 edge: another stance takes no stance weakness', () => {
  for (const stance of ['attack', 'defend', 'counter', 'smash']) {
    const on = weaknessReceipt(PHYSICAL, stance);
    const without = weaknessReceipt(PHYSICAL, stance, { rules: rules => { delete rules.stanceBenefits.neutral.damageTakenMultiplier; delete rules.stanceBenefits.prepared.meleeDamageTakenMultiplier; } });
    assert.equal(on.hpLoss, without.hpLoss, stance);
  }
});

test('rule 5 edge: a Counter return hit never takes the weakness', () => {
  const on = weaknessReceipt({ ...PHYSICAL, counterReturnAttack: true }, null);
  const without = weaknessReceipt({ ...PHYSICAL, counterReturnAttack: true }, null, { rules: rules => { delete rules.stanceBenefits.neutral.damageTakenMultiplier; } });
  assert.equal(on.hpLoss, without.hpLoss);
});

test('rule 5: the shipped data turns the Idle weakness on and leaves Prepared neutral', () => {
  // Owner ruling 2026-11-28: Prepared takes no extra damage; Idle keeps its weakness.
  assert.equal(shipped.stanceBenefits.prepared.meleeDamageTakenMultiplier, 1);
  assert.equal(shipped.stanceBenefits.neutral.damageTakenMultiplier, 1.25);
});

test('rule 5 edge: an un-aimed hit (no target, a card face out of a fight) takes no stance weakness', () => {
  const { combat } = live();
  const plain = profileDamageReceipt(combat, combat.player, null, 40, { ...structuredClone(PHYSICAL), skipRatingBonus: true });
  assert.equal(plain.damageReceipt.hits[0].sources.find(row => row.id === 'stance-weakness'), undefined);
});

test('rule 5: the real core.strike and core.smash (no authored range: melee) meet the Prepared weakness, and it never stacks with their advantage', () => {
  // Strike (Attack) and Smash both beat Prepared (x1.25 advantage). Owner, 2026-11-17: the hit takes the larger of advantage and weakness, never both.
  for (const cardId of ['core.strike', 'core.smash']) {
    const fight = rules => {
      const { combat, enemy } = live({ rules });
      Object.assign(enemy, { block: 0, persistentPoise: { value: 0, max: 0 } });
      enemy.combatStance = { maneuver: 'casting', camp: 'spell', range: 'reach' };
      combat.piles.hand.push({ instanceId: 'x', cardId });
      const row = previewCard(combat, 'x', enemy.id).values.find(value => value.op === 'damage');
      const hp = enemy.hp;
      dispatch(combat, { type: 'playCard', cardInstanceId: 'x', targetId: enemy.id });
      return { face: row.faceValue, quote: row.perTarget?.[enemy.id], lost: hp - enemy.hp };
    };
    const on = fight(withPreparedWeakness), off = fight(rules => { delete rules.stanceBenefits.prepared.meleeDamageTakenMultiplier; });
    assert.ok(off.lost > 0, `${cardId} lands`);
    assert.ok(on.face > off.face, `${cardId}: the face carries the melee weakness, so the card counts as melee (${on.face} against ${off.face})`);
    assert.equal(on.lost, off.lost, `${cardId}: x1.25 in all, as with the advantage alone (not x1.5625)`);
    assert.equal(on.quote, on.lost, `${cardId}: the preview quote is the HP lost`);
  }
});

/** Cleaving Blow (7 damage, then a 3 Poise rider) at a Defend-stance enemy holding `block` Block and `poise` Poise: the preview's Poise row and the live result. */
// The Starseer: the Reaver's starting Forsaken Medallion adds its own triggered Poise damage to the first attack, which is not this card's rider.
function cleave({ block, poise, classId = 'starseer', cardId = 'cleavingBlow', rules = null }) {
  const { combat, enemy } = live({ classId, rules });
  Object.assign(enemy, { block, persistentPoise: { value: poise, max: 20 } });
  enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  combat.piles.hand.push({ instanceId: 'cleave', cardId });
  const view = previewCard(combat, 'cleave', enemy.id);
  const rider = view.values.find(value => value.op === 'poiseDamage')?.perTargetPoise?.[enemy.id];
  const from = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cleave', targetId: enemy.id });
  return { rider, poise: enemy.persistentPoise.value, broke: combat.eventLog.slice(from).some(e => e.type === 'poiseBroken' && e.targetId === enemy.id) };
}

test('rules 2-3: the preview keeps the Defend Poise floor the live rider keeps (Cleaving Blow, 100 Block, 3 Poise)', () => {
  const r = cleave({ block: 100, poise: 3, rules: historicalDefendPoise });
  assert.equal(r.poise, 1, 'live: the rider leaves 1 Poise');
  assert.equal(r.broke, false);
  assert.ok(r.rider, 'the preview quotes the rider');
  assert.equal(r.rider.breaks, false, 'the preview does not say BREAK');
  assert.equal(r.rider.removed, 2, 'the preview removes what live removes (3 -> 1)');
});

test('rules 2-3: a rider whose own hit spent the last Block still keeps the floor (Cleaving Blow, 5 Block, 4 Poise), in the preview and live', () => {
  const r = cleave({ block: 5, poise: 4, rules: historicalDefendPoise });
  assert.equal(r.poise, 1, 'live: the hit arrived while Block remained, so its rider leaves 1 Poise');
  assert.equal(r.broke, false);
  assert.equal(r.rider?.breaks, false, 'the preview agrees');
});

test('rules 2-3 edge: a rider on a hit that arrived at 0 Block breaks Poise normally', () => {
  const r = cleave({ block: 0, poise: 4, rules: historicalDefendPoise });
  assert.equal(r.poise, 0);
  assert.equal(r.broke, true);
  assert.equal(r.rider?.breaks, true);
});

test('rule 4 edge: showing the Counter intent again sets the badge, it does not stack', () => {
  const { combat, enemy } = gilded();
  const parry = registries.enemies.get('gildedKnight').moves.parry;
  primeEnemyCounter(combat, enemy, parry, 'parry');
  primeEnemyCounter(combat, enemy, parry, 'parry');
  assert.equal(enemy.counterStacks, 1);
});

test('rule 4 edge: the badge goes when the Counter is cleared, by a stagger or a re-planned intent', () => {
  for (const clear of ['stagger', 'replan']) {
    const { combat, enemy } = gilded();
    assert.equal(enemy.counterStacks, 1);
    if (clear === 'stagger') drainFixCorePoise(combat, combat.player, enemy, 999);
    else clearCombatCounter(enemy); // what a re-planned or re-shown intent does first (combat.js presentIntent / reshowIntent), with no fight context
    assert.equal(enemy.combatCounter, undefined, `${clear}: the Counter is cleared`);
    assert.equal(enemy.counterStacks ?? 0, 0, `${clear}: no stale badge`);
  }
});

test('decision 2: relic Poise damage keeps the Defend floor too (the Reaver Forsaken Medallion on the first attack)', () => {
  // The Medallion rides the first attack that lands: like a card rider it reads the Block held when that hit arrived, so a hit that spends the
  // last Block (Cleaving Blow into 8 Block) still leaves 1 Poise after the rider and the Medallion's 4.
  const r = cleave({ block: 8, poise: 8, classId: 'reaver' });
  assert.equal(r.poise, 1, 'the hit, its rider and the Medallion 4 Poise leave 1 Poise');
  assert.equal(r.broke, false);
  const smash = cleave({ block: 5, poise: 4, classId: 'reaver', cardId: 'core.smash' });
  assert.equal(smash.poise, 0, 'a Smash still empties it');
});

test('decision 2: carrier-less physical Poise damage keeps the floor; a Smash carrier does not', () => {
  const { combat, enemy } = live();
  Object.assign(enemy, { block: 3, persistentPoise: { value: 4, max: 5 }, statuses: {} });
  enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  dealPoiseDamage(combat, enemy, 10, { cause: 'relic' });
  assert.equal(enemy.persistentPoise.value, 1);
  enemy.block = 0;
  dealPoiseDamage(combat, enemy, 10, { cause: 'relic' });
  assert.equal(enemy.persistentPoise.value, 0, 'at 0 Block it breaks');
});

test('item 4: an enemy whose intent cannot be read has an unknown stance in the preview, not Idle: the quote is what live deals', () => {
  for (const hidden of [true, false]) {
    const { combat, enemy } = live();
    Object.assign(enemy, { block: 0, persistentPoise: { value: 0, max: 0 } });
    enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
    if (hidden) {
      assert.ok(combat.enemyKnowledge, 'the fight reads intents through enemy knowledge');
      delete enemy.actorIntentRevealed; delete enemy.proposalIntentRevealedUntil;
      enemy.knowledgeAction = { serial: 1, reads: { [combat.playerKey || 'player']: { visibility: 'hidden' } } };
    }
    combat.piles.hand.push({ instanceId: 'x', cardId: 'core.strike' });
    const quote = previewCard(combat, 'x', enemy.id).values.find(value => value.op === 'damage').perTarget[enemy.id];
    const hp = enemy.hp;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'x', targetId: enemy.id });
    assert.equal(quote, hp - enemy.hp, `${hidden ? 'hidden' : 'read'} intent: the quote equals the HP lost`);
  }
});

test('item 5: under the whole-action contact policy each Poise row reads the Block of the hit before it, in the preview and live (3-hit base.multi-hit)', () => {
  for (const [block, poise] of [[2, 6], [4, 6], [10, 9], [12, 9], [20, 6], [20, 9], [30, 6]]) {
    const { combat, enemy } = live({ classId: 'starseer' });
    Object.assign(enemy, { block, persistentPoise: { value: poise, max: 20 } });
    enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
    combat.piles.hand.push({ instanceId: 'm', cardId: 'base.multi-hit' });
    const rows = previewCard(combat, 'm', enemy.id).values.map(value => value.perTargetPoise?.[enemy.id]).filter(Boolean);
    const removed = rows.reduce((sum, row) => sum + row.removed, 0), breaks = rows.some(row => row.breaks);
    dispatch(combat, { type: 'playCard', cardInstanceId: 'm', targetId: enemy.id });
    const label = `Block ${block}, Poise ${poise}`;
    assert.equal(removed, poise - enemy.persistentPoise.value, `${label}: the preview removes the Poise live removes`);
    assert.equal(breaks, enemy.persistentPoise.value === 0, `${label}: the preview says BREAK exactly when live empties it`);
  }
});

test('review #2822: Ward damage drained into Poise (Ward off) follows its card, so a spell Ward Break still breaks, in the preview and live', () => {
  const { combat, enemy } = live({ classId: 'starseer' });
  Object.assign(enemy, { block: 5, persistentPoise: { value: 4, max: 20 } });
  enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  combat.piles.hand.push({ instanceId: 'w', cardId: 'base.break-ward' });
  const row = previewCard(combat, 'w', enemy.id).values.find(value => value.op === 'wardDamage')?.perTargetPoise?.[enemy.id];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'w', targetId: enemy.id });
  assert.ok(row, 'the preview quotes the Poise the Ward damage drains');
  assert.equal(row.breaks, true, 'a spell is magic: no Defend floor without Ward stacks');
  assert.equal(enemy.persistentPoise.value, 0, 'live agrees: Poise breaks');
});

test('review #2822 follow-up: a physical card Ward damage (Ward off) keeps the Defend floor in the preview, as live (base.multi-hit, 100 Block, 12 Poise)', () => {
  const { combat, enemy } = live({ classId: 'starseer' });
  // base.multi-hit deals 3 physical hits (9 weapon Poise total) before its 3 Ward damage,
  // so 12 Poise leaves 3 Poise when wardDamage resolves and hits the Defend floor (3 -> 1).
  Object.assign(enemy, { block: 100, persistentPoise: { value: 12, max: 20 } });
  enemy.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  combat.piles.hand.push({ instanceId: 'w', cardId: 'base.multi-hit' });
  const values = previewCard(combat, 'w', enemy.id).values;
  const ward = values.find(value => value.op === 'wardDamage')?.perTargetPoise?.[enemy.id];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'w', targetId: enemy.id });
  assert.ok(ward, 'the preview quotes the Poise the Ward damage drains');
  assert.equal(ward.breaks, false, 'physical Ward damage keeps the floor while Block remains');
  assert.equal(ward.removed, 2, '3 Poise -> 1, as live');
  assert.ok(!values.some(value => value.perTargetPoise?.[enemy.id]?.breaks), 'no row of the preview says BREAK');
  assert.equal(enemy.persistentPoise.value, 1, 'live keeps 1 Poise');
});
