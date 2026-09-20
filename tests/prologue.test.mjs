import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { prologueConfig, prologueRows, prologueCopy, prologueTint, prologueDestination, shouldPlayPrologue, pendingPrologueScene } from '../src/model/prologue.js';
import { advancedConfigExport, parseAdvancedConfigFile, configuredContentBundle } from '../src/model/advancedConfig.js';
import { advancedSubgroups } from '../src/ui/models/AdvancedSettingsGroups.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRegistries } from '../src/model/registries.js';
import { prologueSceneMs, prologueTransitionMs } from '../src/model/prologueTiming.js';
import { prologueArtwork } from '../src/ui/assets.js';

test('opening edits round trip through normal game configuration and keep multiline text',()=>{
  const edits = {'gameConfig.prologue.presentation.shadowStrength':.4,'gameConfig.prologue.presentation.transitionSeconds':12.5,'gameConfig.prologue.scenes.2.text':'Ash — 灰\n<still breathing>','gameConfig.prologue.classes.herald.line':'My words.','gameConfig.prologue.labels.setForth':'Go','gameConfig.prologue.scenes.4.actor.mobile.height':36};
  const imported = parseAdvancedConfigFile(advancedConfigExport(edits),contentBundle);
  assert.deepEqual(imported,edits);
  const config=prologueConfig(imported);
  assert.equal(config.presentation.transitionSeconds,12.5);
  assert.equal(config.presentation.shadowStrength,.4);
  assert.equal(config.scenes[2].text,edits['gameConfig.prologue.scenes.2.text']);
  assert.equal(prologueCopy(config.scenes[3],config,{classId:'herald'}).text,'My words.');
  assert.equal(prologueCopy(config.scenes[3],config,{classId:'reaver'}).text,config.classes.reaver.line);
  assert.deepEqual(configuredContentBundle(contentBundle,edits),configuredContentBundle(contentBundle,{}));
});

test('invalid imports are atomic and timing defaults to five seconds',()=>{
  const current={'gameConfig.prologue.scenes.0.text':'Keep me'};
  for (const bad of [-1,31,'5',null]) assert.throws(()=>parseAdvancedConfigFile(advancedConfigExport({'gameConfig.prologue.presentation.transitionSeconds':bad}),contentBundle,current));
  assert.equal(current['gameConfig.prologue.scenes.0.text'],'Keep me');
  assert.equal(prologueConfig().presentation.transitionSeconds,5);
  assert.ok(prologueConfig().scenes.every(scene=>scene.seconds===5));
  assert.throws(()=>parseAdvancedConfigFile(advancedConfigExport({'gameConfig.prologue.scenes.0.text':'a'.repeat(5001)}),contentBundle));
});

test('scene duration includes the fade and remains editable through export/import',()=>{
  const config=prologueConfig();
  assert.equal(config.scenes[0].effect,'push');
  assert.equal(config.scenes[1].name,'The Burning');
  assert.equal(prologueSceneMs(config.scenes[0]),5000);
  assert.equal(prologueTransitionMs(config.scenes[0],config.presentation),1250);
  assert.equal(prologueTransitionMs(config.scenes[0],config.presentation,true),0);
  assert.equal(prologueTransitionMs({...config.scenes[0],effect:'still'},config.presentation),0);
  assert.equal(prologueTransitionMs(config.scenes[0],{transitionSeconds:.2}),200);
  const edits={'gameConfig.prologue.scenes.0.seconds':8,'gameConfig.prologue.scenes.4.seconds':2};
  const restored=prologueConfig(parseAdvancedConfigFile(advancedConfigExport(edits),contentBundle));
  assert.equal(prologueSceneMs(restored.scenes[0]),8000);
  assert.equal(prologueTransitionMs(restored.scenes[4],restored.presentation),500);
});

