import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { artPath, addDisplayRecord, copyDisplayArt, copySourceArt, DISPLAY_METADATA } from '../tools/art-source.mjs';
import { markerFor, readPin } from '../tools/fetch-art.mjs';
import { withAlternativeArt, planPacks, objectPath } from '../tools/asset-pack.mjs';
import { readLayeredArt, withLayeredArt } from '../tools/layered-art.mjs';
import { cardCutoutAssets } from '../tools/card-cutout-assets.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const names = ['alternativeArtCatalog', 'alternativeCardAnimations', 'alternativeSelectedStances', 'classSmashAnimations'];
const files = ['src/ui/alternativeArtCatalog.js', 'src/content/alternativeCardAnimations.js', 'src/content/alternativeSelectedStances.js', 'src/content/classSmashAnimations.js'];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'display-cache-unit-'));
  const put = (p, data) => { mkdirSync(join(root, p, '..'), {recursive:true}); writeFileSync(join(root, p), data); };
  const pin = {schema:2,repo:'cehinds/AI-Art',tag:'ashenspire-hd-assets-v24',zip:'hd-assets-v24.zip',sha256:'1'.repeat(64),packs:Object.fromEntries(['high','light','common'].map((p,i)=>[p,{zip:`${p==='high'?'hd':p}-assets-v24.zip`,sha256:String(i+1).repeat(64)}]))};
  put('art-release.json', JSON.stringify(pin));
  const entries = Object.fromEntries(['a','b','c','d'].map(x=>[`assets-display/alternative/${x}.webp`,Buffer.from('synthetic-'+x)]));
  entries['assets-display/layered/scene.webp'] = Buffer.from('synthetic-layer');
  entries['assets-display/card-cutouts/card.png'] = Buffer.from('synthetic-cutout');
  const manifest = {schema:2,assets:Object.fromEntries(Object.entries(entries).map(([id,b])=>[id,{common:{path:id,bytes:b.length,sha256:sha(b)}}]))};
  put('art-manifest.json',JSON.stringify(manifest));
  const cache = `.art-cache/${pin.tag}/common/`;
  for(const [id,bytes] of Object.entries(entries)) { put(cache+id,bytes); put(id,Buffer.from('mutable-authoring-poison')); }
  put(cache+'.verified',markerFor(readPin(root),manifest,'common')+'\n');
  names.forEach((name,i)=>{const letter='abcd'[i],id=`assets-display/alternative/${letter}.webp`;put(files[i],`export const ${name} = ${JSON.stringify({sprites:{},hashes:{[letter+'.webp']:sha(entries[id])},filePaths:{[letter+'.webp']:id}})};\n`);});
  const id='assets-display/layered/scene.webp', rec=manifest.assets[id].common;
  put('assets-display/layered/manifest.json',JSON.stringify({schema:1,assets:{[id]:{...rec,width:2,height:3}}}));
  put('src/content/layeredEnvironments.js',`export const LAYERED_SCENES = ${JSON.stringify({scene:{asset:id}})};\nexport const LAYERED_EXPORT_HASHES = ${JSON.stringify({[id]:rec.sha256})};\n`);
  const cut='assets-display/card-cutouts/card.png';
  put('asset-data/card-art/layered-runtime.json',JSON.stringify({assets:{card:manifest.assets[cut].common}}));
  return {root,put,manifest,entries,cache,close:()=>rmSync(root,{recursive:true,force:true})};
}
const cacheOpts={env:{ASHEN_ART_SOURCE:'cache'}};
test('all six display owners reuse exactly pinned rows and read verified common bytes, not root poison',()=>{
 const f=fixture();try {
  for(const mode of ['auto','cache']) {
   const opts={env:{ASHEN_ART_SOURCE:mode,ASHEN_ART_CHECKOUT:'/mutable/ignored'}};
   const out=withLayeredArt(withAlternativeArt(f.manifest,f.root,opts),f.root,opts);
   assert.deepEqual(out.assets,f.manifest.assets);
   assert.throws(()=>artPath('assets-display/../escape',{root:f.root,...opts}),/escapes/);
   assert.equal(out.count,6);
   assert.deepEqual(cardCutoutAssets(f.root,opts)[0].bytes,f.entries['assets-display/card-cutouts/card.png']);
   assert.deepEqual(readLayeredArt(f.root,opts)[0].bytes,f.entries['assets-display/layered/scene.webp']);
  }
 }finally{f.close();}
});
test('new legacy augmentations and already pinned records yield identical object-index plans',()=>{
 const f=fixture();try {
  const expected=planPacks(f.root,['common'],{source:'cache'});
  assert.deepEqual(expected.problems,[]);
  for(const [id,bytes] of Object.entries(f.entries)) assert.deepEqual(expected.packs.common.entries[id],[sha(bytes),bytes.length,id.endsWith('.png')?'image/png':'image/webp']);
  for(const [id,bytes] of Object.entries(f.entries)) f.put(id,bytes);
  f.put('art-manifest.json',JSON.stringify({schema:2,assets:{}}));
  const legacy=planPacks(f.root,['common'],{source:'trees'});
  assert.deepEqual(legacy.problems,[]);
  assert.deepEqual(legacy.packs,expected.packs);
  const previous=process.env.ASHEN_ART_SOURCE;
  try { process.env.ASHEN_ART_SOURCE='trees'; assert.deepEqual(planPacks(f.root,['common']).packs,legacy.packs); }
  finally { if(previous===undefined) delete process.env.ASHEN_ART_SOURCE; else process.env.ASHEN_ART_SOURCE=previous; }
  for(const [id,bytes] of Object.entries(f.entries)) assert.deepEqual(expected.packs.common.files.get(objectPath(sha(bytes),id)),bytes);
 }finally{f.close();}
});
test('unverified display cache never silently falls back to mutable root or authoring checkout',()=>{
 const f=fixture();try {
  rmSync(join(f.root,f.cache,'.verified'));
  assert.throws(()=>withAlternativeArt(f.manifest,f.root,cacheOpts),/fetch-art/);
  assert.throws(()=>artPath('assets-display/alternative/a.webp',{root:f.root,env:{ASHEN_ART_CHECKOUT:f.root}}),/fetch-art/);
  assert.equal(readFileSync(artPath('assets-display/alternative/a.webp',{root:f.root,env:{ASHEN_ART_SOURCE:'trees'}}),'utf8'),'mutable-authoring-poison');
  assert.throws(()=>artPath('assets-display/../escape',{root:f.root,...cacheOpts}),/fetch-art|escapes/);
 }finally{f.close();}
});
test('every pinned metadata collision remains fatal, including extra fields or tiers',()=>{
 const row={path:'assets-display/alternative/a.webp',bytes:1,sha256:'a'.repeat(64)};
 for(const entry of [{common:{...row,bytes:2}},{common:{...row,sha256:'b'.repeat(64)}},{common:{...row,path:'elsewhere'}},{common:{...row,width:1}},{common:row,high:row},{high:row},null])
  assert.throws(()=>addDisplayRecord({[row.path]:entry},row.path,row),/collides/);
 const assets={};addDisplayRecord(assets,row.path,row);const old=assets[row.path];addDisplayRecord(assets,row.path,{...row});assert.equal(assets[row.path],old);
});
test('actual augmentation rejects wrong pinned byte metadata and changed cache bytes',()=>{
 const f=fixture();try {
  const bad=structuredClone(f.manifest);bad.assets['assets-display/alternative/a.webp'].common.bytes++;
  assert.throws(()=>withAlternativeArt(bad,f.root,cacheOpts),/collides/);
  f.put(f.cache+'assets-display/alternative/a.webp','tampered');
  assert.throws(()=>withAlternativeArt(f.manifest,f.root,cacheOpts),/Alternative art changed/);
  f.put(f.cache+'assets-display/layered/scene.webp','tampered');
  assert.throws(()=>readLayeredArt(f.root,cacheOpts),/hash mismatch/);
  f.put(f.cache+'assets-display/card-cutouts/card.png','tampered');
  assert.throws(()=>cardCutoutAssets(f.root,cacheOpts),/Card cutout changed/);
 }finally{f.close();}
});

