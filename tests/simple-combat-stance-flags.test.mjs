// stances.builtInBenefits and stances.sameStanceDiscount (docs/design/SIMPLE-COMBAT-PLAN.md step 1):
// off removes each stance's own bonus, or the same-stance cuts; on (Core today) keeps them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AttackDamageMultiplier,
  BlockGainMultiplier,
  NeutralExtraDraw,
  StanceWeaknessMultiplier,
} from '../src/engine/stanceBenefits.js';
import { stanceEffectiveness, stanceStaminaCost } from '../src/model/stanceRules.js';
import {
  SimpleCombatFixture,
  SimpleCombatRegistries,
  SimpleCombatFight,
} from './helpers/simple-combat.mjs';

const BENEFITS_OFF = 'stanceBenefitsOff';
const DISCOUNT_OFF = 'sameStanceDiscountOff';
const ATTACK_STANCE = 'attack';
const DEFEND_STANCE = 'defend';
const NEUTRAL_STANCE = 'neutral';
const PROBE = SimpleCombatFixture.stanceProbe;

function inStance(entity, maneuver)
{
  return {
    ...entity,
    combatStance:
    {
      ...PROBE.stance,
      maneuver,
    },
  };
}

function benefitReadings(combat)
{
  const player = combat.player;
  return {
    attack: AttackDamageMultiplier(combat, inStance(player, ATTACK_STANCE), null),
    defendBlock: BlockGainMultiplier(combat, inStance(player, DEFEND_STANCE)),
    idleDraw: NeutralExtraDraw(combat, { ...player, combatStance: null }, PROBE.secondTurn),
    idleWeakness: StanceWeaknessMultiplier(combat, null, NEUTRAL_STANCE, {}),
  };
}

function discountReadings(combat)
{
  const enemy = {
    ...combat.enemies[0],
    combatStance: PROBE.stance,
  };
  return {
    sp: stanceStaminaCost(PROBE.baseSp, enemy, PROBE.carrier, combat),
    effectiveness: stanceEffectiveness(combat, enemy, PROBE.carrier),
  };
}

test('stances.builtInBenefits on: Attack, Defend and Idle keep their bonuses', () =>
{
  const readings = benefitReadings(SimpleCombatFight(SimpleCombatRegistries()));
  assert.ok(readings.attack > 1, 'Attack adds damage');
  assert.ok(readings.defendBlock > 1, 'Defend adds Block');
  assert.ok(readings.idleDraw > 0, 'Idle draws an extra card');
  assert.ok(readings.idleWeakness > 1, 'Idle is weak');
});

test('stances.builtInBenefits off: no stance bonus, the Idle weakness stays', () =>
{
  const readings = benefitReadings(SimpleCombatFight(SimpleCombatRegistries(BENEFITS_OFF)));
  assert.equal(readings.attack, 1);
  assert.equal(readings.defendBlock, 1);
  assert.equal(readings.idleDraw, 0);
  assert.ok(readings.idleWeakness > 1, 'weaknesses are not benefits');
});

test('stances.sameStanceDiscount on: the held stance cuts SP and raises the effect', () =>
{
  const readings = discountReadings(SimpleCombatFight(SimpleCombatRegistries()));
  assert.ok(readings.sp < PROBE.baseSp, 'same stance costs less');
  assert.ok(readings.effectiveness > 1, 'same stance hits harder');
});

test('stances.sameStanceDiscount off: full price and no effectiveness bonus', () =>
{
  const readings = discountReadings(SimpleCombatFight(SimpleCombatRegistries(DISCOUNT_OFF)));
  assert.equal(readings.sp, PROBE.baseSp);
  assert.equal(readings.effectiveness, 1);
});
