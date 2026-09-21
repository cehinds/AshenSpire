import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import {
  COMBAT_RATINGS_VERSION, combatRatingDefaults, resolveCombatRatings, attackImpact,
  ratingReceipt, ratingDamageMultiplier,
} from '../src/model/combatRatings.js';
import { createCombat, dispatch, previewCard, previewIntent } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { computeAttackDamage, computeBlockGain, applyAttackDamage, executeAction, dealPoiseDamage } from '../src/engine/actions.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { applyRatingImpact } from '../src/engine/combatRatings.js';
import { advancedConfigExport, parseAdvancedConfigFile, configuredContentBundle, advancedConfigSnapshot } from '../src/model/advancedConfig.js';
import { playerPoiseThresholdReceipt } from '../src/model/statProjection.js';

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
  assert.deepEqual(c.player.ratings, { ar: 5, dr: 5, pr: 10, poise: 16, ward: 16 });
  assert.equal(computeAttackDamage(c, c.player, null, 10, [], physical), 15);
  assert.equal(computeAttackDamage(c, c.player, null, 10, [], magical), 20);
  assert.equal(computeBlockGain(c, c.player, 10, { ...physical, type: 'skill' }), 10);
  assert.equal(computeBlockGain(c, c.player, 10, { ...magical, type: 'skill' }), 20);
  assert.equal(computeBlockGain(c, c.player, 10), 10);
});

test('layered defence applies DR then Poise, adding Ward only for magic', () => {
  const c = fight();
  c.player.ratings = { ...c.player.ratings, dr: 5, poise: 100, ward: 100 };
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 20, [], physical), 7,
    'sword slash: floor((20 - 5 DR) × 50% Poise)');
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 20, [], magical), 3,
    'magic bolt: floor((20 - 5 DR) × 50% Poise × 50% Ward)');
  c.player.ratings.dr = 20;
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 20, [], physical), 0);
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 20, [], magical), 0);
  c.player.block = 100;
  applyAttackDamage(c, c.enemies[0], c.player, 20, [], magical);
  assert.equal(c.player.wardMeter.value, 0);
});

test('Poise and Ward each honor the below-immunity resistance cap', () => {
  const c = fight({ 'gameConfig.combatRatings.resistance.maximum': 0.8 });
  c.player.ratings = { ...c.player.ratings, dr: 0, poise: 999999, ward: 999999 };
  assert.ok(ratingDamageMultiplier(c, c.player, false) > 0);
  assert.ok(ratingDamageMultiplier(c, c.player, true) > 0);
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 100, [], physical), 20);
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 100, [], magical), 4);
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 1, [], physical), 1);
  assert.equal(computeAttackDamage(c, c.enemies[0], c.player, 1, [], magical), 1);
  assert.notDeepEqual(resolveCombatRatings({
    'gameConfig.combatRatings.resistance.maximum': 1,
  }, contentBundle).resistance.maximum, 1, 'a 100% imported cap is rejected');
  c.ratingsRules.resistance.maximum = 1;
  assert.ok(ratingDamageMultiplier(c, c.player, false) > 0, 'runtime clamps even an invalid in-memory cap below immunity');
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

test('combat snapshots without a ratings rules version retain version 1 defence', () => {
  const c = fight();
  c.player.ratings = { ...c.player.ratings, dr: 5, poise: 100, ward: 100 };
  const snapshot = serializeCombatSnapshot(c);
  delete snapshot.ratingsRules.version;
  const restored = restoreCombatSnapshot({ registries, rng: createRng(998), snapshot });
  restored.player.ratings = { ...restored.player.ratings, dr: 5, poise: 100, ward: 100 };
  assert.equal(computeAttackDamage(restored, restored.enemies[0], restored.player, 20, [], physical), 10,
    'legacy physical damage uses Poise but not flat DR');
  assert.equal(computeAttackDamage(restored, restored.enemies[0], restored.player, 20, [], magical), 10,
    'legacy magic damage uses Ward alone');
  assert.equal(computeBlockGain(restored, restored.player, 10, { ...physical, type: 'skill' }), 15,
    'legacy DR remains a physical skill Block bonus');
});

