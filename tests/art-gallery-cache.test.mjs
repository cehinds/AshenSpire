import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {markerFor,readPin} from '../tools/fetch-art.mjs';
import {listArt,resolveArt} from '../workbench/core/assets.mjs';
const env={ASHEN_ART_SOURCE:'cache'};
function fixture(){
 // Gallery resolution returns canonical paths, including platform temp aliases.
 const root=realpathSync.native(mkdtempSync(join(tmpdir(),'ashen-gallery-')));
 const put=(p,b)=>{mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),b);};
 const pin={schema:2,repo:'cehinds/AI-Art',tag:'ashenspire-hd-assets-v24',zip:'hd-assets-v24.zip',sha256:'1'.repeat(64),packs:Object.fromEntries(['high','light','common'].map((p,i)=>[p,{zip:`${p==='high'?'hd':p}-assets-v24.zip`,sha256:String(i+1).repeat(64)}]))};
 const id='music/theme.ogg',bytes=Buffer.from('synthetic music'),row={path:id,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 const manifest={schema:2,assets:{[id]:{common:row}}},cache=`.art-cache/${pin.tag}/common/`;
 put('art-release.json',JSON.stringify(pin));put('art-manifest.json',JSON.stringify(manifest));put(cache+id,bytes);put(cache+'.verified',markerFor(readPin(root),manifest,'common')+'\n');
 put(id,'stale original');put(cache+'music/unlisted.ogg','unlisted cache addition');put('assets-display/alternative/unpublished.webp','local art is not runtime');
 return {root,put,id,cache,close:()=>rmSync(root,{recursive:true,force:true})};
}

test('runtime gallery lists and resolves only manifest-declared verified pack files',async()=>{
 const f=fixture();try{
  const result=await listArt(f.root,{env});assert.deepEqual(result.files.map(f=>f.path),[f.id]);
  assert.equal(result.files[0].from,'common');
  assert.equal(await resolveArt(f.root,f.id,{env}),join(f.root,f.cache,f.id));
  for(const id of ['music/unlisted.ogg','assets-display/alternative/unpublished.webp','../../secret.png'])assert.equal(await resolveArt(f.root,id,{env}),null,id);
  rmSync(join(f.root,f.cache,'.verified'));
  assert.deepEqual((await listArt(f.root,{env})).files,[]);
  assert.equal(await resolveArt(f.root,f.id,{env}),null);
 }finally{f.close();}
});

test('explicit authoring gallery can preview unpublished exports without exposing other checkout files',async()=>{
 const f=fixture();try{
  const checkout=join(f.root,'authoring');mkdirSync(checkout);
  f.put('authoring/common/assets-display/alternative/unpublished.webp','mutable export');f.put('authoring/private/secret.png','private');
  const authoringEnv={ASHEN_ART_CHECKOUT:checkout};
  const result=await listArt(f.root,{env:authoringEnv});assert.deepEqual(result.files.map(f=>f.path),['assets-display/alternative/unpublished.webp']);
  assert.equal(await resolveArt(f.root,'assets-display/alternative/unpublished.webp',{env:authoringEnv}),join(checkout,'common/assets-display/alternative/unpublished.webp'));
  assert.equal(await resolveArt(f.root,'private/secret.png',{env:authoringEnv}),null);
 }finally{f.close();}
});
