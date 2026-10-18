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
  writeFileSync(output,'ORIGINAL');writeFileSync(input,'');assert.notEqual(cli('validate','--input',input).status,0);writeFileSync(input,JSON.stringify({formatVersion:1,core:'ashen.core@1.0.0',modules:{cards:{typo:1}}}));
  const invalid=cli('apply','--input',input,'--out',output);assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/modules\/cards\/typo/);assert.equal(readFileSync(output,'utf8'),'ORIGINAL');
  const author={formatVersion:1,core:'ashen.core@1.0.0',modules:{cards:{handBase:2}},$comment:'keep author note'};writeFileSync(input,JSON.stringify(author));
  assert.equal(cli('apply','--input',input,'--out',output).status,0);assert.deepEqual(JSON.parse(readFileSync(output)),author);
  assert.equal(cli('export','--input',input,'--out',exported).status,0);const snapshot=JSON.parse(readFileSync(exported));assert.equal(snapshot.modules.cards.handBase,2);assert.equal(snapshot.portability.portable,false);assert.ok(snapshot.lock.runtimeHash);
  assert.notEqual(cli('export','--portable','--input',input,'--out',exported).status,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('kernel/runtime edits change the behavior pin; docs, other contracts and unrelated src edits do not',()=>{
 const before=loadGameProfileCatalog();
 const probe=(file,text,moves)=>{const marker=resolve(root,file);try{writeFileSync(marker,text,{flag:'wx'});const after=loadGameProfileCatalog();(moves?assert.notEqual:assert.equal)(after.runtimeHash,before.runtimeHash,file);}finally{rmSync(marker,{force:true});}};
 probe('engine/kernel/__gameProfileRuntimeProbe.txt','probe\n',true);
 probe('engine/runtime/__gameProfileRuntimeProbe.json','{}\n',true);
 probe('engine/runtime/__gameProfileRuntimeProbe.md','# doc\n',false);
 probe('engine/contracts/__gameProfileRuntimeProbe.schema.json','{}\n',false);
 probe('src/model/__gameProfileRuntimeProbe.js','export const probe = 1;\n',false);
});
test('unresolved pack/class card references fail before a game can start',()=>{
 const {catalog,authors}=compileGameProfiles(),changed=JSON.parse(JSON.stringify(catalog));changed.packs['ashen.core-content@1.0.0'].content.characters.find(c=>c.tags.includes('character.player')).player.specialCardId='missing';
 assert.throws(()=>resolveGameAuthor(authors.core,changed),/unresolved card reference/);
});

test('pack policies supply bundle defaults rather than being shadowed by generic defaults',()=>{
 const {catalog,authors}=compileGameProfiles(),changed=JSON.parse(JSON.stringify(catalog));changed.packs['ashen.core-content@1.0.0'].content.routes.acts=2;
 const profile=resolveGameAuthor(authors.core,changed);assert.equal(profile.modules.routes.acts,2);assert.equal(profile.content.routes.acts,2);
});
