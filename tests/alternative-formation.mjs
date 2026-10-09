import assert from 'node:assert/strict';
import { alternativeFormation, fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';

for (const [width,height,narrow] of [[1600,550,false],[390,464,true],[844,230,false]]) {
  for (const count of [1,2,4,6]) {
    const cells = ['player','enemy'].flatMap(side => Array.from({length:6},(_,i) => ({
      side,cell:`${'ABC'[Math.floor(i/2)]}${side==='player'?i%2+1:4-i%2}`,row:Math.floor(i/2),column:i%2,id:`${side}${i}`,
    })));
    const plan = alternativeFormation({columns:2,rows:3,cells,slots:[cells[1],...cells.slice(6,6+count)]},width,height,narrow);
    assert.equal(new Set(plan.cells.map(c=>c.cell)).size,12);
    for(const slot of plan.slots) assert.deepEqual(plan.cells.find(c=>c.cell===slot.cell),slot);
    const actors = plan.slots.map(slot=>({slot,side:slot.side,ratio:slot.side==='enemy'?1.75:1,visibleHeight:190,visibleWidth:160,leading:35,multiplier:1}));
    const fit = fitAlternativeSprites({width,height,actors,narrow});
    assert.equal(fit.length,count+1);
    for(const size of fit){
      const actor=actors.find(a=>a.slot.id===size.id);
      assert(size.visibleHeight>0 && Number.isFinite(size.scale));
      assert(actor.slot.ground-size.visibleHeight>=actor.leading+5);
      assert(size.x-size.scale*actor.visibleWidth/2>=4);
      assert(size.x+size.scale*actor.visibleWidth/2<=width-4);
    }
  }
}
console.log('Alternative formation: desktop, phone, short landscape; 1–6 enemies; grid identity and safe bounds passed.');
