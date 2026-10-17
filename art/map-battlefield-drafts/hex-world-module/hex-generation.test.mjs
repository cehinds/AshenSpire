import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {directions,neighbor,worldEdge} from './hex-geometry.mjs';
import {validateEdge,compareEdges,rotationCandidates} from './hex-adjacency.mjs';
import {loadGeneration,expandTemplate,generateLayout,validateGeneratedLayout,validateGenerationDefinitions} from './hex-generation.mjs';
import {validate} from './validate.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),data=loadGeneration();
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const edge=(id,flow=null)=>{const p=data.profiles.find(p=>p.id===id);return {edgeProfileId:id,tags:[...p.tags],connector:p.connectorKind?{kind:p.connectorKind,flow}:null,missingNeighbor:'boundary'};};
function mutate(file,change,pattern){const temp=fs.mkdtempSync(path.join(path.dirname(root),'.hex-generation-test-'));try{fs.cpSync(root,temp,{recursive:true});const p=path.join(temp,file),d=JSON.parse(fs.readFileSync(p));change(d);fs.writeFileSync(p,JSON.stringify(d));assert.match(validate(temp).errors.join('\n'),pattern);}finally{fs.rmSync(temp,{recursive:true,force:true});}}

test('dirt roads match both dirt and road properties, independent of tag ordering',()=>{
 const a=edge('dirt-road'),b=edge('dirt-road');b.tags.reverse();assert.equal(compareEdges(a,b,data.profiles).compatible,true);
 assert.equal(compareEdges(a,edge('dirt'),data.profiles).compatible,false);
 assert.equal(compareEdges(a,edge('stone-road'),data.profiles).compatible,false);
});
test('every declared edge tag belongs to its exact profile',()=>{
 const a=edge('dirt-road');a.tags.push('grass');assert.match(validateEdge(a,data.profiles).join(' '),/exactly match profile/);
 a.tags=['road'];assert.ok(validateEdge(a,data.profiles).length);
});
test('nonroute surfaces also match strictly; transitions carry different profiles on different sides',()=>{
 assert.equal(compareEdges(edge('grass'),edge('forest'),data.profiles).compatible,false);
 const transition=data.templates.find(t=>t.id==='grass-forest-transition');
 const tile=expandTemplate(transition,{column:1,row:1},0,data.profiles);
 assert.equal(compareEdges(worldEdge(tile,0),edge('forest'),data.profiles).compatible,true);
 assert.equal(compareEdges(worldEdge(tile,3),edge('grass'),data.profiles).compatible,true);
});
test('matching river water still requires opposite flow',()=>{
 assert.equal(compareEdges(edge('river-water','in'),edge('river-water','out'),data.profiles).compatible,true);
 assert.equal(compareEdges(edge('river-water','in'),edge('river-water','in'),data.profiles).compatible,false);
 assert.ok(validateEdge(edge('river-water'),data.profiles).length);
});
test('rotation filtering respects road material and river direction together',()=>{
 const bridge=data.templates.find(t=>t.id==='bridge'),position={column:1,row:1};
 assert.deepEqual(rotationCandidates(bridge,position,[{worldIndex:3,edge:edge('dirt-road')}],data.profiles),[1,4]);
 assert.deepEqual(rotationCandidates(bridge,position,[{worldIndex:3,edge:edge('dirt-road')},{worldIndex:5,edge:edge('river-water','out')}],data.profiles),[1]);
 assert.deepEqual(rotationCandidates(bridge,position,[{worldIndex:3,edge:edge('stone-road')}],data.profiles),[]);
});
test('invalid unconstrained template edges cannot become rotation candidates',()=>{
 const source=structuredClone(data.templates.find(t=>t.id==='river-source'));
 Object.values(source.sides).find(s=>s.edgeProfileId==='river-water').flow=null;
 assert.deepEqual(rotationCandidates(source,{column:0,row:0},[],data.profiles),[]);
});
test('same seed, inputs and anchors reproduce the committed layout',()=>{
 const a=generateLayout(data),b=generateLayout(data);assert.equal(a.ok,true);assert.deepEqual(a,b);
 assert.deepEqual(a.layout,read('generation/layout.example.json'));assert.deepEqual(validateGeneratedLayout(a.layout,data),[]);
 const bridge=a.layout.cells.find(t=>t.position.column===1&&t.position.row===1);assert.equal(bridge.templateId,'bridge');assert.equal(bridge.orientationSteps,1);
});
test('multiple seeded layouts have matching edges and no boundary route leaks',()=>{
 for(const seed of ['edge-test-a','edge-test-b','edge-test-c']){
  const result=generateLayout(data,{...data.rules.example,seed});assert.equal(result.ok,true);assert.deepEqual(validateGeneratedLayout(result.layout,data),[]);
  const byPos=new Map(result.layout.cells.map(t=>[[t.position.column,t.position.row].join(','),t]));
  for(const cell of result.layout.cells)for(let w=0;w<6;w++){
   const other=byPos.get(neighbor(cell.position.column,cell.position.row,w).join(','));
   if(other)assert.equal(compareEdges(worldEdge(cell,w),worldEdge(other,(w+3)%6),data.profiles).compatible,true);
   else assert.equal(worldEdge(cell,w).connector,null);
  }
 }
});
test('unsatisfiable constraints and exhausted budgets emit no partial layout',()=>{
 const impossible=generateLayout(data,{width:1,height:1,seed:'impossible',fixed:[{column:0,row:0,templateId:'bridge',orientationSteps:1}]});
 assert.equal(impossible.ok,false);assert.equal(impossible.reason,'constraints-unsatisfiable');assert.equal(impossible.layout,undefined);
 const limited=structuredClone(data);limited.rules.solver.maxAssignments=1;const exhausted=generateLayout(limited);
 assert.equal(exhausted.ok,false);assert.equal(exhausted.reason,'search-budget-exhausted');assert.equal(exhausted.layout,undefined);
});
test('invalid size and fixed-tile orientations are rejected',()=>{
 assert.throws(()=>generateLayout(data,{width:0,height:1,seed:'bad',fixed:[]}),/dimensions/);
 assert.throws(()=>generateLayout(data,{width:99,height:99,seed:'bad',fixed:[]}),/dimensions/);
 assert.throws(()=>generateLayout(data,{...data.rules.example,fixed:[{column:1,row:1,templateId:'bridge',orientationSteps:6}]}),/fixed tile/);
});
test('connector tags cannot hide a road or invent an unconnected river',()=>{
 const copy=structuredClone(data);copy.profiles.find(p=>p.id==='dirt-road').tags=['dirt'];assert.match(validateGenerationDefinitions(copy).join(' '),/connector tags/);
});
test('authored maps reject known but mismatching dirt/stone road profiles',()=>{
 mutate('tiles/westwatch.json',d=>{d.sides.E.edgeProfileId='stone-road';d.sides.E.tags=['stone','road'];},/incompatible touching edge/);
 mutate('tiles/westwatch.json',d=>d.sides.E.tags=['road'],/exactly match profile/);
});
test('generated layout edits and changed source catalogs are detected',()=>{
 mutate('generation/layout.example.json',d=>d.cells[0].orientationSteps=6,/schema/);
 mutate('generation/tile-templates.json',d=>d.items[0].weight=99,/fingerprint is stale/);
});
