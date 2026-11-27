import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CardUpgradeRules } from '../src/model/cardUpgradeRules.js';
import { runInNewContext } from 'node:vm';
import { cards, fresh, registries as baseRegistries, withScoring } from './helpers/drawback-contract.mjs';
import { planCardUpgrade, ClearCardUpgradePlanCache } from '../src/model/cardUpgradeService.js';
import { canUpgrade, nextUpgradeOptions, nextUpgradeStep, RestUpgradeRule } from '../src/model/cardUpgradeLimits.js';
import { projectGameCard } from '../src/model/gameProfile.js';
import { resolveCard } from '../src/model/registries.js';
import { upgradeStepsOf, applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import * as UpgradeSteps from '../src/model/cardUpgradeSteps.js';
import { mulberry32 } from '../src/model/rng.js';
import { GetActiveScoring } from '../src/model/activeScoring.js';
import { cardUpgradeModel, cardUpgradeChanges } from '../src/ui/models/CardUpgradeModel.js';

// Assemble the original service contract with independently unprepared reads.
// This checks the new preparation against full quotes, not just one picked step.
function unpreparedPlan(run, registries, instance, {choices=1,combos=false,vendor=''}={}) {
  const verdict=canUpgrade(registries,run,instance,{preparation:null});
  const quote={ok:verdict.ok,code:verdict.code,reason:verdict.reason,instanceId:instance.instanceId,n:verdict.n,cost:verdict.cost,free:verdict.free,step:null,before:null,after:null};
  if(!verdict.ok&&verdict.code!=='stones')return quote;
  const base=registries.cards.get(instance.cardId),applied=upgradeStepsOf(instance);
  const face=ref=>projectGameCard(run,ref)||resolveCard(registries,ref);
  const after=step=>face({...instance,upgraded:true,upgradeSteps:[...applied,step]});
  const before=face(instance);
  if(choices<=1){
    const step=vendor?nextUpgradeOptions(run,instance,base,registries,1,{vendor,preparation:null})[0]||null:nextUpgradeStep(run,instance,base,registries,{preparation:null});
    return {...quote,...(vendor?{vendor}:{}),step,before,after:after(step)};
  }
  const options=nextUpgradeOptions(run,instance,base,registries,choices,{combos,vendor,preparation:null}).map(step=>({step,after:after(step)}));
  return {...quote,choices,combos,...(vendor?{vendor}:{}),step:options[0].step,options,before,after:options[0].after};
}

for(const scenario of ['fresh','authored','upgraded','maxed','slots','stones'])test('bounded preparation preserves complete independent quotes and reloads: '+scenario,()=>withScoring(()=>{
  const maxed={...cards.plain,id:'fixture.maxed',type:'power',cost:0,staminaCost:0,manaCost:0,effects:[]};
  const registries={...baseRegistries,cards:{...baseRegistries.cards,get:id=>id===maxed.id?maxed:baseRegistries.cards.get(id),has:id=>id===maxed.id||baseRegistries.cards.has(id)}};
  const run=fresh();run.seed=8301;run.level.level=5;run.smithingStones=scenario==='stones'?0:20;run.mapNodeId='fixture.smith';
  const instance={instanceId:'fixture.owned',cardId:scenario==='maxed'?maxed.id:scenario==='authored'?cards.hold.id:cards.plain.id,rank:3,upgraded:false,upgradeSteps:[]};
  if(scenario==='upgraded'||scenario==='stones')Object.assign(instance,{upgraded:true,upgradeSteps:[{k:'dmg',n:1},{k:'fx',fx:'draw',n:1},{k:'fx',fx:'retain'}]});
  if(scenario==='slots')Object.assign(instance,{rank:1,upgraded:true,upgradeSteps:[{k:'dmg',n:1},{k:'fx',fx:'draw',n:1}]});
  run.deck=[instance];run.sideboard=[];
  const snapshot=JSON.stringify(run),definitions=JSON.stringify([cards.plain,cards.hold,maxed]);
  for(const rule of [{},RestUpgradeRule(instance),{choices:3,vendor:'blacksmith'},{choices:3,vendor:'arcane'}]){
    ClearCardUpgradePlanCache(run);
    const expected=unpreparedPlan(run,registries,instance,rule);
    const actual=planCardUpgrade(run,registries,instance.instanceId,rule);
    assert.deepEqual(actual,expected);
    assert.ok(!JSON.stringify(actual).includes('projectionScope'),'scratch context never enters a quote or saved step');
    if(['maxed','slots','stones'].includes(scenario))assert.equal(actual.code,scenario);
    const loaded=JSON.parse(snapshot);
    assert.deepEqual(planCardUpgrade(loaded,registries,instance.instanceId,rule),expected);
    assert.equal(JSON.stringify(run),snapshot,'planning never mutates the run or its saved RNG facts');
  }
  assert.equal(JSON.stringify([cards.plain,cards.hold,maxed]),definitions);
  instance.playsEver=7;instance.rank=4;run.attributes.strength+=2;
  const rule={choices:3,vendor:'blacksmith'};
  assert.deepEqual(planCardUpgrade(run,registries,instance.instanceId,rule),unpreparedPlan(run,registries,instance,rule));
}));

test('prepared structural menus keep every seeded vendor selection and RNG draw identical, and reject changed operands',()=>withScoring(()=>{
  const preparation={},base=structuredClone(cards.plain),applied=[];
  const limits={rank:2,cardRank:2,playerLevel:5,instance:{rank:2},scoring:GetActiveScoring(),registries:baseRegistries};
  const compare=(extra,count)=>{
    let plainDraws=0,preparedDraws=0;
    const plainRng=upgradeStepRng(91,'fixture.roll',0),preparedRng=upgradeStepRng(91,'fixture.roll',0);
    const plain=rollUpgradeOptions(base,applied,applied.length,()=>{plainDraws++;return plainRng();},{...limits,...extra},count);
    const prepared=rollUpgradeOptions(base,applied,applied.length,()=>{preparedDraws++;return preparedRng();},{...limits,...extra,preparation},count);
    assert.deepEqual(prepared,plain);assert.equal(preparedDraws,plainDraws);
  };
  for(const vendor of ['', 'blacksmith','arcane'])for(const count of [1,3,20])compare({vendor},count);
  base.effects[0].amount=12;compare({},3);
  applied.push({k:'dmg',n:1});compare({},3);
  limits.rank=3;limits.cardRank=3;limits.instance.rank=3;compare({},3);
  limits.scale=2;compare({},3);
  limits.maxRange='melee';compare({},3);
  limits.scoring=structuredClone(limits.scoring);limits.scoring.effects.damage.weight=2;compare({},3);
}));

test('each picker row and option retains ordinary change descriptions, current prices and source ownership',()=>withScoring(()=>{
  const run=fresh();run.seed=73;run.level.level=5;run.smithingStones=20;
  run.deck=[cards.plain,cards.hold,cards.rising].map((card,index)=>({instanceId:'row.'+index,cardId:card.id,rank:3,upgraded:false,upgradeSteps:[]}));
  run.sideboard=[];
  const snapshot=JSON.stringify(run),definitions=JSON.stringify([cards.plain,cards.hold,cards.rising]);
  for(const price of [100,175]){
    const quoted=[];
    const model=cardUpgradeModel(baseRegistries,run,run.deck[0].instanceId,{blacksmith:true,
      quote:id=>{quoted.push(id);return {ok:true,cost:1,cinders:price,reason:''};}});
    assert.equal(model.rows.length,3);
    assert.deepEqual(quoted,run.deck.map(card=>card.instanceId));
    for(const row of model.rows){
      assert.equal(row.cinders,price);
      assert.deepEqual(row.changes,cardUpgradeChanges(baseRegistries,row.plan.before,row.plan.after));
      for(const option of row.options)assert.deepEqual(option.changes,cardUpgradeChanges(baseRegistries,row.plan.before,option.after));
    }
    assert.equal(model.selected.instanceId,run.deck[0].instanceId);
    assert.equal(JSON.stringify(run),snapshot);
  }
  assert.equal(JSON.stringify([cards.plain,cards.hold,cards.rising]),definitions);
}));

test('standalone change descriptions refresh mutable faces and preserve null comparisons',()=>{
  const before=structuredClone(cards.plain),after=structuredClone(cards.plain);
  after.effects[0].amount+=4;
  const first=cardUpgradeChanges(baseRegistries,before,after),snapshot=structuredClone(before);
  after.effects[0].amount+=8;
  after.tags=after.tags.map(tag=>tag==='maneuver:attack'?'maneuver:sweep':tag);
  const second=cardUpgradeChanges(baseRegistries,before,after);
  assert.ok(Number(second.find(row=>row.label==='DAMAGE').after)>Number(first.find(row=>row.label==='DAMAGE').after));
  assert.ok(second.some(row=>row.after==='Sweep'));
  assert.deepEqual(before,snapshot);
  assert.equal(Object.isFrozen(after.effects[0]),false);
  assert.deepEqual(cardUpgradeChanges(baseRegistries,null,after),[]);
  assert.deepEqual(cardUpgradeChanges(baseRegistries,before,null),[]);
});

test('a new uncached plan compiles current in-place scoring edits and never exports its scorer',()=>withScoring(()=>{
  const run=fresh();run.seed=83;run.level.level=5;run.smithingStones=20;
  const instance={instanceId:'current.weights',cardId:cards.plain.id,rank:3,upgraded:false,upgradeSteps:[]};
  run.deck=[instance];run.sideboard=[];
  const rule={choices:3,vendor:'blacksmith'},weights=GetActiveScoring();
  const before=planCardUpgrade(run,baseRegistries,instance.instanceId,rule);
  weights.effects.damage.weight=1000;
  weights.costs.sp.weight=-20;
  ClearCardUpgradePlanCache(run);
  const after=planCardUpgrade(run,baseRegistries,instance.instanceId,rule);
  assert.notEqual(after,before);
  assert.deepEqual(after,unpreparedPlan(run,baseRegistries,instance,rule));
  const inspect=value=>{
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      assert.ok(!['preparation','projectionScope','scoreCard','scorer'].includes(key));
      assert.notEqual(typeof child,'function');inspect(child);
    }
  };
  inspect(after);
}));