test('configuration exports include weights and reject invalid weight boundaries', () => {
  const settings = { 'gameConfig.combatRatings.statuses.burn.poise': 0.25, 'gameConfig.combatRatings.statuses.burn.ward': 0.75 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ 'gameConfig.combatRatings.impact.lightMaxWeight': 20 }), contentBundle));
});


test('old run snapshots retain the legacy rules while new runs opt into ratings', () => {
  assert.equal(configuredContentBundle(contentBundle, { schemaVersion: 1, overrides: {} }).balance.combatRatings.enabled, false);
  const oldRatings = configuredContentBundle(contentBundle, { schemaVersion: 1, ratingsVersion: 1, overrides: {} }).balance.combatRatings;
  assert.equal(oldRatings.enabled, true);
  assert.equal(oldRatings.version, 1);
  const current = configuredContentBundle(contentBundle, advancedConfigSnapshot({})).balance.combatRatings;
  assert.equal(current.enabled, true);
  assert.equal(current.version, COMBAT_RATINGS_VERSION);
  assert.equal(advancedConfigSnapshot({}).ratingsVersion, COMBAT_RATINGS_VERSION);
});

test('non-combat rating receipts describe the active defence rules version', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const currentBundle = configuredContentBundle(contentBundle, advancedConfigSnapshot({}));
  const currentRegistries = createRegistries(currentBundle);
  const currentRun = createRunState({ seed: 42, classId: 'reaver', registries: currentRegistries });
  const currentNote = playerPoiseThresholdReceipt(currentRegistries, currentRun).note;
  assert.match(currentNote, /Defence subtracts flat damage first/);
  assert.match(currentNote, /Poise then reduces every hit/);
  assert.match(currentNote, /Ward adds magical-only reduction/);

  const legacyBundle = configuredContentBundle(contentBundle, {
    schemaVersion: 1, ratingsVersion: 1, overrides: {},
  });
  const legacyRegistries = createRegistries(legacyBundle);
  const legacyRun = createRunState({ seed: 42, classId: 'reaver', registries: legacyRegistries });
  assert.match(playerPoiseThresholdReceipt(legacyRegistries, legacyRun).note,
    /Poise resists physical attacks.*Ward resists magical attacks/);
});

test('enemy defences can differ and explicit magic typing agrees with the intent preview', () => {
  const c = fight({ 'gameConfig.combatRatings.enemyRatings.wanderingSoldier.dr': 4,
    'gameConfig.combatRatings.enemyRatings.wanderingSoldier.poise': 30,
    'gameConfig.combatRatings.enemyRatings.wanderingSoldier.ward': 5,
    'gameConfig.combatRatings.enemyAttackType.wanderingSoldier:slash': 'magic' });
  const e = c.enemies[0];
  assert.equal(e.ratings.dr, 4);
  assert.equal(e.poiseMeter.max, 30); assert.equal(e.wardMeter.max, 5);
  c.player.ratings.dr = 0; c.player.ratings.poise = 0; c.player.ratings.ward = 0;
  e.intent = { kind: 'attack', moveId: 'slash', damage: 7, hits: 1 };
  assert.equal(previewIntent(c, e.id).damage, 7);
  const hp = c.player.hp;
  executeAction(c, { effect: { op: 'damage', target: 'player', amount: 7 }, source: e, owner: e, target: c.player, meta: { moveId: 'slash' } });
  assert.equal(hp - c.player.hp, 7);
  assert.equal(c.player.wardMeter.value, 1);
});

