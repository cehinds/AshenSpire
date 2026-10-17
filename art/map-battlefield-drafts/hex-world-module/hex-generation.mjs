import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {directions,neighbor,address,worldEdge} from './hex-geometry.mjs';
import {validateEdge,compareEdges,rotationCandidates} from './hex-adjacency.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=(base,file)=>JSON.parse(fs.readFileSync(path.resolve(base,file),'utf8'));
const key=(c,r)=>`${c},${r}`;
export function loadGeneration(base=root){
 const index=read(base,'index.json');
 return {profiles:read(base,index.generation.profiles).items,templates:read(base,index.generation.templates).items,rules:read(base,index.generation.rules)};
}
export function expandTemplate(template,position,orientationSteps,profiles){
 const sides={};
 for(const direction of directions){
  const compact=template.sides[direction],profile=profiles.find(p=>p.id===compact.edgeProfileId);
  if(!profile)throw new Error(`Unknown edge profile ${compact.edgeProfileId}`);
  sides[direction]={edgeProfileId:profile.id,tags:[...profile.tags],connector:profile.connectorKind===null?null:{kind:profile.connectorKind,flow:compact.flow},missingNeighbor:'boundary'};
 }
 return {id:address(position.column,position.row),position:{...position,label:address(position.column,position.row)},templateId:template.id,orientationSteps,biomeId:template.biomeId,tags:[...template.tags],sides};
}
export function validateGenerationDefinitions(data){
 const errors=[],{profiles,templates,rules}=data;
 if(new Set(profiles.map(p=>p.id)).size!==profiles.length)errors.push('Duplicate edge profile ID');
 if(new Set(templates.map(t=>t.id)).size!==templates.length)errors.push('Duplicate generation template ID');
 if(rules.matching.mode!=='exact-profile'||rules.matching.tagPolicy!=='exact-set'||rules.matching.riverFlow!=='opposite')errors.push('Unsupported edge matching policy');
 if(!Number.isSafeInteger(rules.solver.maxCells)||rules.solver.maxCells<1||!Number.isSafeInteger(rules.solver.maxAssignments)||rules.solver.maxAssignments<1)errors.push('Invalid generation solver budget');
 if(rules.boundaries.connectorPolicy!=='closed')errors.push('Unsupported generation boundary policy');
 for(const profile of profiles){
  if(!Array.isArray(profile.tags)||!profile.tags.length||new Set(profile.tags).size!==profile.tags.length)errors.push(`${profile.id}: invalid profile tags`);
  for(const routeTag of ['road','river'])if(profile.tags.includes(routeTag)!==(profile.connectorKind===routeTag))errors.push(`${profile.id}: connector tags must agree with connector kind`);
  if(![null,'road','river'].includes(profile.connectorKind))errors.push(`${profile.id}: unsupported connector kind`);
 }
 for(const template of templates){
  if(!Number.isFinite(template.weight)||template.weight<=0)errors.push(`${template.id}: invalid generation weight`);
  if(!template.allowedRotations.length||new Set(template.allowedRotations).size!==template.allowedRotations.length||template.allowedRotations.some(n=>!Number.isInteger(n)||n<0||n>5))errors.push(`${template.id}: invalid allowed rotations`);
  if(Object.keys(template.sides).length!==6||directions.some(d=>!template.sides[d])){errors.push(`${template.id}: all six template sides required`);continue;}
  try{const expanded=expandTemplate(template,{column:0,row:0},0,profiles);for(const [direction,edge]of Object.entries(expanded.sides))for(const error of validateEdge(edge,profiles))errors.push(`${template.id}/${direction}: ${error}`);}catch(error){errors.push(`${template.id}: ${error.message}`);}
 }
 return errors;
}
function randomFromSeed(seed){
 let state=2166136261;for(const character of seed){state^=character.codePointAt(0);state=Math.imul(state,16777619);}
 return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
const fingerprint=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');

/** Bounded, deterministic offline prototype; no game state or art is modified. */
export function generateLayout(data,request=data.rules.example){
 const errors=validateGenerationDefinitions(data);if(errors.length)throw new Error(errors.join('\n'));
 const {width,height,seed,fixed=[]}=request,{rules,profiles,templates}=data;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>rules.solver.maxCells)throw new Error('Generation dimensions exceed the configured positive cell limit');
 if(typeof seed!=='string')throw new Error('Generation seed must be a string');
 if(!Number.isSafeInteger(rules.solver.maxAssignments)||rules.solver.maxAssignments<1)throw new Error('Invalid assignment budget');
 const pins=new Map();
 for(const pin of fixed){
  const template=templates.find(t=>t.id===pin.templateId),position=key(pin.column,pin.row);
  if(!Number.isInteger(pin.column)||!Number.isInteger(pin.row)||pin.column<0||pin.row<0||pin.column>=width||pin.row>=height||pins.has(position)||!template||!template.allowedRotations.includes(pin.orientationSteps))throw new Error('Invalid or duplicate fixed tile constraint');
  pins.set(position,pin);
 }
 const positions=Array.from({length:width*height},(_,i)=>({column:i%width,row:Math.floor(i/width)}));
 const cells=new Map(),random=randomFromSeed(seed);let assignments=0,backtracks=0,budgetExceeded=false;
 const inside=(c,r)=>c>=0&&r>=0&&c<width&&r<height;
 function candidates(position){
  const pin=pins.get(key(position.column,position.row)),neighbors=[];
  for(let w=0;w<6;w++){const [c,r]=neighbor(position.column,position.row,w),other=cells.get(key(c,r));if(other)neighbors.push({worldIndex:w,edge:worldEdge(other,(w+3)%6)});}
  const result=[];
  for(const template of templates){
   if(pin&&template.id!==pin.templateId)continue;
   const rotations=rotationCandidates(template,position,neighbors,profiles,pin?[pin.orientationSteps]:template.allowedRotations);
   for(const rotation of rotations){
    const tile=expandTemplate(template,position,rotation,profiles);
    if(directions.some((_,w)=>{const [c,r]=neighbor(position.column,position.row,w);return !inside(c,r)&&worldEdge(tile,w).connector!==null;}))continue;
    result.push({tile,weight:template.weight/template.allowedRotations.length});
   }
  }
  return result;
 }
 function solve(){
  if(cells.size===positions.length)return true;
  let chosen=null,options=null;
  for(const position of positions){
   if(cells.has(key(position.column,position.row)))continue;
   const possible=candidates(position);if(!possible.length)return false;
   if(options===null||possible.length<options.length){chosen=position;options=possible;}
  }
  const ordered=options.map(option=>({...option,rank:-Math.log(Math.max(random(),Number.MIN_VALUE))/option.weight})).sort((a,b)=>a.rank-b.rank);
  for(const {tile}of ordered){
   if(assignments>=rules.solver.maxAssignments){budgetExceeded=true;return false;}
   assignments++;cells.set(key(chosen.column,chosen.row),tile);
   if(solve())return true;
   cells.delete(key(chosen.column,chosen.row));backtracks++;if(budgetExceeded)return false;
  }
  return false;
 }
 if(!solve())return {ok:false,reason:budgetExceeded?'search-budget-exhausted':'constraints-unsatisfiable',assignments,backtracks};
 const layout={$schema:'../schemas/module.schema.json',kind:'procedural-layout',formatVersion:1,status:'proposal-only',generatorVersion:1,sourceFingerprint:fingerprint(data),request:{width,height,seed,fixed},cells:positions.map(p=>cells.get(key(p.column,p.row))),diagnostics:{assignments,backtracks}};
 return {ok:true,layout};
}

