import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CREATION_FEAT_ART} from '../src/ui/components/creationFeatArt.js';
import {creationFeatEmblem} from '../src/ui/components/creationPageParts.js';
import {withKitDom} from './helpers/kit-dom.mjs';
test('native feat layers preserve staged geometry and separate original art parts',()=>withKitDom(()=>{
 const staged=JSON.parse(readFileSync(new URL('../art/creation-feats-2026-10-12/layers.json',import.meta.url),'utf8'));
 assert.deepEqual(CREATION_FEAT_ART,staged);
 for(const[id,art]of Object.entries(staged)){
  const node=creationFeatEmblem(id),images=node.querySelectorAll('img');
  assert.equal(images.length,art.layers.length);
  for(const[index,image]of [...images].entries()){
   const layer=art.layers[index];assert.equal(image.dataset.featLayer,layer.asset);
   assert.equal(image.style.left,`${layer.x/art.canvas.width*100}%`);
   assert.equal(image.style.top,`${layer.y/art.canvas.height*100}%`);
   assert.ok(image.getAttribute('src').includes('assets/player-polish/ui/creation/'));
  }
 }
}));
test('a build without the staged feat PNGs falls back to the registered glyph emblem',()=>withKitDom(()=>{
 const [id]=Object.keys(CREATION_FEAT_ART);
 const node=creationFeatEmblem(id);
 node.querySelector('img').dispatchEvent(new Event('error'));
 assert.equal(node.querySelectorAll('img').length,0);
 assert.ok(!node.classList.contains('cc-native-feat-emblem'));
 assert.ok(node.querySelector('.cc-feat-medallion-trim'));
 assert.equal(node.dataset.feat,id);
}));
