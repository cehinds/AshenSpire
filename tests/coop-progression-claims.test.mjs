import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries,resolveCard} from '../src/model/registries.js';
import {registriesForClassMastery} from '../src/model/classMasteryRun.js';
import {bankSkillXp,xpToNext,pendingSkillLevelCount} from '../src/model/skills.js';
import {createSession,restoreSession} from '../tools/session.mjs';
import {playCard,endTurn} from '../src/engine/coopCombat.js';
import {validateRunShape} from '../src/model/state.js';
import {xpToNext as characterXpToNext} from '../src/model/levelup.js';
import {coopProgressionProblems} from '../src/model/coopProgression.js';

const root=createRegistries(contentBundle);
function fresh(){const host=createSession({registries:root,seedString:'CLAIM20'});host.addMember({id:'a',name:'A',classId:'reaver',classMastery:{}});host.addMember({id:'b',name:'B',classId:'reaver'});host.start();return host;}
function win(host,{receipt={combatManeuvers:101}}={}){
  host.resolveNode({type:'monster'});assert.ok(host.live);
  host.live.combat.skillXp ||= {};host.live.combat.skillXp.a={xp:{...receipt}};
  let plays=0;
  host.autoResolveCombat((combat,id)=>{
    for(const enemy of combat.enemies)if(enemy.alive)enemy.hp=Math.min(enemy.hp,1);
    const player=combat.players.get(id);if(!player||player.ended||combat.phase!=='player'||combat.result)return;
    for(let tries=0;tries<20&&!player.ended&&!combat.result;tries++){
      const inst=player.piles.hand.find(inst=>{const card=resolveCard(player.registries || root,inst);return !(card.keywords || []).includes('unplayable')&&card.cost!=='X'&&card.cost<=player.entity.energy&&(card.manaCost || 0)<=player.entity.mana;});
      if(!inst){endTurn(combat,id);break;}
      const card=resolveCard(player.registries || root,inst),target=(card.effects || []).some(effect=>effect.target==='enemy')?combat.enemies.find(enemy=>enemy.alive)?.id:undefined;
      try{playCard(combat,id,inst.instanceId,target);plays++;}catch{endTurn(combat,id);break;}
    }
    if(!player.ended&&!combat.result)endTurn(combat,id);
  });
  assert.equal(host.session.scene.kind,'reward');assert.ok(plays>0,'the live session resolves real card plays');
}
const copy=host=>structuredClone(host.serialize());
test('actual co-op victory banks expanded XP at the scoped curve and only manual claims unlock milestones',()=>{
  const host=fresh(),a=host.session.members.get('a'),scoped=registriesForClassMastery(root,a.run),classCost=xpToNext(scoped,'class',0);
  bankSkillXp(scoped,a.run,'class:reaver',classCost-1);a.run.classMasteryState.earnedXp.reaver+=classCost-1;
  a.run.level.xp=characterXpToNext(scoped,1)-1;
  win(host);
  assert.equal(a.run.skills.combatManeuvers.level,1);assert.equal(a.run.skills.combatManeuvers.xp,101);
  assert.equal(a.run.skills['class:reaver'].level,0);assert.equal(a.run.level.level,1);
  assert.equal(pendingSkillLevelCount(scoped,a.run,'combatManeuvers'),1);
  const old=copy(host),other=structuredClone(host.session.members.get('b').run),beforeRng=a.rng.getCounters();
  assert.equal(host.claimMemberSkillLevel('a','combatManeuvers',{saveSession:()=>false}).ok,false);assert.deepEqual(copy(host),old);
  let saved;const saveSession=data=>{saved=structuredClone(data);return true;};
  assert.equal(host.claimMemberSkillLevel('a','combatManeuvers',{saveSession}).ok,true);assert.equal(a.run.skills.combatManeuvers.level,2);assert.equal(a.run.skills.combatManeuvers.xp,1);
  const beforeClass=structuredClone(a.run.skills),classClaim=host.claimMemberSkillLevel('a','class:reaver',{saveSession});
  assert.equal(classClaim.ok,true);assert.equal(classClaim.award.skillAwards.length,4);
  for(const bonus of classClaim.award.skillAwards){assert.equal(bonus.gained,25);assert.equal(a.run.skills[bonus.skillId].level,beforeClass[bonus.skillId]?.level || (bonus.skillId==='combatManeuvers'?1:0));}
  assert.equal(a.run.classMilestones['class:reaver:1'].grants.feat.state,'pending');
  const view=host.snapshot().party.find(row=>row.id==='a'),offer=view.pendingProgression.classMilestoneRewards.find(row=>row.level===1&&row.rewardKind==='feat');assert.ok(offer);
  assert.equal(host.chooseClassMilestone('b',offer.receiptId,offer.options[0],{saveSession}).ok,false);
  const beforeTake=copy(host);assert.equal(host.chooseClassMilestone('a',offer.receiptId,offer.options[0],{saveSession:()=>{throw new Error('disk full');}}).ok,false);assert.deepEqual(copy(host),beforeTake);
  assert.equal(host.chooseClassMilestone('a',offer.receiptId,offer.options[0],{saveSession}).ok,true);
  assert.equal(host.chooseClassMilestone('a',offer.receiptId,offer.options[0],{saveSession}).ok,false);assert.ok(a.run.skillFeats.includes(offer.options[0]));
  assert.deepEqual(host.session.members.get('b').run,other);
  const restored=restoreSession(root,saved);assert.equal(restored.refusedMembers().length,0,JSON.stringify(restored.refusedMembers()));restored.setConnected('a',true);
  assert.equal(restored.chooseClassMilestone('a',offer.receiptId,offer.options[0],{saveSession}).ok,false);
  assert.deepEqual(validateRunShape(a.run),[]);assert.deepEqual(host.serialize().rng,old.rng);assert.ok(Object.keys(beforeRng).length);
  assert.equal(host.claimMemberSkillLevel('a','character',{saveSession}).ok,true);assert.equal(a.run.level.level,2);
  const levelOffer=host.snapshot().party.find(row=>row.id==='a').pendingProgression.levelCards[0];assert.ok(levelOffer);
  assert.equal(host.chooseMemberLevelCard('a',levelOffer.key,levelOffer.cardIds[0],{saveSession}).ok,true);assert.equal(host.chooseMemberLevelCard('a',levelOffer.key,levelOffer.cardIds[0],{saveSession}).ok,false);
});
test('all earned class milestone kinds are generated at level 12, persist across catch-up and claim once',()=>{
  const host=fresh(),a=host.session.members.get('a');let saved;
  const saveSession=data=>{saved=structuredClone(data);return true;};
  for(let level=1;level<=12;level++){
    const scoped=registriesForClassMastery(root,a.run),cost=xpToNext(scoped,'class',level-1);bankSkillXp(scoped,a.run,'class:reaver',cost);a.run.classMasteryState.earnedXp.reaver+=cost;
    assert.equal(host.claimMemberSkillLevel('a','class:reaver',{saveSession}).ok,true);
  }
  const offers=host.snapshot().party.find(row=>row.id==='a').pendingProgression.classMilestoneRewards;
  assert.deepEqual(Object.fromEntries(['cards','feat','armory','relic','attribute'].map(kind=>[kind,offers.filter(row=>row.rewardKind===kind).length])),{cards:6,feat:4,armory:4,relic:3,attribute:2});
  a.catchup=[{type:'reward',offer:{cardIds:[],classMilestoneRewards:structuredClone(offers)}}];
  for(const kind of ['cards','feat','armory','relic','attribute']){
    const offer=offers.find(row=>row.rewardKind===kind),selection=(offer.choiceIds || offer.options)[0];
    assert.equal(host.chooseClassMilestone('a',offer.receiptId,selection,{saveSession}).ok,true,kind);
    assert.equal(host.chooseClassMilestone('a',offer.receiptId,selection,{saveSession}).ok,false);
    assert.ok(!a.catchup[0].offer.classMilestoneRewards.some(row=>row.receiptId===offer.receiptId));
  }
  const restored=restoreSession(root,saved);assert.equal(restored.refusedMembers().length,0,JSON.stringify(restored.refusedMembers()));assert.deepEqual(restored.session.members.get('a').run.classMilestones,a.run.classMilestones);
});
test('initial veteran milestones are offered before combat and an atomic ability refusal never spends its receipt',()=>{
  const host=createSession({registries:root,seedString:'VETERAN'}),a=host.addMember({id:'a',name:'A',classId:'reaver',classMastery:{reaver:{xp:10000,level:4,unlockedRows:[]}}});host.start();
  assert.ok(host.snapshot().party[0].pendingProgression.classMilestoneRewards.some(row=>row.rewardKind==='feat'));
  const skillId='combatManeuvers',offerId='ability:combatManeuvers:1',cardIds=['quickstep','backstep','stomp'];
  a.run.abilityOffers ||= {};a.run.abilityOffers[offerId]={skillId,offerId,level:1,gradeLevel:1,cardIds,choiceIds:cardIds.map(id=>id+'@0'),abilityRanks:[0,0,0],intelligenceSnapshot:1,bonusRank:null};
  const before=copy(host);assert.equal(host.chooseAbilityDraft('a',offerId,'quickstep@0',{saveSession:()=>false}).ok,false);assert.deepEqual(copy(host),before);
  let saved;assert.equal(host.chooseAbilityDraft('a',offerId,'quickstep@0',{saveSession:data=>{saved=structuredClone(data);return true;}}).ok,true);
  assert.equal(a.run.deck.filter(card=>card.abilityOfferId===offerId).length,1);assert.equal(a.run.deck.find(card=>card.abilityOfferId===offerId).abilityRank,0);
  assert.equal(host.snapshot().party[0].deck.find(card=>card.cardId==='quickstep'&&card.abilityRank===0)?.abilityRank,0,'wire preserves the actual earned grade');
  assert.equal(host.chooseAbilityDraft('a',offerId,'quickstep@0',{saveSession:()=>true}).ok,false);assert.deepEqual(validateRunShape(a.run),[]);
  const restored=restoreSession(root,saved);assert.equal(restored.refusedMembers().length,0);
});
test('character card receipt validation rejects unfunded cards and host restore quarantines the forged seat',()=>{
  const host=fresh(),a=host.session.members.get('a');a.run.coopLevelCards={'coop-character:2:0':{key:'coop-character:2:0',level:2,cardIds:['stomp']}};
  assert.ok(coopProgressionProblems(a.run).length);assert.equal(host.chooseMemberLevelCard('a','coop-character:2:0','stomp',{saveSession:()=>true}).ok,false);
  const restored=restoreSession(root,copy(host));assert.equal(restored.refusedMembers()[0].id,'a');assert.ok(restored.session.members.has('b'));
});
