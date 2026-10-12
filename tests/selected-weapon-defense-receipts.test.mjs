import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries } from '../src/model/registries.js';
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
  applyAttackDamage(combat,combat.enemies[0],combat.player,damage,[],{
    combatProfile:{camp,maneuver:'attack',damageType:'blunt',reach:'contact',targeting:'single'},
    attack:{source:camp==='spell'?'spell':'weapon',damageType:'blunt'}});
  return {combat,events:combat.eventLog.slice(before)};
}
const reactions=events=>events.map(event=>selectedWeaponReactionFor(event,pilot)).filter(Boolean);

test('real expanded Block, Barrier, Ward and typed reduction receipts earn protection only with zero HP loss',()=>{
  for(const defense of [{block:5},{camp:'spell',barrier:5},{camp:'spell',ward:5},
    {camp:'spell',ward:3,barrier:2},{flat:5}, {profiles:{player:{immunities:['blunt']}}}]) {
    const {combat,events}=contact(defense);
    assert.equal(combat.player.hp,100,JSON.stringify(defense));
    assert.deepEqual(reactions(events),['fully-defended'],JSON.stringify(defense));
    const before=structuredClone(events),rng=combat.rng.getCounters();
    reactions(events);assert.deepEqual(events,before);assert.deepEqual(combat.rng.getCounters(),rng);
  }
  const {combat,events}=contact({damage:10,camp:'spell',ward:8,barrier:1});
  const receipt=events.find(event=>event.type==='damageDealt');
  assert.deepEqual([receipt.amount,receipt.blocked,receipt.wardResisted],[2,1,8]);
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
