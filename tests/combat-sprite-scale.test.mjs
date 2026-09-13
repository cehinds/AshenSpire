import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCombatSprites, combatSpriteRatio } from '../src/ui/models/CombatSpriteScaleModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { statureFor } from '../src/ui/components/stature.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';

test('the real roster keeps encounter classification and fits every elite/boss ratio', () => {
  const registries = createRegistries(contentBundle);
  for (const row of contentBundle.encounters) for (const id of row.enemies) {
    const ratio = combatSpriteRatio(statureFor(registries, id), id);
    if (row.pool === 'elite') assert.ok(ratio >= 1.5 && ratio <= 2, id);
    else if (row.pool === 'boss') assert.ok(ratio >= 1.5 && ratio <= 3, id);
    else assert.equal(ratio, 1, id);
  }
  assert.equal(combatSpriteRatio('huge', 'stitchedKing'), 2);
  assert.equal(combatSpriteRatio('huge', 'ashheartDragon'), 3);
});

test('cramped screens shrink the shared player reference, preserving ratio and depth', () => {
  for (const width of [320,390,844,1440]) for (const height of [170,380,405]) for (const ratio of [1.5,1.75,2,3]) {
    const plan = combatFormation({width,height,friends:['p'],enemies:['e','e2','e3']});
    const actors = plan.slots.map((slot,i)=>({slot, ratio:i?ratio:1, leading:28,
      boxHeight:i?240:190, visibleHeight:i?170:180, visibleWidth:i?250:120}));
    const sizes=fitCombatSprites({width,height,actors});
    for (let i=0;i<sizes.length;i++) {
      const a=actors[i],s=sizes[i];
      assert.ok(Math.abs(s.visibleHeight/sizes[0].visibleHeight-a.ratio*a.slot.depth/(actors[0].ratio*actors[0].slot.depth))<1e-9);
      assert.ok(s.visibleHeight+a.leading+6<=a.slot.ground+1e-8);
      const half=s.scale*a.visibleWidth/2;
      assert.ok(s.x-half>=6-1e-8 && s.x+half<=width-6+1e-8);
    }
  }
});

test('transparent padding does not consume overhead clearance or erase the visible size ratio',()=>{
  const actors=[
    {slot:{id:'p',ground:300,x:100,artWidth:190,depth:1},ratio:1,leading:28,boxHeight:190,visibleHeight:160,visibleWidth:120},
    {slot:{id:'b',ground:300,x:950,artWidth:400,depth:1},ratio:3,leading:28,boxHeight:384,visibleHeight:240,visibleWidth:300},
  ];
  const [p,b]=fitCombatSprites({width:1000,height:405,actors});
  assert.equal(b.visibleHeight/p.visibleHeight,3);
  assert.equal(b.x,950,'shared fitting preserves the reserved ground anchor');
  assert.ok(b.x + b.scale * actors[1].visibleWidth / 2 <= 994);
  assert.ok(p.visibleHeight<150,'player yields space to the large boss');
  const padded = fitCombatSprites({width:1000,height:405,actors:actors.map(a=>({...a,boxHeight:a.boxHeight*2}))});
  assert.deepEqual(padded.map(a=>a.visibleHeight),[p.visibleHeight,b.visibleHeight]);
});
