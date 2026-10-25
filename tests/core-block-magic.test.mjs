import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { profileDamageReceipt,isPierceHit } from '../src/engine/gameProfileCombat.js';
// Owner, 2026-10-25: Block soaks the whole hit, magic included, unless the hit pierces.
const profile=resolveGameProfile({formatVersion:1,core:'ashen.core@2.0.0',modules:{}});
const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
function liveCore() {
 const run=createRunState({registries:reg,classId:'reaver',seed:511,profileMeta:{gameProfileUnlocks:{core:{completedRunIds:['a','b','c']}}}});
 const combat=createRunCombat({registries:reg,run,rng:createRng(511),enemyIds:['wanderingSoldier']});
 delete combat.player.combatStance;
 return combat;
}
function hit(carrier,block,barrier=0) {
 const combat=liveCore(),target=combat.enemies[0];
 target.block=block;target.barrier=barrier;target.persistentWard=null;target.persistentPoise=null;target.gameProfilePoise=0;
 const receipt=profileDamageReceipt(combat,combat.player,target,10,{...carrier,skipRatingBonus:true},{roll:0});
 return receipt;
}
const physical={combatProfile:{camp:'physical',damageType:'slashing'}};
const magic={combatProfile:{camp:'spell',damageType:'fire',magicShare:1}};
const pierce={combatProfile:{camp:'physical',damageType:'piercing'}};
test('Block soaks a physical hit',()=>{
 const r=hit(physical,4);
 assert.equal(r.blocked,4);
});
test('Block soaks a magic hit without pierce',()=>{
 const r=hit(magic,4);
 assert.equal(r.blocked,4,'magic meets Block');
 assert.ok(r.damageReceipt.hits[0].blocked===4);
});
test('magic Block leaves meets Barrier next',()=>{
 const r=hit(magic,4,3);
 assert.equal(r.blocked,4);
 assert.equal(r.barrierMitigated,3);
});
test('a pierce hit skips Block entirely',()=>{
 for (const carrier of [pierce,{...physical,tags:['pierce']},{...physical,authoredTags:['damage:piercing']}]) {
  const r=hit(carrier,4);
  assert.equal(r.blocked,0);
  assert.ok(isPierceHit(carrier.combatProfile,carrier));
 }
 assert.ok(!isPierceHit(physical.combatProfile,physical));
});
