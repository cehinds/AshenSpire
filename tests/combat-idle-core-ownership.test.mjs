import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { combatTargetAnchors } from '../src/ui/models/CombatOverheadModel.js';

const overlaps = (core, box) => core.x + core.width / 2 > box.left && core.x - core.width / 2 < box.right
  && core.y + 22 > box.top && core.y - 22 < box.bottom;

test('short-landscape cores cannot take the neighbouring hound body', () => {
  // The former e3 square covered (352,151), inside e1's visible hound.
  const input = { width:844, height:190, size:44, lockX:true, maxShiftX:44,
    targets:[{id:'e1',x:367,y:176},{id:'e2',x:561,y:176},{id:'e3',x:337,y:164}],
    obstacles:[{ownerId:'e1',left:342,right:392,top:138,bottom:164},
      {ownerId:'e2',left:536,right:586,top:138,bottom:164},
      {ownerId:'e3',left:361,right:373,top:138,bottom:151}] };
  const original = structuredClone(input);
  const cores = combatTargetAnchors(input);
  for (const core of cores) {
    assert.equal(core.obstructed, false, core.id);
    assert.ok(Math.abs(core.x - input.targets.find(t=>t.id===core.id).x) <= 44);
    assert.ok(input.obstacles.every(box => box.ownerId === core.id || !overlaps(core, box)), core.id+' preserves foreign artwork');
    assert.ok(cores.filter(other=>other.id!==core.id).every(other=>!overlaps(core,
      {left:other.x-22,right:other.x+22,top:other.y-22,bottom:other.y+22})), core.id+' keeps a separate input patch');
  }
  const e3 = cores.find(core=>core.id==='e3');
  assert.equal(352 >= e3.x-22 && 352 <= e3.x+22 && 151 >= e3.y-22 && 151 <= e3.y+22, false,
    'the reproduced e1 body click is no longer intercepted by e3');
  assert.deepEqual(input, original, 'packing never changes artwork or source anchors');
});

test('own artwork permits the target while foreign artwork remains an obstacle in every packing mode', () => {
  for (const options of [{}, {lockX:true}, {packWithinBounds:true}]) {
    const input={width:160,height:120,size:44,targets:[{id:'e1',x:80,y:60}],
      obstacles:[{ownerId:'e1',left:0,right:160,top:0,bottom:120}],...options};
    const [own]=combatTargetAnchors(input);
    assert.equal(!!own.obstructed,false);
    assert.equal(own.x,80);assert.equal(own.y,60);
    const [foreign]=combatTargetAnchors({...input,obstacles:[{...input.obstacles[0],ownerId:'e2'}]});
    assert.equal(foreign.obstructed,true,'impossible foreign-body overlap must stay explicit');
  }
});

const stageSource=readFileSync(new URL('../src/ui/components/battlefieldStage.js',import.meta.url),'utf8');
const stageStart=stageSource.indexOf('    // Idle names do not reserve footer rows');
const stageEnd=stageSource.indexOf('    const rect = combat.getBoundingClientRect();',stageStart);
// The adapter asks for idle enemies and for context-selected ones; answer each.
const actor=(id,art,x,y,idle)=>{
  const properties={};
  return {frame:{dataset:{eid:id},matches:selector=>selector.includes('.context-selected:') ? !idle : idle,
    getBoundingClientRect:()=>({left:0,top:0}),
    style:{removeProperty:key=>delete properties[key],setProperty:(key,value)=>{properties[key]=value;}},properties,x,y},
    sprite:{art,getBoundingClientRect:()=>({...art,width:art.right-art.left,height:art.bottom-art.top})}};
};
const runStage=placed=>runInNewContext(stageSource.slice(stageStart,stageEnd),{placed,zoom:1,refresh:()=>{},
  fieldRect:{left:0,top:0,width:844,height:190},
  getComputedStyle:frame=>({left:String(frame.x),top:String(frame.y)}),
  currentSpriteArtBounds:sprite=>sprite.art,
  readRestingHand:()=>null,combat:{querySelector:()=>null,querySelectorAll:()=>[]},combatTargetAnchors});

test('stage repairs one idle core over a selected neighbour even without a core/core collision', () => {
  const source=stageSource, start=stageStart, end=stageEnd;
  assert.ok(start>=0&&end>start);
  const placed=[actor('e1',{left:342,right:392,top:138,bottom:164},367,176,false),
    actor('e3',{left:361,right:373,top:138,bottom:151},337,164,true)];
  const before=placed.map(actor=>structuredClone(actor.sprite.art));
  runInNewContext(source.slice(start,end),{placed,zoom:1,refresh:()=>{},
    fieldRect:{left:0,top:0,width:844,height:190},
    getComputedStyle:frame=>({left:String(frame.x),top:String(frame.y)}),
    currentSpriteArtBounds:sprite=>sprite.art,
    readRestingHand:()=>null,combat:{querySelector:()=>null,querySelectorAll:()=>[]},combatTargetAnchors});
  const frame=placed[1].frame;
  const core={x:parseFloat(frame.properties['--enemy-core-x']),y:parseFloat(frame.properties['--enemy-core-y']),width:44};
  assert.equal(frame.dataset.coreObstructed,'false');
  assert.ok(Number.isFinite(core.x)&&Number.isFinite(core.y),'the lone stealing core is actually repacked');
  assert.equal(overlaps(core,placed[0].sprite.art),false,'selected neighbour keeps its own body click');
  assert.deepEqual(placed.map(actor=>actor.sprite.art),before,'actual stage adapter does not move or resize artwork');
});

