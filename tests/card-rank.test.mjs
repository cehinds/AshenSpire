// tests/card-rank.test.mjs — SPEC §13.4o card ranks (phase B2a): a card
// instance carries a rank, each rank past 1 adds 1 to its primary number, a
// skill draft rolls the rank, and the rank survives combat, saves and takes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard, primaryEffectIndex } from '../src/model/registries.js';
import { serializeRun, deserializeRun } from '../src/model/state.js';
import { moveToSideboard } from '../src/model/deckRules.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { validateRunShape, createRunState } from '../src/model/state.js';
import { rollDraftRank } from '../src/model/skills.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { applyActionCosts, COST_CONFIG } from '../src/model/actionCosts.js';

// Small named-by-purpose cards fix the mechanics scenario, independently of
// the game's current card numbers, costs, grades, recipes or spell identities.
const fixtureCard=(id,type,effects,extra={})=>({id:`fixture.rank.${id}`,name:id,class:'colorless',rarity:'common',type,cost:1,manaCost:0,costRule:'fixed',keywords:[],effects,textTemplate:type==='attack'?'Deal {damage} damage.':'Gain {block} Block.',...extra});
const fixtureCards=[
  fixtureCard('strike','attack',[{op:'damage',target:'enemy',amount:6}],{upgrade:{effects:[{op:'damage',target:'enemy',amount:9}],textTemplate:'Deal {damage} damage.'}}),
  fixtureCard('defend','skill',[{op:'block',target:'self',amount:8}]),
  fixtureCard('blood','attack',[{op:'loseHp',amount:6},{op:'damage',target:'enemy',amount:20}]),
  fixtureCard('tempo','skill',[{op:'gainEnergy',amount:2},{op:'draw',amount:3},{op:'applyStatus',target:'self',status:'starstoneCharge',stacks:{f:'add',args:[1]}}]),
  fixtureCard('status','skill',[{op:'applyStatus',target:'self',status:'strength',stacks:1},{op:'draw',amount:1}]),
  fixtureCard('block-formula','attack',[{op:'block',target:'self',amount:8},{op:'damage',target:'enemy',amount:{f:'blockOf',of:'self'}}],{cost:2}),
  fixtureCard('multi','attack',[{op:'damage',target:'enemy',amount:2,hits:6},{op:'damage',target:'enemy',amount:1,if:{p:'firstAttackThisCombat'}}]),
  fixtureCard('x-hits','attack',[{op:'damage',target:'enemy',amount:6,hits:'X'}]),
];
const registries = createRegistries({...contentBundle,cards:[...contentBundle.cards,...fixtureCards],
  tagging:[...contentBundle.tagging,...fixtureCards.flatMap(card=>[`classification.${card.type}`,'camp:physical'].map(tagId=>({family:'card',scope:'',objectId:card.id,tagId})))],
  enemies:[...contentBundle.enemies,{id:'fixture.rank.target',name:'Rank target',hp:[1000,1000],poiseMax:0,attributes:{strength:0,dexterity:0,constitution:0,wisdom:0,intelligence:0},moves:{wait:{intent:'block',block:0,weight:1}}}],
});
const draftRegistries=Object.create(registries,{balance:{value:{...registries.balance,skill:{...registries.balance.skill,rankMax:10,}}}});

test('each rank past 1 adds 1 to the primary number, on play and on the face alike', () => {
  // Rank 3 keeps Strike at 1 SP; a higher rank can raise its cost (SPEC §4.3a: rank weighs on the Stamina side), and a
  // 2-SP face scales its numbers first, so the +1 per rank is read here below that threshold.
  const strike = resolveCard(registries, { cardId: 'fixture.rank.strike' });
  const ranked = resolveCard(registries, { cardId: 'fixture.rank.strike', rank: 3 });
  const i = primaryEffectIndex(strike);
  assert.equal(strike.effects[i].op, 'damage');
  assert.equal(ranked.cost, strike.cost, 'fixture: the same SP cost at rank 3');
  assert.equal(ranked.effects[i].amount, strike.effects[i].amount + 2);
  assert.equal(ranked.rank, 3);
  assert.notEqual(resolveCard(registries, { cardId: 'fixture.rank.strike', rank: 2 }), ranked, 'each rank is its own cached face');
  const defend = resolveCard(registries, { cardId: 'fixture.rank.defend', rank: 2 });
  assert.equal(defend.effects[primaryEffectIndex(defend)].amount, resolveCard(registries, { cardId: 'fixture.rank.defend' }).effects[0].amount + 1);
  const upgraded = resolveCard(registries, { cardId: 'fixture.rank.strike', upgraded: true, rank: 2 });
  assert.equal(upgraded.cost, resolveCard(registries, { cardId: 'fixture.rank.strike', upgraded: true }).cost, 'fixture: the same SP cost at rank 2');
  assert.equal(upgraded.effects[i].amount, resolveCard(registries, { cardId: 'fixture.rank.strike', upgraded: true }).effects[i].amount + 1, 'the rank stacks on the upgrade');
  const model = playingCardModel(registries, { cardId: 'fixture.rank.strike', rank: 3 });
  assert.equal(model.rank, 3);
  assert.equal(model.tokens.damage, strike.effects[i].amount + 2, 'the face text reads the ranked number');
});

