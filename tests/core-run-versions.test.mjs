import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';

test("a configured profile's run is expanded with the profile's reaction rules whatever the caller asks", () => {
  const core = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
  const run = createRunState({ seed: 3, classId: 'reaver', registries, combatExpansionVersion: 1, enemyKnowledgeVersion: null, reactionRulesVersion: null });
  assert.equal(run.combatExpansionVersion, 2);
  assert.equal(run.reactionRulesVersion, 2);
  assert.equal(run.advancedConfigSnapshot.breakMeterVersion, 2);
  assert.equal(run.enemyKnowledgeRules, undefined);
  assert.deepEqual(validateRunShape(run), []);
});

test("a Core fight's entry checkpoint loads back with its piles exactly as saved", async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { commitExpansionCandidate } = await import('../src/engine/combatExpansionSave.js');
  const { createSaveManager } = await import('../src/engine/save.js');
  const core = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
  const run = createRunState({ seed: 11, classId: 'reaver', registries });
  const rng = createRng(run.seed), entries = new Map();
  const save = createSaveManager({ getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) });
  run.combatEntered = { nodeId: 'n1_4', encounterId: 'patrol' };
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier', 'wanderingSoldier'], settings: { playInDeckOrder: true } });
  commitExpansionCandidate({ run, candidate: combat, ...run.combatEntered,
    saveCandidate: (next, committedRng) => { save.saveRun(next, committedRng); return { ok: true }; } });
  const saved = JSON.parse(entries.get([...entries.keys()].find(key => /run/i.test(key)))).combatEntered.snapshot;
  const loaded = save.loadRun(registries);
  assert.ok(loaded, save.runStatus().reason);
  // The snapshot-restore door must not re-stamp a Core deck with the legacy
  // carrier fields (damageSchool, exposureBuildupPerHit): SPEC 3.12 restores
  // the fight exactly as it was written.
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.combatEntered.snapshot.piles)), saved.piles);
  assert.ok(Object.values(saved.piles).flat().some(card => card.damageSchool === undefined), 'the fixture has an unstamped Core card');
});