export function validateGeneratedLayout(layout,data){
 const errors=[],{width,height,fixed=[]}=layout.request,byPos=new Map(),ids=new Set();
 if(layout.sourceFingerprint!==fingerprint(data))errors.push('Generated layout source fingerprint is stale; regenerate the example');
 for(const cell of layout.cells){
  const {column:c,row:r}=cell.position;
  if(!Number.isInteger(c)||!Number.isInteger(r)||c<0||r<0||c>=width||r>=height)errors.push(`${cell.id}: generated coordinate out of bounds`);
  if(byPos.has(key(c,r))||ids.has(cell.id))errors.push('Duplicate generated position or ID');
  byPos.set(key(c,r),cell);ids.add(cell.id);
  if(cell.id!==address(c,r)||cell.position.label!==address(c,r))errors.push(`${cell.id}: incorrect generated address`);
  const template=data.templates.find(t=>t.id===cell.templateId);
  if(!template||!template.allowedRotations.includes(cell.orientationSteps)){errors.push(`${cell.id}: invalid generated template or rotation`);continue;}
  const expected=expandTemplate(template,{column:c,row:r},cell.orientationSteps,data.profiles);
  if(cell.biomeId!==expected.biomeId||JSON.stringify(cell.tags)!==JSON.stringify(expected.tags))errors.push(`${cell.id}: template metadata mismatch`);
  for(const direction of directions){
   const edge=cell.sides[direction],want=expected.sides[direction];
   for(const error of validateEdge(edge,data.profiles))errors.push(`${cell.id}/${direction}: ${error}`);
   if(edge?.edgeProfileId!==want.edgeProfileId||edge?.connector?.flow!==want.connector?.flow)errors.push(`${cell.id}/${direction}: generated edge differs from template`);
  }
 }
 if(byPos.size!==width*height||layout.cells.length!==width*height)errors.push('Generated layout has missing or extra cells');
 for(const cell of layout.cells)for(let w=0;w<6;w++){
  const [c,r]=neighbor(cell.position.column,cell.position.row,w),other=byPos.get(key(c,r)),edge=worldEdge(cell,w);
  if(other){const comparison=compareEdges(edge,worldEdge(other,(w+3)%6),data.profiles);if(!comparison.compatible)errors.push(`${cell.id}/${directions[w]}: ${comparison.reasons.join(' ')}`);}
  else if(edge?.connector)errors.push(`${cell.id}: generated connector leaves the closed map boundary`);
 }
 for(const pin of fixed){const cell=byPos.get(key(pin.column,pin.row));if(cell?.templateId!==pin.templateId||cell?.orientationSteps!==pin.orientationSteps)errors.push('Generated layout violates fixed tile constraint');}
 return errors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv.length!==3||process.argv[2]!=='--generate')throw new Error('Usage: node hex-generation.mjs --generate');
 const data=loadGeneration(),result=generateLayout(data);
 if(!result.ok)throw new Error(`No layout emitted: ${result.reason} after ${result.assignments} assignments`);
 const errors=validateGeneratedLayout(result.layout,data);if(errors.length)throw new Error(errors.join('\n'));
 const index=read(root,'index.json');fs.writeFileSync(path.resolve(root,index.generation.example),JSON.stringify(result.layout,null,2)+'\n');
 console.log(`Generated ${result.layout.cells.length} compatible hexes with seed ${result.layout.request.seed}.`);
}
