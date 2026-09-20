import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { prologueConfig, prologueRows, prologueCopy, prologueTint, prologueDestination, shouldPlayPrologue, pendingPrologueScene, migratePrologueState, PROLOGUE_STATE_VERSION, PROLOGUE_V1_SCENE_IDS, PROLOGUE_DEFAULTS } from '../src/model/prologue.js';
import { advancedConfigExport, parseAdvancedConfigFile, configuredContentBundle } from '../src/model/advancedConfig.js';
import { advancedSubgroups } from '../src/ui/models/AdvancedSettingsGroups.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRegistries } from '../src/model/registries.js';
import { prologueSceneMs, prologueTransitionMs } from '../src/model/prologueTiming.js';
import { prologueArtwork } from '../src/ui/assets.js';

test('opening edits round trip through normal game configuration and keep multiline text',()=>{
  const edits = {'gameConfig.prologue.presentation.shadowStrength':.4,'gameConfig.prologue.presentation.transitionSeconds':12.5,'gameConfig.prologue.scenes.night.text':'Ash — 灰\n<still breathing>','gameConfig.prologue.classes.herald.line':'My words.','gameConfig.prologue.labels.setForth':'Go','gameConfig.prologue.scenes.carry.actor.mobile.height':36};
  const imported = parseAdvancedConfigFile(advancedConfigExport(edits),contentBundle);
  assert.deepEqual(imported,edits);
  const config=prologueConfig(imported);
  assert.equal(config.presentation.transitionSeconds,12.5);
  assert.equal(config.presentation.shadowStrength,.4);
  assert.equal(config.scenes[3].text,edits['gameConfig.prologue.scenes.night.text']);
  assert.equal(prologueCopy(config.scenes[2],config,{classId:'herald'}).text,'My words.');
  assert.equal(prologueCopy(config.scenes[2],config,{classId:'reaver'}).text,config.classes.reaver.line);
  assert.deepEqual(configuredContentBundle(contentBundle,edits),configuredContentBundle(contentBundle,{}));
});

test('invalid imports are atomic and timing defaults to five seconds',()=>{
  const current={'gameConfig.prologue.scenes.warmth.text':'Keep me'};
  for (const bad of [-1,31,'5',null]) assert.throws(()=>parseAdvancedConfigFile(advancedConfigExport({'gameConfig.prologue.presentation.transitionSeconds':bad}),contentBundle,current));
  assert.equal(current['gameConfig.prologue.scenes.warmth.text'],'Keep me');
  assert.equal(prologueConfig().presentation.transitionSeconds,5);
  assert.ok(prologueConfig().scenes.every(scene=>scene.seconds===5));
  assert.throws(()=>parseAdvancedConfigFile(advancedConfigExport({'gameConfig.prologue.scenes.warmth.text':'a'.repeat(5001)}),contentBundle));
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
  const edits={'gameConfig.prologue.scenes.warmth.seconds':8,'gameConfig.prologue.scenes.night.seconds':2};
  const restored=prologueConfig(parseAdvancedConfigFile(advancedConfigExport(edits),contentBundle));
  assert.equal(prologueSceneMs(restored.scenes[0]),8000);
  assert.equal(prologueTransitionMs(restored.scenes[3],restored.presentation),500);
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
  assert.equal(groups.filter(g=>prologueConfig().scenes.some(s=>s.name===g.label)).length,5);
  assert.equal(rows.filter(r=>r.prologueTopic==='Class dialogue').length,4);
});

test('tint follows the selected motif and destination follows the run',()=>{
  const config=prologueConfig();
  assert.equal(prologueTint(config,{accent:'frost'}),'#7fa8c9');
  config.presentation.tintSource='character';
  assert.equal(prologueTint(config,{accent:'violet'},{tint:'gold'}),'#a06cc8');
  assert.equal(prologueTint(config,{}, {tint:'ember'}),'#c9502e');
  assert.equal(prologueDestination({journey:{anchors:{start:'crownfall'}}}).name,'Crownfall');
  // The NAME is all the opening reads (prologue.js resolves {location} with it).
  // The destination painting is gone with the scene that swapped artwork for it.
  assert.equal(prologueDestination({seatOrder:['marches','weald','reach']}).name,'The Pale Marches');
  assert.ok(!('art' in prologueDestination({seatOrder:['marches']})),'no dead painting branch');
});

