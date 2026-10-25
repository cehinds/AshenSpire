import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {bundleProject} from '../../tools/hud-component-studio/bundle-project.mjs';
import {bundleLibrary} from '../../tools/hud-component-studio/bundle-library.mjs';
import '../../tools/hud-component-studio/qa/bundle.test.mjs';

const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../tools/hud-component-studio');
const raster=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');
const uri=bytes=>'data:image/png;base64,'+bytes.toString('base64');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const scene=title=>({version:1,title,canvas:{width:1,height:1},defaultState:'page',states:[{id:'page',name:'Page'}],assets:{button:{src:'assets/button.png'}},nodes:[{id:'button',type:'image',asset:'button'}],metadata:{references:{page:'exports/reference.png'}}});
const payload=(html,id)=>JSON.parse(html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)<\\/script>`))[1]);
async function fixture(t){
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'hud-portable-')));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const game=path.join(dir,'game'),art=path.join(dir,'AI-Art'),toolDir=path.join(game,'tools/hud-component-studio'),artTool=path.join(art,'tools/hud-component-studio');
 await fs.mkdir(toolDir,{recursive:true});await fs.mkdir(artTool,{recursive:true});
 const put=async(base,name,bytes)=>{const out=path.join(base,name);await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,bytes);};
 for(const name of ['bundle-project.mjs','bundle-library.mjs','project.js','library-model.js','studio.css','index.html','css-export.js','studio.js','library.css','library.html','library.js']){
  let bytes=await fs.readFile(path.join(source,name));
  if(name==='studio.js'||name==='library.js')bytes=Buffer.concat([Buffer.from('// GAME_TEMPLATE_SENTINEL\n'),bytes]);
  await put(toolDir,name,bytes);
  if(/\.(?:js|css|html)$/.test(name))await put(artTool,name,'ART_TEMPLATE_MUST_NOT_REPLACE_GAME');
 }
 await put(game,'tools/art-authoring.mjs',await fs.readFile(path.join(source,'../art-authoring.mjs')));
 const project='projects/demo/scene.json',manifest='projects/demo/library.json';
 await put(toolDir,project,JSON.stringify(scene('retained Game scene')));await put(artTool,project,JSON.stringify(scene('external edited scene')));
 await put(artTool,'projects/demo/assets/button.png',raster);
 for(const name of ['preview','wireframe','viewport'])await put(artTool,`projects/demo/exports/${name}.png`,raster);
 const library={version:1,title:'external library',scenes:[{id:'scene',src:'scene.json',preview:'exports/preview.png',wireframe:'exports/wireframe.png',viewport:'exports/viewport.png'}],pages:[],components:[]};
 await put(toolDir,manifest,JSON.stringify({...library,title:'retained Game library'}));await put(artTool,manifest,JSON.stringify(library));
 return {dir,game,art,toolDir,artTool,put,project,manifest,env:{ASHEN_ART_CHECKOUT:art}};
}

test('HUD project export reads external scene and exact image bytes but keeps Game templates',async t=>{
 const f=await fixture(t),out=path.join(f.dir,'project.html'),input=path.join(f.toolDir,f.project),external=path.join(f.artTool,f.project);
 const before=await fs.readFile(external);
 await bundleProject({scenePath:input,outPath:out,toolDir:f.toolDir,env:f.env});
 const html=await fs.readFile(out,'utf8'),data=payload(html,'studio-project-data');
 assert.equal(data.scene.title,'external edited scene');assert.equal(data.scene.assets.button.src,uri(raster));
 assert.equal(sha(Buffer.from(data.scene.assets.button.src.split(',')[1],'base64')),sha(raster));assert.equal(data.scene.metadata.references,undefined);
 assert.match(html,/GAME_TEMPLATE_SENTINEL/);assert.doesNotMatch(html,/ART_TEMPLATE_MUST_NOT_REPLACE_GAME/);
 assert.deepEqual(await fs.readFile(external),before);assert.equal(JSON.parse(await fs.readFile(input)).title,'retained Game scene');
 await f.put(f.toolDir,'projects/demo/assets/button.png',Buffer.concat([raster,Buffer.from('stale Game image')]));
 await bundleProject({scenePath:input,outPath:out,toolDir:f.toolDir,env:f.env});
 assert.equal(payload(await fs.readFile(out,'utf8'),'studio-project-data').scene.assets.button.src,uri(raster));
});

test('HUD library export embeds project assets plus exports previews from the external project root',async t=>{
 const f=await fixture(t),out=path.join(f.dir,'library.html');
 await bundleLibrary({manifestPath:path.join(f.toolDir,f.manifest),outPath:out,toolDir:f.toolDir,env:f.env});
 const html=await fs.readFile(out,'utf8'),data=payload(html,'library-data');assert.equal(data.manifest.title,'external library');
 assert.equal(data.scenes['scene.json'].title,'external edited scene');
 for(const image of ['exports/preview.png','exports/wireframe.png','exports/viewport.png'])assert.equal(data.assets[data.images[image]],uri(raster));
 assert.equal(data.assets[data.scenes['scene.json'].assets.button.src],uri(raster));
 assert.match(html,/GAME_TEMPLATE_SENTINEL/);assert.match(data.studioTemplate,/GAME_TEMPLATE_SENTINEL/);assert.doesNotMatch(html,/ART_TEMPLATE_MUST_NOT_REPLACE_GAME/);
});

test('standalone project and library CLIs accept their original relative flags with explicit authoring environment',async t=>{
 const f=await fixture(t);
 for(const [script,flag,input]of [['bundle-project.mjs','--scene',f.project],['bundle-library.mjs','--manifest',f.manifest]]){
  const out=path.join(f.dir,script+'.html'),run=spawnSync(process.execPath,[path.join(f.toolDir,script),flag,input,'--out',out],{cwd:f.game,env:{...process.env,...f.env},encoding:'utf8',timeout:10_000});
  assert.equal(run.status,0,run.stderr);assert.match(await fs.readFile(out,'utf8'),/external edited scene/);
 }
});

test('absolute custom inputs outside known project roots and local fixture mode keep their original source behavior',async t=>{
 const f=await fixture(t),custom=path.join(f.dir,'custom'),out=path.join(f.dir,'custom.html');await f.put(custom,'scene.json',JSON.stringify(scene('custom scene')));await f.put(custom,'assets/button.png',raster);
 await bundleProject({scenePath:path.join(custom,'scene.json'),outPath:out,id:'fixed-custom',toolDir:f.toolDir,env:f.env});
 const data=payload(await fs.readFile(out,'utf8'),'studio-project-data');assert.equal(data.id,'fixed-custom');assert.equal(data.scene.title,'custom scene');
 await f.put(custom,'library.json',JSON.stringify({version:1,title:'custom library',scenes:[{id:'scene',src:'scene.json'}],pages:[],components:[]}));
 await bundleLibrary({manifestPath:path.join(custom,'library.json'),outPath:out,toolDir:f.toolDir,env:f.env});
 assert.equal(payload(await fs.readFile(out,'utf8'),'library-data').scenes['scene.json'].title,'custom scene');
 await f.put(f.toolDir,'projects/demo/assets/button.png',raster);
 await bundleProject({scenePath:path.join(f.toolDir,f.project),outPath:out,toolDir:f.toolDir,env:{}});assert.equal(payload(await fs.readFile(out,'utf8'),'studio-project-data').scene.title,'retained Game scene');
});

test('project and library guards reject traversal and project image links escaping the authoring root',async t=>{
 const f=await fixture(t),out=path.join(f.dir,'refused.html'),bad=scene('bad');bad.assets.button.src='assets/../../secret.png';await f.put(f.artTool,f.project,JSON.stringify(bad));
 await assert.rejects(bundleProject({scenePath:path.join(f.toolDir,f.project),outPath:out,toolDir:f.toolDir,env:f.env}),/Invalid|raster|escapes|Unsafe/);
 const manifest={version:1,scenes:[],components:[],pages:[{id:'bad',preview:'../secret.png'}]};await f.put(f.artTool,f.manifest,JSON.stringify(manifest));
 await assert.rejects(bundleLibrary({manifestPath:path.join(f.toolDir,f.manifest),outPath:out,toolDir:f.toolDir,env:f.env}),/Invalid|escapes|Unsafe/);
 await f.put(f.artTool,f.project,JSON.stringify(scene('linked')));const assets=path.join(f.artTool,'projects/demo/assets'),outside=path.join(f.dir,'outside');await fs.mkdir(outside);await f.put(outside,'button.png',raster);await fs.rm(assets,{recursive:true});await fs.symlink(outside,assets,'junction');
 await assert.rejects(bundleProject({scenePath:path.join(f.toolDir,f.project),outPath:out,toolDir:f.toolDir,env:f.env}),/outside|escapes|links/);
 await assert.rejects(fs.stat(out),e=>e.code==='ENOENT');
});
