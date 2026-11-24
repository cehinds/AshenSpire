import test from 'node:test';
import assert from 'node:assert/strict';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { withoutDefendSmashOverride, withLegacyDefaults, withoutStanceBenefitDefaults, withoutBatch2Rules, withoutSpellCostRules, withoutStatusCapsRule, withoutCounterStackDefaults, withoutQuickstepCounterStacks, withoutThemeBRules, legacyPerceptionRules, legacyHitRoll, legacyPerceptionRoll, legacyRolls, legacyRules } from './legacyHitRules.mjs';

test('the historical Smash helper removes only the new override and restores entry order', () => {
  const owner = fixCoreMechanics.smashVsDefensive;
  const rows = Object.entries(owner), before = JSON.stringify(fixCoreMechanics);
  assert.equal(owner.defendDamageMultiplier, 1.5);
  const answer = withoutDefendSmashOverride(() => {
    assert.equal(fixCoreMechanics.smashVsDefensive, owner, 'keep the shared owner identity');
    assert.deepEqual(Object.entries(owner), rows.filter(([key]) => key !== 'defendDamageMultiplier'));
    return 'built';
  });
  assert.equal(answer, 'built');
  assert.equal(JSON.stringify(fixCoreMechanics), before, 'all original values and property positions return');
});

test('nested historical Smash builders and exceptions restore the shared rule object', () => {
  const owner = fixCoreMechanics.smashVsDefensive, before = JSON.stringify(fixCoreMechanics);
  const failure = new Error('fixture construction failed');
  assert.throws(() => withoutDefendSmashOverride(() => {
    assert.equal(Object.hasOwn(owner, 'defendDamageMultiplier'), false);
    withoutDefendSmashOverride(() => {
      assert.equal(Object.hasOwn(owner, 'defendDamageMultiplier'), false);
    });
    assert.equal(Object.hasOwn(owner, 'defendDamageMultiplier'), false, 'inner completion does not restore an outer omission');
    throw failure;
  }), error => error === failure);
  assert.equal(fixCoreMechanics.smashVsDefensive, owner);
  assert.equal(JSON.stringify(fixCoreMechanics), before);
});

test('every historical builder omits the new Smash key without changing its owner order', () => {
  const builders = [withLegacyDefaults, withoutStanceBenefitDefaults, withoutBatch2Rules, withoutSpellCostRules, withoutStatusCapsRule, withoutCounterStackDefaults, withoutQuickstepCounterStacks, withoutThemeBRules];
  for (const build of builders) {
    const owner = fixCoreMechanics.smashVsDefensive, before = JSON.stringify(owner);
    build(() => assert.equal(Object.hasOwn(owner, 'defendDamageMultiplier'), false, build.name));
    assert.equal(fixCoreMechanics.smashVsDefensive, owner, build.name);
    assert.equal(JSON.stringify(owner), before, `${build.name}: property order`);
  }
});

test('direct historical rules paths omit the new key in their clone without mutating input', () => {
  for (const copy of [legacyPerceptionRules, legacyRules]) {
    const input = structuredClone(fixCoreMechanics), before = JSON.stringify(input);
    const result = copy(input);
    assert.notEqual(result, input, copy.name);
    assert.notEqual(result.smashVsDefensive, input.smashVsDefensive, copy.name);
    assert.equal(Object.hasOwn(result.smashVsDefensive, 'defendDamageMultiplier'), false, copy.name);
    assert.equal(JSON.stringify(input), before, `${copy.name}: original values and property order`);
  }
  for (const copy of [legacyHitRoll, legacyPerceptionRoll, legacyRolls]) {
    const input = structuredClone(fixCoreMechanics), before = JSON.stringify(input);
    const combat = { fixCoreRules: input };
    assert.equal(copy(combat), combat, copy.name);
    assert.notEqual(combat.fixCoreRules, input, copy.name);
    assert.equal(Object.hasOwn(combat.fixCoreRules.smashVsDefensive, 'defendDamageMultiplier'), false, copy.name);
    assert.equal(JSON.stringify(input), before, `${copy.name}: original values and property order`);
  }
});
