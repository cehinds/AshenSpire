import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { combatTargetAnchors } from '../src/ui/models/CombatOverheadModel.js';
import { playerDetailsPlacement } from '../src/ui/models/PlayerDetailsPlacementModel.js';
import { packCombatTargetsWithHud, combatTargetHudFootprints } from '../src/ui/components/battlefieldStage.js';

test('historical1209 phone geometry packs full footers beside its original reserved HUD and hand layout', () => {
  // Native1209 original RED and separate passive logpoints. These are screen
  // pixels, including the common screen-in translation at the original fit.
  const fieldTop=81.37437438964844, handTop=361.1208793242812;
  const intents=[
    {left:113.25,right:209.25,top:202.24937438964844,bottom:256.6400146484375},
    {left:215.25,right:311.25,top:202.24937438964844,bottom:256.6400146484375},
    {left:117.75,right:213.75,top:136.68687438964844,bottom:191.07749938964844},
  ];
  const targets=[
    {id:'player',x:91.6484375,y:484.1868896484375-fieldTop+22,width:48},
    {id:'e1',x:165.7421875,y:309.9525146484375-fieldTop+22,width:104},
    {id:'e2',x:263.2421875,y:309.9525146484375-fieldTop+22,width:104},
    {id:'e3',x:165.7421875,y:265.8900146484375-fieldTop+22,width:104},
  ];
  const placement={art:{right:153.390625,top:353.1740641874425},width:128,height:79.9375,
    viewport:{left:0,top:6.639999866485596,right:390,bottom:656.6399998664856},
    handTop,hudBottom:fieldTop,leftOverhang:43.98876382978723};
  const originalHud={left:163.390625,top:266.6400146484375};
  const fixed=[...intents,
    {left:92.8125,right:297.1875,top:fieldTop,bottom:103.71812438964844},
    {left:241.96875,right:378,top:464.73374938964844,bottom:556.73374938964844},
    {left:0,right:241.953125,top:handTop,bottom:564.6243896484375},
  ];
  const input=structuredClone({targets,placement,fixed,originalHud});
  const clear=(a,b)=>a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;
  const observed=combatTargetHudFootprints([{id:'e2',x:271.7421819148936,
    y:331.9526935385846-fieldTop,width:103.98893617021275}],{left:0,top:fieldTop},43.98876382978723)[0];
  assert.equal(clear(observed,{left:originalHud.left,right:originalHud.left+128,
    top:originalHud.top,bottom:originalHud.top+placement.height}),false,
    'the native unobstructed flag omitted a real HUD overlap');
  let hud=originalHud, retries=0;
  const obstacles=()=>[...fixed,{left:hud.left-placement.leftOverhang-8,right:hud.left+128+8,
    top:hud.top-8,bottom:hud.top+placement.height+8}];
  const pack=()=>combatTargetAnchors({width:390,height:placement.viewport.bottom-fieldTop-60,
    size:44,lockX:true,maxShiftX:44,targets,obstacles:obstacles().map(box=>({...box,
      top:box.top-fieldTop,bottom:box.bottom-fieldTop}))});
  const cores=targets.map(t=>({id:t.id,left:t.x-22,right:t.x+22,
    top:fieldTop+t.y-22,bottom:fieldTop+t.y+22}));
  const result=packCombatTargetsWithHud({pack,targetCores:cores,placeHud:blocked=>{
    retries++;hud=playerDetailsPlacement({...placement,obstacles:[...intents,...blocked]});
  }});
  assert.equal(retries,1); assert.ok(hud.left>230);
  const footprints=combatTargetHudFootprints(result,{left:0,top:fieldTop},44);
  for(let i=0;i<result.length;i++){
    const target=result[i],rect=footprints[i],source=targets.find(t=>t.id===target.id);
    assert.equal(target.obstructed,false,target.id);
    assert.ok(Math.abs(target.x-source.x)<=44);
    assert.ok(rect.left>=0&&rect.right<=390&&rect.top>=fieldTop&&rect.bottom<=placement.viewport.bottom-60);
    assert.ok(obstacles().every(box=>clear(rect,box)),target.id+' full footer clears the complete HUD/Info/hand/intent reservations');
    assert.ok(footprints.filter((_,j)=>j!==i).every(box=>clear(rect,box)));
    if(target.id!=='player')assert.ok(Math.abs(target.y-source.y)<=88);
  }
  assert.ok(hud.left-placement.leftOverhang>=10&&hud.left+128<=380&&hud.top+placement.height<=handTop-10);
  const settled=playerDetailsPlacement({...placement,previous:hud,obstacles:[...intents,...footprints]});
  assert.deepEqual(settled,hud,'tracking keeps the accepted complete-footer reservation');
  const motion={left:0,top:74.734375};
  const moved=combatTargetHudFootprints(result,motion,44);
  moved.forEach((box,index)=>assert.deepEqual(box,{...footprints[index],
    top:footprints[index].top+motion.top-fieldTop,bottom:footprints[index].bottom+motion.top-fieldTop},
    'settled local targets follow the common screen translation without repacking actors'));
  assert.deepEqual(pack(),result,'a settled refresh is idempotent');
  assert.deepEqual({targets,placement,fixed,originalHud},input,'art, layout inputs and captured evidence are immutable');

  // Execute the actual stage tracking function with replacing footer children.
  // The full settled pack must remain the reservation across the shared fade.
  const stage=readFileSync(new URL('../src/ui/components/battlefieldStage.js',import.meta.url),'utf8');
  const start=stage.indexOf('  function placePlayerHud('),end=stage.indexOf('  function trackPlayerHud()',start);
  assert.ok(start>=0&&end>start);
  let delta=0,lastInput;
  const rect=()=>({left:0,top:fieldTop+delta});
  const leading={style:{},querySelector:selector=>selector.includes('combatant-info')?null:{},
    getBoundingClientRect:()=>({left:parseFloat(leading.style.left)||hud.left,
      top:parseFloat(leading.style.top)||hud.top+delta,width:128,height:placement.height})};
  const sprite={};
  const player={dataset:{},querySelector:selector=>selector==='.sprite'?sprite:
    selector==='.combatant-leading'?leading:{getBoundingClientRect:()=>({left:0,top:0})}};
  const combat={getBoundingClientRect:()=>({...placement.viewport,top:placement.viewport.top+delta,
    bottom:placement.viewport.bottom+delta}),querySelector:selector=>selector==='.combat-tools'?null:{getBoundingClientRect:()=>({bottom:fieldTop+delta})}};
  const field={getBoundingClientRect:rect,closest:()=>combat,
    querySelectorAll:selector=>selector==='.combatant.player'?[player]:intents.map(box=>({...box,
      top:box.top+delta,bottom:box.bottom+delta}))};
  const tracking=runInNewContext(stage.slice(start,end)+'\nplacePlayerHud',{
    field,settledTargets:result,settledFooterSize:44,combatTargetHudFootprints,
    uiZoom:()=>1,visibleCombatPanelRect:node=>node,combatPlayerInfoRect:()=>null,
    currentSpriteArtBounds:()=>({...placement.art,top:placement.art.top+delta}),
    readRestingHand:()=>({clearanceTop:handTop+delta}),
    playerDetailsPlacement:options=>{lastInput=options;return playerDetailsPlacement(options);},
  });
  for(let frame=0;frame<60;frame++){
    delta=frame<30?0:motion.top-fieldTop;
    tracking();
    const full=combatTargetHudFootprints(result,rect(),44);
    assert.deepEqual(structuredClone(lastInput.obstacles.slice(intents.length,intents.length+full.length)),full);
    assert.ok(full.every(box=>clear({left:parseFloat(leading.style.left),
      right:parseFloat(leading.style.left)+128,top:parseFloat(leading.style.top),
      bottom:parseFloat(leading.style.top)+placement.height},box)),
      'actual tracking cannot replace a full target reservation with stale child measurements');
  }
});
