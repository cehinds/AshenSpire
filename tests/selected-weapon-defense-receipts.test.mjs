import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {decorateCombatEffects} from '../src/model/combatEffectEvents.js';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { resolvePlayedCombatCard } from '../src/ui/models/PlayedCombatCard.js';
import {selectedWeaponCounterOrigins} from '../src/model/selectedWeaponSequences.js';
import {selectedWeaponCounterFor} from '../src/model/selectedWeaponStances.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyAttackDamage, executeAction } from '../src/engine/actions.js';
import { selectedWeaponReactionFor, REAVER_GREATSWORD_PILOT as pilot } from '../src/model/selectedWeaponStances.js';

const registries=createRegistries(contentBundle);
function contact({camp='physical',damage=5,block=0,barrier=0,ward=0,flat=0,statuses={},evade,profiles}={}) {
  const combat=createCombat({registries,rng:createRng(904),combatExpansionVersion:2,
    ...(profiles?{ruleset:combatRules,combatProfiles:profiles}:{}),enemyIds:['wanderingSoldier'],
    player:{classId:'reaver',maxHp:100,hp:100,maxMana:20,mana:20,maxStamina:20,stamina:20,
      energyMax:10,drawPerTurn:1,deck:[{cardId:'strike',instanceId:'one'}]}});
  Object.assign(combat.player,{block,barrier,statuses,ratings:{ar:0,dr:0,pr:0,poise:0,ward:0},
    damageResistanceFlat:{blunt:flat},damageWeaknessPercent:{},combatEvade:evade});
  combat.player.persistentWard.value=ward;
  combat.enemies[0].ratings={ar:0,dr:0,pr:0,poise:0,ward:0};
  const before=combat.eventLog.length;
  // A melee spell with a physical type splits (magicShareOf); the spell cases are all magic so Barrier and Ward meet the whole hit.
  applyAttackDamage(combat,combat.enemies[0],combat.player,damage,[],{
    combatProfile:{camp,maneuver:'attack',damageType:'blunt',reach:'contact',targeting:'single',...(camp==='spell'?{magicShare:1}:{})},
    attack:{source:camp==='spell'?'spell':'weapon',damageType:'blunt'}});
  return {combat,events:combat.eventLog.slice(before)};
}
const reactions=events=>events.map(event=>selectedWeaponReactionFor(event,pilot)).filter(Boolean);

test('real expanded Block, Barrier, Ward and typed reduction receipts earn protection only with zero HP loss',()=>{
  for(const defense of [{block:5},{camp:'spell',barrier:5},{camp:'spell',ward:3,barrier:5},
    {flat:5}, {profiles:{player:{immunities:['blunt']}}}]) {
    const {combat,events}=contact(defense);
    assert.equal(combat.player.hp,100,JSON.stringify(defense));
    assert.deepEqual(reactions(events),['fully-defended'],JSON.stringify(defense));
    const before=structuredClone(events),rng=combat.rng.getCounters();
    reactions(events);assert.deepEqual(events,before);assert.deepEqual(combat.rng.getCounters(),rng);
  }
  // Ward is a pool that lets at least 1 through each hit it meets, so a hit that reaches Ward always costs HP.
  for(const defense of [{camp:'spell',ward:5},{camp:'spell',ward:3,barrier:2}]) {
    const {combat,events}=contact(defense);
    const receipt=events.find(event=>event.type==='damageDealt');
    assert.deepEqual([receipt.amount,receipt.blocked,receipt.wardResisted],[1,0,4],JSON.stringify(defense));
    assert.equal(combat.player.hp,99,JSON.stringify(defense));
    assert.deepEqual(reactions(events),[],JSON.stringify(defense));
  }
  const {combat,events}=contact({damage:10,camp:'spell',ward:8,barrier:1});
  const receipt=events.find(event=>event.type==='damageDealt');
  // blocked is Block alone; wardResisted is the magic part's Barrier (1) and Ward (8) absorption.
  assert.deepEqual([receipt.amount,receipt.blocked,receipt.wardResisted],[1,0,9]);
  assert.equal(combat.player.hp,99);assert.deepEqual(reactions(events),[],'resistance never hides remaining HP damage');
  assert.deepEqual(reactions(contact({damage:0,block:10,ward:10}).events),[],'a zero attack earns no protection reaction');
});

