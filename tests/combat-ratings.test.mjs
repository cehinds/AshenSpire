import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatRatings, attackImpact, ratingReceipt } from '../src/model/combatRatings.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { computeAttackDamage, computeBlockGain, applyAttackDamage } from '../src/engine/actions.js';
import { applyStatus } from '../src/engine/statuses.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { applyRatingImpact } from '../src/engine/combatRatings.js';
import { advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';

const registries = createRegistries(contentBundle);
function fight(overrides = {}) {
  const ratingsRules = resolveCombatRatings(overrides, contentBundle);
  return createCombat({ registries, rng: createRng(998), ratingsRules,
    player: { classId: 'reaver', maxHp: 1000, hp: 1000, maxMana: 10, energyMax: 3, drawPerTurn: 3,
      attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 },
      deck: Array.from({length: 15}, (_, i) => ({ instanceId: 'c' + i, cardId: 'strike', upgraded: false })), relicIds: [] },
    enemyIds: ['wanderingSoldier'],
  });
}
const physical = { cardId: 'strike', type: 'attack', damageSchool: 'physical' };
const magical = { cardId: 'strike', type: 'attack', damageSchool: 'magic' };

test('AR, DR and PR add once to their eligible effects; Poise and Ward formulas agree', () => {
  const c = fight();
  assert.deepEqual(c.player.ratings, { ar: 5, dr: 5, pr: 10, poise: 15, ward: 15 });
  assert.equal(computeAttackDamage(c, c.player, null, 10, [], physical), 15);
  assert.equal(computeAttackDamage(c, c.player, null, 10, [], magical), 20);
  assert.equal(computeBlockGain(c, c.player, 10, { ...physical, type: 'skill' }), 15);
  assert.equal(computeBlockGain(c, c.player, 10), 10);
});

test('physical and magic resistance use distinct ratings before Block', () => {
  const c = fight(); c.player.ratings.poise = 100; c.player.ratings.ward = 0;
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 20, [], physical), 10);
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 20, [], magical), 20);
  c.player.block = 100;
  applyAttackDamage(c, c.enemies[0], c.player, 20, [], magical);
  assert.equal(c.player.wardMeter.value, 0);
});

test('magic impacts Ward, physical impacts Poise, breaks cost next-turn Actions', () => {
  const c = fight();
  c.player.wardMeter = { value: 0, max: 1 };
  applyRatingImpact(c, c.enemies[0], c.player, magical);
  assert.equal(c.player.pendingActionLoss, 1);
  assert.equal(c.player.poiseMeter.value, 0);
  assert.equal(c.player.wardMeter.max, 2);
  assert.equal(c.player.statuses.weak, undefined);
  assert.equal(c.player.statuses.vulnerable, undefined);
});

test('weapon impact categories and per-card overrides are configurable', () => {
  const c = fight();
  assert.equal(attackImpact(c, c.player, magical), 1);
  for (const item of registries.equipment.armaments) {
    const w = item.weight || 0;
    assert.equal(attackImpact(c, c.player, { ...physical, sourceArmamentId: item.id }), w <= 4 ? 1 : w <= 8 ? 2 : w <= 12 ? 3 : 4);
  }
  c.ratingsRules.attackImpact.strike = 0;
  assert.equal(attackImpact(c, c.player, magical), 0);
});

test('Burn hybrid resistance carries fractional buildup instead of granting immunity', () => {
  const c = fight(); c.player.ratings.poise = 100; c.player.ratings.ward = 100;
  for (let n = 0; n < 10; n++) applyStatus(c, c.player, 'burn', 1, c.enemies[0]);
  assert.equal(c.player.statuses.burn.stacks, 5);
  applyStatus(c, c.player, 'strength', 2, c.player);
  assert.equal(c.player.statuses.strength.stacks, 2);
});

test('combat saves preserve rules, Ward progress, and fractional buildup', () => {
  const c = fight(); applyRatingImpact(c, c.enemies[0], c.player, magical);
  applyStatus(c, c.player, 'burn', 1, c.enemies[0]);
  const saved = serializeCombatSnapshot(c);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(998), snapshot: saved });
  assert.deepEqual(serializeCombatSnapshot(restored), saved);
});

test('configuration exports include weights and reject invalid weight boundaries', () => {
  const settings = { 'gameConfig.combatRatings.statuses.burn.poise': 0.25, 'gameConfig.combatRatings.statuses.burn.ward': 0.75 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ 'gameConfig.combatRatings.impact.lightMaxWeight': 20 }), contentBundle));
});
