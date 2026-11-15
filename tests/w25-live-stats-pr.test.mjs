// Owner, 2026-11-14 (W25-L): PR (spell damage) reads max(INT, WIS) under the new `ratings.prAttributes` rule key; rules without it keep INT-only PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { FixCorePrAttributes } from '../src/model/fixCoreMechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const newRun = () => createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

test('the shipped Core 2 rules read PR from max(INT, WIS)', () => {
  const run = newRun();
  assert.deepEqual(FixCorePrAttributes(run), ['intelligence', 'wisdom']);
  Object.assign(run.attributes, { intelligence: 2, wisdom: 6 });
  assert.equal(gameProfileRatingReceipt(reg, run).totals.pr, 6, 'WIS is the higher attribute');
  Object.assign(run.attributes, { intelligence: 7, wisdom: 3 });
  assert.equal(gameProfileRatingReceipt(reg, run).totals.pr, 7, 'INT is the higher attribute');
});

test('rules saved without the key keep INT-only PR (old snapshot fixture)', () => {
  const run = newRun();
  const { ratings, ...legacyRules } = structuredClone(run.gameProfile.fixCoreRules || {});
  run.fixCoreRules = { ...legacyRules, version: 1, enabled: true };
  assert.equal(FixCorePrAttributes(run), null);
  Object.assign(run.attributes, { intelligence: 2, wisdom: 6 });
  assert.equal(gameProfileRatingReceipt(reg, run).totals.pr, 2, 'WIS no longer feeds PR');
});
