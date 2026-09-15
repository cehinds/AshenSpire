// Structural/reference execution checks only. This does not verify browser layout.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(root,'../..');
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('wireframe-gallery.html');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
for(const [index,code] of scripts.entries()){try{new vm.Script(code,{filename:`gallery-inline-${index}.js`});}catch(error){failures.push(`Inline JavaScript syntax: ${error.message}`);}}
// Extract only the serialized DATA initializer; never execute gallery side effects.
function serializedInitializer(name){const start=html.indexOf(`const ${name}=`);if(start<0)throw Error(`Missing ${name}`);let index=start+`const ${name}=`.length,begin=index,depth=0,quote=null,escape=false;for(;index<html.length;index++){const ch=html[index];if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote=null;continue;}if(ch==='"'||ch==="'"){quote=ch;continue;}if(ch==='['||ch==='{')depth++;if(ch===']'||ch==='}')depth--;if(ch===';'&&depth===0)return html.slice(begin,index);}throw Error(`Unterminated ${name}`);}
let data=[];
try{data=JSON.parse(serializedInitializer('DATA'));}catch(error){failures.push(`DATA extraction: ${error.message}`);}
const ids=new Set(data.map(d=>d.id));check(ids.size===data.length,'Duplicate wireframe IDs');
// The code viewer must show the exact source that produced this artifact.
const embeddedSources=JSON.parse(serializedInitializer('REFERENCE_SOURCE_TEXT'));
for(const [file,contents] of Object.entries(embeddedSources))check(contents===read(file),`Stale actual-code snapshot: ${file}`);
const expectedModes=['wide','compact','iphoneSE','galaxyS24'];
const placeholder=/^\s*(?:\{Shared family components\}|\{Active body model\})\s*$/;
function existsReference(file){const clean=file.split('#')[0].replace(/:\d+$/,'');return fs.existsSync(path.resolve(repo,clean))||fs.existsSync(path.resolve(root,clean));}
function validateReference(ref,id){if(typeof ref==='string'){if(/^PROPOSED/i.test(ref))return;check(existsReference(ref),`${id}: reference missing ${ref}`);return;}check(ref&&typeof ref==='object',`${id}: invalid reference`);if(!ref)return;if(ref.file)check(existsReference(ref.file),`${id}: source missing ${ref.file}`);else check(/propos/i.test(ref.status||''),`${id}: reference has no file or proposed status`);}
for(const d of data){
 check(typeof d.name==='string'&&d.name.length>0,`${d.id}: missing name`);
 check(!d.parent||ids.has(d.parent),`${d.id}: missing parent ${d.parent}`);
 check(Array.isArray(d.views)&&d.views.length===expectedModes.length,`${d.id}: expected four views`);
 for(const mode of expectedModes){const v=d.views?.find(v=>v.mode===mode);check(!!v,`${d.id}: missing ${mode}`);if(!v)continue;check(typeof v.ascii==='string'&&v.ascii.trim().length>0&&!placeholder.test(v.ascii)&&v.ascii.trim()!=='['+d.name+']',`${d.id}/${mode}: empty or label-only diagram`);check(Array.isArray(v.rows)&&v.rows.length>1,`${d.id}/${mode}: missing placement table`);}
 check(typeof d.pseudo==='string'&&d.pseudo.trim().length>30,`${d.id}: missing meaningful pseudocode`);
 check(d.defaults&&typeof d.defaults==='object'&&Object.keys(d.defaults).length>0,`${d.id}: missing configuration defaults`);
 check(d.model&&typeof d.model==='object'&&Object.keys(d.model).length>0,`${d.id}: missing model`);
 check(Array.isArray(d.references)&&d.references.length>0,`${d.id}: missing sources`);for(const ref of d.references||[])validateReference(ref,d.id);
 check(Array.isArray(d.children),`${d.id}: missing explicit children`);for(const child of d.children||[])check(ids.has(typeof child==='string'?child:child.id),`${d.id}: unresolved child ${JSON.stringify(child)}`);
 const implementation=d.implementation;
 check(typeof implementation?.renderer==='string'&&implementation.renderer.length>0,`${d.id}: missing renderer binding`);
 check(Array.isArray(implementation?.styles)&&implementation.styles.length>0,`${d.id}: missing styles binding`);
 check(Array.isArray(implementation?.source)&&implementation.source.length>0,`${d.id}: missing implementation source`);
 for(const file of [...(implementation?.styles||[]),...(implementation?.source||[])])check(existsReference(file),`${d.id}: implementation file missing ${file}`);
 if(implementation?.renderer&&implementation?.source?.length){
  const sourceText=implementation.source.filter(existsReference).map(file=>{const clean=file.split('#')[0];const full=fs.existsSync(path.resolve(repo,clean))?path.resolve(repo,clean):path.resolve(root,clean);return fs.readFileSync(full,'utf8');}).join('\n');
  const symbol=implementation.renderer.split('.').pop();
  check(sourceText.includes(symbol),d.id+': renderer symbol absent from bound sources '+implementation.renderer);
 }

}
for(const d of data){const visited=new Set();let node=d;while(node){if(visited.has(node.id)){failures.push(`${d.id}: inheritance cycle`);break;}visited.add(node.id);node=data.find(x=>x.id===node.parent);}}
// Execute standalone HUD renderer and configuration guards without DOM stubs.
let hudCount=0;
try{
 const {hudConfig,hudDefinitions}=await import('./hud-reference.mjs');
 const sandbox={HUD_REFERENCE_CONFIG:hudConfig,structuredClone};vm.createContext(sandbox);vm.runInContext(read('hud-reference-client.js'),sandbox);
 for(const def of hudDefinitions){const rendered=sandbox.renderHUDComponent(def[0]);check(rendered.includes('hud-reference')&&rendered.length>100,`${def[0]}: empty HUD markup`);hudCount++;}
 const map=structuredClone(hudConfig);map.context='map';check(!sandbox.renderConfiguredHUD(map).includes('data-component="WGH5"'),'XP rendered in default map context');check(!sandbox.hudXpPreviewEnabled(map),'XP award enabled on map');
 const disabled=structuredClone(hudConfig);disabled.layers.mana=false;check(!sandbox.renderConfiguredHUD(disabled).includes('aria-label="MP"'),'Hidden mana still rendered');
 for(const preset of ['current','proposed']){const c=structuredClone(hudConfig);c.layoutPreset=preset;check(!sandbox.renderConfiguredHUD(c).includes('data-component="WGH8"'),`${preset}: Potions leaked into top HUD`);}
 for(const [key,reference] of Object.entries(hudConfig.vitality.referenceMaximum)){
  const c=structuredClone(hudConfig);c.sample[key]={value:reference/4,maximum:reference/2};
  const markup=sandbox.hudVitalityMeter(key,c);
  check(markup.includes('hud-vitality-track" style="width:50%"')&&markup.includes('--fill:50%'),`${key}: capacity/fill are not independent`);
 }
 check(JSON.stringify(JSON.parse(read('hud-config.json')))===JSON.stringify(hudConfig),'HUD JSON differs from source defaults');
 check(sandbox.renderHUDComponent('WGH1').includes('#WCM1'),'HUD health does not link to shared meter');
 for(const bad of [-1,NaN,Infinity]){const config=structuredClone(hudConfig);config.sample.experience.value=bad;let rejected=false;try{sandbox.validateHudConfig(config);}catch{rejected=true;}check(rejected,`HUD accepted invalid XP ${bad}`);}
}catch(error){failures.push(`HUD reference execution: ${error.stack}`);}

