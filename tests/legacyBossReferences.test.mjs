import assert from 'node:assert/strict';
import {test} from 'node:test';
import {contentBundle} from '../src/content/index.js';
import {LEGACY_ACT_BOSSES} from '../src/content/mapconfig.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState} from '../src/model/state.js';
import {createRng} from '../src/engine/rng.js';
import {generateActMap} from '../src/engine/mapgen.js';
import {createSaveManager,createMemoryStorage} from '../src/engine/save.js';
import {createSession,restoreSession} from '../tools/session.mjs';
const reg=createRegistries(contentBundle);
const legacyMap=act=>generateActMap({config:reg.mapConfig(act),rng:createRng(701+act)});
const topology=graph=>Object.values(graph.nodes).map(({id,type,floor,col,next,encounterId})=>({id,type,floor,col,next,encounterId}));
function altered(act,kind){const id=LEGACY_ACT_BOSSES[act];return createRegistries({...contentBundle,encounters:contentBundle.encounters.flatMap(e=>e.id!==id?[e]:kind==='missing'?[]:[{...e,...(kind==='renamed'?{id:id+'Renamed'}:kind==='wrongPool'?{pool:'normal'}:{act:act===3?1:act+1})}])});}
function solo(act){const run=createRunState({seed:701,classId:'reaver',registries:reg});run.actNumber=act;run.mapGraph=legacyMap(act);run.mapNodeId=run.mapGraph.shrineId;return run;}
function lan(act){const host=createSession({registries:reg,seedString:'GOLDBOUGH'});host.addMember({id:'p1',name:'Legacy tester',classId:'reaver'});host.start();const saved=structuredClone(host.serialize());saved.actNumber=act;saved.mapGraph=legacyMap(act);saved.cursorId=saved.mapGraph.shrineId;saved.reachableIds=[saved.mapGraph.bossId];return saved;}
for(const act of [1,2,3]){
 for(const kind of ['missing','renamed','wrongPool','wrongAct']){
  test('act '+act+' legacy '+kind+' original boss is refused by solo and LAN loaders',()=>{
   const changed=altered(act,kind),run=solo(act),before=JSON.stringify(run.mapGraph);
   const saves=createSaveManager(createMemoryStorage());saves.saveRun(run);assert.equal(saves.loadRun(changed),null);
   const receipt=saves.runStatus();assert.equal(receipt.state,'archived');assert(receipt.reason.includes("invalid encounter '"+LEGACY_ACT_BOSSES[act]+"'"));
   assert.equal(JSON.stringify(JSON.parse(saves.getArchive(receipt.archiveId).save).mapGraph),before);
   const saved=lan(act),bytes=JSON.stringify(saved);assert.throws(()=>restoreSession(changed,saved),/Saved boss destination.*invalid encounter/);assert.equal(JSON.stringify(saved),bytes);
  });
 }
 test('act '+act+' valid legacy topology and RNG survive solo and LAN loading',()=>{
  const run=solo(act),mapBefore=topology(run.mapGraph),counters=structuredClone(run.streamCounters);const saves=createSaveManager(createMemoryStorage());saves.saveRun(run);const loaded=saves.loadRun(reg);assert(loaded);assert.deepEqual(topology(loaded.mapGraph),mapBefore);assert.deepEqual(loaded.streamCounters,counters);assert.equal(loaded.mapGraph.bossIds,undefined);assert.equal(loaded.mapGraph.nodes[loaded.mapGraph.bossId].encounterId,undefined);
  const saved=lan(act),before={map:topology(saved.mapGraph),rng:structuredClone(saved.rng)};const restored=restoreSession(reg,saved).serialize();assert.deepEqual(topology(restored.mapGraph),before.map);assert.deepEqual(restored.rng,before.rng);assert.equal(restored.mapGraph.bossIds,undefined);
 });
}