test('a ranked Strike hits for its ranked damage in combat', () => {
  const deck = Array.from({ length: 8 }, (_, n) => ({ instanceId: `c${n}`, cardId: 'fixture.rank.strike', upgraded: false, rank: 4 }));
  const player = { id: 'p1', classId: 'reaver', maxHp: 1000, maxMana: 10, maxStamina: 3, energyMax: 3, drawPerTurn: 5, relicIds: [], deck };
  const combat = createCombat({ registries, rng: createRng(5), player, enemyIds: ['fixture.rank.target'] });
  const card = combat.piles.hand[0];
  assert.equal(card.rank, 4, 'the combat copy keeps the rank');
  const enemy = combat.enemies[0];
  const before = enemy.hp + (enemy.block || 0);
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  const base = resolveCard(registries, { cardId: 'fixture.rank.strike' }).effects[0].amount;
  assert.ok(before - (enemy.hp + (enemy.block || 0)) >= base + 3, 'the hit carries the three extra points');
});

test('a rank must be a whole number of at least 1', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  run.deck[0].rank = 3;
  assert.deepEqual(validateRunShape(run).filter((p) => /rank/.test(p)), []);
  for (const bad of [0, 1.5, '2']) {
    run.deck[0].rank = bad;
    assert.ok(validateRunShape(run).some((p) => /deck\[0\]\.rank/.test(p)), `rank ${JSON.stringify(bad)} is refused`);
  }
});

test('a draft rank runs 1 to the skill level, capped at rankMax, weighted toward the level', () => {
  const rng = createRng(11);
  assert.equal(rollDraftRank(draftRegistries, rng, 0), 1);
  assert.equal(rollDraftRank(draftRegistries, rng, 1), 1);
  const counts = {};
  for (let n = 0; n < 3000; n += 1) {
    const rank = rollDraftRank(draftRegistries, rng, 5);
    assert.ok(rank >= 1 && rank <= 5);
    counts[rank] = (counts[rank] || 0) + 1;
  }
  assert.ok(counts[5] > counts[1] * 2.5, `rank 5 (${counts[5]}) is about five times rank 1 (${counts[1]})`);
  for (let n = 0; n < 200; n += 1) assert.ok(rollDraftRank(draftRegistries, rng, 20) <= draftRegistries.balance.skill.rankMax);
  assert.equal(rollDraftRank(draftRegistries, createRng(42), 7), rollDraftRank(draftRegistries, createRng(42), 7), 'a seeded run rolls the same rank');
});

const amountAt = (cardId, rank, index) => resolveCard(registries, { cardId, rank }).effects[index];
// Fixed-cost fixture faces isolate rank allocation from cost-formula scaling.
const scaledAt = (cardId, rank, n) => n;

test('the primary number is what the card is for, never a cost or tempo', () => {
  // A blood price stays the price: the damage ranks, the HP cost does not.
  assert.deepEqual([amountAt('fixture.rank.blood', 5, 0).amount, amountAt('fixture.rank.blood', 5, 1).amount], [6, 24]);
  // Pure tempo (energy, draw) has no primary number, so nothing moves.
  assert.equal(primaryEffectIndex(resolveCard(registries, { cardId: 'fixture.rank.tempo' })), -1);
  assert.deepEqual(resolveCard(registries, { cardId: 'fixture.rank.tempo', rank: 10 }).effects.map((e) => e.amount), [2, 3, undefined]);
  // A status card ranks its stacks, not its rider draw.
  assert.deepEqual([amountAt('fixture.rank.status', 3, 0).stacks, amountAt('fixture.rank.status', 3, 1).amount], [3, 1]);
  // Block outranks nothing but damage: a formula-damage attack ranks its Block.
  // A face at 2 SP or more (SPEC §4.3a: rank weighs on the Stamina side) scales its Block 8 by the multiplier first.
  assert.equal(amountAt('fixture.rank.block-formula', 4, 0).amount, scaledAt('fixture.rank.block-formula', 4, 8) + 3);
});

