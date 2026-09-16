import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {act1Enemies} from '../../src/content/enemies/act1.js';
import {act2Enemies} from '../../src/content/enemies/act2.js';
import {act3Enemies} from '../../src/content/enemies/act3.js';
import {ENEMY_POSES} from '../../src/content/enemyArt.js';
import {decodePng,contentBox} from '../../tools/concept-cutout.mjs';
const manifest=JSON.parse(readFileSync('assets/enemy-poses/manifest.json'));
const ids=[...act1Enemies,...act2Enemies,...act3Enemies].map(e=>e.id).sort();
assert.deepEqual(manifest.entries.map(e=>e.id).sort(),ids);
assert.deepEqual([...ENEMY_POSES].sort(),ids);
for(const e of manifest.entries){
 const idle=readFileSync('assets/enemy-poses/'+e.idle),attack=readFileSync('assets/enemy-poses/'+e.attack);
 assert(!idle.equals(attack),e.id+' attack must differ from idle');
 if(!e.legacy)assert(idle.equals(readFileSync(e.source)),e.id+' idle changed');
 for(const file of [e.idle,e.attack]){
  const im=decodePng(readFileSync('assets/enemy-poses/'+file));
  assert.equal(im.width,384);assert.equal(im.height,384);assert.equal(im.bpp,4);
  const b=contentBox(im);assert(b.x0>0&&b.x1<383&&b.y0>0&&b.y1<383,file+' needs padding');
  assert(b.y1<=365,file+' ground line');
  assert.equal(im.px[3],0,file+' transparent corner');
 }
}
const result={enemies:ids.length,frames:ids.length*2,legacyReplacements:manifest.entries.filter(e=>e.legacy).length,unchangedPaintedIdles:manifest.entries.filter(e=>!e.legacy).length,dimensions:'384x384 RGBA',distinctAttacks:true,transparentMargins:true};
writeFileSync('art/enemy-poses/asset-validation.json',JSON.stringify(result,null,2)+'\n');console.log(result);
