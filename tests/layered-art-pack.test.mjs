import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {readLayeredArt,withLayeredArt} from '../tools/layered-art.mjs';
import {LAYERED_SCENES,LAYERED_SOURCES,LAYERED_TIME_FILTERS,LAYERED_WEATHER_FILTERS,LAYERED_EXPORT_HASHES} from '../src/content/layeredEnvironments.js';
const root=path.resolve(import.meta.dirname,'..');
test('every runtime layer resolves to a verified portable and web-pack export',()=>{
 const entries=readLayeredArt(root),ids=new Set(entries.map(r=>r.id));assert.ok(entries.length>80);assert.deepEqual(Object.fromEntries(entries.map(e=>[e.id,e.sha256])),LAYERED_EXPORT_HASHES);
 for(const layer of [...Object.values(LAYERED_SCENES).flatMap(s=>s.layers),...Object.values(LAYERED_TIME_FILTERS),...Object.values(LAYERED_WEATHER_FILTERS).flat()]){
  assert.ok(ids.has(layer.asset),layer.asset);assert.ok(LAYERED_SOURCES[layer.asset]);
 }
 const original={schema:2,assets:{}},packed=withLayeredArt(original,root);assert.equal(Object.keys(packed.assets).length,entries.length);assert.deepEqual(original.assets,{});
 for(const row of entries)assert.equal(packed.assets[row.id].common.sha256,row.sha256);
});
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'layer-art-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.mkdirSync(path.join(dir,'assets-display/layered'),{recursive:true});return dir;}
test('changed export bytes fail before packing',t=>{
 const dir=fixture(t),id='assets-display/layered/rug.webp',bytes=Buffer.from('original');fs.writeFileSync(path.join(dir,id),bytes);
 fs.writeFileSync(path.join(dir,'assets-display/layered/manifest.json'),JSON.stringify({schema:1,assets:{[id]:{sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,width:10,height:10}}}));
 fs.writeFileSync(path.join(dir,id),'changed!');assert.throws(()=>readLayeredArt(dir),/hash mismatch/);
});
test('manifest paths cannot escape the reviewed export directory',t=>{
 const dir=fixture(t);fs.writeFileSync(path.join(dir,'assets-display/layered/manifest.json'),JSON.stringify({schema:1,assets:{'assets-display/layered/../../private.webp':{}}}));assert.throws(()=>readLayeredArt(dir),/Invalid layered art path/);
});
test('branch export IDs cannot replace pinned artwork',()=>{
 const [entry]=readLayeredArt(root);assert.throws(()=>withLayeredArt({assets:{[entry.id]:{common:{}}}},root),/collides/);
});

test('a runtime catalog without its manifest cannot produce an artless build',t=>{
 const dir=fixture(t);fs.mkdirSync(path.join(dir,'src/content'),{recursive:true});fs.writeFileSync(path.join(dir,'src/content/layeredEnvironments.js'),'export const LAYERED_SCENES = {};\n');assert.throws(()=>readLayeredArt(dir),/manifest missing/);
});
test('runtime recipes cannot reference exports omitted from the shipping manifest',t=>{
 const dir=fixture(t);fs.mkdirSync(path.join(dir,'src/content'),{recursive:true});fs.writeFileSync(path.join(dir,'src/content/layeredEnvironments.js'),'export const LAYERED_SCENES = {"room":{"layers":[{"asset":"assets-display/layered/missing.webp"}]}};\n');fs.writeFileSync(path.join(dir,'assets-display/layered/manifest.json'),JSON.stringify({schema:1,assets:{}}));assert.throws(()=>readLayeredArt(dir),/Unpacked layered art reference/);
});
