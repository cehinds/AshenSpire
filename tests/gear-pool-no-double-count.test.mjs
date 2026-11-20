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
// Owner, 2026-11-20: only where the item's resolved points feed that pool (hp: constitution, mana: wisdom, stamina: dexterity; derivedStatRules.json).
for (const [slot,id] of [['leftHand','towerShield'],['rightHand','twinblade'],['armor','wayfarerPlate']]) {
  test(`${id}: its legacy pool mod is not counted on top of its resolved points`, () => {
    const {mods} = wear('reaver',slot,id);
    assert.deepEqual([mods.maxHp,mods.maxMana,mods.maxStamina],[0,0,0]);
  });
}
test('bastion: its resolved points feed no Stamina (no Dexterity), so its own -1 max SP stays', () => {
  const {mods} = wear('reaver','armor','bastion');
  assert.deepEqual([mods.maxHp,mods.maxMana,mods.maxStamina],[0,0,-1]);
});
test('a robe keeps its armour group base +1 max MP', () => {
  const {mods} = wear('starseer','armor','sagesRobe');
  assert.equal(mods.maxMana,1);
});

// Owner, 2026-11-20: a run saved with the double-counted pool recalculates at its next re-derive; it does not crash and current HP clamps, never heals.
import { reconcileRunLoadoutHp } from '../src/model/loadout.js';
import { initializeRunDerivedStats } from '../src/model/state.js';
test('an in-progress run that holds the double-counted +10 max HP drops it on re-derive, and current HP clamps to the new max', () => {
  const {run} = wear('reaver','leftHand','towerShield');
  reconcileRunLoadoutHp(reg,run);
  const honest = run.maxHp;
  // The pre-fix save: the Tower Shield's own +10 max HP sat on top of its Constitution points, and the run was at full health.
  run.maxHp = honest + 10; run.hp = run.maxHp; run.equipmentPoolBonuses = {...run.equipmentPoolBonuses, maxHp: run.equipmentPoolBonuses.maxHp + 10};
  const restored = structuredClone(run);
  assert.doesNotThrow(() => initializeRunDerivedStats(restored,reg));
  reconcileRunLoadoutHp(reg,restored);
  assert.equal(restored.maxHp,honest);
  assert.ok(restored.hp <= restored.maxHp, 'current HP clamps to the new max');
  assert.ok(restored.hp <= run.hp, 'and the re-derive never heals');
});
