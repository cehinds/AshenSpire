import assert from 'node:assert/strict';
import {test} from 'node:test';
import {contentBundle} from '../src/content/index.js';
import {LEGACY_ACT_BOSSES} from '../src/content/mapconfig.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState} from '../src/model/state.js';
import {createRng} from '../src/engine/rng.js';
import {generateActMap} from '../src/engine/mapgen.js';
import {createSaveManager,createMemoryStorage} from '../src/engine/save.js';
const reg=createRegistries(contentBundle);
const legacyMap=act=>generateActMap({config:reg.mapConfig(act),rng:createRng(701+act)});
const topology=graph=>Object.values(graph.nodes).map(({id,type,floor,col,next,encounterId})=>({id,type,floor,col,next,encounterId}));
function altered(act,kind){const id=LEGACY_ACT_BOSSES[act];return createRegistries({...contentBundle,encounters:contentBundle.encounters.flatMap(e=>e.id!==id?[e]:kind==='missing'?[]:[{...e,...(kind==='renamed'?{id:id+'Renamed'}:kind==='wrongPool'?{pool:'normal'}:{seat:['weald','marches','reach'][act===3?0:act]})}])});}
function solo(act){const run=createRunState({seed:701,classId:'reaver',registries:reg});run.actNumber=act;run.mapGraph=legacyMap(act);run.mapNodeId=run.mapGraph.shrineId;return run;}
for(const act of [1,2,3]){
 for(const kind of ['missing','renamed','wrongPool','wrongSeat']){
  test('act '+act+' legacy '+kind+' original boss is refused by loaders',()=>{
   const changed=altered(act,kind),run=solo(act),before=JSON.stringify(run.mapGraph);
   const saves=createSaveManager(createMemoryStorage());saves.saveRun(run);assert.equal(saves.loadRun(changed),null);
   const receipt=saves.runStatus();assert.equal(receipt.state,'archived');assert(receipt.reason.includes("invalid encounter '"+LEGACY_ACT_BOSSES[act]+"'"));
   assert.equal(JSON.stringify(JSON.parse(saves.getArchive(receipt.archiveId).save).mapGraph),before);
  });
 }
 test('act '+act+' valid legacy topology and RNG survive loading',()=>{
  const run=solo(act),mapBefore=topology(run.mapGraph),counters=structuredClone(run.streamCounters);const saves=createSaveManager(createMemoryStorage());saves.saveRun(run);const loaded=saves.loadRun(reg);assert(loaded);assert.deepEqual(topology(loaded.mapGraph),mapBefore);assert.deepEqual(loaded.streamCounters,counters);assert.equal(loaded.mapGraph.bossIds,undefined);assert.equal(loaded.mapGraph.nodes[loaded.mapGraph.bossId].encounterId,undefined);
 });
}
