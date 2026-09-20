import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatRatings, attackImpact, ratingReceipt } from '../src/model/combatRatings.js';
import { createCombat, previewIntent } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { computeAttackDamage, computeBlockGain, applyAttackDamage, executeAction, dealPoiseDamage } from '../src/engine/actions.js';
import { applyStatus } from '../src/engine/statuses.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { applyRatingImpact } from '../src/engine/combatRatings.js';
import { advancedConfigExport, parseAdvancedConfigFile, configuredContentBundle, advancedConfigSnapshot } from '../src/model/advancedConfig.js';

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


test('old run snapshots retain the legacy rules while new runs opt into ratings', () => {
  assert.equal(configuredContentBundle(contentBundle, { schemaVersion: 1, overrides: {} }).balance.combatRatings.enabled, false);
  assert.equal(configuredContentBundle(contentBundle, advancedConfigSnapshot({})).balance.combatRatings.enabled, true);
});

test('enemy defences can differ and explicit magic typing agrees with the intent preview', () => {
  const c = fight({ 'gameConfig.combatRatings.enemyRatings.wanderingSoldier.poise': 30,
    'gameConfig.combatRatings.enemyRatings.wanderingSoldier.ward': 5,
    'gameConfig.combatRatings.enemyAttackType.wanderingSoldier:slash': 'magic' });
  const e = c.enemies[0];
  assert.equal(e.poiseMeter.max, 30); assert.equal(e.wardMeter.max, 5);
  c.player.ratings.poise = 100; c.player.ratings.ward = 0;
  e.intent = { kind: 'attack', moveId: 'slash', damage: 7, hits: 1 };
  assert.equal(previewIntent(c, e.id).damage, 7);
  const hp = c.player.hp;
  executeAction(c, { effect: { op: 'damage', target: 'player', amount: 7 }, source: e, owner: e, target: c.player, meta: { moveId: 'slash' } });
  assert.equal(hp - c.player.hp, 7);
  assert.equal(c.player.wardMeter.value, 1);
});

test('automatic enemy typing preserves magic authored on an effect', () => {
  const c = fight(); c.player.ratings.ward = 0; c.player.ratings.poise = 100;
  const e = c.enemies[0], hp = c.player.hp;
  executeAction(c, { effect: { op: 'damage', target: 'player', amount: 10, damageSchool: 'magic' }, source: e, owner: e, target: c.player, meta: { moveId: 'slash' } });
  assert.equal(hp - c.player.hp, 10); assert.equal(c.player.wardMeter.value, 1);
});

test('a magical power carries PR into its later block trigger', async () => {
  const { fireOwnerHooks } = await import('../src/engine/triggers.js');
  const c = fight();
  const card = { cardId: 'astralArmorCard', type: 'power' };
  executeAction(c, { effect: { op: 'applyStatus', target: 'self', status: 'astralArmor', stacks: 1 }, source: c.player, owner: c.player, card });
  const queued = [];
  c.enqueue = action => queued.push(action);
  fireOwnerHooks(c, c.player, 'ownerTurnEnd');
  for (const action of queued) executeAction(c, action);
  assert.equal(c.player.block, 14);
});


test('explicit Poise damage respects configured break rules without legacy penalties', () => {
  const c = fight({ 'gameConfig.combatRatings.breaks.poiseActionLoss': 2 });
  dealPoiseDamage(c, c.player, c.player.poiseMeter.max);
  assert.equal(c.player.pendingActionLoss, 2);
  assert.equal(c.player.statuses.weak, undefined);
  assert.equal(c.player.statuses.vulnerable, undefined);
});

test('armour, relic and status bonuses are additive and counted once', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { equippedPieces } = await import('../src/model/loadout.js');
  const { ratingSourceKey } = await import('../src/model/combatRatings.js');
  const run = createRunState({ seed: 42, classId: 'reaver', registries });
  run.relics = [contentBundle.relics[0].id];
  const armor = equippedPieces(registries, run.loadout, 'reaver').find(p => p.kind === 'armor');
  const rules = resolveCombatRatings({}, contentBundle);
  const before = ratingReceipt(registries, run, rules).totals;
  rules.bonuses[ratingSourceKey(armor)] = { ar: 3 };
  rules.bonuses['relic:' + run.relics[0]] = { ar: 7 };
  const after = ratingReceipt(registries, run, rules).totals;
  assert.equal(after.ar - before.ar, 10);
  const c = fight({ 'gameConfig.combatRatings.bonuses.status:strength.ar': 2 });
  applyStatus(c, c.player, 'strength', 2, c.player);
  assert.equal(computeAttackDamage(c, c.player, null, 10, [], physical), 21);
});
