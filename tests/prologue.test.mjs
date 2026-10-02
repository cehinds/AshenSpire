import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { prologueConfig, prologueRows, prologueCopy, prologueTint, prologueDestination, prologueSequence, prologueResumePosition, prologueSceneArt, prologueScenePreset, prologueBoxBackground, PROLOGUE_PREFIX, shouldPlayPrologue, pendingPrologueScene, migratePrologueState, PROLOGUE_STATE_VERSION, PROLOGUE_V1_SCENE_IDS, PROLOGUE_DEFAULTS, PROLOGUE_ART_IDS, PROLOGUE_LAYOUTS, PROLOGUE_TEXT_POSITIONS, PROLOGUE_SLOT_IDS, PROLOGUE_STAGE_FIELDS, prologueStaging, prologueFreeSlot, prologueSceneCopy, prologueSceneClear, prologueReorderChanges, prologueSlotPayload, prologueSlotChanges, prologueStagedOrder, PROLOGUE_MUSIC } from '../src/model/prologue.js';
import { advancedConfigExport, parseAdvancedConfigFile, configuredContentBundle } from '../src/model/advancedConfig.js';
import { advancedSubgroups } from '../src/ui/models/AdvancedSettingsGroups.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRegistries } from '../src/model/registries.js';
import { prologueSceneMs, prologueTransitionMs } from '../src/model/prologueTiming.js';
import { prologueArtwork } from '../src/ui/assets.js';
import { BEDS } from '../src/content/music.js';
import * as prologueModule from '../src/model/prologue.js';
import { settingsRowHtml } from '../src/ui/screens/settings.js';
import {placePrologueCharacter, paintPrologueCharacter, prologueCharacterDimensions, CHARACTER_LAYER_HEIGHT, prologueTravellerGeometry, prologueTravellerHeightForWidth, prologueTravellerResizeScale} from '../src/ui/prologueCharacter.js';

test('rotated traveller bounds enclose the figure while width scaling preserves its intrinsic size', () => {
  const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-8, `${actual} != ${expected}`);
  // A 100x200 figure, 120px side padding and a 64px ground-shadow extension.
  for (const scale of [1, 1.5]) for (const rotation of [0, 45, 90]) {
    const width = 340*scale, height = 264*scale;
    const radians = rotation*Math.PI/180;
    const anchor = {x:500,y:350};
    const point = (x,y) => ({x:anchor.x+(x-170*scale)*Math.cos(radians)-(y-200*scale)*Math.sin(radians),
      y:anchor.y+(x-170*scale)*Math.sin(radians)+(y-200*scale)*Math.cos(radians)});
    const canvasCorners = [[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>point(x,y));
    const figureCorners = [[120*scale,0],[220*scale,0],[120*scale,200*scale],[220*scale,200*scale]].map(([x,y])=>point(x,y));
    const bounds = {left:Math.min(...canvasCorners.map(p=>p.x)),top:Math.min(...canvasCorners.map(p=>p.y))};
    const geometry = prologueTravellerGeometry({canvasWidth:340,canvasHeight:264,source:{width:100,height:200,padding:120},renderedWidth:width,renderedHeight:height,rotation,bounds});
    near(geometry.anchor.x,anchor.x); near(geometry.anchor.y,anchor.y);
    near(geometry.left,Math.min(...figureCorners.map(p=>p.x)));
    near(geometry.top,Math.min(...figureCorners.map(p=>p.y)));
    near(geometry.width,Math.max(...figureCorners.map(p=>p.x))-geometry.left);
    near(geometry.height,Math.max(...figureCorners.map(p=>p.y))-geometry.top);
    near(geometry.intrinsicWidth,100*scale); near(geometry.intrinsicHeight,200*scale);
    assert.equal(prologueTravellerHeightForWidth(40,geometry.intrinsicWidth*1.25,geometry.intrinsicWidth),50);
    // Dragging a visible corner 20% of its box width/height scales by 20%,
    // independent of rotation, while the numeric width above stays intrinsic.
    near(prologueTravellerResizeScale(geometry,geometry.width*.2,0,'se'),1.2);
    near(prologueTravellerResizeScale(geometry,0,geometry.height*.2,'se'),1.2);
    near(prologueTravellerResizeScale(geometry,-geometry.width*.2,-geometry.height*.2,'nw'),1.2);
    near(prologueTravellerResizeScale(geometry,-geometry.width*.2,0,'se'),.8);
    if (rotation===0) { near(geometry.left,bounds.left+120*scale); near(geometry.top,bounds.top); }
  }
  assert.equal(prologueTravellerHeightForWidth(20,1,100),10);
  assert.equal(prologueTravellerHeightForWidth(60,300,100),100);
});

