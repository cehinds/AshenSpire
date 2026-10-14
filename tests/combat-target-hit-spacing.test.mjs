import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMBAT_TARGET_HIT_PX,combatTargetAnchors,combatTargetPackSize} from '../src/ui/models/CombatOverheadModel.js';

// Regression for #1787: the compact 24px visual footer was used as the pack
// spacing while every painted tap area stayed 44px tall, so two vertically
// packed enemies could sit 26px apart and their hit areas overlapped by 18px.
const hitRect=anchor=>({left:anchor.x-Math.max(COMBAT_TARGET_HIT_PX,anchor.width||0)/2,
  right:anchor.x+Math.max(COMBAT_TARGET_HIT_PX,anchor.width||0)/2,
  top:anchor.y-COMBAT_TARGET_HIT_PX/2,bottom:anchor.y+COMBAT_TARGET_HIT_PX/2});
const overlaps=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
const overlappingPairs=anchors=>anchors.flatMap((a,i)=>anchors.slice(i+1)
  .filter(b=>overlaps(hitRect(a),hitRect(b))).map(b=>`${a.id}/${b.id}`));

// Crowded formations: same-column feet a compact footer apart, a short stage,
// and HUD obstacles that force vertical packing.
const layouts=[
  {name:'two enemies sharing one column',width:288,height:183,
    targets:[{id:'a',x:200,y:100,width:96},{id:'b',x:200,y:126,width:96}]},
  {name:'three overlapping columns on a phone stage',width:288,height:220,
    targets:[{id:'a',x:150,y:90,width:104},{id:'b',x:170,y:100,width:88},{id:'c',x:190,y:116,width:72}]},
  {name:'four enemies under a HUD band',width:390,height:260,
    obstacles:[{left:0,right:390,top:0,bottom:40}],
    targets:[{id:'a',x:220,y:60,width:96},{id:'b',x:240,y:70,width:96},{id:'c',x:260,y:84,width:96},{id:'d',x:280,y:96,width:96}]},
  {name:'feet with body-bottom floors',width:288,height:240,
    targets:[{id:'a',x:180,y:80,minY:80,width:96},{id:'b',x:190,y:104,minY:104,width:96},{id:'c',x:200,y:128,minY:128,width:96}]},
];

test('pack spacing is the real hit-area height, never the compact footer',()=>{
  assert.equal(COMBAT_TARGET_HIT_PX,44,'SPEC §7 minimum touch target');
  assert.equal(combatTargetPackSize([24,20,7]),COMBAT_TARGET_HIT_PX);
  assert.equal(combatTargetPackSize([]),COMBAT_TARGET_HIT_PX);
  assert.equal(combatTargetPackSize([24,60]),60,'a taller visible footer still reserves its full band');
});

test('the stage derives pack spacing and the painted hit height from one constant',()=>{
  const source=readFileSync(new URL('../src/ui/components/battlefieldStage.js',import.meta.url),'utf8');
  assert.match(source,/const footerSize = combatTargetPackSize\(/);
  assert.match(source,/setProperty\('--enemy-hit-height', `\$\{COMBAT_TARGET_HIT_PX \/ zoom\}px`\)/);
  assert.doesNotMatch(source,/--enemy-hit-height', `\$\{\d+/,'no literal hit height may drift from the pack spacing');
});

// The stage packs with lockX and a one-target shift, exactly as here.
for(const layout of layouts){
  test(`packed hit areas never overlap: ${layout.name}`,()=>{
    const size=combatTargetPackSize(layout.targets.map(()=>24));
    const anchors=combatTargetAnchors({width:layout.width,height:layout.height,size,lockX:true,maxShiftX:44,
      obstacles:layout.obstacles||[],targets:layout.targets});
    assert.equal(anchors.length,layout.targets.length);
    assert.deepEqual(anchors.filter(anchor=>anchor.obstructed).map(anchor=>anchor.id),[],
      'every crowded target found a clear slot');
    assert.deepEqual(overlappingPairs(anchors),[],'two packed targets share a tap area');
  });
}

test('the old compact spacing reproduces the overlap this guards against',()=>{
  const anchors=combatTargetAnchors({width:288,height:183,size:24,lockX:true,maxShiftX:44,targets:layouts[0].targets});
  assert.ok(overlappingPairs(anchors).length>0,'the regression fixture must exercise the #1787 overlap');
});
