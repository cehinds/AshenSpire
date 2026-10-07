import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRng} from '../src/engine/rng.js';
import {createCoopCombat,playCard} from '../src/engine/coopCombat.js';
import {grantAbilityCharge} from '../src/engine/abilityRiders.js';
import {getStacks} from '../src/engine/statuses.js';
import {botCardTargetId} from '../tools/simbot.mjs';
const registries=createRegistries(contentBundle);
const player=(id,cardId)=>({id,classId:'reaver',maxHp:80,hp:80,energyMax:20,maxStamina:20,stamina:20,drawPerTurn:5,relicIds:[],deck:Array.from({length:5},(_,i)=>({instanceId:id+i,cardId,upgraded:false}))});
const snapshot=c=>JSON.stringify({players:[...c.players],enemies:c.enemies,eventLog:c.eventLog,queue:c.queue,pendingAbilityDiscard:c.pendingAbilityDiscard,rng:c.rng.getCounters(),playerKey:c.playerKey});
for(const charged of [false,true])test('two-seat target preview retains correct owner and authoritative state, charged='+charged,()=>{
 const c=createCoopCombat({registries,rng:createRng(123),players:[player('a','strike'),player('b','defend')],enemyIds:['wanderingSoldier']});
 c.enemies[0].hp=c.enemies[0].maxHp=1000;
 // Leave the live context bound to A, then preview a distinct card owned by B.
 const attack=c.players.get('a').piles.hand[0];playCard(c,'a',attack.instanceId,'e1');
 grantAbilityCharge(c.players.get('a').entity,{key:'wrong-owner-rime',buildupStatus:'frost',buildup:4});
 const b=c.players.get('b'),card=b.piles.hand[0];
 if(charged)grantAbilityCharge(b.entity,{key:'owner-rime',buildupStatus:'frost',buildup:2});
 const before=snapshot(c),target=botCardTargetId(registries,c,card,'e1','b');
 assert.equal(target,charged?'e1':undefined);assert.equal(snapshot(c),before,'preview changes no seat, resource, queue or RNG');
 assert.equal(botCardTargetId(registries,c,card,'e1'),target,'exact hand ownership remains a safe optional-owner fallback');
 assert.throws(()=>botCardTargetId(registries,c,card,'e1','a'),/not in hand|Unknown card instance/,'an incorrect explicit owner fails visibly');
 assert.equal(snapshot(c),before,'owner refusal leaves the authoritative fight unchanged');
 const oldBlock=b.entity.block;assert.doesNotThrow(()=>playCard(c,'b',card.instanceId,target));
 assert.ok(b.entity.block>oldBlock,'B actually plays its defensive card rather than silently ending its turn');
 if(charged){assert.equal(getStacks(c.enemies[0],'frost'),2);assert.deepEqual(b.entity.abilityRiders.charges,{});}
 assert.equal(c.players.get('a').entity.block,0,'B block never pays the formerly bound actor');
});