test('rounded shadow canvas retains the actual bundled traveller dimensions on paint and repaint', () => {
  const ctx = new Proxy({}, {get:(_,name)=>name==='createRadialGradient' ? ()=>({addColorStop(){}}) : ()=>{}});
  const canvas = {getContext:()=>ctx};
  paintPrologueCharacter(canvas,{naturalWidth:700,naturalHeight:1088});
  assert.equal(canvas.width,2006);
  assert.equal(canvas.height,1437);
  assert.deepEqual(prologueCharacterDimensions(canvas),{width:700,height:1088,padding:653});
  const near = (actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
  for (const scale of [1,.5,1.5]) for (const rotation of [0,45,90]) {
    const geometry = prologueTravellerGeometry({canvasWidth:canvas.width,canvasHeight:canvas.height,
      source:prologueCharacterDimensions(canvas),renderedWidth:canvas.width*scale,renderedHeight:canvas.height*scale,
      rotation,bounds:{left:100,top:200}});
    near(geometry.intrinsicWidth,700*scale);
    near(geometry.intrinsicHeight,1088*scale);
    if (rotation===0) { near(geometry.left,100+653*scale); near(geometry.height,1088*scale); }
    if (rotation===90) { near(geometry.width,1088*scale); near(geometry.height,700*scale); }
    assert.equal(prologueTravellerHeightForWidth(40,geometry.intrinsicWidth*1.25,geometry.intrinsicWidth),50);
  }
  // Switching art quality repaints the same canvas with a different source.
  paintPrologueCharacter(canvas,{naturalWidth:350,naturalHeight:544});
  assert.deepEqual(prologueCharacterDimensions(canvas),{width:350,height:544,padding:327});
});

test('traveller poses on added scenes round trip and rotate around the ground anchor', () => {
  const key = `${PROLOGUE_PREFIX}scenes.extraA.`;
  const edits = {[key+'character']:true, [key+'actor.desktop.rotation']:17, [key+'actor.desktop.layer']:'front', [key+'actor.mobile.rotation']:-12};
  const config = prologueConfig(parseAdvancedConfigFile(advancedConfigExport(edits),contentBundle));
  const scene = config.scenes.find(scene=>scene.id==='extraA');
  assert.equal(scene.character,true);
  const desktop = {style:{}}, phone = {style:{}};
  placePrologueCharacter(desktop,scene.actor.desktop);
  placePrologueCharacter(phone,scene.actor.mobile);
  assert.match(desktop.style.transform,/rotate\(17deg\)/);
  assert.match(phone.style.transform,/rotate\(-12deg\)/);
  assert.equal(desktop.style.zIndex,'2');
  assert.equal(phone.style.zIndex,'0');
  // The expanded shadow canvas must not shift the traveller's ground anchor.
  const originY = Number.parseFloat(desktop.style.transformOrigin.split(' ')[1])/100;
  const height = Number.parseFloat(desktop.style.height);
  const top = 100-Number.parseFloat(desktop.style.bottom)-height;
  assert.ok(Math.abs(top+height*originY-scene.actor.desktop.y)<1e-9);
  assert.ok(Math.abs(originY-1/CHARACTER_LAYER_HEIGHT)<1e-9);
  for (const invalid of [{[key+'actor.desktop.rotation']:181},{[key+'actor.desktop.layer']:'unreachable'}]) {
    assert.throws(()=>parseAdvancedConfigFile(advancedConfigExport(invalid),contentBundle),/Nothing was imported/);
  }
});

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
  assert.equal(groups.filter(g=>prologueConfig().scenes.some(s=>s.name===g.label)).length,PROLOGUE_DEFAULTS.scenes.length);
  assert.equal(PROLOGUE_DEFAULTS.scenes.length,9,'five shipped scenes and four empty slots');
  assert.equal(rows.filter(r=>r.prologueTopic==='Class dialogue').length,4);
});

test('tint follows the selected motif and destination follows the run',()=>{
  const config=prologueConfig();
  assert.equal(prologueTint(config,{accent:'frost'}),'#7fa8c9');
  config.presentation.tintSource='character';
  assert.equal(prologueTint(config,{accent:'violet'},{tint:'gold'}),'#a06cc8');
  assert.equal(prologueTint(config,{}, {tint:'ember'}),'#c9502e');
  assert.deepEqual(prologueDestination({journey:{anchors:{start:'crownfall'}}}),{name:'Crownfall',art:'crownfall'});
  assert.deepEqual(prologueDestination({seatOrder:['marches','weald','reach']}),{name:'The Pale Marches',art:'marches'});
  assert.equal(prologueDestination({seatOrder:['weald']}).art,'weald');
  assert.equal(prologueDestination({seatOrder:['reach']}).art,'reach');
  const finalScene = PROLOGUE_DEFAULTS.scenes.find(scene => scene.id === 'step');
  assert.equal(finalScene.ownStaging, true, 'the destination scene keeps the distant Spire in frame');
  assert.equal(prologueStaging(prologueConfig(), finalScene).imageFocusY, 0);
  assert.deepEqual([finalScene.actor.desktop.x, finalScene.actor.desktop.y, finalScene.actor.mobile.x, finalScene.actor.mobile.y, finalScene.actor.mobile.height], [50, 96, 40, 96, 40], 'the default traveller stands in the foreground in both layouts');
  assert.equal(prologueConfig({[`${PROLOGUE_PREFIX}scenes.step.actor.mobile.x`]: 62}).scenes.find(scene => scene.id === 'step').actor.mobile.x, 62);
  for (const art of ['weald','marches','reach','crownfall']) {
    for (const layout of ['desktop','mobile']) {
      const path = prologueArtwork('step',layout,{destinationArt:art});
      assert.ok(path.endsWith(`assets/prologue/step-${art}-${layout}.webp`));
      assert.equal(readFileSync(new URL(`../assets/prologue/step-${art}-${layout}.webp`,import.meta.url)).subarray(8,12).toString(),'WEBP');
    }
  }
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
  assert.deepEqual(ids.slice(0,5),['warmth','year','carry','night','step']);
  assert.deepEqual(ids.slice(5),[...PROLOGUE_SLOT_IDS],'the slots sit after the shipped scenes, so no stored index moves');
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
    'gameConfig.startingStats.lean.total': 4,            // floor was the attribute count, is now the kit floor
    'gameConfig.prologue.scenes.5.text': 'Still imported',
  }}), contentBundle, {}, [], warnings);
  assert.equal(changes['gameConfig.startingStats.lean.total'],7,'clamped to the floor, not refused');
  assert.equal(changes['gameConfig.prologue.scenes.step.text'],'Still imported','the rest of the file landed');
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/4 is below the 7 this version requires and was raised to 7/);

  // A class cell below its kit floor skips that CLASS's table — raising one
  // cell would break the set's total — and says so, while everything else lands.
  const more = [];
  const kept = parseAdvancedConfigFile(JSON.stringify({schemaVersion:1, game:'Ashen Spire', overrides:{
    'gameConfig.attributeRules.presets.lean.starseer.intelligence': 2,
    'gameConfig.attributeRules.presets.lean.starseer.strength': 4,
    'gameConfig.prologue.scenes.0.text': 'Still imported',
  }}), contentBundle, {}, [], more);
  assert.deepEqual(Object.keys(kept),['gameConfig.prologue.scenes.warmth.text']);
  assert.equal(more.length,1);
  assert.match(more[0],/Starseer — Intelligence: 2 is below the 3 this class's starting kit asks for/);
  assert.match(more[0],/Everything else in the file was imported/);
});

