import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, playCard, previewCoopCard } from '../src/engine/coopCombat.js';
import { coopCardHitPreview } from '../src/ui/models/CoopHitPreviewModel.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const registries=createRegistries(contentBundle);
function comparison(level) {
  const combat=createCoopCombat({registries,rng:createRng(811),combatExpansionVersion:2,
    players:[{id:'seatA',classId:'reaver',level,maxHp:100,hp:100,maxMana:20,mana:20,maxStamina:50,stamina:50,energyMax:10,drawPerTurn:1,
      attributes:{strength:1,dexterity:1,constitution:1,intelligence:1,wisdom:1},
      deck:[{cardId:'strike',instanceId:'one'}]}],enemyIds:['wanderingSoldier']});
  const seat=combat.players.get('seatA'),enemy=combat.enemies[0];
  const instance=seat.piles.hand[0];
  const card=previewCoopCard(combat,seat.id,instance.instanceId,enemy.id).resolvedDefinition;
  // Hold the same stance so this isolates the level contribution from entry grants.
  seat.entity.combatStance=stanceOf(card);
  const actor=JSON.parse(JSON.stringify({...seat.entity,id:seat.id,level:seat.level,attributes:seat.attributes}));
  const scene=JSON.parse(JSON.stringify({combatExpansionVersion:2,enemies:combat.enemies,combatExpansionRules:combat.combatExpansionRules}));
  const predicted=coopCardHitPreview(scene,registries,actor,scene.enemies[0],card);
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
