// Owner, 2026-11-14 (Wave 2.5): each stance has its own natural benefit, on top of the unchanged matchup table, for players AND enemies.
//   Attack +20% damage | Smash +50% Poise damage | Sweep: no extra benefit (owner: sweeps are AoE for full damage; the splash hook stays inert, covered with an explicit fixture) | Counter +25% Block, returns 25% of HP lost
//   Defend +50% Block, -25% Poise damage taken | Prepared spells +25% damage | neutral: the player draws 1 extra card next turn.
// Numbers live in fixCoreMechanics.json `stanceBenefits`; a fight created before the ruling has no block and plays today's rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules } from '../src/model/fixCoreMechanics.js';
import * as Benefits from '../src/engine/stanceBenefits.js';

const modern = rules => ({ combatExpansionVersion: 2, fixCoreRules: rules, gameProfile: { modules: { effects: { fixCoreVersion: 1 } } } });
const fight = modern(shipped);
const old = modern((({ stanceBenefits, ...rest }) => rest)(shipped));
// Owner, 2026-11-14: a Sweep has no extra benefit in the shipped data; the splash hook is kept inert and is exercised through this explicit fixture.
const withSplash = rules => ({ ...rules, stanceBenefits: { ...rules.stanceBenefits, sweep: { splashFraction: 0.5 } } });
const card = maneuver => ({ combatProfile: { camp: maneuver === 'prepared' ? 'spell' : 'physical', maneuver, range: 'melee' } });

test('shipped data holds the approved numbers and the validator guards them', () => {
  assert.deepEqual(shipped.stanceBenefits, { version: 1, attack: { damageMultiplier: 1.2 }, smash: { poiseDamageBonus: 0.5 },
    counter: { blockMultiplier: 1.25 }, defend: { blockMultiplier: 1.5, poiseDamageTakenMultiplier: 0.75, poiseFloorWhileBlock: 1, poiseFloorWardMagic: 1 },
    prepared: { damageMultiplier: 1.25, meleeDamageTakenMultiplier: 1.25 }, neutral: { extraDrawNextTurn: 1, damageTakenMultiplier: 1.25 } });
  assert.doesNotThrow(() => validateFixCoreRules(shipped));
  assert.doesNotThrow(() => validateFixCoreRules((({ stanceBenefits, ...rest }) => rest)(shipped)), 'a block saved before the ruling stays valid');
  const bad = patch => validateFixCoreRules({ ...shipped, stanceBenefits: { ...shipped.stanceBenefits, ...patch } });
  assert.throws(() => bad({ attack: { damageMultiplier: -1 } }), /stanceBenefits\.attack/);
  assert.throws(() => bad({ attack: { extra: 1 } }), /stanceBenefits\.attack/);
  assert.throws(() => bad({ idle: { damageMultiplier: 2 } }), /stanceBenefits\.idle/);
  assert.throws(() => validateFixCoreRules({ ...shipped, stanceBenefits: { ...shipped.stanceBenefits, version: 2 } }), /version 1/);
});

test('a fight without the block gets no benefit from any hook', () => {
  assert.equal(Benefits.StanceBenefitRules(old), null);
  const who = { kind: 'player', combatStance: { maneuver: 'defend' } };
  assert.equal(Benefits.AttackDamageMultiplier(old, who, card('attack')), 1);
  assert.equal(Benefits.BlockGainMultiplier(old, who, card('defend')), 1);
  assert.deepEqual(Benefits.PoiseLossAdjust(old, who, card('smash'), 'defend', { taken: 10, pool: 20 }), { extra: 0, spared: 0 });
  assert.equal(Benefits.CounterReturnAmount(old, 'counter', 12, {}), 0);
  assert.equal(Benefits.SweepSplashFraction(old, who, card('sweep')), 0);
  assert.equal(Benefits.NeutralExtraDraw(old, { kind: 'player' }, 3), 0);
});

