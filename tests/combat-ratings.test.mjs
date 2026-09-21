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
    assert.equal(attackImpact(c, c.player, { ...physical, sourceArmamentId: item.id }), w <= 3 ? 1 : w <= 6 ? 2 : w <= 8 ? 3 : 4);
  }
  for (const [id, expected] of [['dagger', 1], ['straightSword', 2], ['greatsword', 3], ['warhammer', 4]]) assert.equal(attackImpact(c, c.player, { ...physical, sourceArmamentId: id }), expected);
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

// ---- the shape of a rating (owner, 2026-09-21) ----------------------------
//
// "all calculations should be sum(floor(statmult*stat)) + equipment bonus",
// with the multipliers present and shipping at 1. Each attribute term is
// floored ON ITS OWN, so a weight is the rate that attribute converts at: a
// 0.25 weight is four points to the rating, whatever the other four stats are
// doing. The old formula pooled the weighted points and floored the total,
// which let four stats each short of their own threshold add up to a rating
// nobody's weights had promised — and divided that pool by the creation scale
// besides.
test('every rating is the sum of its floored attribute terms, times its multipliers', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const run = createRunState({ seed: 42, classId: 'reaver', registries });
  run.loadout = null; run.relics = [];
  run.attributes = { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 8 };

  const rules = resolveCombatRatings({
    'gameConfig.combatRatings.ratings.ar.strength': 1,
    'gameConfig.combatRatings.ratings.ar.dexterity': 0.5,
    'gameConfig.combatRatings.ratings.ar.constitution': 0,
    'gameConfig.combatRatings.ratings.ar.wisdom': 0.25,
    'gameConfig.combatRatings.ratings.ar.intelligence': 0.25,
  }, contentBundle);
  // floor(1×1) + floor(0.5×1) + 0 + floor(0.25×1) + floor(0.25×8) = 1 + 0 + 0 + 0 + 2
  assert.equal(ratingReceipt(registries, run, rules).totals.ar, 3);

  // A NON-EMPTY POOL IS NOT A TERM. Three attributes at 1 under a 0.5 weight
  // contribute nothing each and nothing together.
  const halves = resolveCombatRatings({
    'gameConfig.combatRatings.ratings.ar.strength': 0.5,
    'gameConfig.combatRatings.ratings.ar.dexterity': 0.5,
    'gameConfig.combatRatings.ratings.ar.constitution': 0.5,
    'gameConfig.combatRatings.ratings.ar.wisdom': 0,
    'gameConfig.combatRatings.ratings.ar.intelligence': 0,
  }, contentBundle);
  assert.equal(ratingReceipt(registries, run, halves).totals.ar, 0);

  // Both multipliers ship at 1 and neither changes a rating until it is moved.
  assert.equal(resolveCombatRatings({}, contentBundle).multiplier, 1);
  assert.equal(resolveCombatRatings({}, contentBundle).ratings.ar.multiplier, 1);
  const scaled = resolveCombatRatings({
    'gameConfig.combatRatings.multiplier': 2,
    'gameConfig.combatRatings.ratings.ar.multiplier': 3,
    'gameConfig.combatRatings.ratings.ar.strength': 1,
    'gameConfig.combatRatings.ratings.ar.dexterity': 0.5,
    'gameConfig.combatRatings.ratings.ar.constitution': 0,
    'gameConfig.combatRatings.ratings.ar.wisdom': 0.25,
    'gameConfig.combatRatings.ratings.ar.intelligence': 0.25,
  }, contentBundle);
  assert.equal(ratingReceipt(registries, run, scaled).totals.ar, 18);
});

// A SAVED FIGHT PREDATES THE MULTIPLIERS. `combatSnapshotProblems` validates a
// restored snapshot's own rating rules, so a field this build added must read
// as 1 when it is absent rather than refuse the run.
test('a combat save written before the multipliers still validates and resumes', async () => {
  const { combatRatingProblems } = await import('../src/model/combatRatings.js');
  const legacy = resolveCombatRatings({}, contentBundle);
  delete legacy.multiplier;
  for (const id of ['ar', 'dr', 'pr', 'poise', 'ward']) delete legacy.ratings[id].multiplier;
  assert.deepEqual(combatRatingProblems(legacy), []);
  const run = { attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 } };
  assert.deepEqual(ratingReceipt(registries, run, legacy).totals, { ar: 5, dr: 5, pr: 10, poise: 15, ward: 15 });
  // A written multiplier is still held to its domain.
  assert.deepEqual(combatRatingProblems({ ...legacy, multiplier: -1 }), ['Invalid rating multiplier']);
});

// THE CREATION POOL IS NOT A COEFFICIENT. A run born on a smaller pool used to
// carry `statConversionScale`, which this receipt divided by: the Starseer's
// INT 8 scored Ward as if it were 23, and the panel's own weights were wrong
// by 2.92× with no row saying so.
test('a run born on a smaller pool is rated on the attributes it shows', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { configuredContentBundle } = await import('../src/model/advancedConfig.js');
  const small = configuredContentBundle(contentBundle, { 'gameConfig.startingStats.tuned2.total': 12 });
  const smallRegistries = createRegistries(small);
  const run = createRunState({ seed: 42, classId: 'starseer', registries: smallRegistries, attributeMode: 'tuned2' });
  run.loadout = null; run.relics = [];
  assert.equal(run.attributeModeSnapshot.statConversionScale, undefined);

  const rules = resolveCombatRatings({}, small);
  const { ward } = ratingReceipt(smallRegistries, run, rules).totals;
  const a = run.attributes;
  const { wisdom, intelligence } = rules.ratings.ward;
  assert.equal(ward, Math.floor(a.wisdom * wisdom) + Math.floor(a.intelligence * intelligence));
  assert.equal(ward, 5, 'WIS 1 and INT 8 under the authored 1 and 0.5 weights, not the 29 the scale produced');
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