test('each class memory resolves to a distinct shipped desktop and mobile painting',()=>{
  const config=prologueConfig();
  assert.equal(config.scenes.find(scene=>scene.id==='carry').character,false);
  for(const layout of ['desktop','mobile']) {
    const paintings=[];
    for(const classId of Object.keys(config.classes)) {
      const path=prologueArtwork('carry',layout,{classId});
      assert.ok(path.endsWith(`assets/prologue/carry-${classId}-${layout}.webp`));
      const bytes=readFileSync(new URL(`../assets/prologue/carry-${classId}-${layout}.webp`,import.meta.url));
      assert.equal(bytes.subarray(0,4).toString(),'RIFF');
      assert.equal(bytes.subarray(8,12).toString(),'WEBP');
      paintings.push(bytes.toString('base64'));
    }
    assert.equal(new Set(paintings).size,4);
    assert.notDeepEqual(readFileSync(new URL(`../assets/prologue/road-${layout}.webp`,import.meta.url)),readFileSync(new URL(`../assets/prologue/step-${layout}.webp`,import.meta.url)));
  }
  assert.equal(prologueArtwork('carry','desktop',{classId:'unknown'}),prologueArtwork('carry','desktop',{classId:'reaver'}));
});

test('existing art-studio exports import into the game without accepting art URLs',()=>{
  const preset=JSON.parse(readFileSync(new URL('../art/prologue-2026-09-19/sequence.json',import.meta.url),'utf8'));
  preset.scenes[0].text='My opening';
  preset.scenes[0].url='https://untrusted.example/image';
  const changes=parseAdvancedConfigFile(JSON.stringify(preset),contentBundle);
  assert.equal(prologueConfig(changes).scenes[0].text,'My opening');
  assert.ok(!JSON.stringify(changes).includes('untrusted.example'));
  preset.scenes[1].id=preset.scenes[0].id;
  assert.throws(()=>parseAdvancedConfigFile(JSON.stringify(preset),contentBundle));
});

test('all editable scene, class, and timing fields are grouped and reachable',()=>{
  const rows=prologueRows();
  const groups=advancedSubgroups(rows,'Opening');
  assert.equal(groups.flatMap(g=>g.rows).length,rows.length);
  assert.equal(groups.filter(g=>prologueConfig().scenes.some(s=>s.name===g.label)).length,6);
  assert.equal(rows.filter(r=>r.prologueTopic==='Class dialogue').length,4);
});

test('tint follows the selected motif and destination follows the run',()=>{
  const config=prologueConfig();
  assert.equal(prologueTint(config,{accent:'frost'}),'#7fa8c9');
  config.presentation.tintSource='character';
  assert.equal(prologueTint(config,{accent:'violet'},{tint:'gold'}),'#a06cc8');
  assert.equal(prologueTint(config,{}, {tint:'ember'}),'#c9502e');
  assert.equal(prologueDestination({journey:{anchors:{start:'crownfall'}}}).name,'Crownfall');
  assert.equal(prologueDestination({seatOrder:['marches','weald','reach']}).art,'assets/environments/pale-marches-map.webp');
});

test('opening preference and interrupted-run recovery leave legacy saves alone',()=>{
  assert.ok(shouldPlayPrologue());
  assert.ok(!shouldPlayPrologue({'gameConfig.prologue.presentation.playback':'off'}));
  assert.ok(!shouldPlayPrologue({'gameConfig.prologue.presentation.playback':'once'},true));
  assert.equal(pendingPrologueScene({}),null);
  assert.equal(pendingPrologueScene({prologue:{version:1,status:'pending',scene:99}}),null);
  const registries=createRegistries(contentBundle);
  const run=createRunState({seed:123,classId:'reaver',registries});
  run.prologue={version:1,status:'pending',scene:3};
  assert.equal(pendingPrologueScene(deserializeRun(serializeRun(run))),3);
  run.prologue.status='complete';
  assert.equal(pendingPrologueScene(deserializeRun(serializeRun(run))),null);
});
