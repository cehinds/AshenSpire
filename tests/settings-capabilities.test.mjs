import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, generalGroups, visibleAdvancedGroups, categoryHtml, settingsSearchHits } from '../src/ui/screens/settings.js';
import { settingsRowAvailable, activeSettingsProfile } from '../src/ui/models/SettingsCapabilitiesModel.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { resolveMapMode, mapKnowledge } from '../src/model/mapknowledge.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { readFileSync } from 'node:fs';
const rows=settingsRows(), core=resolveGameProfile('core'), current=resolveGameProfile('current');
const available=(key,profile)=>settingsRowAvailable(rows.find(row=>row.key===key),profile);
test('Core hides legacy-only mechanics in groups, topics and search while retaining real controls',()=>{
  const groups=visibleAdvancedGroups(true,core).map(group=>group.id);
  for(const group of ['Opening','Progression','Combat','Stats','Recovery','Rewards','Shops','Equipment','World']) assert(!groups.includes(group),group);
  assert(groups.includes('Deck'),'ordered draw still applies to configured fights');
  for(const key of ['viewPreset','uiScale','fullscreen','musicEnabled','sfxVolume','textSize','tapFloor','reducedMotion','screenShake','playInDeckOrder']) assert(available(key,core),key);
  assert(!available('askToUpcastAfterTarget',core));assert(!available('mapMode',core));
  assert.equal(settingsSearchHits('skill',true,{}, {profile:core}).length,0);
  const html=categoryHtml('Advanced',{settingsAdvancedCategory:'Progression'},null,null,null,null,'',false,core);
  assert(!html.includes('data-advanced-group="Progression"'));assert(html.includes('data-advanced-group="Deck"'));
  const profileHtml=categoryHtml('General',{settingsGeneralCategory:'Game rules'},null,null,null,null,'',false,core);
  assert(profileHtml.includes('data-game-profile-settings'));
});
test('Current retains all existing valid sections and rank/map preferences',()=>{
  assert.deepEqual(visibleAdvancedGroups(true,current).map(group=>group.id),visibleAdvancedGroups(true).map(group=>group.id));
  assert(available('askToUpcastAfterTarget',current));assert(available('mapMode',current));
  assert(settingsSearchHits('skill',true,{}, {profile:current}).length>0);
  for(const cat of ['Audio','Accessibility']) assert.deepEqual([...generalGroups(cat,core).values()].flat(),[...generalGroups(cat,current).values()].flat());
});
test('disabled configured resources/equipment/routes remove their dependent options',()=>{
  const profile=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{resources:false,equipment:false,routes:false,cards:false}});
  for(const key of ['manaRing','armamentsPresentation','armamentsPhonePlacement','mapZoom','shrinePathGlow','playInDeckOrder']) assert(!available(key,profile),key);
  assert(available('viewPreset',profile));assert(available('musicEnabled',profile));
  const display=categoryHtml('General',{settingsGeneralCategory:'Display','settingsGeneralTopic.Display':'Map'},null,null,null,null,'',false,profile);
  assert(!display.includes('data-key="mapZoom"'));assert(display.includes('data-key="viewPreset"'));
});
test('fog is the authored default in both profiles and stored eligible choices remain explicit',()=>{
  const bundle=JSON.parse(readFileSync(new URL('../games/ashenspire/bundles/current/bundle.json',import.meta.url),'utf8'));
  assert.equal(bundle.modules.routes.settings.mapMode,'fog');assert.equal(core.modules.routes.mapMode,'fog');
  assert.equal(resolveMapMode({}, {gameProfile:core}),'fog');assert.equal(resolveMapMode({}, {gameProfile:current}),'fog');
  assert.equal(resolveMapMode({settings:{mapMode:'path'}},{gameProfile:core}),'fog');
  assert.equal(resolveMapMode({settings:{mapMode:'path'}},{gameProfile:current}),'path');
  assert.equal(resolveMapMode({settings:{mapMode:'invalid'}},{gameProfile:current}),'fog');
  // The legacy adapter reads its authored fallback rather than a second UI constant.
  const changed={gameProfile:{modules:{routes:{mode:'legacy',mapMode:'path'}}}};
  assert.equal(resolveMapMode({},changed),'path');
});
test('clean real Core and Current maps start partially hidden under fog',()=>{
  for(const profile of [core,current]) {
    const registries=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
    const run=createRunState({seed:3,classId:'reaver',registries});
    run.mapGraph=buildActMap(registries,createRng(3),run.seatOrder[0],1);
    const knowledge=mapKnowledge({graph:run.mapGraph,run,mode:resolveMapMode({},run)});
    assert(knowledge.counts.hidden>0,profile.id);assert(knowledge.drawn.size>0,profile.id);
    assert(knowledge.drawn.size<Object.keys(run.mapGraph.nodes).length,profile.id);
  }
});

test('active run capabilities win over a future new-game choice',()=>{
  const context={active:()=>core,read:()=>current};
  assert.equal(activeSettingsProfile(context),core);
  assert(!available('askToUpcastAfterTarget',activeSettingsProfile(context)));
  assert.equal(activeSettingsProfile({read:()=>current}),current);
  assert(available('askToUpcastAfterTarget',activeSettingsProfile({read:()=>current})));
});
