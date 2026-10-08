import test from 'node:test';
import assert from 'node:assert/strict';
import { combatComposition } from '../src/ui/models/CombatCompositionModel.js';

test('option C keeps a waist-overlapped solo player and a smaller centered enemy group', () => {
  const actors = ['p','a','b'].map((id,i) => ({side:i?'enemy':'player', visibleWidth:60, visibleHeight:100,
    leading:40, slot:{id,ground:300}}));
  const sizes = actors.map((a,i) => ({id:a.slot.id,x:[80,270,340][i],visibleHeight:150,scale:1.5,multiplier:1}));
  const before=structuredClone(sizes);
  const result=combatComposition({actors,sizes,width:390,height:400,handTop:440});
  assert.deepEqual(sizes,before);
  assert.equal(result[0].visibleHeight,192);
  assert.equal(result[0].ground-result[0].visibleHeight/2,440);
  assert.equal(result[1].visibleHeight,120);
  assert.equal((result[1].x+result[2].x)/2,390*.55);
  assert.equal(result[2].x-result[1].x,70);
  assert(result[1].ground<300);
});

test('co-op does not push players beneath the hand and every painted figure stays in bounds', () => {
  for(const width of [320,390,844,1440]) {
    const actors=[{side:'player',visibleWidth:80,visibleHeight:100,leading:30,slot:{id:'p',ground:250}}];
    const [r]=combatComposition({actors,sizes:[{id:'p',x:25,visibleHeight:100,scale:1,multiplier:1}],width,height:300,handTop:290,solo:false});
    assert.equal(r.ground,250); assert.equal(r.visibleHeight,100);
    assert(r.x-r.scale*40>=6); assert(r.x+r.scale*40<=width-6);
  }
});
