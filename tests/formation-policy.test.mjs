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
function fixture(name, modules = {}) {
  const gameProfile = resolveGameProfile({formatVersion:1,core:`ashen.${name}@1.0.0`,modules});
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,gameProfile)),gameProfile);
  const options={registries,rng:createRng(311),enemyIds:Array(7).fill('wanderingSoldier')};
  const combat=createCombat({...options,gameProfile,player:player()});
  return {combat,registries,options};
}
test('current allocates a real seventh enemy to C; core uses only original enemy cells',()=>{
  const current=fixture('current').combat, core=fixture('core').combat;
  assert.equal(current.enemies[6].formationCell,'A5');
  assert.equal(core.enemies[6].formationCell,'B3');
  assert.equal(new Set(formationOccupancy(current).map(row=>row.cell)).size,8);
  const dimensions=formationDimensions({perspectiveGrid:true,formationPolicy:current.formationPolicy},7);
  assert.equal(dimensions.columns,2);assert.equal(dimensions.rows,3);
  assert.deepEqual(dimensions.extraCells[0],{cell:'A5',row:0,lane:0,column:2,side:'enemy',visualBand:'C',formationRole:'extra'});
  assert(isFormationCell('A5',dimensions,'enemy'));assert(!isFormationCell('A5',dimensions,'player'));
  assert(core.enemies.every(enemy=>!enemy.formationCell.endsWith('5')));
});
test('the same authored flag disables current extra occupancy or enables core extra occupancy',()=>{
  assert(fixture('current',{formation:{extraRow:{enabled:false}}}).combat.enemies.every(enemy=>!enemy.formationCell.endsWith('5')));
  assert.equal(fixture('core',{formation:{extraRow:{enabled:true}}}).combat.enemies[6].formationCell,'A5');
  assert.throws(()=>resolveGameProfile({formatVersion:1,core:'ashen.current@1.0.0',modules:{formation:{extraRow:{sides:['player']}}}}));
  assert.throws(()=>resolveGameProfile({formatVersion:1,core:'ashen.current@1.0.0',modules:{formation:{extraRow:{capacityPerLane:2}}}}));
});
test('real dispatch targets the extra occupant normally and pays once',()=>{
  const {combat}=fixture('current');
  combat.piles.hand=[{instanceId:'hit',cardId:'strike',upgraded:false}];
  const target=combat.enemies[6], before=target.hp, energy=combat.player.energy;
  const receipt=dispatch(combat,{type:'playCard',cardInstanceId:'hit',targetId:target.id});
  assert(!receipt.error);assert(target.hp<before);assert(combat.player.energy<energy);
  assert.equal(target.formationCell,'A5');
});
test('save/restore preserves actual occupancy and rejects illegal or colliding cells',()=>{
  const {combat,registries}=fixture('current');const snapshot=serializeCombatSnapshot(combat);
  const restored=restoreCombatSnapshot({registries,rng:createRng(311),snapshot});
  assert.deepEqual(formationOccupancy(restored),formationOccupancy(combat));
  for (const cell of ['A1','A6']) {
    const bad=structuredClone(snapshot);bad.enemies[6].formationCell=cell;
    assert.throws(()=>restoreCombatSnapshot({registries,rng:createRng(311),snapshot:bad}),/formation cell/);
  }
  const collision=structuredClone(snapshot);collision.enemies[6].formationCell=collision.enemies[0].formationCell;
  assert.throws(()=>restoreCombatSnapshot({registries,rng:createRng(311),snapshot:collision}),/formation cell/);
});
test('preserves older valid addresses and classic dimensions exclude extra cells',()=>{
  const {combat}=fixture('current');combat.enemies[6].formationCell='D4';initializeFormationOccupancy(combat);
  assert.equal(combat.enemies[6].formationCell,'D4');
  const classic=formationDimensions({perspectiveGrid:false,formationPolicy:combat.formationPolicy},7);
  assert.equal(classic.extraCells,undefined);assert(!isFormationCell('A5',classic,'enemy'));
});

test('Classic player column addresses remain saveable with a profile policy',()=>{
  const {combat,registries}=fixture('current');combat.player.formationCell='B2';
  const restored=restoreCombatSnapshot({registries,rng:createRng(311),snapshot:serializeCombatSnapshot(combat)});
  assert.equal(restored.player.formationCell,'B2');
});

test('fresh three-lane enemy allocation follows back right/left/middle then front right/middle/left', () => {
  for (const name of ['core','current']) {
    const policy = fixture(name).combat.formationPolicy;
    const combat = { formationPolicy: policy, player: player(), enemies: Array.from({length:6},(_,i)=>({id:`e${i}`})) };
    initializeFormationOccupancy(combat);
    assert.deepEqual(combat.enemies.map(enemy=>enemy.formationCell), ['C4','A4','B4','C3','B3','A3']);
    assert(!combat.enemies.some(enemy=>enemy.formationCell.endsWith('5')));
    // Explicit old addresses reserve their cell before a new actor is placed.
    combat.enemies[0].formationCell='B4';combat.enemies[2].formationCell='C4';
    const before=formationOccupancy(combat);initializeFormationOccupancy(combat);
    assert.deepEqual(formationOccupancy(combat),before);
  }
});
