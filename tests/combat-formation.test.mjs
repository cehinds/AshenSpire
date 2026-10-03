import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation, COMBAT_LAYOUT } from '../src/ui/models/CombatFormationModel.js';
const ids = (prefix,n) => Array.from({length:n},(_,i)=>prefix+i);
test('every preferred row and column places actors on the matching named grid anchor', () => {
  for (const row of 'ABC') for (const playerColumn of ['1', '2']) for (const enemyColumn of ['3', '4']) {
    const plan = combatFormation({ width: 390, height: 380, friends: ids('p', 6), enemies: ids('e', 6), presentation: {
      playerSpawnRow: row, enemySpawnRow: row, playerSpawnColumn: playerColumn, enemySpawnColumn: enemyColumn,
      frontOffsetX: 12, frontOffsetY: -10, backOffsetX: -8, backOffsetY: 5,
      frontLayer: 300, backLayer: 100, rowBLayer: 25,
    } });
    assert.equal(plan.slots[0].cell, row + playerColumn);
    assert.equal(plan.slots[6].cell, row + enemyColumn);
    assert.equal(new Set(plan.slots.map(s => s.cell)).size, 12);
    for (const slot of plan.slots) {
      const cell = plan.cells.find(c => c.cell === slot.cell);
      for (const key of ['x', 'ground', 'layer', 'row', 'column']) assert.equal(slot[key], cell[key]);
      assert.equal(slot.layer, (slot.column ? 300 : 100) + (slot.row === 1 ? 25 : 0));
    }
  }
});
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
test('cells are named row letter then battlefield column, left to right',()=>{
  for(const width of [360,794,1440]) {
    const p=combatFormation({width,height:380,friends:ids('p',6),enemies:ids('e',6)});
    assert.deepEqual(p.slots.map(s=>s.cell),['A1','A2','B1','B2','C1','C2','A4','A3','B4','B3','C4','C3']);
    for(const row of [0,1,2]) assert.deepEqual(p.slots.filter(s=>s.row===row).sort((a,b)=>a.x-b.x).map(s=>s.cell),[1,2,3,4].map(n=>'ABC'[row]+n));
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
