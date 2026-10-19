import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { noncombatEditing, editingLocked, newArmouryItems, armouryHasNew, markArmourySeen } from '../src/model/armouryRules.js';

const make = id => {
  const profile = resolveGameProfile(id);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  return createRunState({ seed: 7, classId: 'reaver', registries, runId: `noncombat-${id}` });
};

test('Core locks deck and equipment editing until the fight resolves, Current never does (D15)', () => {
  const core = make('core'), current = make('current');
  assert.equal(noncombatEditing(core), true);
  assert.equal(noncombatEditing(current), false);
  assert.equal(editingLocked(core, { result: null, pendingReaction: { id: 'r' } }), true);
  assert.equal(editingLocked(core, { result: null }), true);
  assert.equal(editingLocked(core, { result: 'win' }), false);
  assert.equal(editingLocked(core, null), false);
  assert.equal(editingLocked(current, { result: null }), false);
});

test('a new Armoury item glows until the Armoury is opened (D15)', () => {
  const run = make('core');
  assert.equal(armouryHasNew(run), false, 'the starting kit is not new');
  run.loadout.storage.push('d15-new-item');
  assert.deepEqual(newArmouryItems(run), ['d15-new-item']);
  assert.equal(armouryHasNew(run), true);
  markArmourySeen(run);
  assert.equal(armouryHasNew(run), false);
  const legacy = make('core'); delete legacy.armorySeen;
  assert.equal(armouryHasNew(legacy), false, 'an older save starts with everything seen');
  assert.equal(armouryHasNew(make('current')), false);
  assert.doesNotThrow(() => armouryHasNew(null));
});

test('opening the Armoury persists the seen list (review finding)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /if \(armouryHasNew\(run\)\) \{ markArmourySeen\(run\); persist\(\); \}/);
});
