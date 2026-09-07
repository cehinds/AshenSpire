import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { rollEncounter } from '../src/engine/encounters.js';
import { checkPhases } from '../src/engine/triggers.js';
import { BOSS_LOCATIONS } from '../src/content/bossDestinations.js';
import { buildActMap, bossEncounterForNode } from '../src/engine/actmap.js';
const added = ['lanternMoth','briarHermit','chainScavenger','bellKeeper','thornMatriarch','mirrorScribe','stitchCrab','glassRegent','marrowOrganist','cinderMantis','eclipseCantor','furnaceSaint','hollowAstronomer','ashheartDragon'];
const bosses = new Set(['fellWarden','stitchedKing','blightedValkyrie','bellKeeper','thornMatriarch','glassRegent','marrowOrganist','furnaceSaint','hollowAstronomer','ashheartDragon']);
const elites = new Set(['wyrmAspirant','courtDuelist','wyrmLord']);
const reg = createRegistries(contentBundle);
function fight(id, seed = 234){ return createCombat({registries:reg,rng:createRng(seed),player:{classId:'reaver',maxHp:10000,hp:10000,maxMana:0,mana:0,maxStamina:3,stamina:3,energyMax:3,drawPerTurn:0,deck:[],relicIds:[],flasks:[]},enemyIds:[id]}); }
const end = c => dispatch(c,{type:'endTurn'});
test('all ten authored boss locations appear as distinct saved map destinations',()=>{
 const encounters=contentBundle.encounters.filter(e=>e.pool==='boss');
 assert.deepEqual(Object.keys(BOSS_LOCATIONS).sort(),encounters.map(e=>e.id).sort());
 assert.equal(new Set(Object.values(BOSS_LOCATIONS)).size,10);
 const seen=new Set();
 for(const act of [1,2,3])for(let seed=1;seed<=20;seed++){
  const map=buildActMap(reg,createRng(seed),act);
  for(const id of map.bossIds){const encounter=bossEncounterForNode(reg,map,id,act);seen.add(encounter);assert(map.nodes[id].destinationLabel.startsWith(BOSS_LOCATIONS[encounter]+' · '));}
 }
 assert.equal(seen.size,10);
});
test('roster has exactly 20 regular enemies, 10 bosses, and 3 elites with valid authored content',()=>{
 const enemies=contentBundle.enemies;
 assert.equal(new Set(enemies.map(e=>e.id)).size,33);
 assert.equal(enemies.filter(e=>bosses.has(e.id)).length,10);
 assert.equal(enemies.filter(e=>elites.has(e.id)).length,3);
 assert.equal(enemies.filter(e=>!bosses.has(e.id)&&!elites.has(e.id)).length,20);
 const validation=validateContent(contentBundle); assert.equal(validation.ok,true,JSON.stringify(validation.errors));
 const moveIds=new Set();
 for(const id of added){const def=reg.enemies.get(id);assert(def);for(const key of Object.keys(def.moves)){assert(!moveIds.has(key),'new move ID repeated: '+key);moveIds.add(key);}assert(Object.values(def.moves).some(m=>m.damage>0));}
});
test('all 46 new moves execute their actual damage, Block, and effect payloads',()=>{
 let count=0;
 for(const id of added)for(const [key,move]of Object.entries(reg.enemies.get(id).moves)){
  const c=fight(id),e=c.enemies[0];e.intent={kind:move.intent,moveId:key};e.hp-=1;
  const before=c.player.hp;end(c);
  if(move.delay){assert.equal(c.player.hp,before,id+': damage before windup');assert.equal(e.pendingMove.moveId,key);assert.equal(e.block,move.delay.whileCharging.block);for(let n=0;n<move.delay.turns;n++)end(c);assert.equal(e.pendingMove,null);}
  assert.equal(before-c.player.hp,(move.damage||0)*(move.hits||1),id+'/'+key+' damage');
  if(move.block!=null)assert.equal(e.block,move.block,id+'/'+key+' Block');
  for(const effect of move.effects||[]){
   if(effect.op==='heal')assert.equal(e.hp,e.maxHp,id+'/'+key+' heal');
   if(effect.op==='addCard')assert(Object.values(c.piles).flat().some(card=>card.cardId===effect.card),id+'/'+key+' card');
   if(effect.op==='applyStatus'){const target=effect.target==='self'?e:c.player;assert(target.statuses[effect.status],id+'/'+key+' status');}
  }
  assert.equal(c.phase,'player');count++;
 }
 assert.equal(count,46);
});
test('all seven new boss phases unlock once and never replay after healing',()=>{
 for(const id of added.filter(id=>bosses.has(id))){const c=fight(id),e=c.enemies[0],phase=reg.enemies.get(id).phases[0];
  e.hp=e.maxHp;checkPhases(c);assert.equal(c.triggerState.has('phase:'+e.id+':0'),false);
  e.hp=Math.floor(e.maxHp*phase.pct/100);checkPhases(c);assert.equal(c.triggerState.get('phase:'+e.id+':0').fires,1);
  for(const move of phase.unlockMoves||[])assert(e.unlockedMoves.includes(move));
  const queued=c.queue.length;e.hp=e.maxHp;checkPhases(c);e.hp=1;checkPhases(c);assert.equal(c.queue.length,queued);assert.equal(c.triggerState.get('phase:'+e.id+':0').fires,1);
 }
});
test('seeded weighted plans replay exactly and respect move locks and repeat limits',()=>{
 for(const id of added){const a=fight(id,876),b=fight(id,876);const def=reg.enemies.get(id);
  for(let n=0;n<45;n++){assert.deepEqual(a.enemies[0].intent,b.enemies[0].intent);end(a);end(b);}
  const history=a.enemies[0].movesHistory;assert(history.length>5);
  let previous=null,repeats=0;for(const moveId of history){const move=def.moves[moveId];assert(!move.locked,id+' selected locked '+moveId);repeats=moveId===previous?repeats+1:1;previous=moveId;if(move.maxConsecutive)assert(repeats<=move.maxConsecutive,id+' exceeded '+moveId);}
  assert.deepEqual(a.rng.getCounters(),b.rng.getCounters());
 }
});


