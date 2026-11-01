// Owner ruling 2026-11-01: Defend, Counter and Evade (physical or spell) are one defensive family for the
// Core 2 Adept same-stance cut ("Any defensive card").
import test from 'node:test';
import assert from 'node:assert/strict';
import { stanceStaminaCost, stanceManaCost, stanceOf, defensiveFamily } from '../src/model/stanceRules.js';
import { live, profile } from './helpers/fixcore-combat-rules.mjs';

const mk = (maneuver, camp = 'physical', extra = {}) => ({ cost: 2, type: camp === 'spell' ? 'spell' : maneuver,
  combatProfile: { camp, maneuver, ...(camp === 'spell' ? { range: 'ranged' } : {}) }, cardTags: [], ...extra });
// A Ward cantrip mirrors Defend (stays a Spell, takes the basic's stance).
const defend = mk('defend'), counter = mk('counter'), evade = mk('evade'), attack = mk('attack');
const ward = mk('defend', 'spell'); ward.combatProfile.mirrors = 'defend';
function ctxFor(classId, stanceCard, phase = 'player') {
  const player = { id: 'player', kind: 'player', classId, combatStance: stanceOf(stanceCard) };
  return { gameProfile: profile, combatExpansionVersion: 2, core2ActionRulesVersion: 1, phase, player };
}

test('in Defend stance an Evade card (cost 2) costs 1 for a Martial Adept', () => {
  const c = ctxFor('reaver', defend);
  assert.equal(stanceOf(evade).maneuver, 'evade');
  assert.equal(stanceStaminaCost(2, c.player, evade, c), 1);
});
test('in Evade stance a cost-1 Defend stays at the floor of 1', () => {
  const c = ctxFor('reaver', evade);
  assert.equal(stanceStaminaCost(1, c.player, defend, c), 1);
});
test('in Counter stance an Evade card is discounted', () => {
  const c = ctxFor('rogue', counter);
  assert.equal(stanceStaminaCost(2, c.player, evade, c), 1);
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
test('physical Defend stance discounts a Ward cantrip by 1 MP for a Magic Adept, and the reverse holds', () => {
  const c = ctxFor('starseer', defend);
  assert.equal(stanceManaCost(2, c.player, ward, c), 1);
  const r = ctxFor('reaver', ward);
  assert.equal(stanceStaminaCost(2, r.player, defend, r), 1);
});
test('an enemy-turn defensive reaction from a different defensive stance floors at 0', () => {
  const reaction = mk('evade', 'physical', { cardTags: ['trait:reaction'] });
  const c = ctxFor('reaver', defend, 'enemy');
  assert.equal(stanceStaminaCost(1, c.player, reaction, c), 0);
  const own = ctxFor('reaver', defend);
  assert.equal(stanceStaminaCost(1, own.player, reaction, own), 1);
});
