import test from 'node:test';import assert from 'node:assert/strict';
import {CLASS_IDS,OUTFIT_ROWS,WEAPONS,resolveAttack} from './catalog.mjs';
import {resolveAction,actionForCard,createAnimationState,reduceAnimation} from './action-resolver.mjs';
import {GRIPS,weaponTransform} from './weapon-grips.mjs';
const base={classId:'reaver',outfit:'default',main:'straightSword'};
test('every catalog armament and outfit resolves by equipped items',()=>{
 for(const o of OUTFIT_ROWS)for(const main of WEAPONS)for(const off of [null,...WEAPONS]){
  const result=resolveAttack({classId:o.classId,outfit:o.id,main:main.id,off:off?.id});
  assert.equal(typeof result.allowed,'boolean');if(result.allowed){assert.equal(result.outfit,o.key);assert.equal(result.frames,7);assert.equal(result.primary,main.id);assert.equal(result.secondary,off?.id||null);}
 }
 assert.equal(CLASS_IDS.length,4);assert.equal(OUTFIT_ROWS.length,16);assert.equal(WEAPONS.length,25);
});
test('empty, shield, focus and twin loadouts select different poses',()=>{
 assert.equal(resolveAttack(base).clip,'empty');
 assert.equal(resolveAttack({...base,off:'kiteShield'}).clip,'shield');
 assert.equal(resolveAttack({...base,off:'ashStaff'}).clip,'staff');
 assert.equal(resolveAttack({...base,off:'dagger'}).clip,'twin');
 assert.equal(resolveAttack({...base,off:'parryDagger'}).clip,'twin');
});
test('two-handed grip obeys resolved equipment permissions',()=>{
 assert.equal(resolveAttack({...base,main:'greatsword'}).clip,'two-hand');
 assert.equal(resolveAttack({...base,main:'greatsword',off:'kiteShield'}).allowed,false);
 assert.equal(resolveAttack({...base,main:'greatsword',off:'kiteShield',handsRequired:1,oneHandAllowed:true}).clip,'shield');
 assert.equal(resolveAttack({...base,main:'shortbow',off:'dagger',oneHandAllowed:true}).allowed,false);
 assert.equal(resolveAttack({...base,main:'starstoneStaff',handsRequired:2}).clip,'two-hand');
});
test('casting and defense use hand occupancy and techniques',()=>{
 assert.equal(resolveAction({...base,main:'starstoneStaff'},'cast').clip,'focus');
 assert.equal(resolveAction({...base,main:'starstoneStaff',handsRequired:2},'cast').clip,'cast-two-hand');
 assert.equal(resolveAction({...base,main:'ashStaff',off:'starstoneStaff'},'cast').clip,'cast-dual-focus');
 assert.equal(resolveAction({...base,off:'kiteShield'},'block').clip,'block-shield');
 assert.equal(resolveAction({...base,off:'parryDagger'},'parry').clip,'parry-dagger');
 assert.equal(resolveAction({...base,off:'dagger'},'hurt').clip,'hurt-occupied');
});
test('guard skills and powers hold their stance across reactions until own next turn',()=>{
 assert.equal(actionForCard({type:'Attack',tags:['guard']}),'attack');
 assert.equal(actionForCard({type:'Skill',tags:['mechanic:block']}),'defend');
 assert.equal(actionForCard({type:'Skill',tags:[]}),'cast');
 for(const [card,held]of [[{type:'Skill',tags:['guard']},'guard'],[{type:'Power'},'cast']]){
  let state=reduceAnimation(createAnimationState(),{type:'card',card});assert.equal(state.held,held);
  state=reduceAnimation(state,{type:'reaction',action:'hurt'});state=reduceAnimation(state,{type:'complete'});assert.equal(state.held,held);
  state=reduceAnimation(state,{type:'turn-start',actor:'opponent'});assert.equal(state.held,held);
  state=reduceAnimation(state,{type:'turn-start',actor:'self'});assert.equal(state.held,'combat-idle');
 }
});
test('weapon transforms pin each item grip precisely to its socket',()=>{
 for(const item of WEAPONS){assert.ok(GRIPS[item.id]);for(const angle of [-140,-50,0,45,170]){
  const t=weaponTransform(item.id,[311,298],angle);assert.deepEqual(t.anchor,[311,298]);assert.ok(Number.isFinite(t.rotation)&&t.scale>0);
  const x=GRIPS[item.id].tip[0]-t.grip[0],y=GRIPS[item.id].tip[1]-t.grip[1],dx=Math.cos(t.rotation)*x-Math.sin(t.rotation)*y,dy=Math.sin(t.rotation)*x+Math.cos(t.rotation)*y;
  assert.ok(Math.abs(Math.atan2(dy,dx)*180/Math.PI-angle)<1e-8);
 }}
});