test('automatic enemy typing preserves magic authored on an effect', () => {
  const c = fight(); c.player.ratings.dr = 0; c.player.ratings.ward = 0; c.player.ratings.poise = 100;
  const e = c.enemies[0], hp = c.player.hp;
  executeAction(c, { effect: { op: 'damage', target: 'player', amount: 10, damageSchool: 'magic' }, source: e, owner: e, target: c.player, meta: { moveId: 'slash' } });
  assert.equal(hp - c.player.hp, 5); assert.equal(c.player.wardMeter.value, 1);
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
test('every rating is the sum of its floored attribute terms times one global multiplier', async () => {
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

  // The one global multiplier ships at 1 and changes every rating together.
  assert.equal(resolveCombatRatings({}, contentBundle).multiplier, 1);
  const scaled = resolveCombatRatings({
    'gameConfig.combatRatings.multiplier': 2,
    'gameConfig.combatRatings.ratings.ar.strength': 1,
    'gameConfig.combatRatings.ratings.ar.dexterity': 0.5,
    'gameConfig.combatRatings.ratings.ar.constitution': 0,
    'gameConfig.combatRatings.ratings.ar.wisdom': 0.25,
    'gameConfig.combatRatings.ratings.ar.intelligence': 0.25,
  }, contentBundle);
  assert.equal(ratingReceipt(registries, run, scaled).totals.ar, 6);

  const zeroWeights = resolveCombatRatings(Object.fromEntries(
    ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']
      .map(id => [`gameConfig.combatRatings.ratings.ar.${id}`, 0]),
  ), contentBundle);
  const zeroReceipt = ratingReceipt(registries, run, zeroWeights);
  const { renderPlayerPoise } = await import('../src/ui/components/equipmentReceipts.js');
  const zeroHtml = renderPlayerPoise({
    ratings: zeroReceipt.totals,
    ratingSources: zeroReceipt.sources,
    ratingAttributes: zeroReceipt.attributeReceipts,
    note: '',
  });
  assert.match(zeroHtml, /data-rating-id="ar"[\s\S]*?No weighted attributes[\s\S]*?global × \(<b>0<\/b>\)/);
  assert.doesNotMatch(zeroHtml, /global × \(\)/);
});

test('weapon cards add their source equipment rating without a tier', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { equipmentSurfaceReceipt } = await import('../src/model/equipmentPresentation.js');
  const { renderPlayerPoise, renderRoleCopies } = await import('../src/ui/components/equipmentReceipts.js');
  const configured = configuredContentBundle(contentBundle, advancedConfigSnapshot({}));
  const currentRegistries = createRegistries(configured);
  const run = createRunState({ seed: 42, classId: 'reaver', registries: currentRegistries });
  const surface = equipmentSurfaceReceipt(currentRegistries, run);

  const attack = surface.roles.find(row => row.role === 'attack');
  const guard = surface.roles.find(row => row.role === 'guard');
  const technique = surface.roles.find(row => row.role === 'technique');
  assert.deepEqual(
    [attack.receipt.base, attack.receipt.rating.equipmentBase, attack.receipt.rating.attributeValue, attack.receipt.rating.value, attack.receipt.rarityBonus, attack.receipt.value],
    [5, 2, 1, 3, 0, 8],
    'Slashing Strike is 5 base + (2 sword base AR + 1 attribute AR) + 0 rarity',
  );
  assert.deepEqual(
    [guard.receipt.base, guard.receipt.rating.equipmentBase, guard.receipt.rating.attributeValue, guard.receipt.rating.value, guard.receipt.rarityBonus, guard.receipt.value],
    [3, 5, 0, 5, 0, 8],
    'Shield Defend is 3 base + (5 shield base DR + 0 attribute DR) + 0 rarity',
  );
  assert.deepEqual(
    [technique.receipt.base, technique.receipt.rating.id, technique.receipt.rating.value, technique.receipt.value],
    [0, 'ar', 3, 3],
    'Weapon Technique explicitly uses its source weapon AR',
  );

  const html = renderRoleCopies(surface);
  assert.doesNotMatch(html, /\btier\b/i);
  assert.doesNotMatch(html, /pointsPerTier/);
  assert.match(html, /5 base \+ 3 AR \(weapon\) \+ 0 rarity =/);
  assert.match(html, /3 base \+ 5 DR \(shield\) \+ 0 rarity =/);

  const ratingHtml = renderPlayerPoise(surface.poise);
  assert.deepEqual(surface.poise.ratingAttributes.ar.values,
    { strength: 3, dexterity: 1, constitution: 2, wisdom: 1, intelligence: 1 });
  for (const id of ['ar', 'dr', 'pr', 'poise', 'ward']) assert.match(ratingHtml, new RegExp(`data-rating-id="${id}"`));
  assert.match(ratingHtml, /data-rating-id="ar"[\s\S]*?Attributes[\s\S]*?Strength <b>3<\/b> × 0\.5 → floor = <b>1<\/b>[\s\S]*?Calculation[\s\S]*?<b>0<\/b> base[\s\S]*?<b>2<\/b> Straight Sword[\s\S]*?= <strong>3<\/strong>/);
  assert.match(ratingHtml, /data-rating-id="dr"[\s\S]*?Dexterity <b>1<\/b> × 0\.5 → floor = <b>0<\/b>[\s\S]*?<b>2<\/b> Straight Sword[\s\S]*?<b>5<\/b> Round Shield[\s\S]*?= <strong>7<\/strong>/);
  assert.match(ratingHtml, /data-rating-id="pr"[\s\S]*?Wisdom <b>1<\/b> × 0\.5 → floor = <b>0<\/b>[\s\S]*?Intelligence <b>1<\/b> × 0\.5 → floor = <b>0<\/b>[\s\S]*?= <strong>0<\/strong>/);
  assert.match(ratingHtml, /data-rating-id="poise"[\s\S]*?Strength <b>3<\/b> × 0\.5 → floor = <b>1<\/b>[\s\S]*?Constitution <b>2<\/b> × 1 → floor = <b>2<\/b>[\s\S]*?<b>8<\/b> Wayfarer Plate[\s\S]*?= <strong>12<\/strong>/);
  assert.match(ratingHtml, /data-rating-id="ward"[\s\S]*?Wisdom <b>1<\/b> × 1 → floor = <b>1<\/b>[\s\S]*?Intelligence <b>1<\/b> × 0\.5 → floor = <b>0<\/b>[\s\S]*?= <strong>2<\/strong>/);
});

test('an equipment card uses only its source item rating', () => {
  const c = fight();
  c.player.ratings.ar = 10;
  c.player.ratingSources = [
    { name: 'Attributes', kind: 'attribute', ar: 3 },
    { name: 'Straight Sword', kind: 'equipment', sourceId: 'straightSword', ar: 2 },
    { name: 'Dagger', kind: 'equipment', sourceId: 'dagger', ar: 1 },
    { name: 'Relic', kind: 'relic', ar: 4 },
  ];
  assert.equal(computeAttackDamage(c, c.player, null, 5, [], { ...physical, sourceArmamentId: 'straightSword' }), 14,
    '5 card base + 3 attribute AR + 2 source weapon AR + 4 global relic AR');
  assert.equal(computeAttackDamage(c, c.player, null, 5, [], { ...physical, sourceArmamentId: 'dagger' }), 13,
    'the other equipped weapon does not leak into this card');
  assert.equal(computeAttackDamage(c, c.player, null, 5, [], { ...physical, equipmentRole: 'attack' }), 12,
    'an unarmed equipment-profile card excludes every equipped item but keeps attribute and relic AR');
});

test('co-op initializes source equipment ratings for every seat', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const configured = configuredContentBundle(contentBundle, advancedConfigSnapshot({}));
  const currentRegistries = createRegistries(configured);
  const run = createRunState({ seed: 42, classId: 'reaver', registries: currentRegistries });
  const c = createCoopCombat({
    registries: currentRegistries,
    rng: createRng(998),
    players: [{
      id: 'p1', classId: run.class, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp,
      maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck, loadout: run.loadout,
      itemUpgradeLevels: run.itemUpgradeLevels, relicIds: [],
    }],
    enemyIds: ['wanderingSoldier'],
  });
  assert.equal(computeAttackDamage(c, c.player, null, 5, [], { ...physical, sourceArmamentId: 'straightSword' }), 8);
  assert.equal(computeBlockGain(c, c.player, 3, { ...physical, type: 'skill', ratingId: 'dr', sourceArmamentId: 'roundShield' }), 8);
  assert.equal(c.enemies[0].ratings.poise, c.ratingsRules.enemyRatings.wanderingSoldier.poise);
});

