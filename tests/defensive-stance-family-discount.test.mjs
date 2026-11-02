// Owner ruling 2026-11-01: in Defend stance (physical or spell) every defensive card (Defend, Counter; Evade cards are Defend cards) takes the
// Core 2 Adept same-stance cut ("Any defensive card"; "To be clear just for defense stance").
// Owner ruling 2026-11-01: "All the evade stance cards were acting as defend cards so just migrate them all as defend cards".
// Evade is a tag, not a stance: an Evade card is a Defend-stance card, so in Defend stance it is an exact match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stanceStaminaCost, stanceManaCost, stanceOf, defensiveFamily, sameStance, stanceEntryBonuses } from '../src/model/stanceRules.js';
import { live, profile } from './helpers/fixcore-combat-rules.mjs';

const mk = (maneuver, camp = 'physical', extra = {}) => ({ cost: 2, type: camp === 'spell' ? 'spell' : maneuver,
  combatProfile: { camp, maneuver, ...(camp === 'spell' ? { range: 'ranged' } : {}) }, cardTags: [], ...extra });
// A Ward cantrip mirrors Defend (stays a Spell, takes the basic's stance).
const defend = mk('defend'), counter = mk('counter'), evade = mk('defend'), attack = mk('attack');
evade.combatProfile.evade = { charges: 1 };
const ward = mk('defend', 'spell'); ward.combatProfile.mirrors = 'defend';
function ctxFor(classId, stanceCard, phase = 'player') {
  const player = { id: 'player', kind: 'player', classId, combatStance: stanceOf(stanceCard) };
  return { gameProfile: profile, combatExpansionVersion: 2, core2ActionRulesVersion: 1, phase, player };
}

test('in Defend stance an Evade card (cost 2) costs 1 for a Martial Adept', () => {
  const c = ctxFor('reaver', defend);
  assert.equal(stanceOf(evade).maneuver, 'defend');
  assert.equal(sameStance(c.player, evade), true, 'Defend stance plus an Evade card is an exact same-stance match');
  assert.equal(defensiveFamily(c.player, evade), true);
  assert.equal(stanceStaminaCost(2, c.player, evade, c), 1);
});
test('in Defend stance a Counter card takes the cut but the floor of 1 holds', () => {
  const c = ctxFor('reaver', defend);
  assert.equal(stanceStaminaCost(2, c.player, counter, c), 1);
  assert.equal(stanceStaminaCost(1, c.player, counter, c), 1);
});
test('an Evade card entering Defend stance is the Defend stance (no Evade stance exists)', () => {
  const c = ctxFor('reaver', evade);
  assert.equal(c.player.combatStance.maneuver, 'defend');
  assert.equal(stanceStaminaCost(2, c.player, defend, c), 1, 'Defend card matches the Evade card exactly');
});
test('a Counter card with an evade profile stays in Counter stance and grants Evade stacks on entry', () => {
  const hybrid = mk('counter'); hybrid.combatProfile.evade = { charges: 1 };
  assert.equal(stanceOf(hybrid).maneuver, 'counter');
  assert.equal(stanceEntryBonuses(hybrid).evade, 1);
  const combat = live();
  assert.equal(stanceEntryBonuses(hybrid, combat).evade, combat.fixCoreRules.accuracy.evadeStackBase, 'Core grants evadeStackBase (3)');
  assert.equal(stanceEntryBonuses(evade, combat).evade, 3);
});
test('an Evade card grants its Evade stacks on entry in Defend stance', () => {
  assert.equal(stanceEntryBonuses(evade).evade, 1);
});
test('in Counter stance an Evade card is not discounted', () => {
  const c = ctxFor('rogue', counter);
  assert.equal(defensiveFamily(c.player, evade), false);
  assert.equal(stanceStaminaCost(2, c.player, evade, c), 2);
});
test('in Attack stance an Evade card is not discounted', () => {
  const c = ctxFor('reaver', attack);
  assert.equal(defensiveFamily(c.player, evade), false);
  assert.equal(stanceStaminaCost(2, c.player, evade, c), 2);
});
test('without the Adept entitlement there is no cut', () => {
  for (const classId of ['missing', 'starseer']) {
    const c = ctxFor(classId, defend);
    assert.equal(stanceStaminaCost(2, c.player, evade, c), 2, classId);
  }
  const c = ctxFor('reaver', defend); c.player.classUnequipped = true;
  assert.equal(stanceStaminaCost(2, c.player, evade, c), 2);
});
test('physical Defend stance discounts a Ward cantrip by 1 MP for a Magic Adept; spell Defend discounts a physical card', () => {
  const c = ctxFor('starseer', defend);
  assert.equal(stanceManaCost(2, c.player, ward, c), 1);
  const r = ctxFor('reaver', ward);
  assert.equal(stanceStaminaCost(2, r.player, defend, r), 1);
});
test('an enemy-turn defensive reaction from a different defensive stance floors at 0', () => {
  const reaction = mk('counter', 'physical', { cardTags: ['trait:reaction'] });
  const c = ctxFor('reaver', defend, 'enemy');
  assert.equal(stanceStaminaCost(1, c.player, reaction, c), 0);
  const own = ctxFor('reaver', defend);
  assert.equal(stanceStaminaCost(1, own.player, reaction, own), 1);
});