test('real Invulnerability and successful Evade remain distinct from Decoy and status damage',()=>{
  const immune=contact({statuses:{invulnerability:{stacks:1}},evade:{charges:1,bonus:100}});
  assert.deepEqual(reactions(immune.events),['defend']);
  assert.equal(immune.events.some(event=>event.type==='damageDealt'),false);
  assert.equal(immune.combat.player.combatEvade.charges,1,'immunity does not spend Evade');
  const evaded=contact({evade:{charges:1,bonus:100}});
  assert.deepEqual(reactions(evaded.events),['evade']);
  assert.equal(evaded.events.some(event=>event.type==='damageDealt'),false);
  assert.deepEqual(reactions(contact({damage:0,statuses:{invulnerability:{stacks:1}}}).events),[]);
  const {combat}=contact({statuses:{invulnerability:{stacks:1}}}),start=combat.eventLog.length;
  executeAction(combat,{effect:{op:'loseHp',amount:1},source:combat.enemies[0],target:combat.player});
  assert.equal(combat.player.hp,99);assert.deepEqual(reactions(combat.eventLog.slice(start)),[]);
});


test('paid production Guard and Evasion counters associate only their actual absorbed incoming action',()=>{
  for(const [cardId,kind]of [['guardCounter','counter-guard'],['dodgeRoll','counter-evade'],['evasiveGuard','counter-guard']])for(const seed of [6,11]) {
    const run=createRunState({registries,classId:'reaver',seed,combatExpansionVersion:2,startingHands:{rightHand:'greatsword',leftHand:null}});
    const guard=run.deck.find(row=>row.equipmentRole==='guard');
    const counter=run.deck.find(row=>row.cardId===cardId)||{cardId,instanceId:'actual:'+cardId};
    run.deck=[guard,counter,...run.deck.filter(row=>row!==guard&&row!==counter)];
    const combat=createRunCombat({registries,run,rng:createRng(seed),enemyIds:['wanderingSoldier'],settings:{playInDeckOrder:true}});
    dispatch(combat,{type:'setReactions',enabled:false});
    for(const inst of [guard,counter])assert.ok(dispatch(combat,{type:'playCard',cardInstanceId:inst.instanceId,targetId:'player'}).events.some(row=>row.type==='cardPlayed'));
    const before=combat.player.hp,{events}=dispatch(combat,{type:'endTurn'});
    assert.equal(combat.player.hp,before);
    const returned=events.find(row=>row.type==='combatCounterTriggered');
    const avoided=events.find(row=>row.type==='combatAvoidanceResolved'&&row.avoided);
    if(cardId!=='guardCounter'&&seed===6) {
      assert.ok(avoided?.evade?.success);assert.equal(returned,undefined);
      assert.equal(selectedWeaponCounterOrigins(events).size,0,'an actual successful evade never invents a Counter');
      assert.deepEqual(reactions(events),['evade']);
    } else {
      assert.ok(returned);
      const snapshot=resolvePlayedCombatCard(combat,returned,returned.cardInstance);
      assert.equal(selectedWeaponCounterFor(snapshot,pilot,registries.cards.get(cardId)),kind);
      const origins=selectedWeaponCounterOrigins(events);
      const defended=events.find(row=>selectedWeaponReactionFor(row,pilot)==='fully-defended');
      assert.ok(origins.has(defended),'the incoming impact belongs to the combo and is not replayed separately');
      const decorated=decorateCombatEffects(events,registries);
      const shown=decorated.find(row=>selectedWeaponReactionFor(row,pilot)==='fully-defended');
      assert.notEqual(shown,defended,'production defense decoration clones the damage receipt');
      const source=readFileSync(new URL('../src/ui/screens/combat.js',import.meta.url),'utf8');
      const helper=source.slice(source.indexOf('  function selectedCounterOrigins(events) {'),source.indexOf('  const fxCtx = {'));
      const begin=source.indexOf('    reactionForReceipt: event => {'),end=source.indexOf('\n    reactionTimingForReceipt:',begin);
      const stage={poses:['counter-guard','counter-evade'],reactionPoses:['fully-defended','evade']};
      const screenHook=runInNewContext(`(()=>{${helper} const playbackCounterOrigins=selectedCounterOrigins(playbackEvents); return ({${source.slice(begin,end)}}).reactionForReceipt;})()`,{
        selectedWeaponCounterOrigins,selectedWeaponCounterFor,selectedWeaponReactionFor,resolvePlayedCombatCard,
        playbackEvents:decorated,combat,registries,selectedProfile:()=>pilot,stageFor:()=>stage,
        fxCtx:{anchorFor:()=>({})},
      });
      assert.equal(screenHook(shown),null,'the actual screen hook suppresses the decorated incoming prelude owned by the Counter');
      assert.equal(decorated.filter(row=>selectedWeaponReactionFor(row,pilot)&&screenHook(row)).length,0,'both returned routes have no separate incoming body prelude');
      assert.equal(decorated.filter(row=>row.type==='combatCounterTriggered').length,1,'one engine return owns the complete combo');

      assert.ok(events.every(event=>combat.eventLog.includes(event)),'dispatch retains receipt identity');
    }
  }
});