test('restoring a legacy combat rebuilds typed rating sources before source filtering', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const configured = configuredContentBundle(contentBundle, advancedConfigSnapshot({}));
  const currentRegistries = createRegistries(configured);
  const run = createRunState({ seed: 42, classId: 'reaver', registries: currentRegistries });
  const c = createCombat({
    registries: currentRegistries, rng: createRng(998), ratingsRules: configured.balance.combatRatings,
    player: {
      classId: run.class, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp, maxMana: run.maxMana,
      mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina, energyMax: run.energyMax,
      drawPerTurn: run.drawPerTurn, deck: run.deck, loadout: run.loadout, itemUpgradeLevels: run.itemUpgradeLevels,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot, relicIds: [],
    },
    enemyIds: ['wanderingSoldier'],
  });
  const snapshot = serializeCombatSnapshot(c);
  snapshot.player.ratings.ar = 102;
  snapshot.player.ratingSources = [
    { name: 'Attributes', ar: 1 },
    { name: 'Straight Sword', ar: 2 },
    { name: 'Legacy off-hand weapon', ar: 99 },
  ];
  const resumed = restoreCombatSnapshot({ registries: currentRegistries, rng: createRng(998), snapshot });
  assert.equal(computeAttackDamage(resumed, resumed.player, null, 5, [], { ...physical, sourceArmamentId: 'straightSword' }), 8);
  assert.deepEqual(resumed.player.ratingSources.filter(row => row.kind === 'equipment').map(row => row.sourceId), ['straightSword', 'roundShield', 'default']);
  assert.equal(resumed.player.ratingSources.every(row => row.kind), true);
});

