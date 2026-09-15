import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation, COMBAT_LAYOUT } from '../src/ui/models/CombatFormationModel.js';
const ids = (prefix,n) => Array.from({length:n},(_,i)=>prefix+i);
test('six reserved mirrored slots keep empty encounter positions stable',()=>{
  for(const width of [320,360,375,794,1440]) {
    const full=combatFormation({width,height:380,friends:ids('p',6),enemies:ids('e',6)});
    const sparse=combatFormation({width,height:380,friends:['p0'],enemies:['e0']});
    assert.deepEqual(sparse.slots[0],full.slots[0]);
    assert.deepEqual(sparse.slots[1],full.slots[6]);
    for(let i=0;i<6;i++) {
      const a=full.slots[i],b=full.slots[i+6];
      assert.ok(Math.abs(a.x+b.x-width)<1e-8);
      assert.equal(a.formationRow,i%2?'front-row':'back-row');
      assert.equal(a.layer,i%2?0:200);
      assert.ok(a.x-a.width/2>=0 && b.x+b.width/2<=width);
    }
    const feet=[0,2,4].map(i=>full.slots[i].ground);
    assert.ok(Math.abs((feet[1]-feet[0])-(feet[2]-feet[1]))<1e-8);
    assert.ok(full.slots[0].x<full.slots[2].x && full.slots[2].x<full.slots[4].x);
  }
});
test('fitting baselines remain separate from lowered display anchors',()=>{
 const p=combatFormation({width:1440,height:450,friends:ids('p',6),enemies:[]});
 assert.ok(p.slots[0].fitGround<p.slots[0].ground);
 assert.ok(p.slots[2].fitGround<p.slots[2].ground);
 assert.equal(p.slots[4].fitGround,p.slots[4].ground);
});
test('layout budgets sum to viewport and ignore transient domain state',()=>{
 assert.equal(COMBAT_LAYOUT.hud+COMBAT_LAYOUT.field+COMBAT_LAYOUT.hand+COMBAT_LAYOUT.controls,100);
 const input={width:794,height:402,friends:['p'],enemies:ids('e',4)};
 assert.deepEqual(combatFormation(input),combatFormation({...input,phase:'enemy',defeated:['e1']}));
});