// ---- the opening as a STAGING, not a fixed film -----------------------------
//
// Order, inclusion, artwork and the frame around the words are settings now.
// The indices never stop meaning what they meant: `config.scenes` stays in
// authored order (a paused run recorded one of those numbers) and the sequence
// is a view over it. These guard that separation, the file that carries it, and
// the CSS the frames are actually drawn by.
test('the opening plays in the configured order, over the configured subset', () => {
  const ids = config => prologueSequence(config).map(index => config.scenes[index].id);
  assert.deepEqual(ids(prologueConfig()), ['warmth','year','carry','night','step'], 'untouched, the authored order stands');
  const reordered = prologueConfig({
    'gameConfig.prologue.scenes.step.order': 1,
    'gameConfig.prologue.scenes.warmth.order': 5,
  });
  assert.deepEqual(ids(reordered), ['step','year','carry','night','warmth']);
  const shortened = prologueConfig({
    'gameConfig.prologue.scenes.year.enabled': false,
    'gameConfig.prologue.scenes.night.enabled': false,
  });
  assert.deepEqual(ids(shortened), ['warmth','carry','step'], 'the number of scenes is the number switched on');
  // Switching every scene off would leave a screen with no scene and no way
  // out of it, so the authored order stands in.
  // And it is the AUTHORED order, not the typed one: every scene in it is
  // switched off, so no running order in that file was chosen to be watched.
  const none = prologueConfig(Object.fromEntries([
    ...PROLOGUE_DEFAULTS.scenes.map(scene => [`gameConfig.prologue.scenes.${scene.id}.enabled`, false]),
    ['gameConfig.prologue.scenes.step.order', 1],
    ['gameConfig.prologue.scenes.warmth.order', 5],
  ]));
  assert.deepEqual(ids(none), PROLOGUE_DEFAULTS.scenes.filter(scene => !PROLOGUE_SLOT_IDS.includes(scene.id)).map(scene => scene.id),
    'the stand-in is the opening as it shipped — not four blank slots as well');
  // Ties keep authored order, so a half-numbered sequence is still stable:
  // `night` sharing position 1 with `warmth` sits behind it, not in front.
  assert.deepEqual(ids(prologueConfig({'gameConfig.prologue.scenes.night.order': 1})), ['warmth','night','year','carry','step']);
  // The indices are into the AUTHORED list either way: that is what a paused
  // run holds, and what every setting key is named for.
  assert.deepEqual([...prologueSequence(reordered)].sort((a,b)=>a-b), [0,1,2,3,4]);
});

test('a scene names its painting, and every offered painting is shipped for both layouts', () => {
  const config = prologueConfig({'gameConfig.prologue.scenes.step.art': 'road'});
  assert.equal(prologueSceneArt(config.scenes.find(scene => scene.id === 'step')), 'road');
  assert.equal(prologueSceneArt(config.scenes.find(scene => scene.id === 'night')), 'night', 'a scene defaults to its own art');
  // A value outside the offered set falls back to the scene's own painting
  // rather than asking the asset layer for a file that cannot exist.
  assert.equal(prologueSceneArt({id: 'night', art: 'not-a-painting'}), 'night');
  for (const art of PROLOGUE_ART_IDS) {
    for (const layout of ['desktop', 'mobile']) {
      const path = prologueArtwork(art, layout, {classId: 'reaver'});
      const bytes = readFileSync(new URL(`../${path.replace(/^\.?\//, '')}`, import.meta.url));
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', `${art} ${layout} is a shipped painting`);
    }
  }
});

test('the staging settings import and export, alone and inside the whole configuration', () => {
  const edits = {
    'gameConfig.prologue.presentation.layout': 'overlay',
    'gameConfig.prologue.presentation.imageScale': 1.25,
    'gameConfig.prologue.presentation.imageFocusY': 30,
    'gameConfig.prologue.presentation.textPosition': 'middle-left',
    'gameConfig.prologue.presentation.textBoxVisible': false,
    'gameConfig.prologue.presentation.textBoxOpacity': .4,
    'gameConfig.prologue.presentation.textOutline': true,
    'gameConfig.prologue.presentation.textOutlineColor': '#7fa8c9',
    'gameConfig.prologue.scenes.warmth.banner': true,
    'gameConfig.prologue.scenes.warmth.art': 'road',
    'gameConfig.prologue.scenes.warmth.order': 4,
    'gameConfig.prologue.scenes.night.enabled': false,
  };
  // The whole-game file carries them, unchanged, like any other override.
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(edits), contentBundle), edits);
  // And the opening's own file is the same settings under the art-studio shape,
  // so one importer reads both and a scene file needs no format of its own.
  const scenes = parseAdvancedConfigFile(prologueScenePreset(edits), contentBundle);
  const staged = prologueConfig(scenes);
  assert.deepEqual(staged, prologueConfig(edits), 'the scene file round trips every staging setting');
  assert.equal(staged.presentation.layout, 'overlay');
  assert.equal(staged.scenes.find(scene => scene.id === 'warmth').banner, true);
  assert.deepEqual(prologueSequence(staged).map(index => staged.scenes[index].id), ['year','carry','warmth','step']);
});

test('a staging value the screen could not draw is refused, and refuses the file with it', () => {
  const bad = {
    'gameConfig.prologue.presentation.layout': 'diagonal',
    'gameConfig.prologue.presentation.textOutlineColor': 'cornflower',
    'gameConfig.prologue.presentation.imageScale': 12,
    'gameConfig.prologue.scenes.warmth.order': 1.5,
    'gameConfig.prologue.scenes.warmth.art': 'https://untrusted.example/image.webp',
    'gameConfig.prologue.presentation.textPosition': 'bottom-middle',
  };
  for (const [key, value] of Object.entries(bad)) {
    assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({[key]: value}), contentBundle), new RegExp('Nothing was imported'), key);
  }
  // A stored value that somehow survives is still not read into the config.
  assert.equal(prologueConfig({'gameConfig.prologue.presentation.layout': 'diagonal'}).presentation.layout, 'caption');
  assert.equal(prologueConfig({'gameConfig.prologue.scenes.warmth.order': 1.5}).scenes[0].order, 1);
});

test('every frame and text position the settings offer is a frame the stylesheet draws', () => {
  const css = readFileSync(new URL('../styles/prologue.css', import.meta.url), 'utf8');
  for (const id of Object.keys(PROLOGUE_LAYOUTS)) {
    if (id === 'caption') continue;  // the shipped frame is the base rule set
    assert.ok(css.includes(`.prologue-layout-${id}`), `${id} has no stylesheet`);
  }
  // A wireframe that states its own geometry must restate it inside the
  // short-landscape rule as well, or the generic art-plus-side-panel rule
  // silently replaces the frame the owner chose.
  const landscape = css.slice(css.lastIndexOf('@media(max-height:500px)'));
  for (const id of ['overlay', 'letterbox']) {
    assert.ok(landscape.includes(`.prologue-layout-${id}{grid-template-columns:1fr`), `${id} inherits the side panel on a short landscape screen`);
  }
  for (const position of PROLOGUE_TEXT_POSITIONS) {
    const [band, side] = position.split('-');
    assert.ok(css.includes(`[data-position^=${band}]`) || band === 'bottom', `${band} band is not placed`);
    assert.ok(css.includes(`[data-position$=${side}]`) || side === 'center', `${side} side is not placed`);
  }
  // The properties the screen writes are the properties the stylesheet reads.
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  for (const property of ['--prologue-text-scale','--prologue-text-align','--prologue-box','--prologue-outline-color','--prologue-outline-width','--prologue-fit','--prologue-focus','--prologue-scale']) {
    assert.ok(screen.includes(`'${property}'`), `${property} is never set`);
    assert.ok(css.includes(`var(${property}`), `${property} is never read`);
  }
});

