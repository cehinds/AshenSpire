// Owner, 2026-11-07 (backlog #7): `damage.unified` in content/source/fixCoreMechanics.json is a versioned flag snapshotted per fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { fixCoreUnifiedDamage, validateFixCoreRules } from '../src/model/fixCoreMechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
export function liveCore() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  delete combat.player.combatStance;
  return combat;
}

test('a new Core 2 fight snapshots damage.unified = true', () => {
  const combat = liveCore();
  assert.equal(combat.fixCoreRules.damage?.unified, true);
  assert.equal(fixCoreUnifiedDamage(combat), true);
});

test('a fight created without the field (an old save) keeps the physical/magic split', () => {
  const combat = liveCore();
  const { damage, ...old } = combat.fixCoreRules;
  combat.fixCoreRules = old;
  assert.equal(fixCoreUnifiedDamage(combat), false);
  assert.equal(validateFixCoreRules(old), old);
});

test('legacy and non-Core contexts are never unified', () => {
  assert.equal(fixCoreUnifiedDamage({}), false);
  assert.equal(fixCoreUnifiedDamage({ combatExpansionVersion: 1 }), false);
});

test('the flag validator refuses a malformed damage block', () => {
  const combat = liveCore();
  assert.throws(() => validateFixCoreRules({ ...combat.fixCoreRules, damage: { unified: 'yes' } }));
  assert.throws(() => validateFixCoreRules({ ...combat.fixCoreRules, damage: { unified: true, other: 1 } }));
});

// SPEC clarification (owner 2026-11-07): a target holding Ward stacks keeps the wardRouted path (the whole hit to Poise first, then Block, then HP) with the flag on or off.
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
test('a Ward-stack target resolves identically with damage.unified on and off', () => {
  const run = unified => {
    const combat = liveCore(), target = combat.enemies[0];
    if (!unified) { const { damage, ...old } = combat.fixCoreRules; combat.fixCoreRules = old; }
    Object.assign(target, { block: 5, barrier: 0, persistentWard: null, persistentPoise: { value: 6, max: 20 }, gameProfilePoise: 0, statuses: { ward: { stacks: 2 } } });
    delete target.weaknesses; delete target.combatStance;
    const r = profileDamageReceipt(combat, combat.player, target, 10, { skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'fire', magicShare: 1 } }, { roll: 0 });
    const { magical, physical, ...rest } = r.damageReceipt.hits[0];
    return { wardRouted: r.wardRouted, hpLoss: r.hpLoss, blocked: r.blocked, poise: r.poiseMitigated, rest };
  };
  const on = run(true), off = run(false);
  assert.equal(on.wardRouted, true);
  assert.equal(on.poise, 6, 'Poise first, 1:1');
  assert.equal(on.blocked, 4);
  assert.deepEqual(on, off);
});
