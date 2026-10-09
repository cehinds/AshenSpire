import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeFormation, fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';

test('alternative camera preserves occupancy and fits silhouettes on desktop, phone and short landscape', () => {
  for (const [width, height, narrow] of [[1600,620,false],[390,420,true],[844,220,false]]) {
    for (let count=1; count<=6; count++) {
      const cells = ['player','enemy'].flatMap(side => Array.from({length:6},(_,i)=>({
        id:`${side}-${i}`, cell:`${side}-${i}`, side, column:i%2, row:Math.floor(i/2),
      })));
      const slots=[cells[0],...cells.slice(6,6+count)];
      const plan={columns:2,rows:3,cells,slots};
      alternativeFormation(plan,width,height,narrow);
      assert.deepEqual(plan.cells.map(c=>c.cell),cells.map(c=>c.cell));
      assert.deepEqual(plan.slots.map(c=>c.id),slots.map(c=>c.id));
      for (const [visibleWidth,visibleHeight] of [[240,700],[700,320]]) {
        const actors=plan.slots.map(slot=>({slot,side:slot.side,visibleWidth,visibleHeight,
          leading:30,ratio:1.1,multiplier:1.25}));
        const sizes=fitAlternativeSprites({width,height,actors,narrow});
        assert.equal(sizes.length,actors.length);
        sizes.forEach((size,i)=>{
          const actor=actors[i], halfWidth=visibleWidth*size.scale/2;
          assert(size.scale>0 && Number.isFinite(size.scale));
          assert(size.x-halfWidth>=5-1e-6 && size.x+halfWidth<=width-5+1e-6);
          assert(actor.slot.ground-size.visibleHeight>=actor.leading+6-1e-6);
          assert(actor.slot.ground<=height);
        });
      }
    }
  }
});