test('damage multipliers: Attack 1.2, Prepared 1.25, every other stance 1; a return hit never gets one', () => {
  const player = { kind: 'player' }, enemy = { kind: 'enemy' };
  assert.equal(Benefits.AttackDamageMultiplier(fight, player, card('attack')), 1.2);
  assert.equal(Benefits.AttackDamageMultiplier(fight, enemy, card('attack')), 1.2, 'enemies too');
  assert.equal(Benefits.AttackDamageMultiplier(fight, player, card('prepared')), 1.25);
  for (const stance of ['smash', 'sweep', 'defend', 'counter']) assert.equal(Benefits.AttackDamageMultiplier(fight, player, card(stance)), 1, stance);
  assert.equal(Benefits.AttackDamageMultiplier(fight, player, { ...card('attack'), counterReturnAttack: true }), 1);
  assert.equal(Benefits.AttackDamageMultiplier(fight, { kind: 'player', combatStance: { maneuver: 'attack' } }, {}), 1.2, 'a carrier without a stance acts from the held one');
});

test('Block multipliers: Defend 1.5, Counter 1.25', () => {
  const player = { kind: 'player' };
  assert.equal(Benefits.BlockGainMultiplier(fight, player, card('defend')), 1.5);
  assert.equal(Benefits.BlockGainMultiplier(fight, player, card('counter')), 1.25);
  assert.equal(Benefits.BlockGainMultiplier(fight, player, card('attack')), 1);
  assert.equal(Benefits.BlockGainMultiplier(fight, { kind: 'enemy', combatStance: { maneuver: 'defend' } }, {}), 1.5);
});

test('Poise: Smash adds 50% of what the hit took (capped by the pool); a Defend target spares 25% of the total', () => {
  const smash = card('smash'), attack = card('attack'), enemy = { kind: 'enemy' };
  assert.deepEqual(Benefits.PoiseLossAdjust(fight, enemy, smash, 'attack', { taken: 8, pool: 20 }), { extra: 4, spared: 0 });
  assert.deepEqual(Benefits.PoiseLossAdjust(fight, enemy, smash, 'attack', { taken: 8, pool: 10 }), { extra: 2, spared: 0 }, 'never more than the pool holds');
  assert.deepEqual(Benefits.PoiseLossAdjust(fight, enemy, attack, 'defend', { taken: 8, pool: 20 }), { extra: 0, spared: 2 });
  assert.deepEqual(Benefits.PoiseLossAdjust(fight, enemy, smash, 'defend', { taken: 8, pool: 20 }), { extra: 4, spared: 3 }, 'Smash into Defend: +4, then -25% of 12');
  assert.deepEqual(Benefits.PoiseLossAdjust(fight, enemy, smash, 'defend', { taken: 0, pool: 20 }), { extra: 0, spared: 0 });
});

test('Counter stance returns nothing of its own (batch 5, owner 2026-11-15); a fight saved with hpReturnFraction keeps the 25% return', () => {
  assert.equal(Benefits.CounterReturnAmount(fight, 'counter', 12, {}), 0, 'the shipped data has no hpReturnFraction');
  const saved = modern({ ...shipped, stanceBenefits: { ...shipped.stanceBenefits, counter: { blockMultiplier: 1.25, hpReturnFraction: 0.25 } } });
  assert.equal(Benefits.CounterReturnAmount(saved, 'counter', 12, {}), 3);
  assert.equal(Benefits.CounterReturnAmount(saved, 'counter', 3, {}), 0);
  assert.equal(Benefits.CounterReturnAmount(saved, 'counter', 0, {}), 0, 'fully blocked');
  assert.equal(Benefits.CounterReturnAmount(saved, 'defend', 12, {}), 0);
  assert.equal(Benefits.CounterReturnAmount(saved, 'counter', 12, { counterReturnAttack: true }), 0, 'a return never returns');
});

test('neutral: a player at rest draws one extra card from its second turn; enemies and other stances draw none', () => {
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'player' }, 2), 1);
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'player', combatStance: { maneuver: 'neutral' } }, 5), 1);
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'player' }, 1), 0, 'turn 1 has no earlier turn to have rested in');
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'player', combatStance: { maneuver: 'attack' } }, 3), 0);
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'enemy' }, 3), 0);
});

