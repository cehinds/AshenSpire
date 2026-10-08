import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { applyCombatExpansionCard, combatExpansionCardOverlay, combatExpansionNewCards } from '../src/content/combatExpansionCards.js';
import { counterCoverageMatches } from '../src/engine/combatMatchups.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';

const cards = new Map(contentBundle.cards.map(card => [card.id, card]));
const fresh = new Set(combatExpansionNewCards.map(card => card.id));

test('every existing Spell card has a source-authored expansion row and no invented id', () => {
  const spellIds = contentBundle.cards.filter(card => !fresh.has(card.id) && card.minCombatExpansionVersion !== 2 && !card.ashenBlight
    && combatProfileFor(card).camp === 'spell').map(card => card.id);
  assert.equal(spellIds.length, 118);
  for (const id of spellIds) assert(combatExpansionCardOverlay[id], id);
  for (const id of Object.keys(combatExpansionCardOverlay)) assert(cards.has(id), id);
});

test('Spell overlay preserves base data while separating school, camp, type and pressure', () => {
  const base = cards.get('starSpark'), snapshot = structuredClone(base), card = applyCombatExpansionCard(base);
  assert.deepEqual(base, snapshot);
  assert.equal(card.attack.damageType, 'piercing'); assert.equal(card.damageSchool, 'magic');
  assert.equal(combatProfileFor(card).camp, 'spell'); assert.equal(combatProfileFor(card).school, 'lightning');
  assert(card.effects.some(effect => effect.op === 'buildup' && effect.status === 'paralysis' && effect.camp === 'spell'));
  assert.equal(card.effects.filter(effect => effect.op === 'buildup').every(effect => effect.chance === 50), true);
  const force = applyCombatExpansionCard(cards.get('starstonePebble'));
  assert.equal(force.attack.damageType, 'blunt'); assert.equal(combatProfileFor(force).camp, 'spell');
});

test('defensive spell faces grant Barrier and legacy stack grants become explicit buildup', () => {
  const barrier = applyCombatExpansionCard(cards.get('crystalBarrier'));
  assert(barrier.effects.some(effect => effect.op === 'gainBarrier'));
  assert(!barrier.effects.some(effect => effect.op === 'block'));
  assert.match(barrier.textTemplate, /Barrier/); assert(!barrier.textTemplate.includes('{block}'));
  const rot = applyCombatExpansionCard(cards.get('witheringTouch'));
  assert(rot.effects.some(effect => effect.op === 'buildup' && effect.status === 'crimsonBlight'));
  assert(!rot.effects.some(effect => effect.op === 'applyStatus' && effect.target === 'enemy'));
});

test('Fire converts contradictory Frost rider, gets Burn, and selected Force is visibly Unreflectable', () => {
  const fire = applyCombatExpansionCard(cards.get('cinderLance'));
  assert(fire.effects.some(effect => effect.op === 'buildup' && effect.status === 'burn'));
  assert(!fire.effects.some(effect => effect.status === 'frost'));
  const force = applyCombatExpansionCard(cards.get('meteorite'));
  assert(force.traits.includes('unreflectable')); assert(force.cardTags.includes('trait:unreflectable'));
});

test('upgraded variants retain new utility and new Frozen predicate identity', () => {
  for (const [id, op, status] of [['attune', 'gainWard', null], ['hex', 'buildup', 'sleep'], ['moonrendCut', 'applyStatus', 'prone']]) {
    const card = applyCombatExpansionCard(cards.get(id));
    assert(card.effects.some(effect => effect.op === op && (!status || effect.status === status)), id);
    if (card.upgrade?.effects) assert(card.upgrade.effects.some(effect => effect.op === op && (!status || effect.status === status)), `${id} upgraded`);
  }
  const lance = applyCombatExpansionCard(cards.get('progression-eclipse-lance'));
  assert(JSON.stringify(lance.effects).includes('"status":"frozen"'));
  assert(!JSON.stringify(lance.effects).includes('"status":"frostExposed"'));
});

test('new school counters have explicit usable coverage and Area needs dedicated interception', () => {
  const counters = combatExpansionNewCards.filter(card => card.counterCoverage);
  assert.equal(counters.length, 9);
  for (const card of counters) {
    assert.equal(card.minCombatExpansionVersion, 2);
    assert(card.counterCoverage.reaches.length > 0);
    assert.equal(card.counterCoverage.schools, undefined);
    const profile = { camp: card.counterCoverage.camps[0], reach: card.counterCoverage.reaches[0], targeting: 'single' };
    assert.equal(counterCoverageMatches(card.counterCoverage, profile), card.id !== 'barrageCounter');
    assert.equal(counterCoverageMatches(card.counterCoverage, { ...profile, targeting: 'area' }), card.id === 'barrageCounter');
    assert.equal(card.counterPayload.hp, 0, 'impact is printed; no invented HP return');
  }
  const schools = new Set(counters.map(card => combatProfileFor(card).school));
  assert.equal(schools.size, 8);
});

test('only selected spells upcast, new cantrips pay their own surcharge and all new cards are v2', () => {
  assert(applyCombatExpansionCard(cards.get('starstonePebble')).upcast);
  assert.equal(applyCombatExpansionCard(cards.get('bloodPact')).upcast, undefined);
  for (const card of combatExpansionNewCards) assert.equal(card.minCombatExpansionVersion, 2);
  const cantrip = combatExpansionNewCards.find(card => card.id === 'staticNeedle');
  assert.equal(cantrip.upcast.chancePerRank, 25);
  assert.equal(cantrip.effects.find(effect => effect.op === 'buildup').chance, 50);
  const cleanse = combatExpansionNewCards.find(card => card.id === 'sanctuaryCleanse');
  assert.deepEqual(cleanse.usableWhile, ['sleep', 'paralysis', 'dazed']);
});

test('real staff and sceptre equipment projections retain explicit Spell delivery and school', () => {
  const registries = createRegistries(contentBundle);
  for (const [profileId, cardId, maneuver, reach] of [
    ['staffMagicAttack', 'strike', 'casting', 'near'], ['sceptreArcaneAttack', 'strike', 'casting', 'near'],
    ['staffGuard', 'defend', 'defend', 'contact'], ['sceptreGuard', 'defend', 'defend', 'contact'],
  ]) {
    const card = applyCombatExpansionCard(resolveCard(registries, { cardId, profileId }));
    const profile = combatProfileFor(card);
    assert.equal(profile.camp, 'spell', profileId); assert.equal(profile.maneuver, maneuver, profileId);
    assert.equal(profile.reach, reach, profileId); assert.equal(profile.targeting, 'single', profileId);
    if (cardId === 'defend') assert(card.effects.some(effect => effect.op === 'gainBarrier'), profileId);
  }
});
