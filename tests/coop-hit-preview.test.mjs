import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, playCard, previewCoopCard } from '../src/engine/coopCombat.js';
import { coopCardHitPreview, coopCombatantEvasion } from '../src/ui/models/CoopHitPreviewModel.js';
import { effectiveEvasion } from '../src/engine/stanceHit.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const registries=createRegistries(contentBundle);
function comparison(level) {
  const combat=createCoopCombat({registries,rng:createRng(811),combatExpansionVersion:2,
    players:[{id:'seatA',classId:'reaver',combatExpansionVersion:2,level,maxHp:100,hp:100,maxMana:20,mana:20,maxStamina:50,stamina:50,energyMax:10,drawPerTurn:1,
      attributes:{strength:1,dexterity:1,constitution:1,intelligence:1,wisdom:1},
      deck:[{cardId:'strike',instanceId:'one'}]}],enemyIds:['wanderingSoldier']});
  const seat=combat.players.get('seatA'),enemy=combat.enemies[0];
  assert.equal(seat.entity.combatExpansionVersion,2,'the actual acting seat uses expanded combat');
  enemy.combatStance={maneuver:'attack',camp:'physical',range:'melee'};
  const instance=seat.piles.hand[0];
  const card=previewCoopCard(combat,seat.id,instance.instanceId,enemy.id).resolvedDefinition;
  // Hold the same stance so this isolates the level contribution from entry grants.
  seat.entity.combatStance=stanceOf(card);
  const actor=JSON.parse(JSON.stringify({...seat.entity,id:seat.id,level:seat.level,attributes:seat.attributes}));
  const scene=JSON.parse(JSON.stringify({combatExpansionVersion:2,enemies:combat.enemies,combatExpansionRules:combat.combatExpansionRules}));
  const predicted=coopCardHitPreview(scene,registries,actor,scene.enemies[0],card);
  assert.equal(predicted.inRange,true,'the level comparison is an in-range attack');
  primeAccuracyRolls(combat,{die:20,count:2});
  const before=combat.eventLog.length;
  playCard(combat,seat.id,instance.instanceId,enemy.id);
  const receipt=combat.eventLog.slice(before).find(event=>event.type==='attackHit');
  assert.ok(receipt,'the actual host action emits its Accuracy result');
  assert.equal(predicted.accuracy,receipt.accuracy,'public seat level yields host Accuracy');
  assert.equal(predicted.hitChance,receipt.hitChance,'public snapshot percentage matches the host');
  return predicted;
}
test('level ten co-op snapshot previews match actual host rolls and retain level scaling',()=>{
  const low=comparison(1),high=comparison(10);
  assert.ok(high.accuracy>low.accuracy,'level ten includes its earned Accuracy');
  assert.ok(high.hitChance>low.hitChance,'level scaling changes the displayed chance');
});

test('co-op HUD Evasion matches the host with plated armour and an active buckler', () => {
  const slots = registries.equipment.slots;
  const armourSlot = slots.find(slot => slot.kinds.includes('armor'));
  const shieldSlot = slots.find(slot => slot.kinds.includes('shield'));
  assert.ok(armourSlot && shieldSlot, 'the fixture uses authored equipment slots');
  const loadout = { sets: Object.fromEntries(slots.map(slot => [slot.id, [null]])), active: {} };
  loadout.sets[armourSlot.id] = ['default'];
  loadout.sets[shieldSlot.id] = ['buckler'];
  const combat = createCoopCombat({ registries, rng: createRng(812), combatExpansionVersion: 2,
    players: [{ id: 'seatA', classId: 'reaver', combatExpansionVersion: 2, level: 10,
      maxHp: 100, hp: 100, maxMana: 20, mana: 20, maxStamina: 50, stamina: 50,
      energyMax: 10, drawPerTurn: 1, loadout,
      attributes: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10 },
      deck: [{ cardId: 'strike', instanceId: 'one' }] }], enemyIds: ['wanderingSoldier'] });
  const seat = combat.players.get('seatA');
  seat.entity.statuses.evade = { stacks: 2 };
  const row = JSON.parse(JSON.stringify({ ...seat.entity, id: seat.id, level: seat.level, attributes: seat.attributes }));
  const member = JSON.parse(JSON.stringify({ id: seat.id, classId: seat.classId, loadout: seat.loadout, level: { level: 10 } }));
  const scene = JSON.parse(JSON.stringify({ combatExpansionVersion: 2, combatExpansionRules: combat.combatExpansionRules }));
  const host = { ...combat, playerIdForEntity: entity => entity === seat.entity ? seat.id : null };
  assert.equal(coopCombatantEvasion(scene, registries, row, member), effectiveEvasion(host, seat.entity),
    'the public HUD combines current combat state with the same equipment as the host');
  const noShield = structuredClone(member);
  noShield.loadout.sets[shieldSlot.id] = [null];
  assert.notEqual(coopCombatantEvasion(scene, registries, row, noShield), coopCombatantEvasion(scene, registries, row, member),
    'the displayed Evasion includes the active buckler');
  assert.notEqual(coopCombatantEvasion(scene, registries, row), coopCombatantEvasion(scene, registries, row, noShield),
    'plated armour does not silently use the Cloth fallback');
});