test('an idle core never snaps back over a selected neighbour\'s fixed core', () => {
  // Cores 30px apart, and neither core overlaps the other actor's artwork:
  // only the selected enemy's own square stands in the way.
  const placed=[actor('e1',{left:300,right:340,top:60,bottom:120},320,150,false),
    actor('e3',{left:400,right:440,top:60,bottom:120},350,150,true)];
  runStage(placed);
  const e1=placed[0].frame, e3=placed[1].frame;
  assert.equal(e1.properties['--enemy-core-x'],undefined,'the selected core is not repacked');
  const core={x:parseFloat(e3.properties['--enemy-core-x']),y:parseFloat(e3.properties['--enemy-core-y']),width:44};
  assert.ok(Number.isFinite(core.x),'the idle core is packed');
  assert.equal(e3.dataset.coreObstructed,'false');
  assert.equal(overlaps(core,{left:320-22,right:320+22,top:150-22,bottom:150+22}),false,
    'the idle square leaves the selected enemy\'s square to it');
});

test('the player\'s self-cast square is a fixed obstacle for idle-core packing', () => {
  const fixed = stageSource.match(/const fixedCores = placed\.filter\(\(\{frame\}\) => frame\.matches\('([^']+)'\)\)/);
  assert.ok(fixed, 'fixed-core selection is present');
  const selectors = fixed[1].split(',').map(part => part.trim());
  assert.ok(selectors.includes('.player:not(.dead)'), 'the living player square is never covered by a packed enemy core');
  assert.ok(selectors.includes('.enemy.context-selected:not(.dead)'));
});

function runWithControls(placed, controls, bounds = {left:0,top:0,width:390,height:283}) {
  return runInNewContext(stageSource.slice(stageStart,stageEnd), {placed,zoom:1,refresh:()=>{},fieldRect:bounds,
    getComputedStyle:frame=>({left:String(frame.x),top:String(frame.y)}),currentSpriteArtBounds:sprite=>sprite.art,
    visibleCombatPanelRect:node=>node.rect,readRestingHand:()=>null,
    combat:{querySelector:()=>null,querySelectorAll:selector=>controls.filter(node=>selector.split(',').map(part=>part.trim()).includes(node.selector))},
    combatTargetAnchors});
}

test('captured1524 absolute player glyph triggers idle-core repair outside the leading host', () => {
  const glyph={selector:'.player-action-intent',rect:{left:113.266,right:137.266,top:225.156,bottom:249.156}};
  // The core straddles the glyph although its own centres mostly hit e2.
  const placed=[actor('e2',{left:62.934,right:166.934,top:92.730,bottom:217.715},114.934,229.150,true)];
  const artBefore=structuredClone(placed[0].sprite.art);
  runWithControls(placed,[glyph]);
  const frame=placed[0].frame,core={x:parseFloat(frame.properties['--enemy-core-x']),y:parseFloat(frame.properties['--enemy-core-y']),width:44};
  assert.ok(Number.isFinite(core.x)&&Number.isFinite(core.y),'the captured obstructed square is actually repacked');
  assert.equal(frame.dataset.coreObstructed,'false');
  assert.equal(overlaps(core,glyph.rect),false,'the full44px square leaves the absolute glyph clear');
  assert.deepEqual(placed[0].sprite.art,artBefore,'no artwork moves to create a test pass');
});

test('a lone absolute glyph collision triggers repair without any art, core or floor collision', () => {
  const glyph={selector:'.player-action-intent',rect:{left:113.266,right:137.266,top:225.156,bottom:249.156}};
  const placed=[actor('e2',{left:90,right:150,top:180,bottom:270},125,237,true)];
  runWithControls(placed,[glyph]);
  const frame=placed[0].frame,core={x:parseFloat(frame.properties['--enemy-core-x']),y:parseFloat(frame.properties['--enemy-core-y']),width:44};
  assert.ok(Number.isFinite(core.x)&&Number.isFinite(core.y),'the control collision alone invokes packing');
  assert.equal(frame.dataset.coreObstructed,'false');
  assert.equal(overlaps(core,glyph.rect),false);
});

test('mini-HUD controls outside their parent are reserved and impossible space stays explicit', () => {
  const hud={selector:'.combatant-mini-hud',rect:{left:0,right:160,top:0,bottom:120}};
  const placed=[actor('e2',{left:70,right:90,top:20,bottom:80},80,60,true)];
  runWithControls(placed,[hud],{left:0,top:0,width:160,height:120});
  assert.equal(placed[0].frame.dataset.coreObstructed,'true','an unavailable square is never reported reachable');
});