test('a multi-hit effect splits its rank across its hits, rounded up', () => {
  assert.equal(amountAt('fixture.rank.multi', 2, 0).amount, scaledAt('fixture.rank.multi', 2, 2) + 1, 'one step still shows a gain');
  // A rank-10 face costs more SP (SPEC §4.3a); a 2-SP-or-more face scales its base before the rank lands.
  const scaledBase = 2;
  assert.equal(amountAt('fixture.rank.multi', 10, 0).amount, scaledBase + Math.ceil(9 / 6));
  assert.equal(amountAt('fixture.rank.multi', 10, 1).amount, scaledBase === 2 ? 1 : Math.round(1 * TWO_COST_EFFECT_MULTIPLIER), 'the conditional bonus hit is not primary: it takes no rank');
  assert.equal(amountAt('fixture.rank.x-hits', 7, 0).amount, 6 + 2, 'an X-hit card splits as if three hits');
});

test('a ranked card survives a save and reload', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  run.deck[0].rank = 6;
  const back = deserializeRun(serializeRun(run));
  assert.equal(back.deck[0].rank, 6);
  assert.deepEqual(validateRunShape(back).filter((p) => /rank/.test(p)), []);
  back.deck[0].rank = 100;
  assert.ok(validateRunShape(back).some((p) => /deck\[0\]\.rank/.test(p)), 'a rank past the structural ceiling is refused');
});

test('a pending skill draft must carry one valid rank per offered card', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  const pending = (ranks) => ({ rewards: { skillDrafts: [{ skillId: 'item:blade', level: 2, cardIds: ['rend', 'stomp'], ranks }] }, states: {} });
  const rankProblems = (ranks) => { run.pendingReward = pending(ranks); return validateRunShape(run).filter((p) => /ranks/.test(p)); };
  assert.deepEqual(rankProblems(undefined), [], 'an offer from before ranks is rank 1');
  assert.deepEqual(rankProblems([2, 1]), []);
  for (const bad of [[2], [0, 1], [1.5, 1], 'x', [1, 100]]) assert.ok(rankProblems(bad).length, `ranks ${JSON.stringify(bad)} is refused`);
});

test('a ranked plain basic set aside is kept, not deleted', () => {
  const run = createRunState({ seed: 6, classId: 'reaver', registries });
  delete run.loadout;
  run.deck.push({ instanceId: 'ranked-strike', cardId: 'fixture.rank.strike', upgraded: false, rank: 3 });
  assert.ok(moveToSideboard(registries, run, 'ranked-strike'));
  assert.equal(run.sideboard.find((c) => c.instanceId === 'ranked-strike')?.rank, 3);
});

test('cost scaling lands before the primary rank increment under explicit cost weights',()=>{
  const source={...fixtureCards.find(card=>card.id==='fixture.rank.block-formula')};delete source.costRule;
  const config={...COST_CONFIG,budget:{...COST_CONFIG.budget,spDivisor:1,rankWeight:1,twoCostMultiplier:1.75}};
  const face=applyActionCosts(source,source,{rank:4,config});
  assert.ok(face.cost>=2);assert.equal(face.effects[0].amount,Math.round(8*1.75));
  assert.deepEqual(source.effects[0],{op:'block',target:'self',amount:8},'pricing does not mutate the source');
});

test('registry resolution scales a formula-priced primary before adding the rank increment',()=>{
  const rank=6;
  let source;
  for(let amount=1;amount<=10000;amount++){
    const candidate=fixtureCard('formula-order','attack',[{op:'damage',target:'enemy',amount}]);delete candidate.costRule;
    if(applyActionCosts(candidate,candidate,{rank:rank-1}).cost>=2){source=candidate;break;}
  }
  assert.ok(source,'find a formula-priced two-SP scenario under the current cost configuration');
  const reg=createRegistries({...contentBundle,cards:[...contentBundle.cards,source],tagging:[...contentBundle.tagging,{family:'card',scope:'',objectId:source.id,tagId:'classification.attack'}]});
  const actual=resolveCard(reg,{cardId:source.id,rank});
  const expected=Math.round(source.effects[0].amount*COST_CONFIG.budget.twoCostMultiplier)+(rank-1);
  assert.ok(actual.cost>=2);assert.equal(actual.effects[0].amount,expected,'the rank increment itself is not scaled');
  if(COST_CONFIG.budget.twoCostMultiplier!==1)assert.notEqual(actual.effects[0].amount,Math.round((source.effects[0].amount+rank-1)*COST_CONFIG.budget.twoCostMultiplier),'reversing registry scale/rank order would fail');
});
