// Owner, 2026-11-14 (Wave 2.5): each stance has its own natural benefit, on top of the unchanged matchup table, for players AND enemies.
//   Attack +20% damage | Smash +50% Poise damage | Sweep splash 50% to every other enemy in range | Counter +25% Block, returns 25% of HP lost
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
const card = maneuver => ({ combatProfile: { camp: maneuver === 'prepared' ? 'spell' : 'physical', maneuver, range: 'melee' } });

test('shipped data holds the approved numbers and the validator guards them', () => {
  assert.deepEqual(shipped.stanceBenefits, { version: 1, attack: { damageMultiplier: 1.2 }, smash: { poiseDamageBonus: 0.5 }, sweep: { splashFraction: 0.5 },
    counter: { blockMultiplier: 1.25, hpReturnFraction: 0.25 }, defend: { blockMultiplier: 1.5, poiseDamageTakenMultiplier: 0.75 },
    prepared: { damageMultiplier: 1.25 }, neutral: { extraDrawNextTurn: 1 } });
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

test('Counter returns 25% of the HP lost; nothing when the hit was fully blocked', () => {
  assert.equal(Benefits.CounterReturnAmount(fight, 'counter', 12, {}), 3);
  assert.equal(Benefits.CounterReturnAmount(fight, 'counter', 3, {}), 0);
  assert.equal(Benefits.CounterReturnAmount(fight, 'counter', 0, {}), 0, 'fully blocked');
  assert.equal(Benefits.CounterReturnAmount(fight, 'defend', 12, {}), 0);
  assert.equal(Benefits.CounterReturnAmount(fight, 'counter', 12, { counterReturnAttack: true }), 0, 'a return never returns');
});

test('neutral: a player at rest draws one extra card from its second turn; enemies and other stances draw none', () => {
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'player' }, 2), 1);
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'player', combatStance: { maneuver: 'neutral' } }, 5), 1);
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'player' }, 1), 0, 'turn 1 has no earlier turn to have rested in');
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'player', combatStance: { maneuver: 'attack' } }, 3), 0);
  assert.equal(Benefits.NeutralExtraDraw(fight, { kind: 'enemy' }, 3), 0);
});
