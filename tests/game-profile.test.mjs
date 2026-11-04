import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadGameProfileCatalog,collectMechanicsRuntimeArtifacts,MECHANIC_RUNTIME_PATH} from '../tools/game-config.mjs';
import {resolveGameProfile,gameModule,gameContent,projectGameCard,applyGameProfileToContent,bindGameProfileRegistries,validateGameProfileSnapshot} from '../src/model/gameProfile.js';
import {gameDigest,canonicalGameJSON,mergeGameSettings} from '../engine/kernel/gameConfig.js';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {validateContent} from '../src/model/validate.js';
const author=modules=>({formatVersion:1,core:'ashen.core@1.0.0',modules});
test('core class/hand/deck facts are source-owned and immutable per profile',()=>{
 const p=resolveGameProfile('core');assert.deepEqual(gameContent(p,'startingHands'),{reaver:5,starseer:6,rogue:5,herald:5});
 assert.deepEqual(gameContent(p,'classes').map(row=>Object.values(row.attributes).reduce((a,b)=>a+b)),[6,6,6,6]);
 assert.equal(gameContent(p,'starterDeck').shared.reduce((n,row)=>n+row.copies,0)+1,10);
 assert.equal(gameContent(p,'starterDeck').shared.some(row=>row.card==='core.evade'),false);
 assert.deepEqual(gameContent(p,'rests').services,['smith','levelUp','upgradeCard']);assert.equal(gameContent(p,'rests').servicesPerVisit,'all');assert.equal(gameContent(p,'stats').levelGains.constitution.hp,10);
 assert.throws(()=>{p.modules.cards.handBase=90},TypeError);assert.notEqual(p,resolveGameProfile('core'));assert.equal(resolveGameProfile('core').modules.cards.handBase,4);
});



const repo=fileURLToPath(new URL('..',import.meta.url));
test('run pin includes the engine and canonical mechanic runtime while excluding unrelated source and docs',()=>{
 const catalog=loadGameProfileCatalog();
 assert.equal('runtimeSources' in catalog,false);
 assert.equal(catalog.runtimeArtifacts.some(a=>a.id==='ashen.source-runtime'),false);
 const kernel=catalog.runtimeArtifacts.filter(a=>a.id==='ashen.kernel-runtime');assert.equal(kernel.length,1);
 assert.equal(kernel[0].version,'1.0.0');assert.equal(kernel[0].path,'engine/{kernel,runtime}/** (no *.md) + engine/contracts/game-profile.json');
 assert.equal(catalog.runtimeArtifacts.some(a=>a.path.startsWith('src/')),false);
 const walk=dir=>readdirSync(repo+dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
 const files=[...['engine/kernel','engine/runtime'].flatMap(walk).filter(f=>!f.endsWith('.md')),'engine/contracts/game-profile.json'];
 assert.ok(files.length>=5);assert.equal(files.some(f=>f.startsWith('src/')||f.endsWith('.md')),false);
 const entries=files.map(path=>{const text=readFileSync(repo+path,'utf8');return {path,id:'ashen.kernel-runtime',version:'1.0.0',hash:gameDigest(path.endsWith('.json')?canonicalGameJSON(JSON.parse(text)):text)};});
 assert.equal(kernel[0].hash,gameDigest(entries));
 const mechanics=catalog.runtimeArtifacts.filter(a=>a.id==='ashen.mechanics-runtime');assert.equal(mechanics.length,1);
 assert.equal(mechanics[0].path,MECHANIC_RUNTIME_PATH);assert.equal(mechanics[0].hash,gameDigest(collectMechanicsRuntimeArtifacts()));
 assert.equal(catalog.runtimeHash,gameDigest(catalog.runtimeArtifacts));
});
test('resumeRun turns a failed profile bind into a refusal instead of a throw',()=>{
 const source=readFileSync(repo+'src/main.js','utf8'),start=source.indexOf('function resumeRun(');assert.ok(start>=0);
 const next=source.indexOf('\nfunction ',start+1),body=source.slice(start,next<0?undefined:next);
 const binds=body.split('bindGameProfileRegistries(').length-1;assert.ok(binds>=1);
 const guarded=[...body.matchAll(/try\s*\{[^{}]*bindGameProfileRegistries\([^{}]*\}\s*catch\s*\((\w+)\)\s*\{\s*return refuseWith\(\1\);/g)].length;
 assert.equal(guarded,binds,'every bindGameProfileRegistries call in resumeRun sits in try/catch that hands the error to refuseWith');
 // refuseWith lands the refusal first, then says why where the player can see it: the Settings
 // notice when its host is mounted, else the title failure banner (the run-start idiom).
 const helper=body.match(/const refuseWith = error => \{[\s\S]*?\n  \};/);assert.ok(helper,'refuseWith helper present');
 assert.ok(/const landed = refused\(\);[\s\S]*if \(!showSettingsNotice\([\s\S]*failureBanner\(/.test(helper[0]),'refuseWith refuses, then notice-or-banner');
});
