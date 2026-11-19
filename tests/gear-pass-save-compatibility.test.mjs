import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalGameJSON } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { gameProfileEquipmentReceipt } from '../src/model/gameProfileGear.js';
import { GearSummary } from '../src/model/gearEffects.js';
import { runMods } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

function world(enabled) {
  const snapshot = structuredClone(resolveGameProfile('default'));
  if (!enabled) delete snapshot.modules.gear.typeEffectsVersion;
  const { hash: _hash, ...payload } = snapshot;
  snapshot.hash = 'sha256:' + createHash('sha256').update(canonicalGameJSON(payload)).digest('hex');
  const profile = resolveGameProfile(snapshot);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  return { profile, registries, run };
}

for (const enabled of [false, true]) {
  test(`saved gear profile ${enabled ? 'with' : 'without'} type effects keeps its pools, modifiers and combat behavior on reload`, () => {
    const { profile, registries, run } = world(enabled);
    const gear = gameProfileEquipmentReceipt(registries, run);
    const summary = GearSummary(registries, run.loadout, run.class, run);
    assert.equal(gear.sources.some(row => row.itemId === 'type'), enabled);
    assert.equal(gear.sources.some(row => row.sourceId === 'armor/reaver/default'), enabled, 'only the new profile maps the default outfit to its named gear');
    assert.equal(summary.cardRules.length > 0, enabled);
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    assert.equal(!!combat.player.itemProps?.cardRules?.length, enabled);
    assert.equal('spellsPlayedThisTurn' in combat.player.counters, enabled);
    assert.equal((combat.player.statuses.thorns?.stacks || 0) > 0, enabled);
    commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
    const manager = createSaveManager(createMemoryStorage());
    manager.saveRun(run, combat.rng);
    const loaded = manager.loadRun(registries);
    assert.ok(loaded, JSON.stringify(manager.runStatus()));
    assert.equal(loaded.gameProfile.hash, profile.hash);
    assert.equal(loaded.maxHp, run.maxHp);
    assert.deepEqual(gameProfileEquipmentReceipt(registries, loaded), gear);
    const restored = restoreCombatSnapshot({ registries, snapshot: loaded.combatEntered.snapshot, rng: createRng(511), expectedGameProfile: loaded.gameProfile });
    assert.deepEqual(restored.player.itemProps, combat.player.itemProps);
    assert.equal((restored.player.statuses.thorns?.stacks || 0) > 0, enabled);
  });
}

test('an old profile keeps its existing regeneration modifier but gains no new Lantern Fire Thorns', () => {
  const { registries, run } = world(false);
  run.loadout.sets.leftHand[0] = 'lantern';
  const originalRegen = runMods(registries, run.loadout, run.class, run).startStatuses.find(row => row.status === 'regen')?.stacks || 0;
  const registry = { ...registries, equipment: { ...registries.equipment, armaments: registries.equipment.armaments.map(piece => piece.id === 'lantern' ? { ...piece, mods: [...piece.mods, 'self.regen=+2'] } : piece) } };
  const mods = runMods(registry, run.loadout, run.class, run);
  assert.equal(mods.startStatuses.find(row => row.status === 'regen')?.stacks, originalRegen + 2);
  assert.equal(mods.startStatuses.some(row => row.status === 'thornsFire'), false);
  assert.equal(GearSummary(registry, run.loadout, run.class, run).hitRules.length, 0);
});