test('opening preference and interrupted-run recovery leave legacy saves alone',()=>{
  assert.ok(shouldPlayPrologue());
  assert.ok(!shouldPlayPrologue({'gameConfig.prologue.presentation.playback':'off'}));
  assert.ok(!shouldPlayPrologue({'gameConfig.prologue.presentation.playback':'once'},true));
  assert.equal(pendingPrologueScene({}),null);
  assert.equal(pendingPrologueScene({prologue:{version:PROLOGUE_STATE_VERSION,status:'pending',scene:99}}),null);
  // A version-1 index is an index into a DIFFERENT order; only the current
  // version is read, and the migration below is what makes an old save legible.
  assert.equal(pendingPrologueScene({prologue:{version:1,status:'pending',scene:3}}),null);
  const registries=createRegistries(contentBundle);
  const run=createRunState({seed:123,classId:'reaver',registries});
  run.prologue={version:PROLOGUE_STATE_VERSION,status:'pending',scene:3};
  assert.equal(pendingPrologueScene(deserializeRun(serializeRun(run))),3);
  run.prologue.status='complete';
  assert.equal(pendingPrologueScene(deserializeRun(serializeRun(run))),null);
});

// ---- the six-scene → five-scene migration ----------------------------------
//
// The opening was warmth, year, night, carry, road, step. It is now warmth,
// year, carry, night, step: two scenes SWAPPED and one was CUT, so no offset
// describes the move and the index alone is not enough to place a save.
//
// Left unmigrated, a save parked on the old final scene (5) failed the
// five-scene bounds check, `pendingPrologueScene` answered null, and the loader
// fell through to the map — the opening skipped on every load while `status`
// stayed 'pending' forever. Saves at old 2 and 3 resumed on the WRONG scene.
test('every version-1 opening index migrates to the scene it named, by id',()=>{
  const ids=PROLOGUE_DEFAULTS.scenes.map(scene=>scene.id);
  assert.deepEqual(ids,['warmth','year','carry','night','step']);
  assert.deepEqual(PROLOGUE_V1_SCENE_IDS,['warmth','year','night','carry','road','step']);
  // old index → the scene id it must resume on. `road` is gone; a run stopped
  // there had not yet seen what followed it, so it resumes on that scene.
  const expected={0:'warmth',1:'year',2:'night',3:'carry',4:'step',5:'step'};
  for (const [oldIndex,sceneId] of Object.entries(expected)) {
    const run=migratePrologueState({prologue:{version:1,status:'pending',scene:Number(oldIndex)}});
    assert.equal(run.prologue.version,PROLOGUE_STATE_VERSION,`old ${oldIndex} is re-stamped`);
    assert.equal(ids[run.prologue.scene],sceneId,`old ${oldIndex} (${PROLOGUE_V1_SCENE_IDS[oldIndex]}) resumes on ${sceneId}`);
    // and the loader can now see it, instead of skipping the opening forever
    assert.equal(pendingPrologueScene(run),run.prologue.scene);
    assert.ok(PROLOGUE_DEFAULTS.scenes[run.prologue.scene],'never points past the sequence');
  }
  // The two the old arithmetic got wrong, named outright.
  assert.equal(migratePrologueState({prologue:{version:1,status:'pending',scene:2}}).prologue.scene,3);
  assert.equal(migratePrologueState({prologue:{version:1,status:'pending',scene:3}}).prologue.scene,2);
  assert.equal(migratePrologueState({prologue:{version:1,status:'pending',scene:5}}).prologue.scene,4);
});

test('the migration keeps the rest of the state, is idempotent, and leaves other runs alone',()=>{
  const finished=migratePrologueState({prologue:{version:1,status:'complete',scene:5,reason:'setForth'}});
  assert.equal(finished.prologue.status,'complete');
  assert.equal(finished.prologue.reason,'setForth');
  assert.equal(pendingPrologueScene(finished),null,'a finished opening stays finished');
  const once=migratePrologueState({prologue:{version:1,status:'pending',scene:2}});
  assert.deepEqual(migratePrologueState(structuredClone(once)).prologue,once.prologue,'running twice changes nothing');
  // A run with no opening state, and a legacy save without one, are untouched.
  assert.deepEqual(migratePrologueState({}),{});
  assert.equal(pendingPrologueScene(migratePrologueState({})),null);
  const current={prologue:{version:PROLOGUE_STATE_VERSION,status:'pending',scene:3}};
  assert.deepEqual(migratePrologueState(structuredClone(current)),current);
});

test('a migrated version-1 save survives the save round trip and resumes there',()=>{
  const registries=createRegistries(contentBundle);
  const run=createRunState({seed:123,classId:'reaver',registries});
  run.prologue={version:1,status:'pending',scene:5};           // old final scene: 'step'
  assert.equal(pendingPrologueScene(deserializeRun(serializeRun(run))),null,'unmigrated, the opening is skipped');
  migratePrologueState(run);
  const reloaded=deserializeRun(serializeRun(run));
  assert.equal(reloaded.prologue.version,PROLOGUE_STATE_VERSION);
  assert.equal(pendingPrologueScene(reloaded),PROLOGUE_DEFAULTS.scenes.findIndex(scene=>scene.id==='step'));
});