test('snapshot rating overrides stamp the card and govern preview and execution', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { stampDeck } = await import('../src/model/loadout.js');
  const configured = configuredContentBundle(contentBundle, advancedConfigSnapshot({}));
  const currentRegistries = createRegistries(configured);
  const run = createRunState({ seed: 42, classId: 'reaver', registries: currentRegistries });
  run.equipmentProfileRuleSnapshot.profiles.bladeAttack.ratingId = 'pr';
  stampDeck(currentRegistries, run);
  const stamped = run.deck.find(card => card.profileId === 'bladeAttack');
  assert.equal(stamped.profileReceipt.rating.id, 'pr');
  assert.equal(stamped.ratingId, 'pr');
  const c = createCombat({
    registries: currentRegistries, rng: createRng(998), ratingsRules: configured.balance.combatRatings,
    player: {
      classId: run.class, attributes: run.attributes, maxHp: 100, hp: 100, maxMana: run.maxMana, mana: run.mana,
      maxStamina: run.maxStamina, stamina: run.stamina, energyMax: 99, drawPerTurn: run.drawPerTurn,
      deck: run.deck, loadout: run.loadout, itemUpgradeLevels: run.itemUpgradeLevels,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot, relicIds: [],
    },
    enemyIds: ['wanderingSoldier'],
  });
  c.enemies[0].ratings.poise = 0;
  const card = [...c.piles.hand, ...c.piles.draw].find(row => row.instanceId === stamped.instanceId);
  c.piles.draw = c.piles.draw.filter(row => row !== card);
  if (!c.piles.hand.includes(card)) c.piles.hand.push(card);
  assert.equal(previewCard(c, card.instanceId, c.enemies[0].id).values[0].value, stamped.profileReceipt.value);
  const hp = c.enemies[0].hp;
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies[0].id });
  assert.equal(hp - c.enemies[0].hp, stamped.profileReceipt.value);
});

