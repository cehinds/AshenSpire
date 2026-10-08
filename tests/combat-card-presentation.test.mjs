import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
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
  assert.match(text, /Deal 5 damage/); assert.match(text, /Add 4 Burn buildup \(50%\)/);
});
test('summary uses live bindings and preserves full conditional effects', () => {
  const fire = card('emberDart');
  const text = combatCardSummary(fire, {tokens:{damage:9,burn:6}}, reg);
  assert.match(text, /Deal 9 damage/); assert.match(text, /Add 6 Burn buildup/);
  const lucid = combatCardSummary(card('lucidRecovery'), null, reg);
  assert.match(lucid, /you have Sleep/); assert.match(lucid, /Remove 1 Sleep/); assert.match(lucid, /gain 2 Barrier/);
});
test('complex passive cards preserve authored text rather than hiding trigger rules', () => {
  for (const id of ['emberCovenant','shatterOpportunity']) assert.equal(combatCardSummary(card(id), null, reg), null);
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
