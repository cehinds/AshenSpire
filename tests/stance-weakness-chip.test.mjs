// Playtest 2026-11-17 (items 31, 35): the icons under an enemy show its stance weakness. Prepared is weak to melee,
// Idle (no stance, a missing stance row included) to all damage; any other stance, or a Broken or Staggered one, shows none.
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

test('other stances and a broken stance show no stance weakness', () => {
  for (const maneuver of ['attack', 'smash', 'sweep', 'counter', 'defend']) assert.equal(StanceWeaknessFor({ maneuver }, RULES), null, maneuver);
  assert.equal(StanceWeaknessFor({ maneuver: 'prepared', broken: true }, RULES), null);
  assert.equal(StanceWeaknessFor({ maneuver: 'neutral', staggered: true }, RULES), null);
});

// Owner, 2026-11-17: what the chip shows must match the damage rule. An enemy with no stance row takes the Idle x1.25 from every hit
// (gameProfileCombat's stance-weakness stage reads a missing stance as 'neutral'), so it shows "weak to all damage" too.
test('no stance row is Idle: the chip shows weak to all damage, matching the hit it takes', async () => {
  for (const none of [null, undefined]) assert.deepEqual(StanceWeaknessFor(none, RULES), { stance: 'neutral', to: 'all', multiplier: 1.25 });
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const { createRunState } = await import('../src/model/state.js');
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { profileDamageReceipt } = await import('../src/engine/gameProfileCombat.js');
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  delete enemy.combatStance;
  const chip = StanceWeaknessFor(enemy.combatStance, StanceBenefitRules(combat));
  const hit = profileDamageReceipt(combat, combat.player, enemy, 20, { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' }, skipRatingBonus: true });
  const stage = hit.damageReceipt.hits[0].sources.find(row => row.id === 'stance-weakness');
  assert.ok(chip, 'the chip shows for a stance-less enemy');
  assert.equal(stage?.multiplier, chip.multiplier, 'the hit takes exactly what the chip says');
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
