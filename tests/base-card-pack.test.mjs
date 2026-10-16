import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadBaseCardPack, validateBaseCardEffects } from '../tools/base-cards.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { rollCardRewardIds } from '../src/engine/encounters.js';
import { gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';
import { cardChoice } from '../src/model/cardChoices.js';
import { botCardTargetId } from '../tools/simbot.mjs';
import { cardPlainText } from '../src/ui/components/card.js';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';

const pack = loadBaseCardPack();
const rows = pack.rows.filter(row => row.provenance.sourceProposal);
const source = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
function profile(modules = {}) { return resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules}); }
function registries(p = resolveGameProfile('current')) { return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,p)),p); }
const legacy = registries();
function fixture(cardId, reg = legacy) {
  const ref = (id, i) => ({instanceId:`base-test-${i}`,cardId:id,upgraded:false});
  const combat = createCombat({registries:reg,gameProfile:reg.gameProfile,rng:createRng(9),enemyIds:['wanderingSoldier'],player:{classId:'reaver',hp:500,maxHp:1000,maxStamina:50,stamina:40,maxMana:50,mana:40,energyMax:50,drawPerTurn:5,deck:Array.from({length:10},(_,i)=>ref('base.strike',i))}});
  combat.player.hp = 500; combat.player.maxHp = 1000;
  combat.player.stamina = 40; combat.player.mana = 40; combat.player.energy = 40;
  combat.piles.hand=[ref(cardId,'selected'),ref('base.strike','hand1'),ref('base.strike','hand2')];
  combat.piles.draw=[ref('base.strike','draw1'),ref('base.strike','draw2'),ref('base.strike','draw3')];
  combat.piles.discard=[ref('base.strike','discard')];combat.piles.exhaust=[ref('base.strike','exhaust')];
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 1000;enemy.block=0; }
  return combat;
}
function play(combat) {
  const ref=combat.piles.hand[0],def=resolveCard(combat.registries,ref);
  const plan=cardChoice(combat.registries,def,combat.player.classId,combat.player.stanceId);
  dispatch(combat,{type:'playCard',cardInstanceId:ref.instanceId,targetId:botCardTargetId(combat.registries,combat,ref,combat.enemies[0].id),...(plan?{choice:plan.options.find(row=>!row.active)?.id || plan.options[0]?.id}:{})});
  for(let i=0;combat.pendingCardChoice && i<4;i++) {
    const choice=combat.pendingCardChoice;
    dispatch(combat,{type:'chooseCards',cardInstanceIds:choice.candidateIds.slice(0,choice.count)});
  }
  assert.ok(!combat.pendingCardChoice);
  assert.ok(combat.eventLog.some(event=>event.type==='cardResolved'&&event.cardInstanceId===ref.instanceId),def.id);
  return ref;
}

