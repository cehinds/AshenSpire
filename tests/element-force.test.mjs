// W25 (owner, 2026-11-14) Force: half of the post-Block damage to Poise (2026-11-18; was x1.5 Poise damage); a force card pushes the target from melee to reach (or, when the card says pull, from reach to melee)
// on the existing range model; breaking Poise knocks the target back (it must Advance before its next melee move). No Core card carries the force
// school yet (card content is a later task), so the live tests play Comet Fragment (a school:force card from the base pack).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { getStacks } from '../src/engine/statuses.js';
import { actorRangeKey, engagementBand } from '../src/model/combatEngagement.js';
import { ElementTurnEnd, ElementPushPull } from '../src/engine/elementIdentity.js';

const FORCE = { combatProfile: { camp: 'spell', school: 'force', damageType: 'arcane' }, tags: ['school:force'] };
// Base doubled: Core halves card base damage (ceil, effects.baseDamageMultiplier 0.5), so the hit meets the element rules at the old 10.
const hit = (combat, target, carrier = FORCE, base = 20) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });
const band = (combat, enemy) => engagementBand(combat.rangeState, actorRangeKey(combat, combat.player), actorRangeKey(combat, enemy));
test('force sends half of the post-Block damage to Poise (owner 2026-11-18, replaces the x1.5 Poise damage), never more than the pool holds', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 30 });
  const receipt = hit(combat, enemy);
  assert.equal(receipt.poiseMitigated, 5, 'half of the 10 that landed');
  assert.equal(receipt.poiseDrain || 0, 0, 'no extra Poise loss on top');
  enemy.persistentPoise.value = 2;
  assert.equal(hit(combat, enemy).poiseMitigated, 2, 'never more than the pool holds');
  const physical = hit(combat, enemy, { combatProfile: { camp: 'spell', school: 'poison', damageType: 'poison', magicShare: 1 } });
  assert.equal(physical.poiseDrain || 0, 0, 'other elements add none');
});

test('a force hit pushes a melee target to reach; a pull moves a target at reach into melee; neither moves a target already there', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 100 });
  assert.equal(band(combat, enemy), 0, 'starts in melee');
  play(combat, 'cometFragment', enemy.id);
  assert.equal(band(combat, enemy), 1, 'pushed to reach');
  play(combat, 'cometFragment', enemy.id);
  assert.equal(band(combat, enemy), 1, 'already at reach');
  ElementPushPull(combat, combat.player, enemy, { tags: ['school:force', 'pull'] });
  assert.equal(band(combat, enemy), 0, 'pulled into melee');
  ElementPushPull(combat, combat.player, enemy, { tags: ['school:force', 'pull'] });
  assert.equal(band(combat, enemy), 0);
});

test('a force hit that breaks Poise applies Knockback (the target ends at reach and so pays Advance), and Knockback ends with its owner turn', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 3 });
  play(combat, 'cometFragment', enemy.id);
  assert.equal(enemy.persistentPoise.value, 0);
  assert.equal(getStacks(enemy, 'knockback'), 1);
  assert.equal(band(combat, enemy), 1);
  ElementTurnEnd(combat, enemy);
  assert.equal(getStacks(enemy, 'knockback'), 0);
  assert.equal(band(combat, enemy), 1, 'it stays out until it advances');
});

test('an old fight has no force identity: no push, no Knockback', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 3, legacy: true });
  play(combat, 'cometFragment', enemy.id);
  assert.equal(band(combat, enemy), 0);
  assert.equal(getStacks(enemy, 'knockback'), 0);
});
