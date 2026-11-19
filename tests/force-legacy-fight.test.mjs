// Owner ruling 2026-11-18 section 20 is data in the fight: a fight saved with `elements.force.poiseMultiplier` (the old Force) keeps the old Force,
// a new fight plays the new one. Old Force: a 0.5 magic share (half meets Ward), x1.5 Poise damage, a push to reach, Knockback on a break.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { ForceRules, FightMagicShare } from '../src/model/elementIdentityRules.js';
import { getStacks } from '../src/engine/statuses.js';
import { actorRangeKey, engagementBand } from '../src/model/combatEngagement.js';

const FORCE = { combatProfile: { camp: 'spell', school: 'force', damageType: 'arcane' }, tags: ['school:force'] };
const hit = (combat, target, base = 20) => profileDamageReceipt(combat, combat.player, target, base, { ...FORCE, skipRatingBonus: true }, { roll: 0 });
const band = (combat, enemy) => engagementBand(combat.rangeState, actorRangeKey(combat, combat.player), actorRangeKey(combat, enemy));
const oldForce = combat => { combat.fixCoreRules.elements.force = { poiseMultiplier: 1.5 }; return combat; };

test('a new fight reads the new Force rules from its saved data', () => {
  const { combat } = fight({ enemies: 1 });
  assert.deepEqual({ ...ForceRules(combat) }, { legacy: false, magicShare: 0, poiseShare: 0.5, poiseMultiplier: null, push: false, knockback: false });
  assert.equal(FightMagicShare(combat, FORCE.combatProfile), 0);
});

test('a fight saved with elements.force.poiseMultiplier keeps the old Force', () => {
  const { combat } = fight({ enemies: 1 });
  oldForce(combat);
  const rules = ForceRules(combat);
  assert.equal(rules.legacy, true);
  assert.equal(FightMagicShare(combat, FORCE.combatProfile), 0.5, 'half magic');
  assert.equal(rules.push, true); assert.equal(rules.knockback, true);
});

test('old Force: x1.5 Poise damage and no 50/50 split', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 30 });
  oldForce(combat);
  const receipt = hit(combat, enemy);
  assert.ok(receipt.poiseDrain > 0, 'the extra half comes off the pool on top of what absorbed the hit');
  assert.equal(receipt.pierceOpener, undefined);
});

test('old Force: a landed hit pushes a melee target to reach and a break applies Knockback', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 100 });
  oldForce(combat);
  assert.equal(band(combat, enemy), 0);
  play(combat, 'cometFragment', enemy.id);
  assert.equal(band(combat, enemy), 1, 'pushed to reach');
  const broken = fight({ enemies: 1, poise: 3 });
  oldForce(broken.combat);
  play(broken.combat, 'cometFragment', broken.enemy.id);
  assert.equal(getStacks(broken.enemy, 'knockback'), 1);
});

test('a Core fight with no elements block (made before W25) keeps the old Force', () => {
  const { combat } = fight({ enemies: 1, legacy: true });
  assert.equal(ForceRules(combat).legacy, true);
  assert.equal(FightMagicShare(combat, FORCE.combatProfile), 0.5);
});
