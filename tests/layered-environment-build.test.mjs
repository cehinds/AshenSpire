import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const exporter=new URL('../tools/layered-environment-build.mjs',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'layered-export-'));
 t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const game=path.join(home,'game'),art=path.join(home,'external-art'),drafts=path.join(art,'art/map-battlefield-drafts');
 const write=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
 write(path.join(game,'tools/layered-environment-build.mjs'),fs.readFileSync(exporter));
 write(path.join(game,'src/content/.keep'),'');
 const marker=path.join(home,'sharp-loaded');
 // Deterministic absence even on machines that have Sharp installed globally.
 write(path.join(game,'node_modules/sharp/index.js'),"require('node:fs').writeFileSync(process.env.SHARP_TEST_MARKER,'attempted');throw Object.assign(new Error(\"Cannot find module 'sharp' (fixture)\"),{code:'MODULE_NOT_FOUND'});\n");
 write(path.join(drafts,'batch-10-location-streets/scenes.mjs'),`export const exportLocationScenes=()=>({canvas:{width:16,height:16},styleFamilyId:'fixture',scenes:[{id:'room',layers:[{role:'ground',asset:'ground.png'}]}],introMap:{items:[]},timeOfDayFilters:{items:{}}});\n`);
 write(path.join(drafts,'style-system/art-style.mjs'),'export const loadStyleLibrary=()=>({});export const checkStyleAsset=()=>[];\n');
 const names=['batch-10-location-streets/ground.png',...['rain','cold','hot'].map(n=>`batch-04-atmosphere/filters/filter-${n}.png`),...['rain','snow','ash'].map(n=>`batch-04-atmosphere/particles/${n}.png`)];
 const assets=[],records={},outputs=new Map();
 for(const name of names){
  const source=Buffer.from(`source:${name}`),bytes=Buffer.from(`reviewed WebP:${name}`),id='assets-display/layered/'+name.replaceAll('/','--').replace(/\.png$/,'.webp');
  write(path.join(drafts,name),source);write(path.join(game,id),bytes);outputs.set(id,bytes);
  assets.push({file:name,sha256:hash(source),width:16,height:16,visibleBoundsAt32:[0,0,16,16]});
  records[id]={sha256:hash(bytes),sourceSha256:hash(source)};
 }
 write(path.join(drafts,'catalog.json'),JSON.stringify({batches:[{manifest:'sources.json'}]}));
 write(path.join(drafts,'sources.json'),JSON.stringify({assets}));
 write(path.join(game,'assets-display/layered/manifest.json'),JSON.stringify({schema:1,assets:records}));
 const run=(...args)=>spawnSync(process.execPath,[path.join(game,'tools/layered-environment-build.mjs'),...args],{cwd:home,encoding:'utf8',env:{...process.env,ASHENSPIRE_ART_DIR:art,SHARP_TEST_MARKER:marker}});
 return {game,drafts,marker,outputs,run};
}

test('catalog-only CLI publishes verified existing exports without loading optional Sharp',t=>{
 const f=fixture(t),result=f.run('--catalog-only');
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Published 7 native-size layer exports for 1 scenes/);
 assert.equal(fs.existsSync(f.marker),false,'catalog validation never attempts to load Sharp');
 for(const [id,bytes]of f.outputs)assert.deepEqual(fs.readFileSync(path.join(f.game,id)),bytes,'existing WebP bytes stay unchanged');
 const manifest=JSON.parse(fs.readFileSync(path.join(f.game,'assets-display/layered/manifest.json')));
 assert.equal(Object.keys(manifest.assets).length,7);
 for(const record of Object.values(manifest.assets))assert.ok(record.source.startsWith('art/map-battlefield-drafts/'));
 assert.match(fs.readFileSync(path.join(f.game,'src/content/layeredEnvironments.js'),'utf8'),/export const LAYERED_EXPORT_HASHES = /);
});

test('catalog-only still rejects changed source or export hashes without Sharp',t=>{
 for(const changed of ['source','export']){
  const f=fixture(t),file=changed==='source'?path.join(f.drafts,'batch-10-location-streets/ground.png'):path.join(f.game,f.outputs.keys().next().value);
  fs.writeFileSync(file,'changed');const result=f.run('--catalog-only');
  assert.notEqual(result.status,0);assert.match(result.stderr,changed==='source'?/Changed source/:/Re-encode required/);
  assert.equal(fs.existsSync(f.marker),false);
  assert.equal(fs.existsSync(path.join(f.game,'src/content/layeredEnvironments.js')),false,'invalid exports cannot publish a runtime catalog');
 }
});

test('encoding CLI still requires Sharp and cannot rewrite exports when it is unavailable',t=>{
 const f=fixture(t),result=f.run();
 assert.notEqual(result.status,0);assert.match(result.stderr,/Cannot find module 'sharp'/);
 assert.equal(fs.readFileSync(f.marker,'utf8'),'attempted');
 for(const [id,bytes]of f.outputs)assert.deepEqual(fs.readFileSync(path.join(f.game,id)),bytes);
});
