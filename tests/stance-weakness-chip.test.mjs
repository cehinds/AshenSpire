// Playtest 2026-11-17 (items 31, 35): the icons under an enemy show its stance weakness. Prepared is weak to melee,
// Idle (no stance) to all damage; any other stance, a Broken or Staggered one, or no stance row shows none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StanceWeaknessFor } from '../src/model/stanceWeakness.js';
import { StanceBenefitRules } from '../src/engine/stanceBenefits.js';
import { StanceWeaknessChip } from '../src/ui/components/weaknessChips.js';
import { withKitDom } from './helpers/dom.mjs';

// The rule block a fight carries once the stance-weakness rule ships (#2813): stanceBenefits version 1 with the two multipliers.
const RULES = { version: 1, prepared: { damageMultiplier: 1.25, meleeDamageTakenMultiplier: 1.25 }, neutral: { extraDrawNextTurn: 1, damageTakenMultiplier: 1.25 } };

test('under the rule, Prepared (and its casting id) is weak to melee and Idle to all damage', () => {
  assert.deepEqual(StanceWeaknessFor({ maneuver: 'prepared' }, RULES), { stance: 'prepared', to: 'melee', multiplier: 1.25 });
  assert.deepEqual(StanceWeaknessFor({ maneuver: 'casting' }, RULES), { stance: 'prepared', to: 'melee', multiplier: 1.25 });
  assert.deepEqual(StanceWeaknessFor({ maneuver: 'neutral' }, RULES), { stance: 'neutral', to: 'all', multiplier: 1.25 });
  assert.deepEqual(StanceWeaknessFor({}, RULES), { stance: 'neutral', to: 'all', multiplier: 1.25 });
});

test('other stances, a broken stance and no stance row show no stance weakness', () => {
  for (const maneuver of ['attack', 'smash', 'sweep', 'counter', 'defend']) assert.equal(StanceWeaknessFor({ maneuver }, RULES), null, maneuver);
  assert.equal(StanceWeaknessFor({ maneuver: 'prepared', broken: true }, RULES), null);
  assert.equal(StanceWeaknessFor({ maneuver: 'neutral', staggered: true }, RULES), null);
  assert.equal(StanceWeaknessFor(null, RULES), null);
});

// Review on #2814: a fight without the rule draws no chip. A legacy fight has no stanceBenefits block (every enemy is
// neutral there, so an ungated chip would claim a weakness on every foe); a Core 2 fight created before the rule has
// the block without the two multipliers.
test('a fight without the rule shows no stance weakness, a fight with it does', () => {
  const legacy = StanceBenefitRules({ combatExpansionVersion: 1 });
  assert.equal(legacy, null, 'a legacy fight has no stanceBenefits block');
  assert.equal(StanceWeaknessFor({ maneuver: 'neutral' }, legacy), null);
  assert.equal(StanceWeaknessFor({ maneuver: 'prepared' }, legacy), null);
  const before = { version: 1, prepared: { damageMultiplier: 1.25 }, neutral: { extraDrawNextTurn: 1 } };
  assert.equal(StanceWeaknessFor({ maneuver: 'prepared' }, before), null, 'the block without the rule draws none');
  assert.equal(StanceWeaknessFor({ maneuver: 'neutral' }, before), null);
  assert.equal(StanceWeaknessFor({ maneuver: 'prepared' }, { ...RULES, version: 2 }), null, 'only version 1 is read');
  assert.ok(StanceWeaknessFor({ maneuver: 'prepared' }, RULES), 'the rule draws the chip');
});

test('the combat screen reads the fight\'s own rule block for the chip', () => {
  const combatSource = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const calls = combatSource.split('StanceWeaknessFor(').length - 1;
  const gated = combatSource.split('StanceWeaknessFor(dv(enemy).combatStance, StanceBenefitRules(combat))').length - 1;
  assert.equal(calls, 2, 'the chip key and the chip build');
  assert.equal(gated, 2, 'both pass the stanceBenefits block of the fight');
});

test('the chip names the weakness and wears its mark', () => {
  withKitDom(() => {
    const prepared = StanceWeaknessChip({ stance: 'prepared', to: 'melee' });
    assert.equal(prepared.dataset.stance, 'prepared');
    assert.match(prepared.getAttribute('aria-label'), /Prepared: melee hits deal more damage/);
    assert.ok(prepared.querySelector('svg'));
    const idle = StanceWeaknessChip({ stance: 'neutral', to: 'all' });
    assert.match(idle.getAttribute('aria-label'), /Idle \(no stance\): every hit deals more damage/);
    assert.equal(StanceWeaknessChip(null), null);
  });
});
