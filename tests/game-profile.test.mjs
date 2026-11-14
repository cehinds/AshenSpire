import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import { gunzipSync } from 'node:zlib';
import {loadGameProfileCatalog,collectMechanicsRuntimeArtifacts,MECHANIC_RUNTIME_PATH} from '../tools/game-config.mjs';
import {resolveGameProfile,gameModule,gameContent,projectGameCard,applyGameProfileToContent,bindGameProfileRegistries,validateGameProfileSnapshot} from '../src/model/gameProfile.js';
import {gameDigest,canonicalGameJSON,mergeGameSettings} from '../engine/kernel/gameConfig.js';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {validateContent} from '../src/model/validate.js';
import { createMemoryStorage, createSaveManager, runKey } from '../src/engine/save.js';
import { LoadSavedRunContext } from '../src/engine/savedRunContext.js';
import { createRunState } from '../src/model/state.js';
const author=modules=>({formatVersion:1,core:'ashen.core@1.0.0',modules});
test('core class/hand/deck facts are source-owned and immutable per profile',()=>{
 const p=resolveGameProfile('core');assert.deepEqual(gameContent(p,'startingHands'),{reaver:5,starseer:6,rogue:5,herald:5});
 assert.deepEqual(gameContent(p,'classes').map(row=>Object.values(row.attributes).reduce((a,b)=>a+b)),[6,6,6,6]);
 assert.equal(gameContent(p,'starterDeck').shared.reduce((n,row)=>n+row.copies,0)+1,10);
 assert.equal(gameContent(p,'starterDeck').shared.some(row=>row.card==='core.evade'),false);
 assert.deepEqual(gameContent(p,'rests').services,['rest','smith','upgradeCard']);assert.equal(gameContent(p,'rests').servicesPerVisit,1);assert.equal(gameContent(p,'stats').levelGains.constitution.hp,10);
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
test('actual Continue lands a failed saved-context load before presenting its error', () => {
  const source = readFileSync(repo + 'src/main.js', 'utf8');
  const start = source.indexOf('function resumeRun(');
  const end = source.indexOf('function resumeTerminal(', start);
  assert.ok(start >= 0 && end > start);
  const events = [];
  const fixture = new Function('LoadSavedRunContext', 'events', `
    let terminalResume = null;
    const saves = {};
    const original = {}, originalProfile = {};
    let registries = original, registryGameProfile = originalProfile;
    const refusedRunLanding = slot => events.push(['refused', slot]);
    const dlog = () => {};
    const showSettingsNotice = (message, panel) => { events.push(['notice', message, panel]); return false; };
    const failureBanner = (id, title, message) => events.push(['banner', id, title, message]);
    ${source.slice(start, end)}
    return { resumeRun, unchanged: () => registries === original && registryGameProfile === originalProfile };
  `)(() => { throw new Error('invalid saved pin'); }, events);
  fixture.resumeRun(2);
  assert.ok(fixture.unchanged());
  assert.deepEqual(events, [
    ['refused', 2],
    ['notice', 'Saved game configuration could not be restored: invalid saved pin', 'profile'],
    ['banner', 'run:resume:invalid saved pin', 'THIS SAVE COULD NOT BE RESTORED', ' · invalid saved pin'],
  ]);
});

test('saved Core2 context matches the previous two-pass load for current and historical pins', () => {
  const fixture = readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url));
  const old = validateGameProfileSnapshot(JSON.parse(gunzipSync(fixture)));
  const registry = profile => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  for (const profile of [resolveGameProfile('default'), old]) {
    const storage = createMemoryStorage();
    const manager = createSaveManager(storage);
    const run = createRunState({ seed: 511, classId: 'reaver', registries: registry(profile) });
    const overrides = { 'gameConfig.prologue.sceneCount': 2, 'gameConfig.balance.xp.kill.normal': 99 };
    run.advancedConfigSnapshot = { ...run.advancedConfigSnapshot, overrides };
    manager.saveRun(run);
    const original = storage.getItem(runKey());

    const savedProfile = manager.peekRunGameProfile(1);
    const first = manager.loadRun(registry(savedProfile), 1);
    assert.ok(first, manager.runStatus().reason);
    const previousRegistries = registry(savedProfile);
    const previous = manager.loadRun(previousRegistries, 1);
    assert.ok(previous, manager.runStatus().reason);

    let seenConfiguration;
    const context = LoadSavedRunContext(manager, 1, {
      validate(pin, configuration, authored) {
        assert.equal(pin.hash, savedProfile.hash);
        seenConfiguration = configuration;
        return validateContent(authored);
      },
    });
    assert.deepEqual(context.run, previous);
    assert.deepEqual(context.configuration, first.advancedConfigSnapshot);
    assert.deepEqual(seenConfiguration.overrides, overrides);
    assert.deepEqual(context.registries.balance, previousRegistries.balance);
    assert.equal(context.gameProfile.hash, savedProfile.hash);
    assert.equal(storage.getItem(runKey()), original);
  }
});