// ---- the six-scene → five-scene SETTINGS migration -------------------------
//
// Separate from the run-state migration above: this is `gameConfig.prologue.
// scenes.N.*` in his profile and in the configuration file he exports. Those
// keys were POSITIONAL, so the reorder silently reattached his writing to a
// different scene, and the cut scene's keys resolved to no row at all — which,
// in an all-or-nothing import, refused every OTHER setting in the file with it.
test('a configuration exported before the reorder imports, and lands on the scene it was written for', () => {
  const before = {
    'gameConfig.prologue.scenes.0.text': 'Warmth',   // warmth, unmoved
    'gameConfig.prologue.scenes.2.text': 'Last night', // night: was 2, is now 3
    'gameConfig.prologue.scenes.3.text': 'Carry',      // carry: was 3, is now 2
    'gameConfig.prologue.scenes.3.actor.desktop.x': 42, // and carry's actor row still exists
    'gameConfig.prologue.scenes.5.text': 'The last step', // the old FINAL scene
    'gameConfig.prologue.presentation.previewScene': 'road', // a scene that is gone
  };
  const changes = parseAdvancedConfigFile(
    JSON.stringify({schemaVersion:1, game:'Ashen Spire', overrides:before}), contentBundle);
  const config = prologueConfig(changes);
  const scene = id => config.scenes.find(s => s.id === id);
  assert.equal(scene('warmth').text,'Warmth');
  assert.equal(scene('night').text,'Last night','old index 2 was night, and stays night');
  assert.equal(scene('carry').text,'Carry','old index 3 was carry, and stays carry');
  assert.equal(scene('carry').actor.desktop.x,42);
  assert.equal(scene('step').text,'The last step','the old final scene is not dropped');
  assert.equal(config.presentation.previewScene,'step','a preview pointed at the cut scene opens on its heir');
  // The keys are now named, so they cannot drift again.
  assert.ok(Object.keys(changes).every(key => !/\.scenes\.\d/.test(key)), 'no positional scene key survives');
});

test('the cut scene yields to the scene that inherited its keys, and never overwrites it', () => {
  const parse = overrides => parseAdvancedConfigFile(
    JSON.stringify({schemaVersion:1, game:'Ashen Spire', overrides}), contentBundle);
  // road (4) and step (5) both land on `step`. The scene that still exists wins.
  assert.equal(parse({'gameConfig.prologue.scenes.4.text':'Road','gameConfig.prologue.scenes.5.text':'Step'})['gameConfig.prologue.scenes.step.text'],'Step');
  // With no step of its own, road's line is kept rather than thrown away.
  assert.equal(parse({'gameConfig.prologue.scenes.4.text':'Road'})['gameConfig.prologue.scenes.step.text'],'Road');
  // A profile never rewritten is still READ under the old name.
  assert.equal(prologueConfig({'gameConfig.prologue.scenes.2.text':'Last night'}).scenes.find(s=>s.id==='night').text,'Last night');
});

test('a raised row floor costs that row, not the whole file', () => {
  const warnings = [];
  const changes = parseAdvancedConfigFile(JSON.stringify({schemaVersion:1, game:'Ashen Spire', overrides:{
    'gameConfig.startingStats.tuned2.total': 8,          // floor was the attribute count, is now 12
    'gameConfig.prologue.scenes.5.text': 'Still imported',
  }}), contentBundle, {}, [], warnings);
  assert.equal(changes['gameConfig.startingStats.tuned2.total'],12,'clamped to the floor, not refused');
  assert.equal(changes['gameConfig.prologue.scenes.step.text'],'Still imported','the rest of the file landed');
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/8 is below the 12 this version requires and was raised to 12/);

  // A class cell below its kit floor skips that CLASS's table — raising one
  // cell would break the set's total — and says so, while everything else lands.
  const more = [];
  const kept = parseAdvancedConfigFile(JSON.stringify({schemaVersion:1, game:'Ashen Spire', overrides:{
    'gameConfig.attributeRules.presets.tuned2.starseer.intelligence': 2,
    'gameConfig.attributeRules.presets.tuned2.starseer.strength': 14,
    'gameConfig.prologue.scenes.0.text': 'Still imported',
  }}), contentBundle, {}, [], more);
  assert.deepEqual(Object.keys(kept),['gameConfig.prologue.scenes.warmth.text']);
  assert.equal(more.length,1);
  assert.match(more[0],/Starseer — Intelligence: 2 is below the 8 this class's starting kit asks for/);
  assert.match(more[0],/Everything else in the file was imported/);
});
