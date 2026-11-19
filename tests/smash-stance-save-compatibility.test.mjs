import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage, runKey } from '../src/engine/save.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';

const historicalJson = gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url))).toString('utf8');
const historical = JSON.parse(historicalJson);
const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };

function quote(combat, stance) {
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block: 10, barrier: 0, statuses: {}, persistentPoise: { value: 20, max: 20 }, combatStance: { maneuver: stance, camp: 'physical', range: 'melee' } });
  delete target.weaknesses;
  delete target.combatCounter;
  delete combat.player.combatStance;
  return profileDamageReceipt(combat, combat.player, target, 12, smash);
}

for (const shared of [undefined, 1.25, 1.6, 2]) {
  test(`real historical profile and old combat snapshot preserve shared Smash tuning ${shared ?? '(missing block)'}`, () => {
    const storage = createMemoryStorage();
    storage.setItem(runKey(1), `{"gameProfile":${historicalJson}}`);
    const manager = createSaveManager(storage);
    const profile = resolveGameProfile(manager.peekRunGameProfile(1));
    assert.equal(profile.hash, historical.hash);
    assert.equal(profile.lock.runtimeHash, historical.lock.runtimeHash);
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const run = createRunState({ registries, classId: 'reaver', seed: 7331 });
    const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
    // The gzip pins the profile; these explicit snapshot rules pin the old combat.
    delete combat.fixCoreRules.smashVsDefensive.defendDamageMultiplier;
    if (shared === undefined) delete combat.fixCoreRules.smashVsDefensive;
    else combat.fixCoreRules.smashVsDefensive.damageMultiplier = shared;
    const rulesBefore = JSON.stringify(combat.fixCoreRules);
    const defendBefore = quote(combat, 'defend'), preparedBefore = quote(combat, 'prepared');
    const stage = defendBefore.damageReceipt.hits[0].sources.find(row => row.id === 'smash-vs-defensive');
    assert.equal(stage.multiplier, shared ?? 1.25, 'Defend reads the old shared value, including the missing-block fallback');
    const countersBefore = combat.rng.getCounters();
    commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'a1_soldier' });
    manager.saveRun(run, combat.rng);
    const loaded = manager.loadRun(registries);
    assert.ok(loaded, manager.runStatus().reason);
    const restored = restoreCombatSnapshot({ registries, rng: createRng(loaded.seed, loaded.streamCounters), snapshot: loaded.combatEntered.snapshot, expectedGameProfile: loaded.gameProfile });
    assert.equal(restored.gameProfile.hash, historical.hash);
    assert.equal(restored.gameProfile.lock.runtimeHash, historical.lock.runtimeHash);
    assert.equal(Object.hasOwn(restored.fixCoreRules.smashVsDefensive || {}, 'defendDamageMultiplier'), false);
    assert.equal(JSON.stringify(restored.fixCoreRules), rulesBefore, 'saved tuning and entry order survive the actual save/load path');
    assert.deepEqual(restored.rng.getCounters(), countersBefore);
    assert.deepEqual(quote(restored, 'defend'), defendBefore);
    assert.deepEqual(quote(restored, 'prepared'), preparedBefore);
    assert.equal(JSON.stringify(restored.fixCoreRules), rulesBefore, 'previews do not rewrite old rules');
    assert.equal(manager.peekRunGameProfile(1).hash, historical.hash);
  });
}
