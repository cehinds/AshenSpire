import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {combatFrameTarget} from '../src/ui/components/battlefieldStage.js';
import {combatTargetAnchors} from '../src/ui/models/CombatOverheadModel.js';

const clear = (target, rect) => target.x + target.width / 2 + 2 <= rect.left
  || target.x - target.width / 2 >= rect.right + 2 || target.y + 22 + 2 <= rect.top || target.y - 22 >= rect.bottom + 2;

test('captured1227 offscreen player core can pack above the hand without removing any obstacle',()=>{
  // Captured frame/hand/HUD and old proxy coordinates, not a claim that the
  // diagnostic recorded internal sprite or pack inputs. Reconstruct the old
  // desired anchor from its observed44px core. The lower band conservatively
  // reserves the entire footer containing its observed action-row hits.
  const fieldRect={left:0,top:90,width:1440,height:417.28125};
  const oldCenter={x:534.54684,y:801.2808},hostRect={left:oldCenter.x-50,width:100,bottom:oldCenter.y-22};
  const input={id:'player',hostRect,fieldRect,footerSize:44,footerWidth:0,player:true};
  const target=combatFrameTarget(input);
  const obstacles=[{left:0,right:1440,top:507.28125-90,bottom:777.28125-90},
    {left:0,right:1440,top:777.28125-90,bottom:900-90},
    {left:664.265625,right:776.265625,top:459.28125-90,bottom:503.28125-90},
    // An independently exposed44px Info door is an additional controlled
    // obstacle, not a measured hidden rectangle from the old diagnostic.
    {left:oldCenter.x-22,right:oldCenter.x+22,top:435-90,bottom:479-90}];
  const options={width:1440,height:900-90-60,size:44,lockX:true,maxShiftX:44,obstacles};
  const old={...target,y:oldCenter.y-90,minY:oldCenter.y-90};
  assert.equal(combatTargetAnchors({...options,targets:[old]})[0].obstructed,true,
    'the previous player body-bottom floor cannot escape the captured hand/footer coverage');
  const before=structuredClone({input,obstacles}),[packed]=combatTargetAnchors({...options,targets:[target]});
  assert.equal(packed.obstructed,false);assert.equal(packed.x,oldCenter.x);
  assert.ok(packed.y+22<=fieldRect.height,'the full44px proxy stays inside the field');
  assert.ok(obstacles.every(rect=>clear(packed,rect)),'full hand, footer, HUD and Information footprints remain clear');
  assert.equal(packed.width,48,'existing complete reserved player footprint is retained');
  assert.deepEqual({input,obstacles},before,'artwork and obstacle measurements are immutable');
  assert.deepEqual(combatTargetAnchors({...options,targets:[packed]}),[packed],'settled proxy placement is idempotent');
});

test('ordinary player anchors and all enemy body-bottom floors remain unchanged',()=>{
  const common={id:'actor',hostRect:{left:100,width:80,bottom:200},fieldRect:{left:0,top:50,height:300},footerSize:44,footerWidth:104};
  assert.deepEqual(combatFrameTarget({...common,player:true}),{id:'actor',x:140,y:172,minY:22,width:104});
  assert.deepEqual(combatFrameTarget({...common,player:false}),{id:'actor',x:140,y:172,minY:172,width:104});
  const options={width:360,height:300,size:44,lockX:true,obstacles:[{left:80,right:210,top:160,bottom:280}]};
  const [enemy]=combatTargetAnchors({...options,targets:[combatFrameTarget({...common,player:false})]});
  assert.equal(enemy.y,172);assert.equal(enemy.obstructed,true,'an enemy cannot move its footer over its own body to hide infeasible space');
  const [player]=combatTargetAnchors({...options,targets:[combatFrameTarget({...common,player:true})]});
  assert.equal(player.obstructed,false);assert.ok(player.y+24<=160,'only the independent player proxy can use the clear upper slot');
  const [ordinary]=combatTargetAnchors({...options,obstacles:[],targets:[combatFrameTarget({...common,player:true})]});
  assert.equal(ordinary.x,140);assert.equal(ordinary.y,172);
});

test('a fully blocked field still reports the player proxy as obstructed',()=>{
  const target=combatFrameTarget({id:'player',hostRect:{left:30,width:60,bottom:500},
    fieldRect:{left:0,top:0,height:80},footerSize:44,footerWidth:0,player:true});
  const [packed]=combatTargetAnchors({width:120,height:80,size:44,lockX:true,maxShiftX:44,targets:[target],
    obstacles:[{left:0,right:120,top:0,bottom:80}]});
  assert.equal(packed.obstructed,true);assert.ok(packed.y>=22&&packed.y+22<=80);
});

test('the actual stage pack and HUD retry use the same player proxy receipt and enemy attachment',()=>{
  const source=readFileSync(new URL('../src/ui/components/battlefieldStage.js',import.meta.url),'utf8');
  const begin=source.indexOf('    const packTargets = () => '),end=source.indexOf('    settledTargets = targets;',begin);
  assert.ok(begin>=0&&end>begin);
  const fieldRect={left:10,top:90,width:1440,height:417.28125},boxes=[
    {hostRect:{left:484.54684,width:100,bottom:779.2808},footerWidth:0,frameRect:{},controls:[]},
    {hostRect:{left:550,width:100,bottom:400},footerWidth:104,frameRect:{},controls:[]},
  ];
  const placed=boxes.map((_box,index)=>({frame:{dataset:{eid:index?'enemy':'player'},
    classList:{contains:role=>role===(index?'enemy':'player')}}}));
  let packInput,retryInput;
  runInNewContext(source.slice(begin,end),{fieldRect,boxes,placed,footerSize:44,combatFrameTarget,ribbon:null,
    combat:{getBoundingClientRect:()=>({bottom:900})},readFooterObstacles:()=>[],
    combatTargetAnchors:input=>{packInput=input;return input.targets;},placePlayerHud:()=>{},
    packCombatTargetsWithHud:input=>{retryInput=input;return input.pack();}});
  const player=packInput.targets.find(target=>target.id==='player'),enemy=packInput.targets.find(target=>target.id==='enemy');
  assert.equal(player.y,fieldRect.height-22);assert.equal(player.minY,22);
  assert.equal(enemy.y,400-90+22);assert.equal(enemy.minY,enemy.y);
  for(const target of packInput.targets){
    const core=retryInput.targetCores.find(core=>core.id===target.id);
    assert.equal(core.left,fieldRect.left+target.x-22);assert.equal(core.top,fieldRect.top+target.y-22);
    assert.equal(core.right-core.left,44);assert.equal(core.bottom-core.top,44);
  }
});