test('a run paused on a scene that is no longer in the opening resumes, it does not replay', () => {
  const ids = config => prologueSequence(config).map(index => config.scenes[index].id);
  const at = (config, sceneId) => ids(config)[prologueResumePosition(config, config.scenes.findIndex(scene => scene.id === sceneId))];
  const full = prologueConfig();
  // A scene still in the opening resumes on itself, wherever it now sits. An
  // empty slot is not in the opening, so it resumes like any other cut scene —
  // which, with nothing after it, is the last scene that is playing.
  for (const id of ids(full)) assert.equal(at(full, id), id);
  for (const id of PROLOGUE_SLOT_IDS) assert.equal(at(full, id), 'step');
  const cut = prologueConfig({'gameConfig.prologue.scenes.carry.enabled': false, 'gameConfig.prologue.scenes.night.enabled': false});
  assert.deepEqual(ids(cut), ['warmth','year','step']);
  assert.equal(at(cut, 'carry'), 'step', 'the next scene still in the opening, not the first');
  assert.equal(at(cut, 'night'), 'step');
  // Nothing follows the saved scene any more: the LAST scene stands, so the
  // run is not sent back through scenes it has already watched.
  const tail = prologueConfig({'gameConfig.prologue.scenes.night.enabled': false, 'gameConfig.prologue.scenes.step.enabled': false});
  assert.equal(at(tail, 'step'), 'carry');
  assert.equal(at(tail, 'night'), 'carry');
  // The question is asked in the STAGING, not in authored numbering: with the
  // opening reversed, what follows `carry` is what follows it as it now plays.
  const shipped = PROLOGUE_DEFAULTS.scenes.filter(scene => !PROLOGUE_SLOT_IDS.includes(scene.id));
  const reversed = prologueConfig(Object.fromEntries([
    ...shipped.map((scene, index) => [`${PROLOGUE_PREFIX}scenes.${scene.id}.order`, shipped.length - index]),
    [`${PROLOGUE_PREFIX}scenes.carry.enabled`, false],
  ]));
  assert.deepEqual(ids(reversed), ['step','night','year','warmth']);
  assert.equal(at(reversed, 'carry'), 'year', 'the scene after the cut one in the running order');
});

test('the text container keeps the shipped strip, and takes the colour it is given', () => {
  // THE DEFAULT IS THE OPENING AS IT SHIPPED. #19150f → #100e0c is the gradient
  // styles/prologue.css carried before the container was a setting, so a
  // profile that has never opened these settings sees no change.
  assert.equal(prologueBoxBackground(prologueConfig().presentation), 'linear-gradient(rgba(25,21,15,1),rgba(16,14,12,1))');
  assert.equal(prologueBoxBackground({textBoxColor: '#7fa8c9', textBoxOpacity: .5}), 'linear-gradient(rgba(136,175,204,0.5),rgba(127,168,201,0.5))');
  assert.equal(prologueBoxBackground({textBoxColor: '#ffffff', textBoxOpacity: 1}), 'linear-gradient(rgba(255,255,255,1),rgba(255,255,255,1))', 'the lift never runs past white');
  // A stored colour the wheel could not have produced falls back rather than
  // writing a broken background onto the screen.
  assert.equal(prologueBoxBackground({textBoxColor: 'cornflower', textBoxOpacity: 2}), 'linear-gradient(rgba(25,21,15,1),rgba(16,14,12,1))');
  const css = readFileSync(new URL('../styles/prologue.css', import.meta.url), 'utf8');
  // The corner radius is a SETTING, with one home: a hardcoded radius for the
  // floating frames would always beat the number the owner typed. It ships at
  // 0, which is the square strip the opening has always had.
  assert.match(css, /border-radius:var\(--prologue-box-radius,0\)/);
  assert.ok(!/border-radius:10px/.test(css), 'and no frame carries a radius of its own');
  assert.equal(prologueConfig().presentation.boxRadius, 0);
});

test('the wash is the scene\'s own staging, not a branch about a scene id', () => {
  // It began as `if (scene.id === 'night')` in the renderer, which washed that
  // dark plate at full strength the moment another scene borrowed it. It is
  // data now: `night` ships with its own staging, and the renderer reads the
  // resolved staging without knowing any scene by name.
  const config = prologueConfig();
  const wash = id => prologueStaging(config, config.scenes.find(scene => scene.id === id)).wash;
  assert.equal(wash('night'), .06);
  assert.equal(wash('warmth'), config.presentation.wash);
  assert.equal(wash('warmth'), .14);
  // Turning `night`'s own staging off hands it back to the house style, and
  // pointing another scene at that painting does NOT clamp it.
  const shared = prologueConfig({[`${PROLOGUE_PREFIX}scenes.night.ownStaging`]: false, [`${PROLOGUE_PREFIX}scenes.warmth.art`]: 'night'});
  assert.equal(prologueStaging(shared, shared.scenes.find(scene => scene.id === 'night')).wash, .14);
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  assert.ok(!/=== 'night'/.test(screen), 'the renderer knows no scene by name');
  assert.match(screen, /wash\.style\.opacity = String\(stage_\.wash\)/, 'it reads the resolved staging');
  const settings = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(settings, /openingOnly \? Object\.keys\(changes\)\.filter\(key => !key\.startsWith\(PROLOGUE_PREFIX\)\)/, 'the scene door refuses keys from outside the opening');
});

