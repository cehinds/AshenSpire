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