test('live pools expose all 20 regular enemies and 10 bosses through seeded legal encounters',()=>{
 const encounters=contentBundle.encounters;
 const poolIds=pool=>new Set(encounters.filter(e=>e.pool===pool).flatMap(e=>e.enemies));
 assert.equal(poolIds('normal').size,20);assert.equal(poolIds('boss').size,10);assert.equal(poolIds('elite').size,3);
 assert.deepEqual([...poolIds('boss')].sort(),[...bosses].sort());
 const actIds=[['lanternMoth','briarHermit','chainScavenger','bellKeeper','thornMatriarch'],['mirrorScribe','stitchCrab','glassRegent','marrowOrganist'],['cinderMantis','eclipseCantor','furnaceSaint','hollowAstronomer','ashheartDragon']];
 for(let act=1;act<=3;act++){
  for(const id of actIds[act-1]){
   const rows=encounters.filter(e=>e.enemies.includes(id));assert(rows.length);
   for(const row of rows){assert.equal(row.act,act);assert.equal(row.pool,bosses.has(id)?'boss':'normal');assert(row.weight>0);assert(row.floorBand.min>=1 && row.floorBand.min<=row.floorBand.max);assert(row.floorBand.max<=(bosses.has(id)?6:4));}
   assert(reg.enemies.get(id).tags.length>0,id+' needs creature tags');
  }
  for(const pool of ['normal','boss']){
   const expected=encounters.filter(e=>e.act===act&&e.pool===pool).map(e=>e.id),seen=new Set();
   const a=createRng(1700+act),b=createRng(1700+act);
   for(let n=0;n<600;n++){const id=rollEncounter(reg,a,{act,pool});assert.equal(id,rollEncounter(reg,b,{act,pool}));seen.add(id);}
   assert.deepEqual([...seen].sort(),expected.sort());
  }
 }
 for(const id of ['bossOmen','a2_bossStitchedKing','a3_bossRotValkyrie'])assert(encounters.some(e=>e.id===id&&e.pool==='boss'));
});