// ---- the staging is per scene, the opening is a list, the slots are real ----
test('a scene may keep its own staging, and inherits the house style until it does', () => {
  const config = prologueConfig({
    [`${PROLOGUE_PREFIX}presentation.layout`]: 'overlay',
    [`${PROLOGUE_PREFIX}presentation.textScale`]: 1.4,
    [`${PROLOGUE_PREFIX}scenes.step.ownStaging`]: true,
    [`${PROLOGUE_PREFIX}scenes.step.stage.layout`]: 'letterbox',
  });
  const staged = id => prologueStaging(config, config.scenes.find(scene => scene.id === id));
  assert.equal(staged('warmth').layout, 'overlay', 'the house style');
  assert.equal(staged('step').layout, 'letterbox', 'one scene may letterbox while the rest do not');
  // A SCENE'S BLOCK IS ONLY WHAT IT ANSWERS FOR ITSELF. `step` set its frame and
  // nothing else, so it still follows the opening's text size. Shipping a full
  // copy of the house style inside every scene is what made `night` — the one
  // scene with its own wash — silently ignore every other setting changed here.
  assert.equal(staged('warmth').textScale, 1.4);
  assert.equal(staged('step').textScale, 1.4, 'what a scene has not set still follows the house style');
  assert.deepEqual(PROLOGUE_DEFAULTS.scenes.find(scene => scene.id === 'night').stage, {wash: .06, camera: 'out'}, 'night answers for its wash and camera alone');
  const housed = prologueConfig({[`${PROLOGUE_PREFIX}presentation.layout`]: 'letterbox'});
  for (const scene of housed.scenes) assert.equal(prologueStaging(housed, scene).layout, 'letterbox', `${scene.id} ignored the house style`);
  assert.equal(prologueStaging(housed, housed.scenes.find(scene => scene.id === 'night')).wash, .06, 'while night keeps the one thing it answers for');
  for (const field of PROLOGUE_STAGE_FIELDS) {
    assert.ok(field.key in config.presentation, `${field.key} missing from the house style`);
  }
  // And both homes are reachable from Settings, as rows that refuse bad values.
  const rows = new Map(prologueRows().map(row => [row.key, row]));
  for (const field of PROLOGUE_STAGE_FIELDS) {
    assert.ok(rows.has(`${PROLOGUE_PREFIX}presentation.${field.key}`), `${field.key} has no house row`);
    assert.ok(rows.has(`${PROLOGUE_PREFIX}scenes.step.stage.${field.key}`), `${field.key} has no scene row`);
  }
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({[`${PROLOGUE_PREFIX}scenes.step.stage.layout`]: 'diagonal'}), contentBundle), /Nothing was imported/);
});

test('scenes can be added, duplicated, reordered and emptied through named slots', () => {
  const config = prologueConfig();
  assert.equal(prologueFreeSlot(config), PROLOGUE_SLOT_IDS[0], 'an untouched opening has every slot free');
  // A DUPLICATE CARRIES EVERYTHING, which is the point of duplicating: `night`
  // is the scene with its own staging, and the copy keeps that staging.
  const copy = prologueSceneCopy({}, 'night', 'extraA');
  assert.equal(copy[`${PROLOGUE_PREFIX}scenes.extraA.name`], 'Last night (copy)');
  assert.equal(copy[`${PROLOGUE_PREFIX}scenes.extraA.enabled`], true);
  assert.equal(copy[`${PROLOGUE_PREFIX}scenes.extraA.stage.wash`], .06);
  assert.equal(copy[`${PROLOGUE_PREFIX}scenes.extraA.text`], PROLOGUE_DEFAULTS.scenes.find(s => s.id === 'night').text);
  // A duplicate keeps its traveller too, including the separate phone pose.
  const traveller = prologueSceneCopy({
    [`${PROLOGUE_PREFIX}scenes.step.actor.desktop.rotation`]: 17,
    [`${PROLOGUE_PREFIX}scenes.step.actor.desktop.layer`]: 'front',
  }, 'step', 'extraA');
  const imported = parseAdvancedConfigFile(advancedConfigExport(traveller), contentBundle);
  const duplicate = prologueConfig(imported).scenes.find(scene => scene.id === 'extraA');
  assert.equal(duplicate.character, true);
  assert.deepEqual(duplicate.actor.desktop, {...PROLOGUE_DEFAULTS.scenes.find(scene => scene.id === 'step').actor.desktop, rotation:17, layer:'front'});
  assert.deepEqual(duplicate.actor.mobile, PROLOGUE_DEFAULTS.scenes.find(scene => scene.id === 'step').actor.mobile);
  const withCopy = prologueConfig(copy);
  assert.ok(prologueSequence(withCopy).map(index => withCopy.scenes[index].id).includes('extraA'));
  assert.equal(prologueFreeSlot(withCopy), PROLOGUE_SLOT_IDS[1], 'a filled slot is no longer free');
  // Emptying it restores the authored blank rather than writing a second empty.
  const cleared = prologueConfig({...copy, ...prologueSceneClear('extraA')});
  assert.deepEqual(cleared.scenes.find(scene => scene.id === 'extraA'), PROLOGUE_DEFAULTS.scenes.find(scene => scene.id === 'extraA'));
  // Reordering rewrites the whole running order, 1..n, with no gaps, and
  // refuses a list that is not every scene exactly once.
  const ids = PROLOGUE_DEFAULTS.scenes.map(scene => scene.id);
  const moved = ['step', ...ids.filter(id => id !== 'step')];
  const changes = prologueReorderChanges(moved);
  assert.deepEqual(Object.values(changes), moved.map((id, index) => index + 1));
  const reordered = prologueConfig(changes);
  assert.equal(reordered.scenes.find(scene => scene.id === 'step').order, 1);
  assert.deepEqual(prologueSequence(reordered).map(index => reordered.scenes[index].id), ['step', 'warmth', 'year', 'carry', 'night']);
  assert.throws(() => prologueReorderChanges(['step', 'step']), /every scene exactly once/);
  assert.throws(() => prologueReorderChanges([...ids, 'ghost']), /every scene exactly once/);
  // An added scene starts as a text card, because a new scene ships no art.
  assert.equal(prologueSceneArt(PROLOGUE_DEFAULTS.scenes.find(scene => scene.id === 'extraA')), null);
  assert.equal(prologueArtwork('warmth'), prologueArtwork('warmth'), 'a painting is still resolvable');
});