test('ratings-disabled legacy runs carry their migrated direct source rating on the card', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const legacyBundle = configuredContentBundle(contentBundle, { schemaVersion: 1, overrides: {} });
  const legacyRegistries = createRegistries(legacyBundle);
  const run = createRunState({ seed: 42, classId: 'reaver', registries: legacyRegistries });
  const stamped = run.deck.find(card => card.profileId === 'bladeAttack');
  const c = createCombat({
    registries: legacyRegistries, rng: createRng(998),
    player: {
      classId: run.class, attributes: run.attributes, maxHp: 100, hp: 100, maxMana: run.maxMana, mana: run.mana,
      maxStamina: run.maxStamina, stamina: run.stamina, energyMax: 99, drawPerTurn: run.drawPerTurn,
      deck: run.deck, loadout: run.loadout, itemUpgradeLevels: run.itemUpgradeLevels,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot, relicIds: [],
    },
    enemyIds: ['wanderingSoldier'],
  });
  const card = [...c.piles.hand, ...c.piles.draw].find(row => row.instanceId === stamped.instanceId);
  assert.equal(c.ratingsRules, undefined);
  assert.equal(previewCard(c, card.instanceId, c.enemies[0].id).values[0].value, stamped.profileReceipt.value);
  c.piles.draw = c.piles.draw.filter(row => row !== card);
  if (!c.piles.hand.includes(card)) c.piles.hand.push(card);
  const hp = c.enemies[0].hp;
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies[0].id });
  assert.equal(hp - c.enemies[0].hp, stamped.profileReceipt.value);
});

test('version-one equipment profile migration preserves compatible saved overrides', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { restoreEquipmentProfileRuleSnapshot } = await import('../src/model/loadout.js');
  const run = createRunState({ seed: 42, classId: 'reaver', registries });
  const legacy = structuredClone(run.equipmentProfileRuleSnapshot);
  legacy.snapshotVersion = 1;
  legacy.profiles.bladeAttack.baseValue = 42;
  legacy.profiles.bladeAttack.cap = 43;
  legacy.profiles.bladeAttack.pointsPerTier = 5;
  legacy.profiles.bladeAttack.gainPerTier = 3;
  delete legacy.profiles.bladeAttack.ratingId;
  const migrated = restoreEquipmentProfileRuleSnapshot(legacy, registries);
  assert.equal(migrated.snapshotVersion, 2);
  assert.equal(migrated.profiles.bladeAttack.baseValue, 42);
  assert.equal(migrated.profiles.bladeAttack.cap, 43);
  assert.equal(migrated.profiles.bladeAttack.ratingId, 'ar');
  assert.equal(migrated.profiles.bladeAttack.pointsPerTier, undefined);
  assert.equal(migrated.profiles.bladeAttack.gainPerTier, undefined);
});

