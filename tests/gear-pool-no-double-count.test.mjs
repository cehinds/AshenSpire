import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { runMods } from '../src/model/loadout.js';
const profile = resolveGameAuthor(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json',import.meta.url))),loadGameProfileCatalog());
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
const wear = (classId,slot,id) => {
  const run = createRunState({registries:reg,classId,seed:429,profileMeta:{gameProfileUnlocks:{[profile.id]:{completedRunIds:['a','b','c']}}}});
  run.loadout.sets[slot]=[id];
  return {run,mods:runMods(reg,run.loadout,classId,run)};
};
// Core gear resolves to attribute points (CON, END), which already feed the pools; an item row's own max HP/MP/SP mod must not add again.
for (const [slot,id] of [['leftHand','towerShield'],['rightHand','twinblade'],['armor','wayfarerPlate'],['armor','bastion']]) {
  test(`${id}: its legacy pool mod is not counted on top of its resolved points`, () => {
    const {mods} = wear('reaver',slot,id);
    assert.deepEqual([mods.maxHp,mods.maxMana,mods.maxStamina],[0,0,0]);
  });
}
test('a robe keeps its armour group base +1 max MP', () => {
  const {mods} = wear('starseer','armor','sagesRobe');
  assert.equal(mods.maxMana,1);
});
