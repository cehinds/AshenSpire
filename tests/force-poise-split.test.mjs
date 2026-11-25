// Owner ruling 2026-11-18 section 20: after Block, a Force hit sends half of what is left to Poise and half to HP
// (`elements.force.poiseShare`, 0.5); a normal physical hit sends 25% to Poise and 75% to HP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';

const FORCE = { combatProfile: { camp: 'spell', school: 'force', damageType: 'arcane' }, tags: ['school:force'] };
const BLUNT = { combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'blunt', reach: 'contact' }, tags: ['camp:physical', 'damage:blunt'] };
const hit = (combat, target, carrier, base = 20) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });

function historicalFight(options) {
  const world = fight(options);
  world.combat.fixCoreRules.poise = { drain: 'prevented', breakRule: 'broken', brokenDamageMultiplier: 1.5 };
  world.combat.fixCoreRules.ward = { enabled: false, poisePerStack: 5, routing: 'blockFirst' };
  return world;
}

test('the Force Poise share is a config value, not a literal', () => {
  assert.equal(fixCoreMechanics.elements.force.poiseShare, 0.5);
  assert.equal(fixCoreMechanics.elements.force.poiseMultiplier, undefined, 'the old x1.5 Poise damage is gone');
});

test('a Force hit sends half of the post-Block damage to Poise and half to HP; a blunt hit sends 25% / 75%', () => {
  const { combat, enemy } = historicalFight({ enemies: 1, poise: 40 });
  const force = hit(combat, enemy, FORCE);
  assert.equal(force.damageReceipt.hits[0].incoming, 10);
  assert.equal(force.poiseMitigated, 5, 'half to Poise');
  assert.equal(force.hpLoss, 5, 'half to HP');
  assert.equal(force.poiseDrain || 0, 0, 'no extra Poise loss on top');
  const blunt = hit(combat, enemy, BLUNT);
  const incoming = blunt.damageReceipt.hits[0].incoming;
  assert.equal(blunt.hpLoss, Math.floor(incoming * 0.75), '75% to HP, rounded down');
  assert.equal(blunt.poiseMitigated, incoming - Math.floor(incoming * 0.75), 'the rest, about a quarter, to Poise');
  assert.ok(blunt.poiseMitigated < incoming / 2);
});

test('Force splits what Block leaves, not the whole hit', () => {
  const { combat, enemy } = historicalFight({ enemies: 1, poise: 40 });
  enemy.block = 4;
  const force = hit(combat, enemy, FORCE);
  assert.equal(force.blocked, 4);
  assert.equal(force.poiseMitigated, 3, 'half of the 6 Block left');
  assert.equal(force.hpLoss, 3);
});

test('Poise never absorbs more than it holds: the rest of a Force hit reaches HP', () => {
  const { combat, enemy } = historicalFight({ enemies: 1, poise: 2 });
  const force = hit(combat, enemy, FORCE);
  assert.equal(force.poiseMitigated, 2);
  assert.equal(force.hpLoss, 8);
});