test('profile caps constrain attack and guard receipts, previews, and execution', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { stampDeck } = await import('../src/model/loadout.js');
  const configured = configuredContentBundle(contentBundle, advancedConfigSnapshot({}));
  const currentRegistries = createRegistries(configured);
  const run = createRunState({ seed: 42, classId: 'reaver', registries: currentRegistries });
  run.equipmentProfileRuleSnapshot.profiles.bladeAttack.cap = 6;
  run.equipmentProfileRuleSnapshot.profiles.shieldGuard.cap = 4;
  stampDeck(currentRegistries, run);
  const cards = {
    attack: run.deck.find(card => card.profileId === 'bladeAttack'),
    guard: run.deck.find(card => card.profileId === 'shieldGuard'),
  };
  assert.deepEqual([cards.attack.profileReceipt.value, cards.attack.ratingCap], [6, 6]);
  assert.deepEqual([cards.guard.profileReceipt.value, cards.guard.ratingCap], [4, 4]);

  const makeCombat = (card) => {
    const c = createCombat({
      registries: currentRegistries, rng: createRng(998), ratingsRules: configured.balance.combatRatings,
      player: {
        classId: run.class, attributes: run.attributes, maxHp: 100, hp: 100, maxMana: run.maxMana, mana: run.mana,
        maxStamina: run.maxStamina, stamina: run.stamina, energyMax: 99, drawPerTurn: 1,
        deck: [structuredClone(card)], loadout: run.loadout, itemUpgradeLevels: run.itemUpgradeLevels,
        equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot, relicIds: [],
      },
      enemyIds: ['wanderingSoldier'],
    });
    c.enemies[0].ratings.poise = 0;
    return c;
  };

  const attackCombat = makeCombat(cards.attack);
  const attack = attackCombat.piles.hand[0];
  assert.equal(previewCard(attackCombat, attack.instanceId, attackCombat.enemies[0].id).values[0].value, 6);
  const hp = attackCombat.enemies[0].hp;
  dispatch(attackCombat, { type: 'playCard', cardInstanceId: attack.instanceId, targetId: attackCombat.enemies[0].id });
  assert.equal(hp - attackCombat.enemies[0].hp, 6);

  const guardCombat = makeCombat(cards.guard);
  const guard = guardCombat.piles.hand[0];
  assert.equal(previewCard(guardCombat, guard.instanceId).values[0].value, 4);
  dispatch(guardCombat, { type: 'playCard', cardInstanceId: guard.instanceId });
  assert.equal(guardCombat.player.block, 4);
});

test('foundation execution applies the same card rating as its preview', async () => {
  const { prototypeInput } = await import('../src/content/prototypes/combatBuilds.js');
  const input = prototypeInput('heavy', 'basic', 998);
  input.ratingsRules = resolveCombatRatings({}, contentBundle);
  const c = createCombat(input);
  c.player.ratings = { ar: 5, dr: 0, pr: 0, poise: 1, ward: 1 };
  c.player.ratingSources = [{ name: 'Attributes', kind: 'attribute', ar: 5 }];
  const card = [...c.piles.hand, ...c.piles.draw].find(row => c.registries.cards.get(row.cardId).type === 'attack');
  card.ratingId = 'ar';
  c.piles.draw = c.piles.draw.filter(row => row !== card);
  if (!c.piles.hand.includes(card)) c.piles.hand.push(card);
  const shown = previewCard(c, card.instanceId, c.enemies[0].id).values.find(value => value.op === 'damage').value;
  const hp = c.enemies[0].hp;
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies[0].id });
  assert.equal(hp - c.enemies[0].hp, shown);
});

// A SAVED FIGHT PREDATES THE MULTIPLIERS. `combatSnapshotProblems` validates a
// restored snapshot's own rating rules, so a field this build added must read
// as 1 when it is absent rather than refuse the run.
test('a combat save written before the multipliers still validates and resumes', async () => {
  const { combatRatingProblems } = await import('../src/model/combatRatings.js');
  const legacy = resolveCombatRatings({}, contentBundle);
  delete legacy.multiplier;
  assert.deepEqual(combatRatingProblems(legacy), []);
  const run = { attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 } };
  assert.deepEqual(ratingReceipt(registries, run, legacy).totals, { ar: 5, dr: 5, pr: 10, poise: 16, ward: 16 });
  // A written multiplier is still held to its domain.
  assert.deepEqual(combatRatingProblems({ ...legacy, multiplier: -1 }), ['Invalid rating multiplier']);
});

