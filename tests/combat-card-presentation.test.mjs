import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { combatCardType, combatCardSummary } from '../src/model/playingCard.js';
const reg = createRegistries(contentBundle);
const card = id => applyCombatExpansionCard(reg.cards.get(id));
test('large face labels match the maneuver while spell Counters remain Counter', () => {
  for (const [id, label] of [['strike','Attack'],['defend','Defend'],['bashingBlow','Smash'],['shieldBash','Counter'],['dodgeRoll','Counter'],['barrageCounter','Counter'],['emberDart','Spell']]) assert.equal(combatCardType(card(id)), label, id);
});
test('Counter summary distinguishes protection from return and includes card Evade', () => {
  assert.doesNotMatch(combatCardSummary(card('barrageCounter'), null, reg), /Counter|Area|Contact|attacks and spells/);
  assert.match(combatCardSummary(card('shieldBash'), null, reg), /Gain \d+ Block/);
  assert.match(combatCardSummary(card('shieldBash'), null, reg), /Return.*Poise/);
  const dodge = combatCardSummary(card('dodgeRoll'), null, reg);
  assert.match(dodge, /Prepare one Evade/);
  assert.match(dodge, /Return.*damage/);
});
test('new spell summary contains its explicit gauge pressure and chance', () => {
  const text = combatCardSummary(card('emberDart'), null, reg);
  assert.match(text, /Deal 5 Fire damage/); assert.match(text, /Add 4 Burn buildup \(50%\)/);
});
test('summary uses live bindings and preserves full conditional effects', () => {
  const fire = card('emberDart');
  const text = combatCardSummary(fire, {tokens:{damage:9,burn:6}}, reg);
  assert.match(text, /Deal 9 Fire damage/); assert.match(text, /Add 6 Burn buildup/);
  const lucid = combatCardSummary(card('lucidRecovery'), null, reg);
  assert.match(lucid, /you have Sleep/); assert.match(lucid, /Remove 1 Sleep/); assert.match(lucid, /gain 2 Barrier/);
});
test('complex passive cards preserve authored text rather than hiding trigger rules', () => {
  for (const id of ['emberCovenant','shatterOpportunity','earthGrounding','restfulDream']) assert.equal(combatCardSummary(card(id), null, reg), null);
  assert.match(combatCardSummary(card('starPath'), null, reg), /Gain 1 Concealed for 2 turns/);
  assert.match(combatCardSummary(card('starPath'), null, reg), /Sweep and Holy revelation clear it/);
});

test('summaries retain ally and random targets, removal quantities and resolved hit counts', () => {
  assert.match(combatCardSummary(card('rallyingBanner'), null, reg), /Ally gains 10 Block/);
  assert.match(combatCardSummary(card('sharedFlame'), null, reg), /Heal an ally for 7 HP/);
  assert.match(combatCardSummary(card('ashOath'), null, reg), /to an ally/);
  assert.match(combatCardSummary(card('pilfer'), null, reg), /Discard 1 at random/);
  assert.match(combatCardSummary(card('ambush'), {tokens:{damage:4}}, reg), /Remove all Prepared/);
  const random = {type:'attack',effects:[{op:'damage',target:'randomEnemy',amount:4,hits:{f:'x'}}]};
  assert.equal(combatCardSummary(random, null, reg), null);
  assert.match(combatCardSummary(random, {values:[{op:'damage',value:4,hits:0}]}, reg), /4 damage ×0 to a random enemy/);
  assert.match(combatCardSummary(card('sanctuaryCleanse'), null, reg), /Usable through Sleep, Paralysis, Dazed/);
});

test('expanded grade summaries retain added buildup together with authored limits', () => {
  const grade = id => applyCombatExpansionCard(resolveCard(reg, {cardId:id, abilityRank:5}));
  const offering = combatCardSummary(grade('progression-crown-of-scars'), null, reg);
  assert.match(offering, /Offer 3 HP \(leave at least 1 HP\)/);
  assert.match(offering, /offerings paid at least 1 this turn/);
  assert.match(offering, /once per turn per family/);
  assert.match(offering, /Add 3 Crimson Blight buildup/);
  const orbit = combatCardSummary(grade('progression-cinder-orbit'), null, reg);
  assert.match(orbit, /your previous card this turn was a Spell/);
  assert.match(orbit, /Add 4 Burn buildup/);
  const ward = grade('progression-firmament-ward');
  const charged = combatCardSummary(ward, {tokens:{chargeManaDiscount:2}}, reg);
  assert.match(charged, /Next spell this turn: 2 less Mana \(min 0\); cannot stack with itself/);
  assert.match(charged, /Gain 2 Barrier once per turn per family/);
  const constellation = combatCardSummary(grade('progression-falling-constellation'), null, reg);
  assert.match(constellation, /distinct starstone card IDs played at least 2 this turn/);
  const shelter = combatCardSummary(grade('progression-pilgrim-s-shelter'), null, reg);
  assert.match(shelter, /you began this turn with HP at most 50%/);
  const reprisal = combatCardSummary(grade('progression-crimson-reprisal'), null, reg);
  assert.match(reprisal, /HP lost at least 1 since your previous turn began/);
  assert.match(combatCardSummary(grade('progression-back-alley-cut'), null, reg), /not \(the target has Block before this card\)/);
  assert.match(combatCardSummary(grade('progression-silent-exchange'), null, reg), /Choose and discard 1/);
});

test('temporary tier options keep nonzero base separate and never offer locked tiers', async () => {
  const { upcastChoicePlan } = await import('../src/ui/components/upcastChoice.js');
  const plan = upcastChoicePlan({name:'Tiered fixture',upcast:{baseTier:2,unlockedTiers:[3,5],maximumTier:5}});
  assert.deepEqual(plan.options.map(option => option.id), ['2','3','5']);
  assert.match(plan.options[1].name, /tier 3 \(\+1\)/);
  assert.match(plan.options[2].tooltip, /\+3 SP and \+3 Mana/);
});

test('compact Counter face leaves complete delivery coverage in inspection', async () => {
  const { cardDetailHtml } = await import('../src/ui/components/card.js');
  const html = cardDetailHtml(reg, {cardId:'barrageCounter', upgraded:false});
  for (const term of ['Counter coverage:', 'Martial', 'Spell', 'Contact', 'Near', 'Far', 'Area', 'status pressure']) assert.ok(html.includes(term), term);
});

test('primary Power and Status labels precede camps; utility skills remain Skill', () => {
  for (const id of ['emberCovenant','shatterOpportunity','rallyingStandard']) assert.equal(combatCardType(card(id)), 'Power', id);
  assert.equal(combatCardType({id:'fixture-status',type:'status',cardTags:['camp:spell']}), 'Status');
  assert.equal(combatCardType({id:'fixture-curse',type:'curse',cardTags:['camp:spell']}), 'Status');
  assert.equal(combatCardType(card('dreamHarvest')), 'Skill');
  assert.equal(combatCardType(card('emberDart')), 'Spell');
});
