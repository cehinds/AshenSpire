import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {authoringRoot,authoringPath,compositeSourcePath} from '../tools/art-authoring.mjs';
import {serve} from '../tools/serve.mjs';
import {assertSourceDisplayArt} from '../tools/source-display-art.mjs';

function fixture(){
 // Keep Python/Node parity about the same physical owners, not temp aliases.
 const dir=realpathSync.native(mkdtempSync(join(tmpdir(),'ashen-authoring-'))),root=join(dir,'game'),assetRoot=join(dir,'AI-Art');
 mkdirSync(root);mkdirSync(assetRoot);
 const put=(base,path,text)=>{const target=join(base,path);mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,text);};
 return {dir,root,assetRoot,put,close:()=>rmSync(dir,{recursive:true,force:true})};
}

test('authoring roots require explicit separate writable sources and refuse runtime caches',()=>{
 const f=fixture();try{
  assert.equal(authoringRoot({root:f.root,env:{},required:false}),null);
  assert.throws(()=>authoringRoot({root:f.root,env:{}}),/ASHEN_ART_CHECKOUT/);
  assert.throws(()=>authoringRoot({root:f.root,assetRoot:f.root}),/separate/);
  const cache=join(f.root,'.art-cache','release','common');mkdirSync(cache,{recursive:true});
  assert.throws(()=>authoringRoot({root:f.root,assetRoot:cache}),/cache/);
  if(process.platform!=='win32'){
   const link=join(f.dir,'linked-cache');symlinkSync(cache,link,'dir');
   assert.throws(()=>authoringRoot({root:f.root,assetRoot:link}),/cache/);
   symlinkSync(cache,join(f.assetRoot,'common'),'dir');
   assert.throws(()=>authoringPath('assets-display/alternative/pose.webp',{root:f.root,assetRoot:f.assetRoot}),/cache/);
  }
  assert.equal(authoringRoot({root:f.root,assetRoot:f.assetRoot,env:{ASHEN_ART_CHECKOUT:f.root}}),f.assetRoot);
 }finally{f.close();}
});

test('authoring mappings preserve runtime IDs and game-owned metadata/code',()=>{
 const f=fixture(),options={root:f.root,assetRoot:f.assetRoot};try{
  const mappings={'assets-display/alternative/pose.webp':'common/assets-display/alternative/pose.webp','assets-mobile/poses/ready.webp':'light/assets/poses/ready.webp','assets/poses/ready.webp':'hd/assets/poses/ready.webp','assets/fonts/body.woff2':'common/assets/fonts/body.woff2','assets/sfx/hit.ogg':'hd/assets/sfx/hit.ogg','music/score.ogg':'common/music/score.ogg','pose-studio/stances/source/pose.png':'pose-studio/stances/source/pose.png'};
  for(const [id,path]of Object.entries(mappings))assert.equal(authoringPath(id,options),join(f.assetRoot,path),id);
  for(const id of ['assets-display/alternative/index.json','src/content/catalog.js','music/score/composer.mjs','pose-studio/stances/preview.mjs','pose-studio/stances/index.html'])assert.equal(compositeSourcePath(id,options),join(f.root,id),id);
  assert.equal(compositeSourcePath('pose-studio/stances/source/pose.png',options),join(f.assetRoot,'pose-studio/stances/source/pose.png'));
  for(const bad of ['../outside.png','assets/../../secret','/absolute.png','C:/absolute.png','art/\\outside.png','art/.git/config'])assert.throws(()=>authoringPath(bad,options),/Unsafe/);
 }finally{f.close();}
});

test('runtime measurement refuses an unpublished authoring preview before checking catalogs',()=>{
 assert.throws(()=>assertSourceDisplayArt('/unused',{env:{ASHEN_ART_CHECKOUT:'/mutable'}}),/Clear ASHEN_ART_CHECKOUT/);
});

test('Python and Node exporters agree on the separate art checkout layout',()=>{
 const f=fixture();try{
  const ids=['assets-display/alternative/pose.webp','assets-display/layered/manifest.json','assets-mobile/poses/ready.webp','assets/poses/ready.webp','pose-studio/stances/project.rig.json'];
  const code="import json,sys;sys.path.insert(0,sys.argv[1]);from art_authoring import art_path;print(json.dumps([str(art_path(sys.argv[2],p,sys.argv[3])) for p in json.loads(sys.argv[4])]))";
  const result=spawnSync(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),['-B','-c',code,resolve('tools'),f.root,f.assetRoot,JSON.stringify(ids)],{encoding:'utf8',env:{...process.env,ASHEN_ART_CHECKOUT:''}});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),ids.map(id=>authoringPath(id,{root:f.root,assetRoot:f.assetRoot})));
 }finally{f.close();}
});

test('game source server overlays explicit authoring images and keeps display catalogs local',async()=>{
 const f=fixture();let app;try{
  f.put(f.root,'assets-display/alternative/pose.webp','stale original');f.put(f.assetRoot,'common/assets-display/alternative/pose.webp','new export');
  f.put(f.root,'assets-display/alternative/index.json','game metadata');
  app=await serve({root:f.root,assetRoot:f.assetRoot,port:0,open:false,host:'127.0.0.1',quiet:true});
  const response=await fetch(app.url+'assets-display/alternative/pose.webp');assert.equal(await response.text(),'new export');
  assert.equal(await(await fetch(app.url+'assets-display/alternative/index.json')).text(),'game metadata');
 }finally{if(app){app.server.closeAllConnections();await new Promise(done=>app.server.close(done));}f.close();}
});
