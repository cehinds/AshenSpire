import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=process.env.COMBAT_QA_ROOT || 'D:/repos/.codex/worktrees/combat-expansion-runtime/AshenSpire';
const base=process.env.COMBAT_QA_WIRE || 'D:/repos/.codex/outputs/combat-card-stances/counter-visual-wire.json';
const load=path=>import(pathToFileURL(root+'/'+path));
const sessionPath=process.env.COMBAT_QA_SESSION_PATH || root+'/tools/session.mjs';
const {contentBundle}=await load('src/content/index.js');
const {createRegistries}=await load('src/model/registries.js');
const {initialClassTreeChoices}=await load('src/model/classTree.js');
const {registriesForClassMastery}=await load('src/model/classMasteryRun.js');
const {createSession}=await import(pathToFileURL(sessionPath));
const {projectLanSnapshot}=await load('tools/lan-state.mjs');
const {payAshenBlight}=await load('src/engine/ashenBlight.js');
const {resolveCoopPlayedCombatCard}=await load('src/ui/models/PlayedCombatCard.js');
const {resolveCombatAnimation}=await load('src/model/combatAnimation.js');
const registries=createRegistries({...contentBundle,balance:{...contentBundle.balance,
 enemyKnowledge:{...contentBundle.balance.enemyKnowledge,reads:{...contentBundle.balance.enemyKnowledge.reads,
 minimumExact:0,maximumExact:0,minimumClue:0,maximumClue:0}}}}),cases=[];
for(const convertedSeat of ['p1','p2']) {
 const host=createSession({registries,seedString:'GUARD2',combatExpansionVersion:2,
  knowledgeAuthority:{roomId:'visual-'+convertedSeat,privateSeed:0x24681357}});
 host.addMember({id:'p1',name:'Different owner',classId:'rogue',playInDeckOrder:true});
 host.addMember({id:'p2',name:'Paid Counter owner',classId:'reaver',playInDeckOrder:true});host.start();
 for(const member of host.session.members.values()) {
  while(member.run.classMasteryState?.initialTreeTiers.length) {
   const choices=initialClassTreeChoices(registriesForClassMastery(registries,member.run),member.run);
   assert.equal(host.chooseMasteryNode(member.id,choices[0]).ok,true);
  }
  if(member.id==='p2') {
   const mounted=member.run.deck.find(card=>card.cardId==='shieldBash'&&card.grantedBy==='roundShield');
   assert.ok(mounted,'actual mounted Round Shield card');mounted.abilityRank=1;
   member.run.deck=[mounted,...member.run.deck.filter(card=>card!==mounted)];
  }
 }
 for(const id of ['p1','p2'])assert.equal(host.chooseNode(id,host.session.mapGraph.startIds[0]).ok,true);
 const combat=host.live.combat,owner=combat.players.get(convertedSeat).entity;
 assert.equal(payAshenBlight({...combat,draw:()=>.99},owner,{amount:100,receiptId:'visual-'+convertedSeat,combatKey:combat.combatKey}).converted,true);
 for(const threshold of [25,50,75])assert.equal(host.combatBlightFeat(convertedSeat,{threshold,path:'martial'}).ok,true);
 for(const seat of combat.players.values())seat.entity.energy=seat.entity.stamina=seat.entity.mana=20;
 assert.equal(host.combatEndTurn('p1').ok,true,'actual host action refreshes funded pre-play scene');
 const beforeWire=projectLanSnapshot(host.snapshot(),['p1','p2']);
 const instance=beforeWire.scene.players.find(player=>player.id==='p2').hand.find(card=>card.cardId==='shieldBash'&&card.grantedBy==='roundShield');
 assert.ok(instance);assert.notDeepEqual(beforeWire.scene.players[0].attributes,beforeWire.scene.players[1].attributes);
 const committed=structuredClone(combat.players.get('p2').piles.hand.find(card=>card.instanceId===instance.instanceId));
 const hp=combat.enemies.map(enemy=>enemy.hp);
 assert.equal(host.combatPlay('p2',instance.instanceId,'p2',undefined,2).ok,true);
 const afterWire=projectLanSnapshot(host.snapshot(),['p1','p2']),receipt=afterWire.scene.events.find(event=>event.type==='cardPlayed');
 const raw=combat.eventLog.filter(event=>event.type==='cardPlayed').at(-1);
 assert.ok(receipt,'actual session+LAN projection publishes paid card receipt');
 assert.deepEqual(receipt.cardInstance,committed);assert.deepEqual(receipt.cardInstance,raw.cardInstance);
 assert.deepEqual(receipt.cardTags,raw.cardTags);assert.equal(receipt.upcastTier,2);assert.equal(receipt.playerId,'p2');
 assert.equal(receipt.cardInstance.abilityRank,1);assert.deepEqual(combat.enemies.map(enemy=>enemy.hp),hp);
 const definition=resolveCoopPlayedCombatCard(registries,afterWire,receipt);
 assert.deepEqual(definition,resolveCoopPlayedCombatCard(registries,afterWire,raw));
 assert.equal(Boolean(definition.ashenBlightConverted),convertedSeat==='p2');
 assert.doesNotMatch(JSON.stringify(afterWire),/privateSeed|readCounters|knowledgeAuthority/);
 const price=instance.upcastPreviews[2],before=beforeWire.scene.players,after=afterWire.scene.players;
 assert.equal(after.find(p=>p.id==='p2').energy,before.find(p=>p.id==='p2').energy-price.cost);
 assert.equal(after.find(p=>p.id==='p2').mana,before.find(p=>p.id==='p2').mana-price.manaCost);
 cases.push({convertedSeat,party:afterWire.party,before,after,enemies:afterWire.scene.enemies,
  events:afterWire.scene.events,receipt,instanceId:instance.instanceId,price:{sp:price.cost,mana:price.manaCost},
  expected:{ownerId:'p2',tier:2,converted:convertedSeat==='p2',effects:definition.effects,counterPayload:definition.counterPayload,technique:resolveCombatAnimation(definition,[],{classId:'reaver',combatExpansionVersion:2}).technique}});
}
const sources=['src/engine/combat.js','src/engine/coopCombat.js','src/ui/models/PlayedCombatCard.js','src/model/combatAnimation.js','tools/session.mjs','tools/lan-state.mjs'];
writeFileSync(base,JSON.stringify({boundary:'production createSession accepted actions -> host snapshot -> projectLanSnapshot canned transport; compiled client handles actual public receipt, no socket/second-browser claim',
 ...(sessionPath!==root+'/tools/session.mjs'?{stagedSessionValidationOnly:sessionPath}:{}),
 sources:Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(readFileSync(path==='tools/session.mjs'?sessionPath:root+'/'+path)).digest('hex')])),cases},null,2));
console.log('Prepared two actual session/LAN projected paid p2 Tier2 receipt cases with distinct p1 class/stats and corruption ownership. '+base);
