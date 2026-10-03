import test from 'node:test';
import assert from 'node:assert/strict';
import { localMapPolicy } from '../src/content/localMapPresentation.js';
import { localCamera, anchoredZoom, panCamera, inspectionCamera } from '../src/ui/models/LocalMapCameraModel.js';
import { localServiceModel } from '../src/ui/models/LocalServiceModel.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { createRng } from '../src/engine/rng.js';
import { generateJourney, journeyGraph } from '../src/model/worldAtlas.js';
import { createLocationVisit, arriveAt, restAt, previewRest, leaveLocation } from '../src/engine/locations.js';
import { smithingPlan } from '../src/model/smithing.js';
const policy = localMapPolicy('crownfall');

test('camera anchors the same map point under the cursor and bounds saved values',()=>{
  const a={x:.5,y:.5,zoom:1.5}, anchor={x:250,y:180};
  const b=anchoredZoom(a,3,anchor,400,400,policy);
  assert.ok(Math.abs(a.x+(anchor.x-200)/600-b.x-(anchor.x-200)/1200)<1e-12);
  assert.ok(Math.abs(a.y+(anchor.y-200)/600-b.y-(anchor.y-200)/1200)<1e-12);
  assert.deepEqual(localCamera({x:Infinity,y:-1,zoom:100},policy),{x:.5,y:0,zoom:5});
  assert.equal(panCamera(a,60,0,400,400,policy).x,.4);
});
test('inspection adds 30 percent once, centers edge sites and retains closer manual zoom',()=>{
  const a=localCamera(null,policy), p={x:1,y:.1};
  const first=inspectionCamera(a,p,null,policy);
  assert.ok(Math.abs(first.zoom-1.95)<1e-12); assert.equal(first.x,1);
  assert.deepEqual(inspectionCamera(first,p,first.zoom,policy),first);
  assert.equal(inspectionCamera({...a,zoom:4},p,first.zoom,policy).zoom,4);
});
test('service inspection derives real plans without changing inventory or rolling stock',()=>{
  const registries=createRegistries(contentBundle),run=createRunState({seed:123,classId:'reaver',registries});
  run.hp-=15;
  const before=JSON.stringify(run), state={};
  // The preview reads the place's own rules (plan phase 7): an inn point
  // resolves to the town's full rest, the classic Shrine to its partial one.
  const expect=(id,opts)=>previewRest(createLocationVisit({run:structuredClone(run),registries,rng:null},id,opts)).heal;
  const rest=localServiceModel({handlerId:'rest',registries,run,state,nodeId:'crownfall/inn',serviceTypeId:'inn'});
  assert.ok(rest.benefit.includes(`recover ${expect('inn')} HP`));
  assert.equal(expect('inn'),15);
  const reduced=localServiceModel({handlerId:'rest',registries,run,state,nodeId:'crownfall/chapel',serviceTypeId:'chapel',healMult:.5});
  assert.ok(reduced.benefit.includes(`recover ${expect('chapel',{healMult:.5})} HP`));
  assert.ok(expect('chapel',{healMult:.5})<expect('chapel'));
  // Handed the run's live streams, the preview reads their position and
  // advances nothing (the rest itself will roll where the preview rolled).
  const live=createRng(123,{misc:7});
  const before7=JSON.stringify(live.getCounters());
  const withRng=localServiceModel({handlerId:'rest',registries,run,state,nodeId:'crownfall/inn',serviceTypeId:'inn',rng:live});
  assert.ok(withRng.benefit.includes(`recover ${expect('inn')} HP`));
  assert.equal(JSON.stringify(live.getCounters()),before7);
  // The preview arrives before it rests, as entry does: with a rule that
  // rolls on arrival and one that rolls on rest, the preview and the real
  // visit agree from every starting position of the stream.
  const rollingRules=contentBundle.propertyRules.map((r)=>{
    if(r.tag!=='restFlasks'&&r.tag!=='restHpFull')return r;
    const row=structuredClone(r); row.triggers[0].if={p:'random',pct:50}; return row;
  });
  const rollingReg=createRegistries({...contentBundle,propertyRules:rollingRules});
  for(let k=0;k<12;k+=1){
    const real=structuredClone(run);
    const visit=createLocationVisit({run:real,registries:rollingReg,rng:createRng(1,{misc:k})},'inn');
    arriveAt(visit); const rested=restAt(visit); leaveLocation(visit);
    const preview=localServiceModel({handlerId:'rest',registries:rollingReg,run,state,nodeId:'crownfall/inn',serviceTypeId:'inn',rng:createRng(1,{misc:k})});
    assert.ok(rested.heal>0?preview.benefit.includes(`recover ${rested.heal} HP`):preview.benefit.includes('allow no healing'),`stream position ${k}: preview '${preview.benefit}' vs rest ${rested.heal}`);
  }
  const smith=localServiceModel({handlerId:'smith',registries,run,state});
  const plan=smithingPlan(registries,run);
  assert.ok(smith.facts[0].includes(`${plan.stones} Smithing Stones`));
  for(const c of plan.candidates) assert.ok(smith.facts.some(f=>f.includes(`${c.cost} stones`)));
  const shop=localServiceModel({handlerId:'shop',registries,run,state});
  assert.ok(shop.facts.some(f=>f.includes('exact prices')));
  const stocked = localServiceModel({handlerId:'shop',registries,run,state:{stock:{cards:[{cost:30},{cost:15}],removeCost:50}}});
  assert.ok(stocked.facts.some(f=>f.includes('prices 15, 30 cinders')));
  assert.deepEqual(state,{});assert.equal(JSON.stringify(run),before);
  run.flaskCharges.hpCurrent=0;
  const depleted=JSON.stringify(run);
  const charges=localServiceModel({handlerId:'rest',registries,run,state});
  assert.ok(charges.facts.some(f=>f.includes('Entering refills your assigned flask charges')));
  assert.equal(JSON.stringify(run),depleted);
});
test('used services, full health and archive benefits do not promise unavailable rewards',()=>{
  const registries=createRegistries(contentBundle),run=createRunState({seed:123,classId:'reaver',registries});
  assert.equal(localServiceModel({handlerId:'rest',registries,run}).benefit,'Your health is already full.');
  const archive=localServiceModel({handlerId:'lore',registries,run,state:{used:true}});
  assert.equal(archive.used,true); assert.ok(archive.facts.some(f=>f.includes('no items')));
});
test('per-map camera and selection round-trip in the existing journey save',()=>{
  const registries=createRegistries(contentBundle),run=createRunState({seed:123,classId:'reaver',registries});
  run.journey=generateJourney('LOCAL-CAMERA');run.mapGraph=journeyGraph(run.journey);
  run.journey.view.localMaps={crownfall:{x:.3,y:.6,zoom:2,selectedId:'crownfall/chapel',inspectionZoom:2}};
  assert.deepEqual(deserializeRun(serializeRun(run)).journey.view,run.journey.view);
});
