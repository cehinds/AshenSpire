import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,cpSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{tmpdir}from'node:os';import{spawnSync}from'node:child_process';
import {compileGameProfiles,loadGameProfileCatalog} from '../tools/game-config.mjs';
import {resolveGameAuthor} from '../engine/kernel/gameConfig.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cli=(...args)=>spawnSync(process.execPath,['tools/game-config.mjs',...args],{cwd:root,encoding:'utf8'});
function selectedCoreContent(catalog, author) {
 const pack=catalog.bundles[author.core].manifest.packs.find(row=>row.id==='ashen.core-content');
 return catalog.packs[`${pack.id}@${pack.version}`].content;
}
test('generated imports and locks exactly match source compilation',()=>{
 const compiled=compileGameProfiles();for(const[path,value]of Object.entries(compiled.outputs))assert.equal(readFileSync(resolve(root,path),'utf8'),value,path);
 assert.equal(cli('check').status,0);
});
test('kernel/runtime edits change the behavior pin without mutating the shared repository',async t=>{
 const repositoryHash=loadGameProfileCatalog().runtimeHash;
 const fixtureRoot=mkdtempSync(resolve(tmpdir(),'ashen-game-profile-isolated-'));
 t.after(()=>rmSync(fixtureRoot,{recursive:true,force:true}));
 // The loader derives ROOT from its module location. Importing a copied loader
 // exercises the real compiler without adding writable roots to production APIs.
 for(const file of ['src','engine','games/ashenspire','content/source','tools/game-config.mjs','tools/base-cards.mjs','tools/catalog-json.mjs','tools/lib']) {
  const destination=resolve(fixtureRoot,file);mkdirSync(dirname(destination),{recursive:true});
  cpSync(resolve(root,file),destination,{recursive:true});
 }
 const {loadGameProfileCatalog:loadFixtureCatalog}=await import(pathToFileURL(resolve(fixtureRoot,'tools/game-config.mjs')).href);
 const before=loadFixtureCatalog();
 assert.equal(before.runtimeHash,repositoryHash,'the isolated tree has the production runtime inputs');
 const probe=(file,text,moves)=>{
  const marker=resolve(fixtureRoot,file);
  try {
   writeFileSync(marker,text,{flag:'wx'});
   const after=loadFixtureCatalog();
   (moves?assert.notEqual:assert.equal)(after.runtimeHash,before.runtimeHash,file);
   // Check while the probe exists, not just after cleanup: parallel hash
   // readers of the repository must never observe a candidate mutation.
   assert.equal(existsSync(resolve(root,file)),false,`${file} stays outside the shared repository`);
   assert.equal(loadGameProfileCatalog().runtimeHash,repositoryHash,'the shared runtime pin stays unchanged');
  } finally {rmSync(marker,{force:true});}
 };
 probe('engine/kernel/__gameProfileRuntimeProbe.txt','probe\n',true);
 probe('engine/runtime/__gameProfileRuntimeProbe.json','{}\n',true);
 probe('engine/runtime/__gameProfileRuntimeProbe.md','# doc\n',false);
 probe('engine/contracts/__gameProfileRuntimeProbe.schema.json','{}\n',false);
 probe('src/model/__gameProfileRuntimeProbe.js','export const probe = 1;\n',false);
});
test('unresolved pack/class card references fail before a game can start',()=>{
 const {catalog,authors}=compileGameProfiles(),changed=JSON.parse(JSON.stringify(catalog));selectedCoreContent(changed,authors.core).characters.find(c=>c.tags.includes('character.player')).player.specialCardId='missing';
 assert.throws(()=>resolveGameAuthor(authors.core,changed),/unresolved card reference/);
});

test('pack policies supply bundle defaults rather than being shadowed by generic defaults',()=>{
 const {catalog,authors}=compileGameProfiles(),changed=JSON.parse(JSON.stringify(catalog));selectedCoreContent(changed,authors.core).routes.acts=2;
 const profile=resolveGameAuthor(authors.core,changed);assert.equal(profile.modules.routes.acts,2);assert.equal(profile.content.routes.acts,2);
});
