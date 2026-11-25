// Owner ruling 2026-11-18 section 20: a Force hit is PHYSICAL (magic share 0), so it meets Block first, even when a spell deals it.
// Arcane damage keeps its 50% magic split. The face of a Force card reads the same share as its combat receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { combatRules } from '../src/content/combatRules.js';
import { magicShareOf, schoolMagicShare } from '../src/model/combatRatings.js';
import { fight } from './elementFixture.mjs';
import { dispatch } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

test('the force school carries magic share 0 in the rules data; Arcane keeps 0.5', () => {
  assert.equal(combatRules.schools.force.magicShare, 0);
  assert.equal(schoolMagicShare('force'), 0);
  assert.equal(combatRules.damageTypes.arcane.magicShare, 0.5, 'Arcane is unchanged');
});

test('magicShareOf: a school:force spell is all physical at any reach, by profile school or by tag', () => {
  for (const reach of ['contact', 'near', 'reach']) {
    assert.equal(magicShareOf({ camp: 'spell', maneuver: 'casting', school: 'force', damageType: 'arcane', reach }), 0, `school force at ${reach}`);
  }
  assert.equal(magicShareOf({ camp: 'spell', tags: ['school:force'] }), 0, 'a school:force tag');
  assert.equal(magicShareOf({ camp: 'spell', damageType: 'arcane' }), 0.5, 'an unschooled Arcane spell keeps its 50% split');
});

test('under the historical split a Force spell meets Block first, then Poise, then HP: magic-only Ward is never touched', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 40 });
  // b0f8f0606d3: archived Force split and magic-only Ward, before the HP buffer.
  combat.fixCoreRules.poise = { drain: 'prevented', breakRule: 'broken', brokenDamageMultiplier: 1.5 };
  combat.fixCoreRules.ward = { enabled: false, poisePerStack: 5, routing: 'blockFirst' };
  enemy.persistentWard = { value: 5, max: 5 };
  enemy.block = 4;
  const hand = combat.piles.hand[0];
  hand.cardId = 'cometFragment'; hand.upgraded = false;
  primeAccuracyRolls(combat);
  const hp = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: hand.instanceId, targetId: enemy.id });
  const hit = out.events.find(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  assert.ok(hit, 'the spell dealt damage');
  assert.equal(hit.blocked, 4, 'Block soaked the Force hit first');
  assert.equal(enemy.block, 0);
  assert.equal(hit.wardResisted || 0, 0, 'Ward was not met');
  assert.equal(hit.wardAbsorbed || 0, 0);
  assert.ok((hit.poiseAbsorbed || 0) > 0, 'Poise took its share of what Block left (a magic part never meets Poise)');
  assert.ok(hp - enemy.hp > 0, 'the rest reached HP');
});