test('a preset slot parks the whole opening, and loading one replaces it', () => {
  const opening = {
    [`${PROLOGUE_PREFIX}presentation.layout`]: 'panelLeft',
    [`${PROLOGUE_PREFIX}scenes.night.enabled`]: false,
    [`${PROLOGUE_PREFIX}presets.a.data`]: 'should never be inside the payload',
    cardMotif: 'band',
  };
  const payload = prologueSlotPayload(opening);
  assert.deepEqual(JSON.parse(payload), {
    [`${PROLOGUE_PREFIX}presentation.layout`]: 'panelLeft',
    [`${PROLOGUE_PREFIX}scenes.night.enabled`]: false,
  }, 'the opening, without the slots and without anything that is not the opening');
  // LOADING IS A REPLACEMENT: an override the profile holds and the slot does
  // not is taken away, or the scene you switched off a moment ago stays off
  // with nothing on screen to say why.
  const current = {[`${PROLOGUE_PREFIX}scenes.warmth.text`]: 'written since', [`${PROLOGUE_PREFIX}presets.a.data`]: payload, cardMotif: 'band'};
  const changes = prologueSlotChanges(payload, current);
  assert.equal(changes[`${PROLOGUE_PREFIX}scenes.warmth.text`], undefined);
  assert.ok(`${PROLOGUE_PREFIX}scenes.warmth.text` in changes, 'and it is named, so it is actually unset');
  assert.equal(changes[`${PROLOGUE_PREFIX}presentation.layout`], 'panelLeft');
  assert.ok(!('cardMotif' in changes), 'nothing outside the opening is touched');
  assert.ok(!(`${PROLOGUE_PREFIX}presets.a.data` in changes), 'and the slots are not inside the slot');
  // A slot written by a version that knew a key this one does not, or holding a
  // value this one refuses, is refused whole rather than half applied.
  assert.throws(() => prologueSlotChanges('{"gameConfig.prologue.scenes.warmth.ghost":1}'), /does not know/);
  assert.throws(() => prologueSlotChanges(`{"${PROLOGUE_PREFIX}presentation.layout":"diagonal"}`), /refuses/);
  assert.throws(() => prologueSlotChanges('not json'), /empty or unreadable/);
  // A slot written before the scenes were renamed still loads, by scene id.
  assert.equal(prologueSlotChanges('{"gameConfig.prologue.scenes.2.text":"old"}')[`${PROLOGUE_PREFIX}scenes.night.text`], 'old');
  // Slots ride in the ordinary configuration file like any other setting.
  const stored = {[`${PROLOGUE_PREFIX}presets.b.data`]: payload, [`${PROLOGUE_PREFIX}presets.b.name`]: 'Letterboxed'};
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(stored), contentBundle), stored);
});

test('the camera, the reveal, the hold and the scene audio are all settings the screen reads', () => {
  const rows = new Map(prologueRows().map(row => [row.key, row]));
  for (const key of ['waitForInput', 'music', 'stinger']) {
    assert.ok(rows.has(`${PROLOGUE_PREFIX}scenes.warmth.${key}`), `${key} is not editable`);
  }
  // `auto` is the rule the opening shipped with, kept as a value rather than as
  // the absence of one, so a scene can say "held still" and mean it.
  assert.equal(prologueConfig().presentation.camera, 'auto');
  assert.equal(prologueConfig().scenes[0].effect, 'push', 'and warmth is the scene auto still pushes');
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  assert.match(screen, /scene\.effect === 'push' \? 'in' : 'none'/, 'auto is the old rule, written down');
  assert.match(screen, /!scene\.waitForInput/, 'a holding scene is never advanced automatically');
  // ENTERED, not re-drawn: a rotation re-runs the scene, and an unconditional
  // stinger fired again on every rotation.
  assert.match(screen, /notify && audio && scene\.music/, 'the music moves when the scene is entered');
  assert.match(screen, /notify && audio && scene\.stinger/, 'and so does the stinger');
  // Silence is a CONTEXT, not a stop: stopping the sound without moving the
  // engine's context left `music('map')` answering 'unchanged' when the opening
  // ended, and the map stayed silent.
  assert.ok(!/audio[^\n]*stopMusic/.test(screen), 'the opening never stops the music behind the engine\'s back');
  assert.equal(BEDS.quiet, 'silence', 'deliberate quiet, spelled the one way');
  assert.ok(Object.keys(PROLOGUE_MUSIC).filter(id => id !== 'keep').every(id => id in BEDS), 'every music choice is a real bed');
  // The reveal never removes the words from the document — it recolours them.
  assert.match(screen, /class:'prologue-unsaid'/);
  assert.ok(!/aria-hidden[^)]*unsaid/.test(screen), 'the unread part stays readable to assistive technology');
  const css = readFileSync(new URL('../styles/prologue.css', import.meta.url), 'utf8');
  // Transparent FILL alone left the stroke visible, so with the text outline on
  // every un-revealed letter was legible in outline from the first frame.
  assert.match(css, /\.prologue-unsaid\{color:transparent;-webkit-text-stroke-color:transparent\}/);
  // Reduced motion is one branch, and it is "show everything".
  assert.match(screen, /if \(!steps \|\| reduced\(\)\) \{ dialogue\.textContent = text; return null; \}/);
  // Main passes the engine in, or the opening simply keeps whatever is playing.
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /settings, run, audio, startScene/);
});

