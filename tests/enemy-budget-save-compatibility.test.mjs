import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { characterSettings, enemyAttributeBudget } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateGameProfileSnapshot, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';

// An actual historical profile, not current content with a substituted old hash.
const saved = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url))));
const expected = {
  wanderingSoldier: { level: 1, own: [2, 0, 0, 0, 0] },
  fellWarden: { level: 5, own: [2, 3, 0, 1, 0] },
  ashheartDragon: { level: 19, own: [1, 1, 1, 3, 0] },
};
test('historical runs retain their actual tier budgets in new fights and restored fights', () => {
  const profile = validateGameProfileSnapshot(structuredClone(saved));
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = deserializeRun(serializeRun(createRunState({ registries, classId: 'reaver', seed: 512 })));
  const state = e => ({ level: e.level, own: ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'].map(k => e.ownAttributes[k]) });
  for (const [id, want] of Object.entries(expected)) {
    const fight = createRunCombat({ registries, run, rng: createRng(512), enemyIds: [id] });
    assert.deepEqual(state(fight.enemies[0]), want, `${id}: exact prechange seeded attributes`);
    const restored = restoreCombatSnapshot({ registries, rng: createRng(512), snapshot: serializeCombatSnapshot(fight), expectedGameProfile: run.gameProfile });
    assert.deepEqual(state(restored.enemies[0]), want, `${id}: exact saved fight attributes`);
  }
  assert.equal(run.gameProfile.hash, saved.hash);
});

test('authored points and the last applicable explicit tag budget retain priority', () => {
  const settings = characterSettings(saved.modules);
  const tagged = { ...settings, tagRules: { ...settings.tagRules, 'custom.budget': { attributeBudget: [7, 9] } } };
  const row = { id: 'custom', level: 19, tags: ['character.enemy', 'tier.boss', 'custom.budget'] };
  assert.equal(enemyAttributeBudget(row, tagged), 9);
  assert.equal(enemyAttributeBudget({ ...row, attributePoints: 11 }, tagged), 11);
  assert.equal(enemyAttributeBudget({ id: 'player', level: 19, tags: ['character.player'] }, tagged), settings.tagRules['character.player'].attributeBudget[1]);
});