// Exercise the actual offer assembly with explicit roller output. Repeated
// outcomes are unusual with family exclusion, but must still fill the offer.
// Only the low-level stream is controlled; upgrade application stays real.
const limitsSource = readFileSync(new URL('../src/model/cardUpgradeLimits.js', import.meta.url), 'utf8')
  .replace(/^import\b[^\n]*\n/gm, '').replace(/^export /gm, '');
function offerAssembly(pool) {
  const calls = [];
  const api = runInNewContext(`${limitsSource}\n;({ nextUpgradeOptions });`, {
    CardUpgradeRules,
    upgradeStepsOf, applyUpgradeSteps, mulberry32, GetActiveScoring,
    cardRank: () => 1, VisibleCardRank: () => 1, EffectiveTier: () => 1,
    NodeScheduleKey: () => '', OfferSalted: (_run, id) => id,
    UpgradeSteps: { ...UpgradeSteps, rollUpgradeOptions: (_base, _applied, _index, rng, limits, count) => {
      const options = pool.slice(0, count);
      for (const _ of options) { rng(); rng(); }
      calls.push({ count, vendor: limits.vendor || '', excludeFamilies: [...limits.excludeFamilies] });
      return options;
    } },
  });
  return { ...api, calls };
}
const prefixCard = () => ({ ...structuredClone(cards.plain),
  effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'block', target: 'self', amount: 4 }] });
