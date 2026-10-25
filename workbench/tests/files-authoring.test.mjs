import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createFileService,allowedKind} from '../core/files.mjs';
import {createWorkbench} from '../server.mjs';

const pose='pose-studio/renewal/hero/base.pose.json',page='pose-studio/stances/editor.html';
const text=name=>JSON.stringify({name,actor:'reaver',poses:[],clips:[],bindings:[]})+'\n';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'wb-files-authoring-')));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const root=path.join(dir,'game'),art=path.join(dir,'AI-Art'),state=path.join(dir,'state');
 await fs.mkdir(root);await fs.mkdir(art);await fs.mkdir(path.join(root,'.git'));
 const put=async(base,name,bytes)=>{const file=path.join(base,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);};
 await put(root,pose,text('retained Game evidence'));await put(art,pose,text('external editable project'));
 await put(root,page,'original Game editor');await put(art,page,'must not shadow Game code');
 const service=(checkout=art,options={})=>createFileService({root,stateDir:state,env:checkout?{ASHEN_ART_CHECKOUT:checkout}:{},...options});
 return {dir,root,art,state,put,service};
}

test('Motion file API passes its explicit environment through and lists/reads/saves newly external projects',async t=>{
 const f=await fixture(t),fresh='pose-studio/renewal/new/new.pose.json';
 await f.put(f.art,fresh,text('new export'));
 await f.put(f.root,'pose-studio/stances/preview.mjs','export const owner="Game";');
 await f.put(f.art,'pose-studio/stances/preview.mjs','export const owner="wrong";');
 await f.put(f.art,'pose-studio/stances/external-only.mjs','must not be listed');
 await f.put(f.root,'assets-display/alternative/index.json','{"owner":"Game"}');
 const app=await createWorkbench({root:f.root,stateDir:f.state,env:{ASHEN_ART_CHECKOUT:f.art},children:false,port:0});
 t.after(()=>app.close());
 const call=(route,body)=>fetch(app.url+route,{method:body?'POST':'GET',headers:{'x-studio-token':app.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const listing=await(await call('/api/files/list?dir=pose-studio/renewal&ext=.json')).json();assert.ok(listing.files.includes(fresh));
 const opened=await(await call('/api/files/read?path='+encodeURIComponent(pose))).json();assert.equal(opened.text,text('external editable project'));
 const saved=await call('/api/files/save',{changes:[{path:pose,text:text('edited in Motion'),baseHash:opened.hash}]});assert.equal(saved.status,200,await saved.clone().text());
 assert.equal(await fs.readFile(path.join(f.art,pose),'utf8'),text('edited in Motion'));assert.equal(await fs.readFile(path.join(f.root,pose),'utf8'),text('retained Game evidence'));
 const code=await(await call('/api/files/read?path=pose-studio/stances/preview.mjs')).json();assert.match(code.text,/Game/);
 const codes=await(await call('/api/files/list?dir=pose-studio/stances&ext=.mjs')).json();assert.deepEqual(codes.files,['pose-studio/stances/preview.mjs']);
 assert.equal(allowedKind('assets-display/alternative/index.json'),null);assert.equal((await call('/api/files/read?path=assets-display/alternative/index.json')).status,403);
});

test('diff, optimistic conflict, backup and restore share the external project owner',async t=>{
 const f=await fixture(t),files=f.service(),opened=await files.read(pose);
 assert.equal(opened.text,text('external editable project'));
 const diff=await files.diff(pose,text('new value'));assert.equal(diff.exists,true);assert.match(JSON.stringify(diff),/external editable project/);
 const save=await files.save([{path:pose,text:text('new value'),baseHash:opened.hash}]);
 const manifest=JSON.parse(await fs.readFile(path.join(f.state,'backups',save.backup,'manifest.json')));
 assert.equal(manifest.files[0].authoringRootHash,hash(Buffer.from(await fs.realpath(f.art))));
 await assert.rejects(files.save([{path:pose,text:text('stale write'),baseHash:opened.hash}]),e=>e.status===409);
 await files.restore(save.backup);assert.equal((await files.read(pose)).text,opened.text);
 assert.equal(await fs.readFile(path.join(f.root,pose),'utf8'),text('retained Game evidence'));
});

test('a mixed backup fails atomically after switching authoring checkout, while a selected Game restore remains valid',async t=>{
 const f=await fixture(t),a=f.service(),oldPose=await a.read(pose),oldPage=await a.read(page);
 const saved=await a.save([{path:page,text:'changed Game editor',baseHash:oldPage.hash},{path:pose,text:text('changed Art A'),baseHash:oldPose.hash}]);
 const artB=path.join(f.dir,'Art-B');await fs.mkdir(artB);await f.put(artB,pose,text('unrelated Art B'));
 const b=f.service(artB);
 await assert.rejects(b.restore(saved.backup),e=>e.status===409);
 assert.equal(await fs.readFile(path.join(f.root,page),'utf8'),'changed Game editor');
 assert.equal(await fs.readFile(path.join(artB,pose),'utf8'),text('unrelated Art B'));assert.equal(await fs.readFile(path.join(f.art,pose),'utf8'),text('changed Art A'));
  await assert.rejects(f.service(null).restore(saved.backup),e=>e.status===409);
  assert.equal(await fs.readFile(path.join(f.root,page),'utf8'),'changed Game editor');
 await b.restore(saved.backup,[page]);assert.equal(await fs.readFile(path.join(f.root,page),'utf8'),'original Game editor');
});

test('legacy Game backups remain portable Game backups and cannot be restored into an authoring checkout',async t=>{
 const f=await fixture(t),game=f.service(null),opened=await game.read(pose);
 const saved=await game.save([{path:pose,text:text('new Game evidence'),baseHash:opened.hash}]);
 const manifest=JSON.parse(await fs.readFile(path.join(f.state,'backups',saved.backup,'manifest.json')));assert.equal('authoringRootHash' in manifest.files[0],false);
 await assert.rejects(f.service().restore(saved.backup),e=>e.status===409);
 assert.equal(await fs.readFile(path.join(f.art,pose),'utf8'),text('external editable project'));
 const clone=path.join(f.dir,'another-Game');await fs.mkdir(clone);await f.put(clone,pose,text('clone current'));
 await createFileService({root:clone,stateDir:f.state,env:{}}).restore(saved.backup);
 assert.equal(await fs.readFile(path.join(clone,pose),'utf8'),opened.text);assert.equal(await fs.readFile(path.join(f.root,pose),'utf8'),text('new Game evidence'));
});

test('mixed-owner write failure rolls external bytes back and leaves no failed backup set',async t=>{
 const f=await fixture(t),files=f.service(f.art,{fileFault:rel=>{if(rel===page)throw Error('fixture write fault');}});
 const a=await files.read(pose),b=await files.read(page);
 await assert.rejects(files.save([{path:pose,text:text('must roll back'),baseHash:a.hash},{path:page,text:'must not land',baseHash:b.hash}]),/rolled back/);
 assert.equal(await fs.readFile(path.join(f.art,pose),'utf8'),a.text);assert.equal(await fs.readFile(path.join(f.root,page),'utf8'),b.text);
 assert.deepEqual((await files.backups()).backups,[]);
});

test('external listing has no stale Game fallback and retains private, cache and symlink guards',async t=>{
 const f=await fixture(t),files=f.service();await fs.rm(path.join(f.art,pose));
 assert.equal((await files.list('pose-studio/renewal','.json')).files.includes(pose),false);
 await assert.rejects(files.read(pose));
 const fresh='pose-studio/renewal/new/project.pose.json';await f.put(f.art,fresh,text('fresh'));assert.ok((await files.list('','.json')).files.includes(fresh));
 for(const bad of ['../secret.json','pose-studio/renewal/.private.json','pose-studio\\renewal\\x.json','pose-studio/renewal/a.json:stream']){
  assert.equal(allowedKind(bad),null);await assert.rejects(files.read(bad));await assert.rejects(files.list(bad));
 }
 const cache=path.join(f.root,'.art-cache','tag','common');await fs.mkdir(cache,{recursive:true});assert.throws(()=>f.service(cache),/cache/);
 const outside=path.join(f.dir,'outside');await fs.mkdir(outside);await f.put(outside,'secret.pose.json',text('outside'));
 const link=path.join(f.art,'pose-studio/renewal/link');await fs.symlink(outside,link,'junction');
 await assert.rejects(files.read('pose-studio/renewal/link/secret.pose.json'));
 await assert.rejects(files.save([{path:'pose-studio/renewal/link/new.pose.json',text:text('escape'),baseHash:null}]));
 assert.equal((await files.list('pose-studio/renewal','.json')).files.some(p=>p.includes('/link/')),false);
  const inside=path.join(f.art,'pose-studio/renewal/new'),insideLink=path.join(f.art,'pose-studio/renewal/inside-link');
  await fs.symlink(inside,insideLink,'junction');
  await assert.rejects(files.read('pose-studio/renewal/inside-link/project.pose.json'),/Linked path refused/);
  assert.equal((await files.list('pose-studio/renewal','.json')).files.some(p=>p.includes('/inside-link/')),false);
});

test('restore preflights every selected path before changing a mixed Game/Art set',async t=>{
 const f=await fixture(t),files=f.service(),a=await files.read(pose),b=await files.read(page);
 const saved=await files.save([{path:page,text:'saved Game editor',baseHash:b.hash},{path:pose,text:text('saved Art'),baseHash:a.hash}]);
 const parent=path.dirname(path.join(f.art,pose)),outside=path.join(f.dir,'restore-outside');await fs.mkdir(outside);await fs.rename(parent,parent+'-old');await fs.symlink(outside,parent,'junction');
 await assert.rejects(files.restore(saved.backup));
 assert.equal(await fs.readFile(path.join(f.root,page),'utf8'),'saved Game editor');assert.deepEqual(await fs.readdir(outside),[]);
});

test('an explicit authoring-root alias keeps one canonical owner and cannot disguise a runtime cache',async t=>{
 const f=await fixture(t),alias=path.join(f.dir,'Art-alias');await fs.symlink(f.art,alias,'junction');
 const viaAlias=f.service(alias),opened=await viaAlias.read(pose);assert.equal(opened.text,text('external editable project'));
 const saved=await viaAlias.save([{path:pose,text:text('via alias'),baseHash:opened.hash}]);
 const manifest=JSON.parse(await fs.readFile(path.join(f.state,'backups',saved.backup,'manifest.json')));
 assert.equal(manifest.files[0].authoringRootHash,hash(Buffer.from(await fs.realpath(f.art))));
 await f.service().restore(saved.backup);assert.equal(await fs.readFile(path.join(f.art,pose),'utf8'),opened.text);
 const cache=path.join(f.root,'.art-cache','tag','common'),cacheAlias=path.join(f.dir,'cache-alias');await fs.mkdir(cache,{recursive:true});await fs.symlink(cache,cacheAlias,'junction');
 assert.throws(()=>f.service(cacheAlias),/cache/);
});