test('sandbox copies only declared verified images and local metadata, never stale originals or cache extras',()=>{
 const f=fixture();try {
  f.put(f.cache+'assets-display/alternative/unlisted.webp','not declared');
  f.put('assets-display/README.md','local game metadata');
  const out=join(f.root,'sandbox');
  copyDisplayArt(out,{root:f.root,...cacheOpts});
  for(const [id,bytes] of Object.entries(f.entries)) assert.deepEqual(readFileSync(join(out,id)),bytes);
  assert.equal(readFileSync(join(out,'assets-display/README.md'),'utf8'),'local game metadata');
  assert.equal(existsSync(join(out,'assets-display/alternative/unlisted.webp')),false);
  assert.equal(readFileSync(join(out,'assets-display/layered/manifest.json'),'utf8'),readFileSync(join(f.root,'assets-display/layered/manifest.json'),'utf8'));
  for(const [id,bytes] of Object.entries(f.entries)) f.put(id,bytes);
  copyDisplayArt(join(f.root,'trees-sandbox'),{root:f.root,env:{ASHEN_ART_SOURCE:'trees'}});
  f.put('assets-display/alternative/a.webp','wrong');
  assert.throws(()=>copyDisplayArt(join(f.root,'bad-trees'),{root:f.root,env:{ASHEN_ART_SOURCE:'trees'}}),/hash mismatch/);
  f.put(f.cache+'assets-display/alternative/a.webp','wrong');
  assert.throws(()=>copyDisplayArt(join(f.root,'bad-cache'),{root:f.root,...cacheOpts}),/hash mismatch/);
  rmSync(join(f.root,f.cache,'.verified'));
  assert.throws(()=>copyDisplayArt(join(f.root,'no-cache'),{root:f.root,...cacheOpts}),/fetch-art/);
 }finally{f.close();}
});
test('source sandbox helper also materializes current display images and game-owned catalogs',()=>{
 const f=fixture();try {
  const high='.art-cache/ashenspire-hd-assets-v24/high/';
  f.put(high+'assets/bg/a.webp','tiny high');
  f.put(high+'.verified',markerFor(readPin(f.root),f.manifest,'high')+'\n');
  f.put(f.cache+'assets/fonts/a.woff2','tiny font');
  const out=join(f.root,'source-sandbox');copySourceArt(out,{root:f.root,...cacheOpts});
  assert.equal(readFileSync(join(out,'assets/bg/a.webp'),'utf8'),'tiny high');
  assert.equal(readFileSync(join(out,'assets/fonts/a.woff2'),'utf8'),'tiny font');
  assert.deepEqual(readFileSync(join(out,'assets-display/layered/scene.webp')),f.entries['assets-display/layered/scene.webp']);
  assert.ok(existsSync(join(out,'assets-display/layered/manifest.json')));
 }finally{f.close();}
});

