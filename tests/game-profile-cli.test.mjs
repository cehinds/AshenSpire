import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';import{tmpdir}from'node:os';import{spawnSync}from'node:child_process';
import {compileGameProfiles,loadGameProfileCatalog} from '../tools/game-config.mjs';
import {resolveGameAuthor} from '../engine/kernel/gameConfig.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cli=(...args)=>spawnSync(process.execPath,['tools/game-config.mjs',...args],{cwd:root,encoding:'utf8'});
test('generated imports and locks exactly match source compilation',()=>{
 const compiled=compileGameProfiles();for(const[path,value]of Object.entries(compiled.outputs))assert.equal(readFileSync(resolve(root,path),'utf8'),value,path);
 assert.equal(cli('check').status,0);
});
test('CLI apply validates before atomic replacement and export labels host requirements',()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'ashen-game-profile-')),input=resolve(dir,'input.json'),output=resolve(dir,'source.json'),exported=resolve(dir,'export.json');
 try{
  writeFileSync(output,'ORIGINAL');writeFileSync(input,JSON.stringify({formatVersion:1,core:'ashen.core@1.0.0',modules:{cards:{typo:1}}}));
  const invalid=cli('apply','--input',input,'--out',output);assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/modules\/cards\/typo/);assert.equal(readFileSync(output,'utf8'),'ORIGINAL');
  const author={formatVersion:1,core:'ashen.core@1.0.0',modules:{cards:{handBase:2}},$comment:'keep author note'};writeFileSync(input,JSON.stringify(author));
  assert.equal(cli('apply','--input',input,'--out',output).status,0);assert.deepEqual(JSON.parse(readFileSync(output)),author);
  assert.equal(cli('export','--input',input,'--out',exported).status,0);const snapshot=JSON.parse(readFileSync(exported));assert.equal(snapshot.modules.cards.handBase,2);assert.equal(snapshot.portability.portable,false);assert.ok(snapshot.lock.runtimeHash);
  assert.notEqual(cli('export','--portable','--input',input,'--out',exported).status,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('runtime source edits change the exact behavior pin independently of game data',()=>{
 const marker=resolve(root,'src/model/__gameProfileRuntimeProbe.js'),before=loadGameProfileCatalog();
 try{writeFileSync(marker,'export const probe = 1;\n',{flag:'wx'});const after=loadGameProfileCatalog();assert.notEqual(after.runtimeHash,before.runtimeHash);}finally{rmSync(marker,{force:true});}
});
test('unresolved pack/class card references fail before a game can start',()=>{
 const {catalog,authors}=compileGameProfiles(),changed=JSON.parse(JSON.stringify(catalog));changed.packs['ashen.core-content@1.0.0'].content.classes[0].specialCardId='missing';
 assert.throws(()=>resolveGameAuthor(authors.core,changed),/unresolved card reference/);
});
