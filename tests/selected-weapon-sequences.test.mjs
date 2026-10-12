import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedWeaponSequence as clip, selectedWeaponSequenceTiming as timing, selectedWeaponCounterOrigins} from '../src/model/selectedWeaponSequences.js';
import {selectedWeaponCounterFor,REAVER_GREATSWORD_PILOT as pilot} from '../src/model/selectedWeaponStances.js';
import {applyCombatExpansionCard} from '../src/content/combatExpansionCards.js';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {ANIM_SPEEDS} from '../src/ui/animationPace.js';

test('review ratios keep the existing six-phase attack cadence and whole counter paths',()=>{
  assert.deepEqual(clip('fully-defended').durations,[2,3,1,2,3,2]);
  assert.equal(timing(clip('attack'),ANIM_SPEEDS.normal).totalMs,195);
  assert.equal(timing(clip('fully-defended'),ANIM_SPEEDS.normal).totalMs,422.5);
  assert.equal(timing(clip('counter-guard'),ANIM_SPEEDS.normal).totalMs,650);
  assert.equal(timing(clip('counter-guard'),ANIM_SPEEDS.normal).impactMs,520);
  assert.equal(clip('counter-guard').poses[clip('counter-guard').impact],'pilot-attack-3');
  assert.equal(timing(clip('counter-evade'),ANIM_SPEEDS.normal).totalMs,292.5);
  assert.deepEqual(clip('counter-evade').poses,[...clip('evade').poses,...clip('attack').poses]);
  assert.deepEqual(clip('counter-guard').poses,[...clip('fully-defended').poses,'pilot-smash',...clip('attack').poses]);
  for(const speed of Object.values(ANIM_SPEEDS))assert.equal(timing(clip('attack'),speed).totalMs,speed?.lungeMs||0);
});

test('counter routing reads authored Guard/Evasion and gives the canonical mixed Guard its existing identity',()=>{
  const r=createRegistries(contentBundle);
  for(const [id,expected]of [['guardCounter','counter-guard'],['riposte','counter-guard'],['dodgeRoll','counter-evade'],['evasiveGuard','counter-guard']]) {
    const base=r.cards.get(id);
    const snapshot=applyCombatExpansionCard(base);
    assert.equal(selectedWeaponCounterFor(snapshot,pilot,base),expected,id);
  }
  assert.equal(selectedWeaponCounterFor({cardTags:['camp:physical','maneuver:counter']},pilot),null);
  assert.equal(selectedWeaponCounterFor({cardTags:['camp:spell','maneuver:counter','guard']},pilot),null);
});

test('one matching consumed root earns a combo without suppressing an earlier or later hit from that attacker',()=>{
  const move=()=>({type:'enemyMoveStarted',sourceId:'enemy'});
  const hit=()=>({type:'damageDealt',sourceId:'enemy',targetId:'player'});
  const consume={type:'combatCounterConsumed',sourceId:'player',targetId:'enemy',cardId:'riposte',cardInstanceId:'c'};
  const returned={...consume,type:'combatCounterTriggered'};
  const earlier=hit(),origin=hit(),later=hit();
  assert.deepEqual([...selectedWeaponCounterOrigins([move(),earlier,move(),consume,origin,returned,move(),later])],[origin]);
  assert.equal(selectedWeaponCounterOrigins([move(),consume,origin,move(),returned]).size,0);
  assert.equal(selectedWeaponCounterOrigins([move(),consume,origin,{...returned,cardInstanceId:'other'}]).size,0);
});
