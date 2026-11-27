import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatMechanics } from '../src/content/generated/combatMechanics.js';
import {
  ResolveMechanicsTable,
  EffectiveProtectionPipeline,
} from '../src/model/combatMechanics.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import {
  resolveGameProfile,
  applyGameProfileToContent,
  bindGameProfileRegistries,
} from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';

const rawProtection = JSON.parse(
  readFileSync(new URL('../content/source/mechanics/protection.json', import.meta.url), 'utf8'),
);

function buildProtectionContext(overrides = {})
{
  const merged = structuredClone(combatMechanics.authored);
  for (const [id, patch] of Object.entries(overrides))
  {
    merged[id] = {
      ...(merged[id] || {}),
      ...patch,
    };
  }

  return { combatMechanics: ResolveMechanicsTable(merged) };
}

function createCoreFight()
{
  const profile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(
    createRegistries(applyGameProfileToContent(contentBundle, profile)),
    profile,
  );
  const run = createRunState({
    registries,
    classId: 'reaver',
    seed: 19,
    profileMeta: {
      gameProfileUnlocks: {
        core: { completedRunIds: ['a', 'b', 'c'] },
      },
    },
  });
  const combat = createRunCombat({
    registries,
    run,
    rng: createRng(19),
    enemyIds: ['wanderingSoldier'],
  });

  combat.enemies[0].block = 10;
  combat.enemies[0].persistentPoise = { value: 12, max: 12 };
  combat.enemies[0].combatStance = { maneuver: 'neutral', camp: 'physical' };
  return combat;
}

test('protection.json compiles with parent-child inheritance for all five pipelines', () =>
{
  for (const id of Object.keys(rawProtection))
  {
    assert.ok(combatMechanics.resolved[id], `${id} is present in compiled combatMechanics`);
  }

  const weaponPoise = EffectiveProtectionPipeline('protection.weaponPoise');
  assert.deepEqual(weaponPoise.order, ['block', 'wardHp', 'stancePoise', 'weaponPoiseDrain']);
  assert.equal(weaponPoise.pierceApplies, true);
  assert.equal(weaponPoise.applyLegacyPoiseAdjust, false);

  const disabledParent = buildProtectionContext({
    protection: { enabled: false },
  });
  assert.equal(EffectiveProtectionPipeline('protection.weaponPoise', disabledParent), null);
  assert.equal(EffectiveProtectionPipeline('protection.standard', disabledParent), null);

  const childReEnabled = buildProtectionContext({
    protection: { enabled: false },
    'protection.weaponPoise': { enabled: true },
  });
  assert.ok(EffectiveProtectionPipeline('protection.weaponPoise', childReEnabled));
  assert.equal(EffectiveProtectionPipeline('protection.standard', childReEnabled), null);
});

test('editing protection.weaponPoise order in combatMechanics config changes mitigation without JS edits', () =>
{
  const combat = createCoreFight();
  const enemy = combat.enemies[0];
  const hitCarrier = {
    skipRatingBonus: true,
    combatProfile: {
      camp: 'physical',
      maneuver: 'attack',
      range: 'melee',
    },
  };

  const baseline = profileDamageReceipt(combat, combat.player, enemy, 12, hitCarrier, { forecast: true });
  assert.ok(baseline.blocked > 0, 'baseline Block absorbs damage');
  assert.equal(baseline.hpLoss, 0);

  // Removing 'block' from the configured pipeline order skips Block absorption directly from JSON config.
  combat.combatMechanics = buildProtectionContext({
    'protection.weaponPoise': {
      order: ['wardHp', 'stancePoise', 'weaponPoiseDrain'],
    },
  }).combatMechanics;

  const noBlock = profileDamageReceipt(combat, combat.player, enemy, 12, hitCarrier, { forecast: true });
  assert.equal(noBlock.blocked, 0);
  assert.equal(noBlock.hpLoss, baseline.blocked);
});
