import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { formationDimensions, isFormationCell } from '../src/model/formationLayout.js';
import { formationOccupancy, initializeFormationOccupancy } from '../src/model/formationOccupancy.js';
const player = () => ({ id: 'one', classId: 'reaver', maxHp: 100, hp: 100, maxStamina: 10, stamina: 10, maxMana: 5, mana: 5, energyMax: 10, drawPerTurn: 5, deck: Array.from({length:10},(_,i)=>({instanceId:`d${i}`,cardId:'strike',upgraded:false})) });
// A fight now opens with at most 3 enemies (owner, 2026-11-03), so the formation extra row can
// only be reached by an old save or a hand-built list. Widen the combat to 7 enemies after
// createCombat so these tests still exercise the formation model and snapshot restore.
function widen(combat, count = 7) {
  while (combat.enemies.length < count) {
    const clone = structuredClone(combat.enemies[0]);
    clone.id = `e${combat.enemies.length + 1}`; clone.instanceId = clone.id; delete clone.formationCell;
    combat.enemies.push(clone);
  }
  initializeFormationOccupancy(combat);
}
function fixture(name, modules = {}) {
  const gameProfile = resolveGameProfile({formatVersion:1,core:`ashen.${name}@1.0.0`,modules});
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,gameProfile)),gameProfile);
  const options={registries,rng:createRng(311),enemyIds:Array(3).fill('wanderingSoldier')};
  const combat=createCombat({...options,gameProfile,player:player()});
  widen(combat);
  return {combat,registries,options};
}


