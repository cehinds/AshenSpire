import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveGameProfile,gameModule,gameContent,projectGameCard,applyGameProfileToContent,bindGameProfileRegistries,validateGameProfileSnapshot} from '../src/model/gameProfile.js';
import {gameDigest,canonicalGameJSON,mergeGameSettings} from '../engine/kernel/gameConfig.js';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {validateContent} from '../src/model/validate.js';
const author=modules=>({formatVersion:1,core:'ashen.core@1.0.0',modules});
test('canonical SHA256 matches UTF8 SHA256 and metadata has no gameplay effect',()=>{
 for(const text of ['','abc','A long string '.repeat(100),'✦ 🔥'])assert.equal(gameDigest(text),'sha256:'+createHash('sha256').update(text).digest('hex'));
 assert.equal(resolveGameProfile(author({})).hash,resolveGameProfile({...author({}),$comment:'annotation',modules:{$comment:'group note'}}).hash);
 assert.equal(canonicalGameJSON({z:1,a:2}),' {"a":2,"z":1}'.trim());
});
test('bundle inheritance, explicit off/defaults and deep overrides use one contract',()=>{
 const core=resolveGameProfile('core');assert.equal(gameModule(core,'cards').handBase,4);assert.equal(gameModule(core,'multiplayer'),null);
 const off=resolveGameProfile(author({cards:false}));assert.equal(gameModule(off,'cards'),null);assert.equal(off.foundation.mode,'configured');
 const changed=resolveGameProfile(author({cards:{handBase:2},resources:{include:['sp']}}));assert.equal(changed.modules.cards.handBase,2);assert.equal(changed.modules.cards.turnPolicy,'multiCard');assert.deepEqual(changed.modules.resources.include,['sp']);assert.notEqual(changed.hash,core.hash);
 assert.deepEqual(mergeGameSettings({x:{a:1,b:2},list:[1,2]},{x:{b:7},list:[3]}),{x:{a:1,b:7},list:[3]});
 assert.equal(gameModule({gameProfile:changed},'cards'),changed.modules.cards);
});
test('invalid author shapes and settings fail at exact paths',()=>{
 for(const [value,path]of [[{...author({}),surprise:true},'$/surprise'],[author({typo:true}),'$/modules/typo'],[author({cards:2}),'$/modules/cards'],[author({cards:{handBase:NaN}}),'$/modules/cards/handBase'],[author({cards:{handBase:-1}}),'$/modules/cards/handBase'],[author({cards:{handBase:1.5}}),'$/modules/cards/handBase'],[author({cards:{handbase:4}}),'$/modules/cards/handbase'],[author({resources:{include:['sp','ghost']}}),'$/modules/resources/include'],[author({defenses:{include:['block'],order:['poise']}}),'$/modules/defenses/order'],[{...author({}),core:'ashen.core@latest'},'$/core']])assert.throws(()=>resolveGameProfile(value),e=>e.path===path);
});
test('core class/hand/deck facts are source-owned and immutable per profile',()=>{
 const p=resolveGameProfile('core');assert.deepEqual(gameContent(p,'startingHands'),{reaver:5,starseer:6,rogue:5,herald:5});
 assert.deepEqual(gameContent(p,'classes').map(row=>Object.values(row.attributes).reduce((a,b)=>a+b)),[6,6,6,6]);
 assert.equal(gameContent(p,'starterDeck').shared.reduce((n,row)=>n+row.copies,0)+1,10);
 assert.equal(gameContent(p,'starterDeck').shared.some(row=>row.card==='core.evade'),false);
 assert.deepEqual(gameContent(p,'rests').services,['strategize','smith','levelUp']);assert.equal(gameContent(p,'stats').levelGains.constitution.hp,10);
 assert.throws(()=>{p.modules.cards.handBase=90},TypeError);assert.notEqual(p,resolveGameProfile('core'));assert.equal(resolveGameProfile('core').modules.cards.handBase,4);
});
test('resource-off cards select explicit authored alternatives and retain card identities',()=>{
 const both=resolveGameProfile('core'),none=resolveGameProfile(author({resources:false}));
 const normal=projectGameCard(both,'core.starseerSpecial'),alternate=projectGameCard(none,'core.starseerSpecial');
 assert.deepEqual(normal.resourceCosts,{sp:1,mp:1});assert.deepEqual(alternate.resourceCosts,{sp:0,mp:0});assert.equal(normal.id,alternate.id);assert.deepEqual(normal.effects,alternate.effects);
 assert.equal(projectGameCard(resolveGameProfile(author({cards:false})),'core.strike'),null);
 assert.deepEqual(projectGameCard(both,'core.strike').kindIds,['classification.attack']);
});
test('current remains a cloned legacy bundle; configured projection passes real validation',()=>{
 const core=resolveGameProfile('core'),legacy=applyGameProfileToContent(contentBundle,'current');assert.notEqual(legacy,contentBundle);assert.notEqual(legacy.cards,contentBundle.cards);assert.equal(legacy.cards.length,contentBundle.cards.length);
 const before=contentBundle.cards.length,projected=applyGameProfileToContent(contentBundle,core);
 assert.equal(contentBundle.cards.length,before);assert.equal(projected.cards.length,before+gameContent(core,'cards').length);
 const result=validateContent(projected);assert.equal(result.ok,true,JSON.stringify(result.errors));
 const reg=bindGameProfileRegistries(createRegistries(projected),core);assert.equal(reg.cards.get('core.strike').name,'Strike');assert.equal(reg.gameProfile.hash,core.hash);
});
test('snapshots validate digests and pinned runtime, with no shared mutable selector',()=>{
 const original=resolveGameProfile('core'),copy=JSON.parse(JSON.stringify(original));assert.equal(validateGameProfileSnapshot(copy).hash,original.hash);
 copy.modules.cards.handBase=20;assert.throws(()=>validateGameProfileSnapshot(copy),/digest mismatch/);
 const stale=JSON.parse(JSON.stringify(original));stale.lock.runtimeHash='sha256:unsupported';delete stale.hash;stale.hash=gameDigest(stale);assert.throws(()=>validateGameProfileSnapshot(stale),/unsupported runtime artifact/);
 assert.equal(resolveGameProfile('current').foundation.mode,'legacy');assert.equal(original.foundation.mode,'configured');
});
