import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { carriedIds } from '../src/model/loadout.js';
import { noncombatEditing, editingLocked, newArmouryItems, armouryHasNew, markArmourySeen } from '../src/model/armouryRules.js';

const make = id => {
  const profile = resolveGameProfile(id);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  return createRunState({ seed: 7, classId: 'reaver', registries, runId: `noncombat-${id}` });
};



test('opening the Armoury persists the seen list (review finding)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /if \(armouryHasNew\(run\)\) \{ markArmourySeen\(run\); persist\(\); \}/);
});


test('bought and reward armour glows, and an older save does not glow its existing armour (review finding)', () => {
  const run = make('core');
  markArmourySeen(run);
  run.loadout.boughtArmour = [{ classId: 'reaver', id: 'qa-armour' }];
  assert.deepEqual(newArmouryItems(run), ['armour:reaver/qa-armour']);
  markArmourySeen(run);
  assert.equal(armouryHasNew(run), false);
  const old = make('core');
  old.loadout.boughtArmour = [{ classId: 'reaver', id: 'old-armour' }];
  old.armorySeen = carriedIds(old.loadout); // a save from before armour refs were tracked
  assert.equal(armouryHasNew(old), false);
  old.loadout.boughtArmour.push({ classId: 'reaver', id: 'new-armour' });
  assert.equal(armouryHasNew(old), true);
});