test('both profile pins include the JSON pack and the expanded raw registry validates',()=>{
  for(const p of [profile(),resolveGameProfile('current')])assert.ok(p.lock.artifacts.some(row=>row.path.endsWith('base-cards/cards.json')));
  const result=validateContent(contentBundle);assert.equal(result.ok,true,JSON.stringify(result.errors));
  for(const row of rows)assert.ok(legacy.cards.has(row.definition.id));
  assert.equal(legacy.proposalStatusRules['base.greased'].behaviors.length>0,true);
  assert.throws(()=>createRegistries({...contentBundle,cards:[...contentBundle.cards,contentBundle.cards[0]]}),/Duplicate/);
});
test('all 67 authored combat cards preview and resolve through the actual current engine',()=>{
  for(const row of rows.filter(row=>row.provenance.sourceProposal.entityKind==='combatCard')) {
    const combat=fixture(row.definition.id);
    const before=combat.rng.getCounters();
    assert.doesNotThrow(()=>previewCard(combat,combat.piles.hand[0].instanceId,combat.enemies[0].id),row.definition.id);
    assert.deepEqual(combat.rng.getCounters(),before,'preview must not spend RNG');
    assert.doesNotThrow(()=>play(combat),row.definition.id);
  }
});
test('all three burden cards are real unplayable definitions and never normal rewards',()=>{
  for(const row of rows.filter(row=>row.definition.burden)) {
    const combat=fixture(row.definition.id);
    assert.throws(()=>play(combat),/unplayable|cannot play/i,row.definition.id);
    assert.equal(pack.groups['base.current-rewards'].members.includes(row.definition.id),false);
  }
});
test('core keeps its ten-card starter and only admits compatible rewards with active dependencies',()=>{
  const p=profile(),reg=registries(p),run=createRunState({seed:73,classId:'reaver',registries:reg});
  assert.equal(run.deck.length,10);assert.equal(run.deck.filter(card=>card.cardId==='core.reaverSpecial').length,1);
  assert.equal(run.deck.some(card=>card.cardId.startsWith('base.')),false);
  const admitted=new Set(p.content.cards.map(card=>card.id));
  assert.ok(admitted.has('base.draw'));assert.ok(admitted.has('base.foresight'));
  for(const id of ['base.greased','base.poison','base.blight','base.divine-strike','base.persistent-protection','base.retain','base.break-ward']) assert.equal(admitted.has(id),false,id);
  const offer=gameProfileRewardOffers(reg,run,createRng(17),{offerId:'base-core',source:'normal'});
  for(const option of offer.options)if(option.kind==='combatCards')assert.equal(reg.cards.get(option.id).type==='status',false);
  for(const toggle of ['statuses','stances','defenses','equipment','stats','reactions','intent']) {
    const changed=profile({[toggle]:false});
    for(const card of changed.content.cards.filter(card=>card.id.startsWith('base.'))) {
      const row=pack.rows.find(row=>row.definition.id===card.id);
      assert.equal(row.requirements.modules.includes(toggle),false,`${toggle}: ${card.id}`);
      for(const effect of card.effects)if(effect.op==='applyStatus')assert.equal((pack.statusSource.rules[effect.status]?.requires.modules || []).includes(toggle),false,`${toggle}: ${card.id} status dependency`);
    }
  }
});
test('all admitted core cards resolve explicit SP/MP-off alternatives without disabled costs',()=>{
  for(const include of [[],['sp'],['mp'],['sp','mp']]) {
    const p=profile({resources:{include}}),reg=registries(p);
    for(const card of p.content.cards.filter(row=>row.id.startsWith('base.'))) {
      const projected=projectGameCard(p,card.id),resolved=resolveCard(reg,{cardId:card.id});
      if(!include.includes('sp'))assert.equal(projected.staminaCost,0,card.id);
      if(!include.includes('mp'))assert.equal(resolved.manaCost,0,card.id);
      assert.ok(projected.effects.length || projected.burden,card.id);
    }
  }
});
test('current rewards can draw the expanded authored pool and preserve old balanced definitions',()=>{
  const selected=new Set();
  for(let seed=1;seed<=200;seed++)for(const id of rollCardRewardIds(legacy,createRng(seed),{classId:'reaver',pool:'normal'}))if(id.startsWith('base.'))selected.add(id);
  assert.ok(selected.size>30,`${selected.size} base rewards actually drawn`);
  for(const id of pack.groups['base.current-rewards'].members)assert.ok(legacy.classes.get('reaver').cardPool.includes(id),id);
  const old=contentBundle.cards.find(row=>row.id==='greatswordSunderingHew');
  assert.deepEqual([old.cost,old.manaCost,old.effects[0].amount],[2,1,36]);
});
test('closed opcode/formula/reference validation and duplicate author IDs fail by name',()=>{
  for(const mutation of [card=>card.effects=[{op:'fakeCardEffect'}],card=>card.effects=[{op:'damage',target:'enemy',amount:{f:'fakeFormula'}}],card=>card.effects=[{op:'applyStatus',target:'self',status:'missing-status',stacks:1}]]) {
    const changed=structuredClone(pack);mutation(changed.rows[0].definition);assert.throws(()=>validateBaseCardEffects(changed),/base.persistent-protection/);
  }
  const {catalog,authors}=compileGameProfiles(),changed=structuredClone(catalog);
  changed.packs['ashen.base-cards@1.0.0'].content.baseCards.cards[1].definition.id='base.persistent-protection';
  assert.throws(()=>resolveGameAuthor(authors.core,changed),/duplicate.*base.persistent-protection/);
});
test('authored rule clauses and namespaced numeric tokens survive the real card text projection',()=>{
  for(const id of ['base.persistent-protection','base.poison','base.mirrors','base.extra-weapon','base.retain-block']) {
    const text=cardPlainText(legacy,{cardId:id});assert.equal(/[{}]/.test(text),false,text);assert.ok(text.length>5);
  }
  assert.match(cardPlainText(legacy,{cardId:'base.transmute'}),/cinders/);
  assert.match(cardPlainText(legacy,{cardId:'base.one-use-scroll'}),/Foresight.*One play per combat/);
});
