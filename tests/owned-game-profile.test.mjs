import test from 'node:test';
import assert from 'node:assert/strict';
import { ownGameProfile, shareableGameProfile } from '../src/model/ownedGameProfile.js';
import { freezeProfile } from '../src/engine/gameProfileCombat.js';
import { candidateState, foundationTransaction } from '../src/engine/combatRules.js';
import { bindTurnStamina } from '../src/model/turnStamina.js';
import { createRng } from '../src/engine/rng.js';
const pin = value => ownGameProfile(value, freezeProfile);
const ctx = gameProfile => ({ gameProfile, registries: {}, rng: createRng(17), queue: [], enemies: [], eventLog: [],
  _emitEvent: (state,type,payload) => { const event={type,...payload}; state.eventLog.push(event); return event; } });

test('owned profile is an exact detached copy and every descendant is immutable even below a frozen root',()=>{
  const source=Object.freeze({$comment:'preserve this',modules:{cards:{handBase:5}},list:[1,{text:'data'}]});
  const copy=pin(source);
  assert.deepEqual(copy,source);assert.notEqual(copy,source);assert.notEqual(copy.modules,source.modules);
  assert.equal(copy.$comment,'preserve this');assert.equal(Object.isFrozen(copy.modules.cards),true);
  assert.equal(Object.isFrozen(copy.list[1]),true);assert.throws(()=>{copy.modules.cards.handBase=99;},TypeError);
  source.modules.cards.handBase=8;assert.equal(copy.modules.cards.handBase,5);
  assert.equal(shareableGameProfile({gameProfile:copy}),copy);
});
test('exact native JSON copy retains comments, negative zero, own special keys, nulls and key order',()=>{
  const source=JSON.parse('{"$comment":"keep","__proto__":{"value":1},"constructor":"ordinary data","zero":0,"nil":null}');
  source.zero=-0;const copy=pin(source);
  assert.deepEqual(Object.keys(copy),Object.keys(source));assert.equal(Object.hasOwn(copy,'__proto__'),true);
  assert.equal(copy.__proto__.value,1);assert.equal(Object.getPrototypeOf(copy),Object.prototype);
  assert.equal(Object.is(copy.zero,-0),true);assert.equal(copy.nil,null);assert.equal(copy.$comment,'keep');
});
test('mutable, forged, shallow-frozen and externally deep-frozen profiles retain full clone behavior',()=>{
  for(const profile of [{modules:{x:1}},Object.freeze({modules:{x:1}}),freezeProfile({modules:{x:1}})]) {
    const original=ctx(profile), candidate=candidateState(original);
    assert.notEqual(candidate.gameProfile,profile);assert.deepEqual(candidate.gameProfile,profile);
    candidate.gameProfile.modules.x=2;assert.equal(profile.modules.x,1);
  }
  const copied=structuredClone(pin({modules:{x:1}}));assert.equal(shareableGameProfile({gameProfile:copied}),null);
});
test('sharing omits the profile from the actual structured clone but preserves mutable aliases and cycles',()=>{
  const profile=pin({modules:{cards:{handBase:5}}}),original=ctx(profile),shared={count:1};
  original.first=shared;original.second=shared;shared.self=shared;
  const native=globalThis.structuredClone;let clonedProfile=false;
  globalThis.structuredClone=value=>{clonedProfile ||= Object.hasOwn(value,'gameProfile');return native(value);};
  let candidate;
  try {candidate=candidateState(original,{detached:true});} finally {globalThis.structuredClone=native;}
  assert.equal(clonedProfile,false);assert.equal(candidate.gameProfile,profile);
  assert.equal(candidate.first,candidate.second);assert.equal(candidate.first.self,candidate.first);assert.notEqual(candidate.first,shared);
  candidate.first.count=2;assert.equal(shared.count,1);assert.notEqual(candidate.rng,original.rng);
});
test('profile or descendant aliases fall back to one full graph clone',()=>{
  const profile=pin({modules:{cards:{handBase:5}}});
  for(const alias of [profile,profile.modules,profile.modules.cards]) {
    const original=ctx(profile);original.alias=alias;const candidate=candidateState(original);
    assert.notEqual(candidate.gameProfile,profile);
    const expected=alias===profile?candidate.gameProfile:alias===profile.modules?candidate.gameProfile.modules:candidate.gameProfile.modules.cards;
    assert.equal(candidate.alias,expected);candidate.gameProfile.modules.cards.handBase=9;assert.equal(profile.modules.cards.handBase,5);
  }
});
test('accessors are read only once by native cloning and nonplain containers conservatively fall back',()=>{
  const profile=pin({modules:{cards:{handBase:5}}}), original=ctx(profile);let reads=0;
  original.extra={get data(){reads++;return profile.modules;}};
  const candidate=candidateState(original);assert.equal(reads,1);assert.equal(candidate.extra.data,candidate.gameProfile.modules);
  for(const extra of [new Map([['profile',profile]]),new Set([profile.modules]),new Date(0)]) {
    const data=ctx(profile);data.extra=extra;const result=candidateState(data);
    assert.notEqual(result.gameProfile,profile);assert.deepEqual(result.extra,structuredClone(extra));
    if(extra instanceof Map)assert.equal(result.extra.get('profile'),result.gameProfile);
    if(extra instanceof Set)assert.ok(result.extra.has(result.gameProfile.modules));
  }
});
test('native mutable Maps keep shared aliases and cycles while profile key/value aliases fall back',()=>{
  const profile=pin({modules:{cards:{handBase:5}}}),original=ctx(profile),row={count:1};
  original.row=row;original.triggerState=new Map([['row',row]]);original.triggerState.set('self',original.triggerState);
  const candidate=candidateState(original);
  assert.equal(candidate.gameProfile,profile);assert.notEqual(candidate.triggerState,original.triggerState);
  assert.equal(candidate.triggerState.get('row'),candidate.row);assert.equal(candidate.triggerState.get('self'),candidate.triggerState);
  candidate.row.count=2;assert.equal(row.count,1);
  for(const member of [profile,profile.modules,profile.modules.cards]) for(const position of ['key','value']) {
    const data=ctx(profile);data.triggerState=new Map(position==='key'?[[member,'data']]:[['data',member]]);
    const result=candidateState(data);assert.notEqual(result.gameProfile,profile);
    const expected=member===profile?result.gameProfile:member===profile.modules?result.gameProfile.modules:result.gameProfile.modules.cards;
    if(position==='key')assert.ok(result.triggerState.has(expected));else assert.equal(result.triggerState.get('data'),expected);
  }
  class CustomMap extends Map {}
  assert.equal(shareableGameProfile({gameProfile:profile,extra:new CustomMap()}),null);
  assert.equal(shareableGameProfile({gameProfile:profile,extra:new Proxy(new Map(),{})}),null);
});
test('only exact owner-installed stamina aliases with own data backing permit sharing',()=>{
  const profile=pin({modules:{cards:{handBase:5}}}),original=ctx(profile);
  original.player=bindTurnStamina({stamina:3,maxStamina:5});
  const candidate=candidateState(original);assert.equal(candidate.gameProfile,profile);
  assert.equal(candidate.player.energy,3);candidate.player.energy=2;assert.equal(candidate.player.stamina,2);assert.equal(original.player.stamina,3);
  const alias=Object.getOwnPropertyDescriptor(original.player,'energy');
  const forged=ctx(profile);forged.player={stamina:3,maxStamina:5};Object.defineProperty(forged.player,'energy',alias);
  assert.notEqual(candidateState(forged).gameProfile,profile);
  Object.defineProperty(original.player,'energy',{configurable:false});
  assert.notEqual(candidateState(original).gameProfile,profile,'changed descriptor loses ownership proof');
  const changed=ctx(profile);changed.player=bindTurnStamina({stamina:3,maxStamina:5});let reads=0;
  Object.defineProperty(changed.player,'energy',{enumerable:true,configurable:true,get(){reads++;return 3;}});
  assert.notEqual(candidateState(changed).gameProfile,profile);assert.equal(reads,1,'guard does not evaluate a forged getter');
  for(const member of [profile,profile.modules]) {
    const aliased=ctx(profile);aliased.player=bindTurnStamina({stamina:member,maxStamina:5});
    const result=candidateState(aliased);assert.notEqual(result.gameProfile,profile);
    assert.equal(result.player.energy,member===profile?result.gameProfile:result.gameProfile.modules);
  }
  const inherited=ctx(profile);inherited.player=bindTurnStamina({stamina:3,maxStamina:5});delete inherited.player.stamina;
  assert.notEqual(candidateState(inherited).gameProfile,profile,'absent own backing retains fallback');
  const backing=ctx(profile);backing.player=bindTurnStamina({stamina:3,maxStamina:5});let backingReads=0;
  Object.defineProperty(backing.player,'stamina',{enumerable:true,configurable:true,get(){backingReads++;return 3;}});
  structuredClone(backing.player);const nativeReads=backingReads;backingReads=0;
  assert.notEqual(candidateState(backing).gameProfile,profile);assert.equal(backingReads,nativeReads,'no extra backing getter execution');
});
test('unsupported profile data keeps legacy fallback and cannot gain a JSON ownership brand',()=>{
  const profile=pin({date:new Date(0)});assert.equal(shareableGameProfile({gameProfile:profile}),null);
  assert.equal(Object.isFrozen(profile),true);assert.equal(pin(3),3);
});
test('failed transactions and detached previews preserve live mutable state and RNG',()=>{
  const original=ctx(pin({modules:{x:1}}));original.mutable={count:1};const counters=original.rng.getCounters();
  const preview=candidateState(original,{detached:true});preview.mutable.count=9;preview.rng.float('misc');
  assert.equal(original.mutable.count,1);assert.deepEqual(original.rng.getCounters(),counters);
  assert.throws(()=>foundationTransaction(original,candidate=>{candidate.mutable.count=20;candidate.rng.float('misc');throw Error('refused');}),/refused/);
  assert.equal(original.mutable.count,1);assert.deepEqual(original.rng.getCounters(),counters);
  const mutableIdentity=original.mutable;
  foundationTransaction(original,candidate=>{candidate.mutable.count++;candidate.rng.float('misc');});
  assert.equal(original.mutable.count,2);assert.notEqual(original.mutable,mutableIdentity);assert.equal(original.gameProfile,preview.gameProfile);
});