const prefixSteps = [{ k: 'dmg', n: 1 }, { k: 'blk', n: 1 }, { k: 'fx', fx: 'draw', n: 1 }];

test('distinct offer assembly computes only its requested prefix and preserves vendor input', () => withScoring(() => {
  const base = prefixCard(), instance = { instanceId: 'prefix.owned', cardId: base.id, rank: 2, upgradeSteps: [] };
  const run = { seed: 39, level: { level: 3 } }, snapshot = JSON.stringify({ base, instance, run });
  for (const vendor of ['', 'blacksmith', 'arcane']) {
    const { nextUpgradeOptions: assemble, calls } = offerAssembly(prefixSteps);
    const options = assemble(run, instance, base, {}, 2, { vendor });
    assert.equal(JSON.stringify(options), JSON.stringify(prefixSteps.slice(0, 2)));
    assert.deepEqual(calls.map(call => call.count), [2], vendor || 'rest');
    assert.equal(calls[0].vendor, vendor);
  }
  assert.equal(JSON.stringify({ base, instance, run }), snapshot);
}));

test('duplicate prefixes retry the complete stream and retain the first distinct outcomes', () => withScoring(() => {
  const [a, b, c] = prefixSteps, base = prefixCard();
  const run = { seed: 39, level: { level: 3 } }, instance = { instanceId: 'prefix.owned', cardId: base.id };
  for (const [name, pool, expected] of [
    ['unique at target + 1', [a, a, b, c], [a, b]],
    ['unique at target + 2', [a, a, a, b, c], [a, b]],
    ['unique after initial surplus', [a, a, a, a, b, c], [a, b]],
    ['fewer available outcomes', [a, a, a], [a]],
  ]) {
    const { nextUpgradeOptions: assemble, calls } = offerAssembly(pool);
    assert.equal(JSON.stringify(assemble(run, instance, base, {}, 2)), JSON.stringify(expected), name);
    assert.deepEqual(calls.map(call => call.count), [2, 20], name);
  }
}));