// A FIGHT SAVED BEFORE THE CHANGE RESUMES, AND RESUMES UNDER THE ONE
// CALCULATION. Its snapshot carries the old rating rules and the creation
// divisor they were read through; the divisor is not carried back into the
// live fight, and the legacy rule fields read as the multipliers' default of
// 1. The fight's ratings therefore move on resume — the owner's call
// (2026-09-21), and the alternative was two rating formulas kept forever.
test('a pre-change combat snapshot resumes without its divisor', async () => {
  const { serializeCombatSnapshot, restoreCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  const c = fight();
  const snapshot = serializeCombatSnapshot(c);
  snapshot.ratingAttributeScale = 0.2;
  for (const id of ['ar', 'dr', 'pr', 'poise', 'ward']) {
    snapshot.ratingsRules.ratings[id].pointsPerIncrease = 1;
    snapshot.ratingsRules.ratings[id].gain = 1;
  }
  delete snapshot.ratingsRules.multiplier;
  const resumed = restoreCombatSnapshot({ registries, rng: createRng(998), snapshot });
  assert.equal(resumed.ratingAttributeScale, undefined, 'the divisor is not carried into the live fight');
  assert.deepEqual(resumed.player.ratings, c.player.ratings, 'and the resumed fight is rated by the one calculation');
});

// THE CREATION POOL IS NOT A COEFFICIENT. A creation mode used to carry
// `statConversionScale` and this receipt divided by it, so the lean span's
// every attribute entered the formulas at five times the value on the sheet: a
// Starseer showing INT 3 was rated as if it held 15, and the panel's own
// weights were wrong by that factor with no row saying so.
test('a run born on the lean pool is rated on the attributes it shows', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const run = createRunState({ seed: 42, classId: 'starseer', registries });
  run.loadout = null; run.relics = [];
  assert.equal(run.attributeModeSnapshot.statConversionScale, undefined, 'the mode carries no scale');

  const rules = resolveCombatRatings({}, contentBundle);
  const { ward } = ratingReceipt(registries, run, rules).totals;
  const { wisdom, intelligence, base } = rules.ratings.ward;
  assert.equal(ward, base + Math.floor(run.attributes.wisdom * wisdom) + Math.floor(run.attributes.intelligence * intelligence));
  assert.equal(ward, 4, 'a base of 1, WIS 2 and INT 3 under the authored 1 and 0.5 weights — sixteen while the divisor stood');
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

// AR, DR and PR are acronyms. Poise and Ward are words, and every surface in
// the game spells them that way — including this file's own tab name, which
// has always read "Poise formula". The ROWS under it read "POISE — Base",
// "Strength — WARD per stack", "Straight Sword — additional WARD": one id,
// two spellings, roughly seven hundred rows apart from their own heading.
//
// The general Advanced-label test cannot catch this — "POISE" opens with a
// capital and carries no camelCase, so it passes either way. This is the
// assertion that has to be specific.
test('a rating is spelled the same on its rows as on its tab', async () => {
  const { combatRatingRows } = await import('../src/model/combatRatings.js');
  const rows = combatRatingRows(contentBundle);

  for (const [id, expected] of [['ar', 'AR'], ['dr', 'DR'], ['pr', 'PR'], ['poise', 'Poise'], ['ward', 'Ward']]) {
    const formula = rows.filter(row => row.statTopic === `${expected} formula`);
    assert.ok(formula.length >= 3, `${expected} has a formula group of its own`);
    assert.ok(formula.some(row => row.label === `${expected} — Base`), `${expected} — Base is spelled like its tab`);
    assert.ok(rows.some(row => row.key.endsWith(`.${id}`) && / — additional /.test(row.label)
      && row.label.endsWith(expected)), `an equipment bonus row spells ${id} as "${expected}"`);
  }

  // The falsifier, stated as its own line: the two that are NOT acronyms are
  // never shouted, anywhere in the group — labels or topics.
  const shouted = rows.filter(row => /\b(POISE|WARD)\b/.test(`${row.label} ${row.statTopic || ''}`));
  assert.deepEqual(shouted.map(row => row.label), [],
    'no row shouts a rating whose name is an ordinary word');
  // And the three that ARE acronyms are never softened into words.
  assert.ok(!rows.some(row => /\b(Ar|Dr|Pr)\b/.test(row.label)), 'AR, DR and PR stay acronyms');
});
