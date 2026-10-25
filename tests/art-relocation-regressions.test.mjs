import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {authoringPath,compositeSourcePath,isAuthoringFile} from '../tools/art-authoring.mjs';
import {serve} from '../tools/serve.mjs';
import {webpDimensions} from '../tools/mobileart-policy.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'art-relocation-regression-')),root=join(dir,'game'),assetRoot=join(dir,'AI-Art');
 mkdirSync(root);mkdirSync(assetRoot);
 const put=(base,path,bytes)=>{const file=join(base,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,bytes);};
 return {root,assetRoot,put,close:()=>rmSync(dir,{recursive:true,force:true})};
}

test('the actual selected-frame publication block writes both external exports and the game catalog on its first frame',()=>{
 const f=fixture();try{
  const source=readFileSync(new URL('../tools/selected-weapon-profile-export.mjs',import.meta.url),'utf8');
  const start='\n  const catalogPath = file(',end='\n} finally {';
  assert.equal(source.split(start).length,2,'one actual publication block');
  assert.equal(source.split(end).length,2,'one browser cleanup boundary');
  const block=source.slice(source.indexOf(start),source.indexOf(end));
  const old={hashes:{'old.webp':'old'},filePaths:{'old.webp':'assets-display/alternative/old.webp'},weaponProfiles:{pilot:{frames:{old:{path:'assets-display/alternative/old.webp'}}}}};
  f.put(f.root,'src/content/alternativeSelectedStances.js',`export const alternativeSelectedStances = ${JSON.stringify(old)};\n`);
  // Synthetic encoded output stands in for the earlier browser rasterization;
  // this regression executes the real complete file/catalog/rig writer, not a copy.
  const full=Buffer.from('UklGRi4AAABXRUJQVlA4TCIAAAAv/8F/AAdQj8KXov8BgUCyv/cMRfQ/4z//+c9//vOf//wf','base64'),mobile=Buffer.from('UklGRiQAAABXRUJQVlA4TBgAAAAv/8A/AAdQj1IUvv8BAEX6/58i+p/6338=','base64');
  assert.deepEqual([webpDimensions(full).width,webpDimensions(full).height],[512,512]);
  assert.deepEqual([webpDimensions(mobile).width,webpDimensions(mobile).height],[256,256]);
  const choice={id:'counter',role:'counter',label:'Counter',sourceOption:'C1',sourcePath:'art/sheet.png',cropBounds:[0,0,3,3]};
  const manifest={id:'pilot',classId:'reaver',weaponFamily:'greatsword',sourceSheets:[{path:choice.sourcePath,sha256:'1'.repeat(64)}]};
  const exported=[{choice,full:full.toString('base64'),mobile:mobile.toString('base64'),bounds:[1,1,2,464],sourceBounds:[0,0,3,3],scale:1,supportAnchor:[256,464],excludedStrong:0}];
  const file=rel=>rel.startsWith('src/')?join(f.root,rel):authoringPath(rel,{root:f.root,assetRoot:f.assetRoot});
  vm.runInNewContext(block,{file,manifest,exported,manifestPath:'pose-studio/stances/update-stances/selections.json',readFileSync,writeFileSync,mkdirSync,dirname,Buffer,sha,console:{log(){}}},{timeout:1000});
  for(const [name,bytes]of [['pilot-counter.webp',full],['pilot-counter-mobile.webp',mobile]]){
   assert.deepEqual(readFileSync(join(f.assetRoot,'common/assets-display/alternative',name)),bytes);
   assert.equal(existsSync(join(f.root,'assets-display/alternative',name)),false,'no loose game image output');
  }
  const text=readFileSync(join(f.root,'src/content/alternativeSelectedStances.js'),'utf8');
  const catalog=JSON.parse(text.match(/^export const alternativeSelectedStances = (.+);$/m)[1]);
  assert.equal(catalog.hashes['old.webp'],undefined);
  assert.equal(catalog.hashes['pilot-counter.webp'],sha(full));
  assert.equal(catalog.hashes['pilot-counter-mobile.webp'],sha(mobile));
  assert.equal(catalog.weaponProfiles.pilot.frames.counter.path,'assets-display/alternative/pilot-counter.webp');
  assert.equal(catalog.weaponProfiles.pilot.frames.counter.liteSha256,sha(mobile));
  const rig=JSON.parse(readFileSync(join(f.assetRoot,'pose-studio/stances/selected-projects/pilot.rig.json')));
  assert.equal(rig.assets.counter.src,`data:image/webp;base64,${full.toString('base64')}`);
  assert.equal(rig.queues.review.items[0].animationId,'counter');
 }finally{f.close();}
});

test('the explicit authoring server serves the migrated HUD reference and lets the actual asset loader finish',async()=>{
 const f=fixture(),reference='tools/hud-component-studio/reference.png';let app;
 try{
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');
  f.put(f.assetRoot,reference,bytes);
  f.put(f.root,reference,'different stale Game reference bytes');
  f.put(f.root,'tools/hud-component-studio/studio.js','game editor');
  f.put(f.assetRoot,'tools/hud-component-studio/studio.js','must not shadow game code');
  app=await serve({root:f.root,assetRoot:f.assetRoot,port:0,open:false,host:'127.0.0.1',quiet:true});
  const response=await fetch(app.url+reference);
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/^image\/png/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  assert.equal(isAuthoringFile(reference),true);
  assert.equal(isAuthoringFile('tools/hud-component-studio/unrelated.png'),false,'only the declared top-level reference is added');
  assert.equal(compositeSourcePath(reference,{root:f.root,assetRoot:f.assetRoot}),join(f.assetRoot,reference));
  assert.equal(compositeSourcePath(reference,{root:f.root,env:{}}),join(f.root,reference),'no implicit authoring root');
  assert.equal(await(await fetch(app.url+'tools/hud-component-studio/studio.js')).text(),'game editor');
  rmSync(join(f.root,reference)); // The migrated Game reference is absent in production.
  const studio=readFileSync(new URL('../tools/hud-component-studio/studio.js',import.meta.url),'utf8');
  const functions=studio.split('\n').filter(line=>line.startsWith('async function loadAssets(){'));
  assert.equal(functions.length,1,'one actual HUD asset loader');
  const loading={hidden:true,replaceChildren(){},querySelector(){return {textContent:''};}},failures=[];
  let canvasWaited=false;
  class HttpImage{
   set src(path){fetch(new URL(path,app.url+'tools/hud-component-studio/')).then(async res=>{if(!res.ok)throw Error('HTTP '+res.status);assert.deepEqual(Buffer.from(await res.arrayBuffer()),bytes);await this.onload();}).catch(()=>this.onerror());}
  }
  await vm.runInNewContext(`(${functions[0]})()`,{$:()=>loading,html:()=>({}),scene:{nodes:[{type:'group'},{type:'group'}]},generic:false,Image:HttpImage,notify:message=>failures.push(message),actions:()=>({}),action:()=>({}),waitCanvasImages:async()=>{canvasWaited=true;}},{timeout:1000});
  assert.deepEqual(failures,[]);
  assert.equal(canvasWaited,true);
  assert.equal(loading.hidden,true,'the actual loader leaves its loading state after the external reference loads');
 }finally{
  if(app){app.server.closeAllConnections();await new Promise(done=>app.server.close(done));}
  f.close();
 }
});