test('authored offers retain their two-entry target and combos retain the complete partner pool', () => withScoring(() => {
  const base = prefixCard(), run = { seed: 39, level: { level: 3 } };
  base.upgrade = { effects: [{ op: 'damage', target: 'enemy', amount: 7 }, base.effects[1]] };
  const instance = { instanceId: 'prefix.owned', cardId: base.id }, snapshot = JSON.stringify({ base, run, instance });
  const authored = offerAssembly([{ k: 'authored' }, ...prefixSteps]);
  const options = authored.nextUpgradeOptions(run, instance, base, {}, 4);
  assert.equal(JSON.stringify(options), JSON.stringify([{ k: 'authored' }, prefixSteps[0]]));
  assert.deepEqual(authored.calls.map(call => call.count), [2]);
  assert.deepEqual(authored.calls[0].excludeFamilies, ['damage']);
  const combos = offerAssembly(prefixSteps);
  const combined = combos.nextUpgradeOptions(run, instance, base, {}, 2, { noAuthored: true, combos: true });
  assert.equal(combined.length, 2);
  assert.deepEqual(combos.calls.map(call => call.count), [20]);
  assert.equal(JSON.stringify({ base, run, instance }), snapshot);
}));

test('real seeded streams retain their complete prefix through specialty rejection and rank/rarity decoration', () => withScoring(() => {
  const base = prefixCard(), scoring = GetActiveScoring();
  scoring.rank = { unrankedMax: 0, width: 10, maxRank: 10, maxCp: 100 };
  const snapshot = JSON.stringify(base);
  const scenarios = [
    { name: 'rest', extra: {}, score: () => 0 },
    { name: 'vendor and family exclusion', extra: { vendor: 'blacksmith', excludeFamilies: ['flow'] }, score: () => 0 },
    { name: 'specialty rejection', extra: { nodeSpecialty: [{ kind: 'fx:draw' }] }, score: face => face.draw > 0 ? 1e6 : 0 },
    { name: 'CP rejection loop', extra: {}, score: () => 1e6 },
    { name: 'rarity promotion', extra: {}, score: () => 18, discounts: { common: 0, uncommon: 5, rare: 10 } },
    { name: 'rank promotion', extra: {}, score: () => 18, discounts: { common: 0, uncommon: 0, rare: 0 } },
  ];
  for (const scenario of scenarios) {
    scoring.rarity.discount = scenario.discounts || { common: 0, uncommon: 2, rare: 5 };
    const observations = [1, 3, 20].map(count => {
      let draws = 0, scores = 0;
      const rng = upgradeStepRng(91, 'fixture.prefix', 0);
      const preparation = { scorer: { scoring, score: face => {
        scores++;
        return { raw: face.name === base.name ? 0 : scenario.score(face) };
      } } };
      const options = rollUpgradeOptions(base, [], 0, () => { draws++; return rng(); }, {
        scoring, registries: baseRegistries, rank: 1, cardRank: 1, playerLevel: 2,
        instance: { rank: 1 }, tierUnlocks: false, preparation, ...scenario.extra,
      }, count);
      return { options, draws, scores };
    });
    for (let index = 0; index < 2; index++) {
      assert.deepEqual(observations[index].options, observations[2].options.slice(0, [1, 3][index]), scenario.name);
    }
    if (scenario.name === 'specialty rejection') {
      assert.ok(observations[0].scores > 2, 'the rejected specialty takes the bounded retry path');
      assert.ok(observations[2].options.every(step => step.fx !== 'draw'));
    }
    if (scenario.name === 'CP rejection loop') {
      assert.deepEqual(observations[2].options, []);
      assert.ok(observations[0].scores > 1 && observations[0].scores <= 97, 'at most 96 CP candidates plus the baseline');
    } else {
      assert.ok(observations[0].options.length > 0, scenario.name);
      assert.equal(observations[0].draws, 2, 'one offer retains the original two external RNG draws');
    }
    if (scenario.name === 'rarity promotion') assert.equal(observations[0].options[0].nextRarity, 'rare');
    if (scenario.name === 'rank promotion') assert.equal(observations[0].options[0].nextRank, 2);
  }
  assert.equal(JSON.stringify(base), snapshot);
}));

test('offer prefix optimization retains strict admission of complete card metadata', () => withScoring(() => {
  const run = fresh(), base = { ...prefixCard(), type: 'power', effects: [], costGrowth: { stamina: 1, mana: 0, perUse: 1, max: 3 } };
  const instance = { instanceId: 'prefix.invalid', cardId: base.id, rank: 2, upgradeSteps: [] };
  for (const value of [NaN, undefined]) {
    assert.throws(() => nextUpgradeOptions(run, instance, { ...base, metadata: { value } }, baseRegistries, 2), /finite acyclic JSON data/);
  }
  assert.throws(() => nextUpgradeOptions(run, instance, { ...base, $comment: () => 'not cloneable' }, baseRegistries, 2), { name: 'DataCloneError' });
}));
