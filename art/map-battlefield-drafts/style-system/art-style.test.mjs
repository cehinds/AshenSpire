import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {loadStyleLibrary,checkStyleAsset,validateArtCatalog,validateStyleLibrary} from './art-style.mjs';
import {repo,profile} from './build-library.mjs';
const library=loadStyleLibrary();
const absolute=i=>path.resolve(repo,i.asset);
const active=role=>library.items.find(i=>i.profileId===role&&i.review.verdict==='approved');
test('every retained source is reviewed or explicitly excluded, with hashes and valid replacements',()=>{
 assert.deepEqual(validateStyleLibrary(library),[]);
 assert.equal(library.items.filter(i=>i.review.verdict==='approved').length,231);
 for(const role of ['map-icon','battlefield-ground','battlefield-prop','battlefield-backdrop','color-filter','weather-field','weather-particles','weather-lightning'])assert.ok(active(role),role);
});
test('unapproved historical assets cannot substitute for their corrected equivalents',()=>{
 for(const item of library.items.filter(i=>i.review.verdict==='replace')){
  assert.match(checkStyleAsset(library,absolute(item),[item.profileId]).join('\n'),/unapproved style source/);
  const replacement=library.items.find(i=>i.assetKey===item.replacedBy);
  assert.deepEqual(checkStyleAsset(library,absolute(replacement),[item.profileId]),[]);
 }
});
test('a matching family cannot put map miniatures into a battlefield prop slot',()=>{
 assert.match(checkStyleAsset(library,absolute(active('map-icon')),['battlefield-prop']).join('\n'),/art role mismatch/);
 assert.match(checkStyleAsset(library,path.resolve(repo,'missing.png'),['battlefield-prop']).join('\n'),/unindexed art/);
});
test('catalog metadata and all animation frames must match reviewed source roles',()=>{
 const lightning=active('weather-lightning');
 const catalog={id:'weather',items:[{id:'lightning',asset:lightning.asset,styleFamilyId:lightning.styleFamilyId,styleProfileId:lightning.profileId,animation:{frames:[lightning.asset]}}]};
 assert.deepEqual(validateArtCatalog(catalog,repo,{library}),[]);
 catalog.items[0].animation.frames=[active('map-icon').asset];
 assert.match(validateArtCatalog(catalog,repo,{library}).join('\n'),/art role mismatch/);
 catalog.items[0].styleFamilyId='unrelated';
 assert.match(validateArtCatalog(catalog,repo,{library}).join('\n'),/mismatched art style family/);
});
test('newly pending sources and altered manifests cannot inherit an earlier visual approval',()=>{
 const changed=structuredClone(library);changed.items.find(i=>i.review.verdict==='approved').sha256='0'.repeat(64);
 assert.match(validateStyleLibrary(changed).join('\n'),/source hash mismatch/);
 const pending=structuredClone(library);pending.items.find(i=>i.review.verdict==='approved').review.verdict='pending';
 assert.match(validateStyleLibrary(pending).join('\n'),/missing completed visual review/);
});

test('folder names do not change the role of castle-grounds sources',()=>{
 for(const [file,role]of [['castle-grounds/backdrop.png','battlefield-backdrop'],['castle-grounds/prop-left.png','battlefield-prop'],['castle-grounds/ground.png','battlefield-ground'],['particles/rain.png','weather-particles']])assert.equal(profile({file}),role);
});