// Cross-artifact checks: every JSON document parses and published IDs agree.
let jsonCount=0;
for(const file of fs.readdirSync(root).filter(file=>file.endsWith('.json'))){try{JSON.parse(read(file));jsonCount++;}catch(error){failures.push(file+': invalid JSON '+error.message);}}
const catalogFiles=['component-wireframe-catalog.json','tooltip-wireframe-catalog.json','wireframe-catalog.json','card-wireframe-catalog.json'];
const catalogIds=catalogFiles.flatMap(file=>JSON.parse(read(file)).map(entry=>entry.id));
check(new Set(catalogIds).size===catalogIds.length,'Duplicate IDs across source catalogs');
check(catalogIds.length===ids.size&&catalogIds.every(id=>ids.has(id)),'Published gallery differs from source catalog IDs');
const {componentCompletionDefaults}=await import('./component-completion.mjs');
check(JSON.stringify(JSON.parse(read('reference-defaults.json')).components)===JSON.stringify(componentCompletionDefaults),'Component JSON differs from source defaults');
const grid=componentCompletionDefaults.groundGrid,anchors=grid.depthLoweringFractions.map((offset,row)=>row+offset);
check(Math.abs((anchors[1]-anchors[0])-(anchors[2]-anchors[1]))<1e-9,'Formation depth gaps differ');
check(grid.slotsPerSide===grid.rows*grid.columns,'Formation capacity differs from grid dimensions');
check(componentCompletionDefaults.overlay.defenseAnchorByRole.player<.5&&componentCompletionDefaults.overlay.defenseAnchorByRole.enemy>.5,'Guard anchors are on wrong vertical sides');
const focusContext={};vm.createContext(focusContext);vm.runInContext(read('combatant-focus.js'),focusContext);
const focus=componentCompletionDefaults.combatantFocus;
for(let row=0;row<3;row++){const normal=focusContext.rowPresentationScale(row,false,focus),selected=focusContext.rowPresentationScale(row,true,focus);check(selected.factor>normal.factor,'Selection shrinks row '+row);check(selected.zPriority>normal.zPriority,'Selection fails to focus row '+row);}
const groups=[{availableWidth:300,availableHeight:250,actors:[{row:0,baseWidth:100,baseHeight:200}]},{availableWidth:240,availableHeight:250,actors:[{row:2,baseWidth:100,baseHeight:200}]}];
check(focusContext.sharedCombatantBaseScale(groups,focus)===focusContext.sharedCombatantBaseScale([...groups].reverse(),focus),'Shared fit depends on faction ordering');

const report={jsonFiles:jsonCount,entries:data.length,views:data.reduce((sum,d)=>sum+(d.views?.length||0),0),inlineScripts:scripts.length,hudRenderers: hudCount,failures,scope:'Static completeness, file references, JavaScript syntax and isolated HUD execution. Browser layout and interaction not verified.'};
console.log(JSON.stringify(report,null,2));
process.exitCode=failures.length?1:0;