test('actual portable Pose package overlays all local metadata after verified images',()=>{
 const f=fixture();try {
  for(const tool of ['art-source.mjs','fetch-art.mjs','zip.mjs','art-authoring.mjs'])f.put('tools/'+tool,readFileSync(new URL('../tools/'+tool,import.meta.url)));
  f.put('pose-studio/package.mjs',readFileSync(new URL('../pose-studio/package.mjs',import.meta.url)));
  f.put('pose-studio/index.html','tiny editor');f.put('src/entry.js','tiny game');f.put('engine/entry.js','tiny engine');f.put('AshenSpire.html','tiny artifact fixture');
  const high='.art-cache/ashenspire-hd-assets-v24/high/';
  for(const name of ['combat-effects','pose-effects','painted-outfits','readiness-poses'])f.put(high+'assets/'+name+'/tiny.png','tiny image');
  f.put(high+'.verified',markerFor(readPin(f.root),f.manifest,'high')+'\n');
  for(const name of ['art/pose-studio','art/combat-effects-2026-09-07','art/card-effect-refresh-2026-09-09','pose-studio/renewal','pose-studio/stances'])f.put('authoring/'+name+'/project.json','{}');
  for(const id of DISPLAY_METADATA)f.put(id,'retained game metadata '+id);
  const result=spawnSync(process.execPath,[join(f.root,'pose-studio/package.mjs'),'--asset-root',join(f.root,'authoring')],{cwd:f.root,encoding:'utf8',env:{...process.env,ASHEN_ART_SOURCE:'cache',ASHEN_ART_CHECKOUT:''}});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const out=join(f.root,'build/pose-studio-app');
  for(const id of DISPLAY_METADATA)assert.equal(readFileSync(join(out,id),'utf8'),'retained game metadata '+id);
  for(const [id,bytes] of Object.entries(f.entries))assert.deepEqual(readFileSync(join(out,id)),bytes);
 }finally{f.close();}
});

test('actual display-library generation preserves groups when all display rows become pinned',()=>{
 const f=fixture();try {
  for(const tool of ['art-source.mjs','fetch-art.mjs','zip.mjs','display-art-library.mjs'])f.put('tools/'+tool,readFileSync(new URL('../tools/'+tool,import.meta.url)));
  const manifest=structuredClone(f.manifest);manifest.assets['assets/bg/classic.webp']={high:{path:'assets/bg/classic.webp',bytes:1,sha256:'a'.repeat(64)}};manifest.assets['assets/ui/shared.webp']={common:{path:'assets/ui/shared.webp',bytes:1,sha256:'b'.repeat(64)}};
  const run=m=>{
   f.put('art-manifest.json',JSON.stringify(m));f.put(f.cache+'.verified',markerFor(readPin(f.root),m,'common')+'\n');
   const result=spawnSync(process.execPath,[join(f.root,'tools/display-art-library.mjs'),'--write'],{cwd:f.root,encoding:'utf8',env:{...process.env,ASHEN_ART_SOURCE:'cache',ASHEN_ART_CHECKOUT:''}});
   assert.equal(result.status,0,result.stdout+result.stderr);
   return Object.fromEntries(['classic','alternative','shared'].map(name=>[name,readFileSync(join(f.root,'assets-display',name,'library.json'),'utf8')]));
  };
  const legacy=structuredClone(manifest);for(const id of Object.keys(f.entries))delete legacy.assets[id];
  const before=run(legacy),after=run(manifest);assert.deepEqual(after,before);
  assert.equal(Object.keys(JSON.parse(after.alternative).assets).length,3);
  assert.equal(Object.keys(JSON.parse(after.classic).assets).length,1);
  assert.equal(Object.keys(JSON.parse(after.shared).assets).length,1);
 }finally{f.close();}
});
