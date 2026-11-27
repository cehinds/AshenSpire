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
import { gameProfileEquipmentReceipt } from '../src/model/gameProfileGear.js';
const profile = resolveGameAuthor(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json',import.meta.url))),loadGameProfileCatalog());
const profileContent = applyGameProfileToContent(contentBundle, profile);
const reg = bindGameProfileRegistries(createRegistries(profileContent), profile);
const withSignature = (id, mods) => {
  const append = piece => piece.id === id ? { ...piece, mods: [...piece.mods, ...mods] } : piece;
  const equipment = { ...profileContent.equipment,
    armaments: profileContent.equipment.armaments.map(append), armour: profileContent.equipment.armour.map(append),
  };
  return bindGameProfileRegistries(createRegistries({ ...profileContent, equipment }), profile);
};
const wear = (classId,slot,id,registries = reg) => {
  const run = createRunState({registries,classId,seed:429,profileMeta:{gameProfileUnlocks:{[profile.id]:{completedRunIds:['a','b','c']}}}});
  run.loadout.sets[slot]=[id];
  return {run,mods:runMods(registries,run.loadout,classId,run)};
};
// Core gear resolves to attribute points (CON, END), which already feed the pools; an item row's own max HP/MP/SP mod must not add again.
// Owner, 2026-11-20: only where the item's resolved points feed that pool (hp: constitution, mana: wisdom, stamina: dexterity; derivedStatRules.json).
for (const [slot,id,signature,feeder] of [
  ['leftHand','towerShield','self.maxHp=+10','constitution'],
  ['rightHand','twinblade','self.maxStamina=+1','dexterity'],
  ['armor','cinderforgedPlate','self.maxHp=+4','constitution'],
]) {
  test(`${id}: its legacy pool mod is not counted on top of its resolved points`, () => {
    const registries = withSignature(id, [signature]);
    const {run,mods} = wear('reaver',slot,id,registries);
    const ref = slot === 'armor' ? `armor/reaver/${id}` : `armament/${id}`;
    const source = gameProfileEquipmentReceipt(registries,run).sources.find(row => row.sourceId === ref);
    assert.ok(source?.resolved.values[feeder] > 0, `the fixture feeds the pool through ${feeder}`);
    assert.deepEqual([mods.maxHp,mods.maxMana,mods.maxStamina],[0,0,0]);
  });
}
test('the current Wayfarer Plate keeps a raw HP line because it grants no base Constitution', () => {
  const registries = withSignature('wayfarerPlate', ['self.maxHp=+4']);
  const {run,mods} = wear('reaver','armor','wayfarerPlate',registries);
  const source = gameProfileEquipmentReceipt(registries,run).sources.find(row => row.sourceId === 'armor/reaver/wayfarerPlate');
  assert.equal(source?.resolved.values.constitution, 0);
  assert.deepEqual([mods.maxHp,mods.maxMana,mods.maxStamina],[4,0,0]);
});
test('a legacy Bastion max SP penalty still applies through the signature reader', () => {
  const {mods} = wear('reaver','armor','bastion',withSignature('bastion', ['self.maxStamina=-1']));
  assert.deepEqual([mods.maxHp,mods.maxMana,mods.maxStamina],[0,0,-1]);
});
test('current Sage robe does not gain flat Mana from its group', () => {
  const {mods} = wear('starseer','armor','sagesRobe');
  assert.equal(mods.maxMana,0);
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

// Review finding: a Blacksmith pick is the player's spend; only the item's BASE resolved points decide whether its own pool line is dropped.
test('a CON pick on Rite Vestments does not drop its +6 max HP line; a DEX pick on a Stamina-line item likewise', () => {
  const rite = withSignature('riteVestments', ['self.maxHp=+6']);
  const {run} = wear('herald','armor','riteVestments',rite);
  const ref = 'armor/herald/riteVestments';
  const before = runMods(rite,run.loadout,'herald',run).maxHp;
  assert.equal(before,6,'the item line is its own +6');
  run.itemUpgradePicks = {[ref]:[{id:'attr:constitution',k:'stat',stat:'constitution',n:2}]};
  assert.equal(runMods(rite,run.loadout,'herald',run).maxHp,before,'a CON pick leaves the +6 in place');
  const oldBastion = withSignature('bastion', ['self.maxStamina=-1']);
  const bastion = wear('reaver','armor','bastion',oldBastion);
  const bRef = 'armor/reaver/bastion';
  const sp = runMods(oldBastion,bastion.run.loadout,'reaver',bastion.run).maxStamina;
  assert.equal(sp, -1);
  bastion.run.itemUpgradePicks = {[bRef]:[{id:'attr:dexterity',k:'stat',stat:'dexterity',n:2}]};
  assert.equal(runMods(oldBastion,bastion.run.loadout,'reaver',bastion.run).maxStamina,sp,'a DEX pick leaves the item\'s own Stamina line in place');
});