// ---- the list editor, as the panel actually renders it ----------------------
//
// `settingsRowHtml` is a pure function of the settings, so the row the owner
// sees can be asserted without a browser. Every claim below is one the review
// of #1237 caught the first cut getting wrong.
test('the scene list shows the staging, and never claims a scene is playing when it is not', () => {
  const row = prologueRows().find(entry => entry.type === 'sceneList');
  const scenes = html => [...html.matchAll(/data-scene="(\w+)"/g)].map(match => match[1]);
  const shipped = PROLOGUE_DEFAULTS.scenes.map(scene => scene.id);
  // A scene that is switched off KEEPS ITS PLACE in the list, or every edit
  // would renumber it to the end: switch one off, move anything, switch it back
  // on, and it used to come back last.
  const parked = settingsRowHtml({[`${PROLOGUE_PREFIX}scenes.year.enabled`]: false}, row, {});
  assert.deepEqual(scenes(parked), shipped);
  assert.match(parked, /data-scene="year"[^>]*data-live="0"/);
  assert.match(parked, /data-scene="carry"[^>]*data-live="1"/);
  // The row that IS the next free slot cannot duplicate itself — it would be
  // both sides of the copy, and the insert landed at the front of the opening.
  assert.match(parked, /data-scene-copy="extraA" disabled/);
  assert.ok(!/data-scene-copy="warmth" disabled/.test(parked));
  // With every scene off, nothing is playing, the list says so, and it does not
  // render nine "On" buttons over a profile that has them all switched off.
  const none = settingsRowHtml(Object.fromEntries(shipped.map(id => [`${PROLOGUE_PREFIX}scenes.${id}.enabled`, false])), row, {});
  assert.equal((none.match(/data-live="1"/g) || []).length, 0);
  assert.equal((none.match(/aria-pressed="true"/g) || []).length, 0);
  assert.match(none, /falls back to the five scenes it shipped with/);
  // The ends of the staging are the ends of the list, whatever is switched on.
  assert.match(parked, /data-scene-move="up" data-scene-id="warmth"[^>]*disabled/);
  assert.match(parked, /data-scene-move="down" data-scene-id="extraD"[^>]*disabled/);
  // The order every action edits comes from the SETTINGS, not from the rows on
  // screen: an abandoned drag leaves the DOM rearranged with nothing saved, and
  // reading it back persisted that arrangement on the next button press.
  const panel = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');
  assert.match(panel, /const stagedIds = \(\) => \{/);
  assert.ok(!/sceneIdsInList/.test(panel), 'no action reads the running order out of the DOM');
  assert.match(panel, /if \(moved\) renderSettings/, 'and an abandoned drag puts the rows back');
  assert.match(panel, /if \(!slot \|\| slot === source\) return;/, 'a slot is never its own source');
});

test('the first frame is already staged, and the inset measures the axis it names', () => {
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  // applyStaging used to run only after the painting decoded — up to eight
  // seconds on a missing file — so the opening drew its first scene in the
  // shipped caption layout and jumped into the chosen one when the art landed.
  const mount = screen.indexOf('applyStaging(prologueStaging(config,config.scenes[sceneIndex]));');
  assert.ok(mount > 0 && mount < screen.indexOf('showScene(position); raf = requestAnimationFrame'), 'the frame is up before the artwork');
  // A percentage margin measures the container's WIDTH on both axes, so the
  // vertical inset is multiplied by a height unit instead.
  assert.match(screen, /String\(Number\(stage\.textInsetY\) \|\| 0\)/, 'the property carries a bare number');
  const css = readFileSync(new URL('../styles/prologue.css', import.meta.url), 'utf8');
  assert.match(css, /calc\(var\(--prologue-inset-y,4\)\*1cqh\) calc\(var\(--prologue-inset-x,4\)\*1cqw\)/);
  assert.match(css, /\.prologue-screen\{container-type:size/, 'and the screen is the container those units measure');
});

// ---- the buttons are the frame's, and the dials reach the stylesheet -------
test('the controls stand in a band at the bottom, whatever the words do', () => {
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  // The caption holds the WORDS. Continue used to be inside it, so an overlay
  // wireframe floated the buttons into the middle of the picture with them.
  assert.match(screen, /const caption = el\('div',\{class:'prologue-caption'\},\[title,speaker,dialogue,location\]\)/);
  assert.match(screen, /const bar = el\('div',\{class:'prologue-bar'\},\[progress,controls\]\)/);
  assert.match(screen, /if \(inText\) caption\.append\(progress,controls\)/, 'and they can be asked back under the text');
  const css = readFileSync(new URL('../styles/prologue.css', import.meta.url), 'utf8');
  assert.match(css, /\.prologue-bar\{grid-row:3/, 'the band is the frame\'s last row');
  // Every wireframe keeps the band last: the ones that restate their grid say
  // where it goes, and the short-landscape and portrait fallbacks move it with
  // the caption rather than dropping it on top of one.
  assert.match(css, /\.prologue-layout-panelLeft \.prologue-bar,\.prologue-layout-panelRight \.prologue-bar,\.prologue-layout-overlay \.prologue-bar\{grid-row:2;grid-column:1\/-1\}/);
  assert.match(css, /\.prologue-layout-panelLeft \.prologue-bar,\.prologue-layout-panelRight \.prologue-bar,\.prologue-layout-overlay \.prologue-bar\{grid-row:3;grid-column:1\}/);
  for (const rows of [/\.prologue-layout-overlay\{grid-template-rows:1fr auto\}/, /\.prologue-layout-panelLeft,\.prologue-layout-panelRight\{grid-template-rows:1fr auto/]) {
    assert.match(css, rows, 'a wireframe that states its rows leaves one for the band');
  }
  assert.equal(prologueConfig().presentation.controlsPosition, 'bar');
  // The safe-area inset is a FLOOR under the authored padding, not a value that
  // replaces it: a container padding of 0 must still be 0 under the text.
  assert.match(css, /\.prologue-controls-text \.prologue-caption\{padding-bottom:max\(var\(--prologue-box-padding,1rem\),env\(safe-area-inset-bottom\)\)\}/);
  // A scene nobody is watching moves its CLOCK past the entrance, and that is
  // ALL it moves. Finishing the animations instead left `elapsed` at 0, so the
  // next tick rewound the fade; and it finished the camera too, which then
  // popped backwards the moment the page came back. The clock puts every
  // animation where that moment in the scene actually puts it.
  assert.match(screen, /if \(paused \|\| blocked\(\)\) elapsed = Math\.max\(elapsed,duration\);/);
  // The one place an animation is still fast-forwarded is reduced motion, where
  // finishing it IS the setting.
  assert.equal((screen.match(/a\.finish\(\)/g) || []).length, 1);
  assert.match(screen, /if \(reduced\(\)\) animations\.forEach\(a=>a\.finish\(\)\)/);
});

test('every staging dial the settings offer is a property the stylesheet reads', () => {
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/prologue.css', import.meta.url), 'utf8');
  // A field that reaches neither the screen nor the stylesheet is a row that
  // does nothing, which is worse than no row at all.
  const carried = {
    imageBrightness: '--prologue-filter', imageContrast: '--prologue-filter', imageSaturation: '--prologue-filter',
    imageBlur: '--prologue-filter', imageFlip: '--prologue-flip', vignette: '--prologue-vignette',
    backdropColor: '--prologue-backdrop', letterboxColor: '--prologue-letterbox',
    titleColor: '--prologue-title-color', speakerColor: '--prologue-speaker-color',
    dialogueColor: '--prologue-dialogue-color', locationColor: '--prologue-location-color',
    titleScale: '--prologue-title-scale', speakerScale: '--prologue-speaker-scale',
    lineHeight: '--prologue-line-height', letterSpacing: '--prologue-letter-spacing',
    textMaxWidth: '--prologue-measure', textFont: '--prologue-font',
    boxPadding: '--prologue-box-padding', boxRadius: '--prologue-box-radius',
    boxBorderWidth: '--prologue-box-border', boxBorderColor: '--prologue-box-border-color',
    boxBlur: '--prologue-box-backdrop',
  };
  for (const [field, property] of Object.entries(carried)) {
    assert.ok(field in prologueConfig().presentation, `${field} has no authored default`);
    assert.ok(screen.includes(`'${property}'`), `${field} is never written as ${property}`);
    assert.ok(css.includes(`var(${property}`), `${property} is never read`);
  }
  // The ones the screen reads directly rather than through a property.
  assert.match(screen, /title\.hidden = stage\.titleVisible === false/);
  assert.match(screen, /speaker\.hidden = stage\.speakerVisible === false/);
  assert.match(screen, /stage_\.locationVisible === false/);
  assert.match(screen, /stage_\.progressStyle === 'dots'/);
  assert.match(screen, /stage_\.transitionEase \|\| 'ease-in-out'/);
  assert.match(screen, /stage_\.cameraEase \|\| 'linear'/);
  assert.match(screen, /delayMs = Math\.max\(0,Number\(stage_\.textDelaySeconds\)/);
  assert.match(screen, /p\.advanceOnClick === true/);
  // The transition time is per scene now, so it has ONE home: the staging.
  assert.ok(PROLOGUE_STAGE_FIELDS.some(field => field.key === 'transitionSeconds'));
  assert.equal(prologueRows().filter(row => row.key.endsWith('presentation.transitionSeconds')).length, 1);
  // And the whole staging is still answerable per scene, which is the point.
  const scene = prologueConfig({
    [`${PROLOGUE_PREFIX}scenes.warmth.ownStaging`]: true,
    [`${PROLOGUE_PREFIX}scenes.warmth.stage.imageSaturation`]: 0,
    [`${PROLOGUE_PREFIX}scenes.warmth.stage.textDelaySeconds`]: 2,
  });
  const staged = prologueStaging(scene, scene.scenes[0]);
  assert.equal(staged.imageSaturation, 0, 'one scene may be grey while the rest are not');
  assert.equal(staged.textDelaySeconds, 2);
  assert.equal(prologueStaging(scene, scene.scenes[1]).imageSaturation, 1);
});

// ---- the screen only names what it imports ---------------------------------
//
// `PROLOGUE_DEFAULTS` was used in the renderer and never imported. `node
// --check` sees valid syntax, every test here reads the file as TEXT, and the
// model tests never mount the screen — so the opening threw `ReferenceError` on
// the first scene and showed nothing but its caption, and only photographing
// the built game caught it. This is the cheap half of that lesson: every
// opening symbol the renderer names has to be a symbol it imported.
test('the opening renderer imports every opening symbol it names', () => {
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  const imported = new Set([...screen.matchAll(/import \{([^}]+)\} from/g)]
    .flatMap(match => match[1].split(',').map(name => name.trim().split(/\s+as\s+/).pop())));
  const body = screen.slice(screen.lastIndexOf('import '));
  const exported = new Set(Object.keys(prologueModule));
  const named = new Set([...body.matchAll(/\b(PROLOGUE_[A-Z_]+|prologue[A-Za-z]+)\b/g)].map(match => match[1]));
  for (const name of named) {
    if (!exported.has(name)) continue;  // a local of the same shape is not an import
    assert.ok(imported.has(name), `${name} is used in the renderer but never imported`);
  }
  assert.ok(named.has('PROLOGUE_DEFAULTS'), 'the symbol that taught this lesson is still one of them');
});

test('a fixed-height caption sets every scene at one size, the largest at which the longest fits', () => {
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  // Measured over every scene in the opening, not the one on screen, so the
  // size does not jump between scenes; never above the chosen size.
  assert.match(screen, /order\.map\(index => config\.scenes\[index\]\)/);
  assert.match(screen, /\(stage\.textScale \?\? 1\) \* \(fixedCaption\(stage\) \? captionFit\(\) : 1\)/);
  assert.match(screen, /probe\.scrollHeight <= probe\.clientHeight/);
  // Re-measured when the frame changes size, and the observer goes with the screen.
  assert.match(screen, /new ResizeObserver/);
  assert.match(screen, /resized\?\.disconnect\(\); restyled\?\.disconnect\(\)/);
  // The player's text size moves every rem without resizing the frame.
  assert.match(screen, /getComputedStyle\(document\.documentElement\)\.fontSize/);
  // A floor in on-screen pixels: a frame too short for readable words scrolls.
  assert.match(screen, /const MIN_DIALOGUE_PX = 12;/);
});

test('the words sit centred in the fixed band, and a short landscape screen gives them the whole panel', () => {
  assert.equal(PROLOGUE_DEFAULTS.presentation.textPosition, 'middle-center', 'the owner centres the words in the band');
  const css = readFileSync(new URL('../styles/prologue.css', import.meta.url), 'utf8');
  assert.match(css, /\.prologue-fixed-caption:is\(\.prologue-layout-caption,\.prologue-layout-letterbox\) \.prologue-caption\[data-position\^=middle\]\{align-content:center;align-content:safe center\}/, 'an overflowing band keeps its first line reachable');
  // On a short landscape screen the caption layout is a side panel: no band height, no fit.
  assert.match(css, /@media\(max-height:500px\) and \(orientation:landscape\)\{[^@]*\.prologue-fixed-caption\.prologue-layout-caption \.prologue-caption\{height:auto\}/);
  const screen = readFileSync(new URL('../src/ui/screens/prologue.js', import.meta.url), 'utf8');
  assert.match(screen, /stage\.layout === 'caption' && !\(shortLandscape\.matches && !root\.closest\('\.pse-phone'\)\)/, 'the editor phone preview keeps its fitted band');
  assert.match(css, /\.pse-phone \.prologue-fixed-caption\.prologue-layout-caption \.prologue-caption\{height:calc\(var\(--prologue-caption-vh,18\) \* 1cqh\)\}/);
  assert.match(screen, /if \(currentStage\?\.captionFixedHeight !== true\) return;/, 'a rotation into the panel lets go of the fitted size');
  assert.match(screen, /if \(key !== seen\) \{ seen = key; refit\(\); \}/, 'an unmeasured panel is not re-staged on every callback');
});