// ---- Live resolution: the same receipt drives the hit, the preview and the card face ----
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs'; // fixtures drop enemy weaknesses (SPEC 5.3)
import { applyAttackDamage, computeBlockGain, gainBlock } from '../src/engine/actions.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const OPEN = { skipRatingBonus: true };
const carrierOf = (maneuver, camp = 'physical') => ({ ...OPEN, combatProfile: { camp, maneuver, range: 'melee' } });
const stanceOf = maneuver => ({ maneuver, camp: 'physical', range: 'melee' });
/** `benefits: false` plays the same fight under the rules a fight created before the ruling holds (no stanceBenefits block).
 *  `idleWeakness: false` leaves out the Idle stance weakness (theme B, 2026-11-17), so a stance-less target takes only the attacker's benefit. */
function live({ benefits = true, enemies = ['wanderingSoldier'], poise = 0, block = 0, stance = null, idleWeakness = true } = {}) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: enemies });
  if (!benefits) { const { stanceBenefits, ...rest } = combat.fixCoreRules; combat.fixCoreRules = rest; }
  if (!idleWeakness) delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;
  for (const target of combat.enemies) {
    Object.assign(target, { hp: 500, maxHp: 500, block, barrier: 0, statuses: {}, persistentPoise: { value: poise, max: Math.max(20, poise) }, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
    delete target.combatCounter;
    if (stance) target.combatStance = stanceOf(stance); else delete target.combatStance;
  }
  Object.assign(combat.player, { hp: 500, maxHp: 500, block: 0, statuses: {}, persistentPoise: { value: poise, max: 20 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  return { combat, target: combat.enemies[0] };
}
const strike = (combat, from, to, amount, carrier) => { primeAccuracyRolls(combat); applyAttackDamage(combat, from, to, amount, [], carrier); return combat.eventLog.filter(row => row.type === 'damageDealt').at(-1); };

test('Attack +20% and Prepared +25%: shown (preview) equals dealt, for a player and for an enemy; the old rules deal the printed number', () => {
  for (const [maneuver, camp, expected] of [['attack', 'physical', 6], ['prepared', 'spell', 6], ['smash', 'physical', 5], ['sweep', 'physical', 5]]) {
    const carrier = carrierOf(maneuver === 'prepared' ? 'casting' : maneuver, camp);
    const { combat, target } = live({ idleWeakness: false });
    const shown = previewDamageHits(combat, combat.player, target, 10, [], carrier, 1).hitDamages[0];
    const dealt = strike(combat, combat.player, target, 10, carrier);
    // The Core base-damage scale halves the printed 10 to 5 (rounded up); 5 x 1.25 = 6.25 floors to 6; every row here lands on 6 or the scaled 5.
    assert.equal(500 - target.hp, expected, `${maneuver} deals ${expected}`);
    assert.equal(shown, 500 - target.hp, `${maneuver}: the quote is the HP lost`);
    assert.ok(dealt);
  }
  { // an enemy in Attack stance hits the player for +20%
    const { combat, target } = live({ idleWeakness: false });
    const hit = strike(combat, target, combat.player, 10, carrierOf('attack'));
    assert.equal(500 - combat.player.hp, 6); assert.ok(hit); // 10 halved to 5, x1.25 floors to 6
  }
  { // the old rules (a fight created before the ruling): the printed number
    const { combat, target } = live({ benefits: false });
    strike(combat, combat.player, target, 10, carrierOf('attack'));
    assert.equal(500 - target.hp, 5); // the printed 10, halved by the Core base-damage scale
  }
});

test('Block gained: Defend x1.5, Counter x1.25, others unchanged; the old rules keep the printed Block', () => {
  const { combat } = live();
  const block = maneuver => computeBlockGain(combat, combat.player, 10, carrierOf(maneuver));
  assert.equal(block('defend'), 15);
  assert.equal(block('counter'), 12);
  assert.equal(block('attack'), 10);
  const old = live({ benefits: false }).combat;
  assert.equal(computeBlockGain(old, old.player, 10, carrierOf('defend')), 10);
  const before = combat.player.block;
  gainBlock(combat, combat.player, 10, { ...carrierOf('defend'), cardId: 'x' });
  assert.equal(combat.player.block - before, computeBlockGain(combat, combat.player, 10, { ...carrierOf('defend'), cardId: 'x' }), 'the Block gained is the Block quoted');
});

test('Poise: a Smash costs the pool 50% more, a Defend target 25% less; HP lost is unchanged; the preview carries the same Poise', () => {
  const lost = (benefits, attacker, defender, base = 40) => {
    const { combat, target } = live({ benefits, poise: 20, stance: defender });
    const preview = previewDamageHits(combat, combat.player, target, base, [], carrierOf(attacker), 1);
    strike(combat, combat.player, target, base, carrierOf(attacker));
    return { pool: 20 - target.persistentPoise.value, hp: 500 - target.hp, previewHp: preview.hitDamages[0] };
  };
  const smashOld = lost(false, 'smash', 'attack'), smashNew = lost(true, 'smash', 'attack');
  assert.ok(smashOld.pool > 0);
  assert.equal(smashNew.pool, smashOld.pool + Math.floor(0.5 * smashOld.pool), 'Smash: +50% Poise damage');
  assert.equal(smashNew.hp, smashOld.hp, 'the extra is Poise damage, not HP');
  const defOld = lost(false, 'sweep', 'defend'), defNew = lost(true, 'sweep', 'defend');
  assert.equal(defNew.pool, defOld.pool - Math.floor(0.25 * defOld.pool), 'Defend: -25% Poise damage taken');
  assert.equal(defNew.previewHp, defNew.hp, 'quotes equal HP lost');
  // The existing Smash vs Defend rule keeps working: its Poise drain is 50% of the total, now with the Smash bonus and the Defend sparing on top.
  const both = lost(true, 'smash', 'defend', 16), bothOld = lost(false, 'smash', 'defend', 16);
  assert.ok(bothOld.pool > 0);
  const taken = bothOld.pool, extra = Math.floor(0.5 * taken);
  assert.equal(both.pool, taken + extra - Math.floor(0.25 * (taken + extra)));
});

test('Counter stance: a hit that costs HP returns nothing (batch 5); a fight saved with hpReturnFraction still returns 25% of the HP lost', () => {
  const trial = ({ legacyReturn = false, block = 0, attacker = 'player' } = {}) => {
    const { combat, target } = live({ stance: 'counter', block });
    if (legacyReturn) combat.fixCoreRules = { ...combat.fixCoreRules, stanceBenefits: { ...combat.fixCoreRules.stanceBenefits, counter: { blockMultiplier: 1.25, hpReturnFraction: 0.25 } } };
    const [from, to] = attacker === 'player' ? [combat.player, target] : [target, combat.player];
    if (attacker === 'enemy') { to.combatStance = stanceOf('counter'); to.block = block; }
    strike(combat, from, to, 40, carrierOf('sweep'));
    return { lost: 500 - to.hp, back: 500 - from.hp };
  };
  const shipped = trial();
  assert.ok(shipped.lost > 0);
  assert.equal(shipped.back, 0, 'the shipped Counter stance returns nothing of its own (the stack return is the Counter card\'s)');
  assert.equal(trial({ attacker: 'enemy' }).back, 0);
  const saved = trial({ legacyReturn: true });
  assert.equal(saved.back, Math.floor(0.25 * saved.lost), 'a fight saved with the 25% return keeps it');
  assert.equal(trial({ legacyReturn: true, block: 1000 }).back, 0, 'a fully blocked hit returns nothing');
});

// ---- Sweep: played through the engine, with cleavingBlow (a Sweep card) retargeted to ONE enemy so the splash is what reaches the others ----
import { dispatch, previewCard } from '../src/engine/combat.js';
import { TargetQuote, TargetQuoteSplashHits } from '../src/ui/models/TargetQuoteModel.js';
import { rangePairKey, actorRangeKey } from '../src/model/combatEngagement.js';
const singleBundle = { ...contentBundle, cards: contentBundle.cards.map(card => card.id !== 'cleavingBlow' ? card
  : { ...card, effects: card.effects.map(effect => effect.op === 'damage' ? { ...effect, target: 'enemy' } : effect) }) };
const singleReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(singleBundle, profile)), profile);
function sweepFight({ benefits = true, enemies = 3, splash = true } = {}) {
  const run = createRunState({ registries: singleReg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: singleReg, run, rng: createRng(511), enemyIds: Array.from({ length: enemies }, () => 'wanderingSoldier') });
  if (!benefits) { const { stanceBenefits, ...rest } = combat.fixCoreRules; combat.fixCoreRules = rest; }
  else if (splash) combat.fixCoreRules = withSplash(combat.fixCoreRules);
  for (const enemy of combat.enemies) Object.assign(enemy, { hp: 500, maxHp: 500, block: 0, barrier: 0, statuses: {}, persistentPoise: { value: 0, max: 20 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 0 } });
  Object.assign(combat.player, { hp: 500, maxHp: 500, statuses: {} });
  return combat;
}
function playCleave(combat, targetId) {
  const ref = { instanceId: 'sweep-test', cardId: 'cleavingBlow', upgraded: false };
  combat.piles.hand.push(ref);
  combat.player.energy = combat.player.stamina = 20; combat.player.mana = combat.player.maxMana;
  primeAccuracyRolls(combat);
  dispatch(combat, { type: 'playCard', cardInstanceId: ref.instanceId, targetId });
}

test('Sweep splash hook (explicit rule fixture; not shipped): a single-target Sweep also hits every other enemy in range at 50% of its damage', () => {
  const combat = sweepFight();
  playCleave(combat, combat.enemies[0].id);
  const lost = combat.enemies.map(enemy => 500 - enemy.hp);
  assert.ok(lost[0] > 0, 'the aimed enemy is hit');
  assert.equal(lost[1], Math.floor(lost[0] / 2), 'the second enemy takes 50% of the hit');
  assert.equal(lost[2], lost[1], 'and so does the third');
  // Range: an enemy the Sweep cannot reach is not splashed (the same contact the hit itself uses).
  const far = sweepFight();
  const sweepCarrier = { ...carrierOf('sweep'), resolvedRangeSource: { sourceType: 'unarmed' } };
  assert.deepEqual(Benefits.SweepSplashTargets(far, far.player, far.enemies[0], sweepCarrier, far.enemies).map(e => e.id), [far.enemies[1].id, far.enemies[2].id].map(String));
  far.rangeState.engagements[rangePairKey(actorRangeKey(far, far.player), actorRangeKey(far, far.enemies[2]))] = 1;
  assert.deepEqual(Benefits.SweepSplashTargets(far, far.player, far.enemies[0], sweepCarrier, far.enemies).map(e => e.id), [far.enemies[1].id], 'the enemy at Reach is out of a melee Sweep');
  assert.deepEqual(Benefits.SweepSplashTargets(far, far.player, far.enemies[0], carrierOf('attack'), far.enemies), [], 'only a Sweep splashes');
  const old = sweepFight({ benefits: false });
  playCleave(old, old.enemies[0].id);
  assert.deepEqual(old.enemies.map(enemy => 500 - enemy.hp).slice(1), [0, 0], 'a fight created before the ruling hits only the aimed enemy');
});

test('shipped data gives a Sweep no splash: every enemy it already reaches takes the full hit, and the hook is inert', () => {
  assert.equal(shipped.stanceBenefits.sweep, undefined);
  assert.equal(Benefits.SweepSplashFraction(fight, { kind: 'player', combatStance: { maneuver: 'sweep' } }, card('sweep')), 0);
  const combat = sweepFight({ splash: false });
  playCleave(combat, combat.enemies[0].id);
  assert.deepEqual(combat.enemies.map(enemy => 500 - enemy.hp).slice(1), [0, 0], 'the shipped rules add no splash to a single-target Sweep card');
});

test('neutral: a player who ends a turn holding no stance draws one extra card next turn; holding a stance, or under the old rules, draws the usual hand', () => {
  const handAfterNextTurn = ({ benefits = true, stance = null } = {}) => {
    const { combat } = live({ benefits });
    combat.player.energy = 5;
    if (stance) combat.player.combatStance = stanceOf(stance); else delete combat.player.combatStance;
    dispatch(combat, { type: 'setReactions', enabled: false });
    dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.phase, 'player', 'the enemies acted and the next turn began');
    return combat.piles.hand.length;
  };
  const base = handAfterNextTurn({ benefits: false });
  assert.equal(handAfterNextTurn(), base + 1, 'no stance: one extra card');
  assert.equal(handAfterNextTurn({ stance: 'attack' }), base, 'a held stance draws the usual hand');
});

test('Sweep splash hook (explicit rule fixture): quotes: aimed at one enemy, each other enemy in range quotes its splash as an extra line, and it is the HP the play takes', () => {
  const combat = sweepFight();
  const ref = { instanceId: 'sweep-quote', cardId: 'cleavingBlow', upgraded: false };
  combat.piles.hand.push(ref);
  combat.player.energy = combat.player.stamina = 20; combat.player.mana = combat.player.maxMana;
  const [aimed, second, third] = combat.enemies;
  const reference = previewCard(combat, ref.instanceId, aimed.id);
  const preview = (_c, id, targetId) => previewCard(combat, id, targetId);
  const quote = TargetQuote({ preview, combat, instanceId: ref.instanceId, targetId: second.id, reference });
  const aimedQuote = TargetQuote({ preview, combat, instanceId: ref.instanceId, targetId: aimed.id, reference });
  assert.ok(aimedQuote.hits[0] > 0 && !aimedQuote.splash, 'the aimed enemy has its own quote and no splash line');
  assert.deepEqual(quote.splash, [Math.floor(aimedQuote.hits[0] / 2)], 'the other enemy quotes half of the aimed hit as its splash');
  assert.deepEqual(TargetQuoteSplashHits(reference, third.id), quote.splash);
  assert.match(quote.splashText, /Sweep/);
  playCleave(combat, aimed.id);
  assert.equal(500 - second.hp, quote.splash[0], 'quotes equal HP lost');
  assert.equal(500 - aimed.hp, aimedQuote.hits[0]);
});

import { StanceBenefitTip } from '../src/ui/models/StanceBenefitModel.js';
import { readFileSync } from 'node:fs';

test('the stance tooltip and the stance help state each benefit in the same words as the numbers', () => {
  const expected = { attack: /\+20% damage/, smash: /\+50% Poise damage/, sweep: /No extra benefit.*full damage/, counter: /\+25% Block gained\.?$/, defend: /\+50% Block.*25% less Poise/, casting: /\+25% damage/ };
  for (const [maneuver, pattern] of Object.entries(expected)) assert.match(StanceBenefitTip(maneuver).body, pattern, maneuver);
  assert.match(StanceBenefitTip('prepare').body, /draw 1 extra card/, 'the resting glyph names the no-stance draw');
  const nodes = readFileSync(new URL('../content/source/nodes.csv', import.meta.url), 'utf8');
  for (const id of ['attack', 'defend', 'counter', 'sweep', 'smash', 'casting']) assert.match(nodes.split('\n').find(row => row.startsWith(`maneuver:${id},`)), /Stance benefit:/, `${id} help names its benefit`);
});

import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

test('a fight saved before the ruling keeps today\'s stance rules after a save and load; a fight saved with them keeps them', () => {
  for (const benefits of [false, true]) {
    const { combat } = live({ benefits });
    const loaded = restoreCombatSnapshot({ registries: reg, rng: createRng(511), snapshot: serializeCombatSnapshot(combat) });
    assert.equal(Boolean(Benefits.StanceBenefitRules(loaded)), benefits, `benefits ${benefits}`);
    assert.equal(computeBlockGain(loaded, loaded.player, 10, carrierOf('defend')), benefits ? 15 : 10);
    const target = loaded.enemies[0];
    Object.assign(target, { hp: 500, block: 0, persistentPoise: { value: 0, max: 20 } });
    delete target.weaknesses; // a loaded fight re-reads its enemies' weaknesses (SPEC 5.3); this test is about stance rules
    strike(loaded, loaded.player, target, 10, carrierOf('attack'));
    // With the rules: Attack's x1.2 on a stance-less (Idle) target, which takes x1.25 too (theme B, 2026-11-17), on the printed 10 halved to 5
    // by the Core base-damage scale (theme A): floor(5 x 1.2 x 1.25) = 7; without them the halved 5.
    assert.equal(500 - target.hp, benefits ? 7 : 5);
  }
});
