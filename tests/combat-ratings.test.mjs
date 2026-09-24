import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatRatings, attackImpact, ratingReceipt } from '../src/model/combatRatings.js';
import { createCombat, dispatch, previewCard, previewIntent } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { computeAttackDamage, computeBlockGain, applyAttackDamage, executeAction, dealPoiseDamage } from '../src/engine/actions.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
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
  // Poise and Ward open at a base of 1 (combatRatingDefaults): 1 + CON 10 +
  // floor(STR 10 / 2), and 1 + WIS 10 + floor(INT 10 / 2).
  assert.deepEqual(c.player.ratings, { ar: 5, dr: 5, pr: 10, poise: 16, ward: 16 });
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
  // A Strike the weapon lends, as the engine carries it — cardId included. The
  // card has a cost-derived Poise value (SPEC §3.4), and the weapon's weight
  // still decides (SPEC §13.4): otherwise every weapon would hit alike.
  const strikePoise = registries.cards.get('strike').cardRatingValues.poise;
  for (const item of registries.equipment.armaments) {
    const w = item.weight || 0;
    assert.equal(attackImpact(c, c.player, { ...physical, sourceArmamentId: item.id }), w <= 3 ? 1 : w <= 6 ? 2 : w <= 8 ? 3 : 4);
  }
  const byWeapon = [['dagger', 1], ['straightSword', 2], ['greatsword', 3], ['warhammer', 4]];
  for (const [id, expected] of byWeapon) assert.equal(attackImpact(c, c.player, { ...physical, sourceArmamentId: id }), expected);
  assert.ok(byWeapon.some(([, expected]) => expected !== strikePoise), 'the weights disagree with the card value, so the test can tell them apart');
  // No weapon behind it: the card's own Poise value, not the flat unarmed
  // default. Read off a card whose value differs from that default, or the
  // assertion could not tell the two apart (Strike's is 1, the same as it).
  const heavy = registries.cards.ids().map(id => registries.cards.get(id))
    .find(def => def.type === 'attack' && def.cardRatingValues?.poise > c.ratingsRules.impact.unarmed);
  assert.ok(heavy, 'some physical attack carries a Poise value above the unarmed default');
  assert.equal(attackImpact(c, c.player, { cardId: heavy.id, type: 'attack', damageSchool: 'physical' }), heavy.cardRatingValues.poise);
  // An enemy's blow carries no card value: its category default still holds.
  assert.equal(attackImpact(c, c.enemies[0], { damageSchool: 'physical' }), c.ratingsRules.impact.enemyPhysical);
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

// The armour half of this reads the item's OWN rating now (#1242): a set's AR
// has no authored column, so it travels in the rules and the receipt takes it
// once. Relic and status bonuses are still bonuses, and still additive.
test('armour ratings, relic and status bonuses are additive and counted once', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { equippedPieces } = await import('../src/model/loadout.js');
  const { ratingSourceKey } = await import('../src/model/combatRatings.js');
  const run = createRunState({ seed: 42, classId: 'reaver', registries });
  run.relics = [contentBundle.relics[0].id];
  const armor = equippedPieces(registries, run.loadout, 'reaver').find(p => p.kind === 'armor');
  const rules = resolveCombatRatings({}, contentBundle);
  const before = ratingReceipt(registries, run, rules).totals;
  rules.itemRatings[ratingSourceKey(armor)] = { ar: 3 };
  rules.bonuses['relic:' + run.relics[0]] = { ar: 7 };
  const after = ratingReceipt(registries, run, rules).totals;
  assert.equal(after.ar - before.ar, 10);
  const c = fight({ 'gameConfig.combatRatings.bonuses.status:strength.ar': 2 });
  applyStatus(c, c.player, 'strength', 2, c.player);
  assert.equal(computeAttackDamage(c, c.player, null, 10, [], physical), 21);
});

// THE ROW IS THE ITEM'S NUMBER, NOT A PLUS ON TOP OF IT (owner, 2026-09-21:
// "if I edit the AR in the settings for straight sword to 2 then it should show
// 2 on the card and in combat + AR bonuses"). One setting, and every reader —
// the item card, the rating receipt, the fight — says the same number. #1246
// has since authored the sword AT 2, so the test moves it to 4: a number the
// authored data does not already hold, or it would pass without the row.
test('an item rating setting IS the item’s rating, on the card and in combat', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { equipmentCardModel } = await import('../src/model/equipmentCard.js');
  const settings = { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 4 };
  const authored = contentBundle.equipment.armaments.find(p => p.id === 'straightSword');
  assert.notEqual(authored.attackRating, 4, 'the authored sword is the thing being moved');

  const configured = configuredContentBundle(contentBundle, settings);
  const sword = configured.equipment.armaments.find(p => p.id === 'straightSword');
  assert.equal(sword.attackRating, 4, 'the column the card prints carries the configured number');
  const tuned = createRegistries(configured);
  assert.equal(equipmentCardModel(tuned, sword).facts.find(f => f.label === 'Attack').value, 4);

  const run = createRunState({ seed: 42, classId: 'reaver', registries: tuned });
  const rules = resolveCombatRatings(settings, contentBundle);
  const receipt = ratingReceipt(tuned, run, rules);
  const source = receipt.sources.find(s => s.name === 'Straight Sword');
  assert.equal(source.ar, 4, `not ${authored.attackRating}, and not ${authored.attackRating} + 4`);
  assert.equal(source.effectiveRatings.ar, 4, 'and a card sourced from the sword reads the same number');
  const attributes = receipt.sources.find(s => s.name === 'Attributes').ar;
  assert.equal(receipt.totals.ar, attributes + 4, 'the item’s own AR, with the attribute bonus on top');
});

// "if a staff says PR of 1 then my wizard with a +2 to PR should have a PR of
// +3 for all cards that scale off PR" — the magical weapon's Attack Rating is
// PR, so the PR row is the one that moves its column. The staff is authored at
// 1 now, so the row moves it to 3 and the caster's +2 makes 5.
test('a magical weapon’s PR row is its Attack Rating, and attribute PR adds to it', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const settings = { 'gameConfig.combatRatings.itemRatings.armament:ashStaff.pr': 3 };
  assert.notEqual(contentBundle.equipment.armaments.find(p => p.id === 'ashStaff').attackRating, 3);
  const configured = configuredContentBundle(contentBundle, settings);
  const staff = configured.equipment.armaments.find(p => p.id === 'ashStaff');
  assert.equal(staff.attackRating, 3);
  const tuned = createRegistries(configured);
  const run = createRunState({ seed: 7, classId: 'starseer', registries: tuned });
  run.loadout.sets.rightHand[0] = 'ashStaff';
  run.attributes = { ...run.attributes, wisdom: 2, intelligence: 2 };
  const rules = resolveCombatRatings(settings, contentBundle);
  const receipt = ratingReceipt(tuned, run, rules);
  assert.equal(receipt.sources.find(s => s.name === 'Ash Staff').pr, 3);
  assert.equal(receipt.totals.pr, 5, 'WIS 2 and INT 2 at 0.5 each is +2, and the staff says 3');
  // …and the card the staff lends reads the same sum (#1246's direct rating).
  const { effectiveEquipmentRating } = await import('../src/model/ratingFormula.js');
  assert.equal(effectiveEquipmentRating(tuned.balance.combatRatings, run.attributes, staff, { ratingId: 'pr' }, 'pr').value, 5);
});

// A rating no item column can hold is still the item's rating: it travels in
// the run's rules instead of on the piece, and the receipt adds it once.
test('a rating with no item column is carried by the rules, not lost', () => {
  const rules = resolveCombatRatings({ 'gameConfig.combatRatings.itemRatings.armament:straightSword.ward': 4 }, contentBundle);
  assert.deepEqual(rules.itemRatings['armament:straightSword'], { ward: 4 });
  assert.equal(rules.itemRatings['armament:straightSword'].ar, undefined, 'AR has a column and is not kept twice');
});

// A configuration exported before the rows became values still imports, and
// what it meant — authored plus the plus — is what it lands as.
test('a stored per-item bonus is read as the value it used to make', () => {
  const legacy = { 'gameConfig.combatRatings.bonuses.armament:straightSword.ar': 3 };
  const file = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides: legacy });
  assert.deepEqual(parseAdvancedConfigFile(file, contentBundle),
    { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 5 });
  const sword = configuredContentBundle(contentBundle, legacy).equipment.armaments.find(p => p.id === 'straightSword');
  assert.equal(sword.attackRating, 5, '2 authored + the 3 the old dial added');
});

// Copilot, on #1242: a saved fight carries its own rules, `bonuses.<item>` and
// all, and is restored into registries rebuilt from the RUN's configuration
// snapshot — where the same plus has already become the item's value. Adding
// the old table on top of the new column would score the plus twice.
test('a resumed fight scores an old per-item plus once, not twice', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const legacy = { 'gameConfig.combatRatings.bonuses.armament:straightSword.ar': 3 };
  // What `main.js resumeRun` does: registries from the run's own snapshot.
  const tuned = createRegistries(configuredContentBundle(contentBundle, legacy));
  const run = createRunState({ seed: 42, classId: 'reaver', registries: tuned });
  const attributes = ratingReceipt(tuned, run, resolveCombatRatings({}, contentBundle))
    .sources.find(s => s.name === 'Attributes').ar;

  // The rules the fight opened under, written by the old build: the plus is
  // still in `bonuses`, keyed by the item.
  const saved = resolveCombatRatings({}, contentBundle);
  saved.bonuses['armament:straightSword'] = { ar: 3 };
  const resumed = ratingReceipt(tuned, run, saved);
  const sword = resumed.sources.find(s => s.name === 'Straight Sword');
  assert.equal(sword.ar, 5, 'authored 2 + the 3, once');
  assert.equal(sword.effectiveRatings.ar, 5, 'on the card path too');
  assert.equal(resumed.totals.ar, attributes + 5, 'not 8, which is what adding both homes gives');
  const { effectiveEquipmentRating } = await import('../src/model/ratingFormula.js');
  const piece = tuned.equipment.armaments.find(p => p.id === 'straightSword');
  assert.equal(effectiveEquipmentRating(saved, run.attributes, piece, { ratingId: 'ar' }, 'ar').equipmentBase, 5,
    'the card value a resumed fight deals reads the plus once as well');
});

// An item's rating is a whole number in the column it is written to, and the
// row's ceiling is the old one, so the two sums the migration cannot keep
// exactly are named at the import door rather than found later.
test('a legacy bonus that cannot be kept exactly says so', () => {
  const warnings = [];
  const file = (overrides) => JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides });
  const fractional = parseAdvancedConfigFile(file({ 'gameConfig.combatRatings.bonuses.armament:straightSword.ar': 0.5 }),
    contentBundle, {}, [], warnings);
  assert.deepEqual(fractional, { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 3 }, '2.5 rounds');
  assert.match(warnings.join(' '), /rounded/);
  assert.match(warnings.join(' '), /Straight Sword AR 2\.5→3/);

  const capped = [];
  const big = parseAdvancedConfigFile(file({ 'gameConfig.combatRatings.bonuses.armament:straightSword.ar': 999 }),
    contentBundle, {}, [], capped);
  assert.deepEqual(big, { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 999 });
  assert.match(capped.join(' '), /stopped there/);
});

// One number, one row, wherever it is read: the profile itself is brought
// forward at boot, so the settings row cannot open on a different value from
// the one the card and the fight are using.
test('a stored profile is rewritten to the rows this build has', async () => {
  const { normalizeAdvancedSettings, advancedConfigRows, advancedConfigExport } = await import('../src/model/advancedConfig.js');
  const profile = { 'gameConfig.combatRatings.bonuses.armament:straightSword.ar': 3, 'settings.musicEnabled': true };
  assert.equal(normalizeAdvancedSettings(profile, contentBundle), profile, 'the same object main.js holds');
  assert.deepEqual(profile, {
    'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 5,
    'settings.musicEnabled': true,
  }, 'the old key is gone and unrelated settings are untouched');

  // Which is what closes the gap the reviewer named: the row now opens on the
  // number the card shows.
  const row = advancedConfigRows(contentBundle).find(r => r.key === 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar');
  assert.equal(profile[row.key], 5);
  assert.equal(row.def, 2, 'and the authored value is still what Reset returns it to');
  assert.match(advancedConfigExport(profile), /itemRatings\.armament:straightSword\.ar/);
});

// ARMOUR, which every test above left alone: a set authors one rating column
// (its Poise threshold, which is also its weight), keys itself by class, and
// authors no attack rating at all.
test('a set’s Poise is its own value, its weight follows it, and it has no AR column', async () => {
  const { itemRatingColumn, authoredItemRatings } = await import('../src/model/combatRatings.js');
  const { createRunState } = await import('../src/model/state.js');
  const { pieceWeight } = await import('../src/model/statProjection.js');
  const authored = contentBundle.equipment.armour.find(p => p.classId === 'reaver' && p.id === 'default');
  assert.equal(authored.poiseThreshold, 8);
  assert.equal(itemRatingColumn(contentBundle.equipment, authored, 'poise'), 'poiseThreshold');
  for (const id of ['ar', 'dr', 'pr', 'ward']) {
    assert.equal(itemRatingColumn(contentBundle.equipment, authored, id), null, `${id} has no armour column to stamp`);
  }

  const settings = { 'gameConfig.combatRatings.itemRatings.armor:reaver:default.poise': 3 };
  const configured = configuredContentBundle(contentBundle, settings);
  const set = configured.equipment.armour.find(p => p.classId === 'reaver' && p.id === 'default');
  assert.equal(set.poiseThreshold, 3, 'the armour key parses through its two colons');
  assert.equal(authoredItemRatings(configured.equipment, set).poise, 3);
  const { mechanics } = await import('../src/framework/data/mechanics.js');
  assert.equal(pieceWeight(set), Math.round(3 * mechanics.weight.itemWeightScale * 10) / 10, 'a set’s Poise IS its weight (rescaled by itemWeightScale) — the row’s note says so');
  assert.equal(contentBundle.equipment.armour.find(p => p.classId === 'reaver' && p.id === 'default').poiseThreshold, 8,
    'and the authored bundle is untouched');

  // A rating a set has no column for still reaches combat, through the rules.
  const tuned = createRegistries(configured);
  const run = createRunState({ seed: 42, classId: 'reaver', registries: tuned });
  const rules = resolveCombatRatings({ ...settings, 'gameConfig.combatRatings.itemRatings.armor:reaver:default.ar': 4 }, contentBundle);
  assert.deepEqual(rules.itemRatings['armor:reaver:default'], { ar: 4 }, 'Poise has a column and is not kept twice');
  assert.equal(ratingReceipt(tuned, run, rules).sources.find(s => s.name === set.name).ar, 4);
});

// Switching the ratings system off switches its rows off with it. It matters
// most for armour: a set's Poise is its weight, so a dial that changes nothing
// else must not quietly move what the set costs to wear.
test('with ratings off, an item rating moves nothing', () => {
  const settings = {
    'gameConfig.combatRatings.enabled': false,
    'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 1,
    'gameConfig.combatRatings.itemRatings.armor:reaver:default.poise': 99,
  };
  const configured = configuredContentBundle(contentBundle, settings);
  assert.equal(configured.balance.combatRatings.enabled, false);
  assert.equal(configured.equipment.armaments.find(p => p.id === 'straightSword').attackRating, 2);
  assert.equal(configured.equipment.armour.find(p => p.classId === 'reaver' && p.id === 'default').poiseThreshold, 8);
  // And an older run, which `configuredContentBundle` forces off by version.
  const older = configuredContentBundle(contentBundle, { schemaVersion: 1, overrides: { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 1 } });
  assert.equal(older.balance.combatRatings.enabled, false);
  assert.equal(older.equipment.armaments.find(p => p.id === 'straightSword').attackRating, 2);
});

// ONE STORED NUMBER, ONE ANSWER. A hand-edited profile can hold anything; the
// settings panel floors it into the row's domain and shows what it floored to,
// and the column has to agree with what the panel shows or the two are back to
// disagreeing — which is the defect this change exists to end.
test('a stored number reads the same in the panel and on the item', async () => {
  const { resolveNumberRow } = await import('../src/ui/screens/settings.js');
  const { advancedConfigRows } = await import('../src/model/advancedConfig.js');
  const key = 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar';
  const row = advancedConfigRows(contentBundle).find(r => r.key === key);
  for (const raw of [2.7, 1500, -4, '3', 0]) {
    const settings = { [key]: raw };
    const shown = resolveNumberRow(settings, row);
    const onItem = configuredContentBundle(contentBundle, settings).equipment.armaments.find(p => p.id === 'straightSword').attackRating;
    assert.equal(onItem, shown, `stored ${JSON.stringify(raw)}: the panel shows ${shown} and the sword carries ${onItem}`);
  }
  // Unreadable is unset, in both, which is the authored value.
  for (const raw of ['', null, 'lots']) {
    const settings = { [key]: raw };
    assert.equal(resolveNumberRow(settings, row), 2);
    assert.equal(configuredContentBundle(contentBundle, settings).equipment.armaments.find(p => p.id === 'straightSword').attackRating, 2);
  }
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
    // Each formula is its own block under Advanced → Stats, filed under the
    // trait it rates (models/AdvancedSettingsGroups.js).
    const formula = rows.filter(row => row.key.includes(`.ratings.${id}.`));
    assert.ok(formula.length >= 3, `${expected} has a formula block of its own`);
    assert.ok(formula.every(row => row.advancedGroup === 'Stats' && row.statTopic === `${expected} formula`), `${expected} sits under Stats`);
    assert.ok(formula.some(row => row.label === `${expected} — Base`), `${expected} — Base is spelled like its tab`);
    // The per-item rows are the item's own ratings now (#1242), so they read
    // "Straight Sword — AR" rather than "— additional AR"; the spelling rule
    // is the same.
    assert.ok(rows.some(row => row.key.includes('.itemRatings.') && row.key.endsWith(`.${id}`)
      && row.label.endsWith(` — ${expected}`)), `an equipment rating row spells ${id} as "${expected}"`);
  }

  // The falsifier, stated as its own line: the two that are NOT acronyms are
  // never shouted, anywhere in the group — labels or topics.
  const shouted = rows.filter(row => /\b(POISE|WARD)\b/.test(`${row.label} ${row.statTopic || ''}`));
  assert.deepEqual(shouted.map(row => row.label), [],
    'no row shouts a rating whose name is an ordinary word');
  // And the three that ARE acronyms are never softened into words.
  assert.ok(!rows.some(row => /\b(Ar|Dr|Pr)\b/.test(row.label)), 'AR, DR and PR stay acronyms');
});

// A NAME IS A HEADING; A PHRASE IS A SENTENCE. `words()` capitalises every
// word, which is right for "Wandering Soldier" and wrong for "Poise Action
// Loss" — and Breaks carried both at once, the hand-written "Break threshold
// multiplier" two rows from the key-derived "Recovery Per Turn".
//
// The general Advanced-label test cannot catch this either — "Recovery Per
// Turn" opens with a capital and carries no unsplit camelCase, so it passes
// whichever way it is cased.
test('a key-derived label reads like the hand-written one beside it', async () => {
  const { combatRatingRows } = await import('../src/model/combatRatings.js');
  const rows = combatRatingRows(contentBundle);
  const labelOf = (key) => rows.find(row => row.key.endsWith(key))?.label;

  // The four that were shouted, spelled out. Each sits in a tab whose other
  // rows are hand-written sentences, named here so the comparison is explicit.
  assert.equal(labelOf('breaks.poiseActionLoss'), 'Poise action loss');
  assert.equal(labelOf('breaks.wardActionLoss'), 'Ward action loss');
  assert.equal(labelOf('breaks.recoveryPerTurn'), 'Recovery per turn');
  assert.equal(labelOf('breaks.thresholdGrowth'), 'Break threshold multiplier');
  assert.equal(labelOf('impact.enemyPhysical'), 'Enemy physical');
  assert.equal(labelOf('impact.magic'), 'Magic impact');

  // The rule, not the six examples: in each of these tabs no leaf shouts a
  // second word. A SUBJECT still may — "Wyrm Aspirant" is a name — so this
  // reads only what follows the em dash.
  for (const topic of ['Breaks', 'Impact']) {
    for (const row of rows.filter(r => r.statTopic === topic)) {
      const cut = row.label.lastIndexOf(' — ');
      const leaf = cut < 0 ? row.label : row.label.slice(cut + 3);
      for (const word of leaf.split(' ').slice(1)) {
        assert.ok(/^[a-z0-9]/.test(word) || /^(AR|DR|PR|HP|Poise|Ward)$/.test(word),
          `${topic}: "${row.label}" reads as a phrase, not a heading — "${word}" is capitalised`);
      }
    }
  }
});

// AN ENEMY MOVE IS A NAME, and combat already spells it as one: "Halberd
// Sweep" on the move card, the current intent and the history. #1249 briefly
// sentence-cased the settings row to "Halberd sweep type", which put the same
// move in two spellings on two screens — the complaint the whole label pass
// answers. So the row is tied to what combat shows, move by move, rather than
// to a casing rule of its own: whatever the move card calls a move, the
// settings row calls it too.
test('an enemy attack-type row names the move the way combat does', async () => {
  const { combatRatingRows } = await import('../src/model/combatRatings.js');
  const { enemyMoveCards } = await import('../src/model/enemyMoveCards.js');
  const labels = new Map(combatRatingRows(contentBundle).map(row => [row.key, row.label]));

  let checked = 0;
  for (const enemy of contentBundle.enemies) {
    for (const card of enemyMoveCards(enemy)) {
      const key = `gameConfig.combatRatings.enemyAttackType.${enemy.id}:${card.moveId}`;
      assert.equal(labels.get(key), `${enemy.name} — ${card.name} type`,
        `${enemy.name}'s ${card.moveId} is spelled the same in settings as on its move card`);
      checked += 1;
    }
  }
  assert.ok(checked > 70, 'every move, including the multi-word ones, is compared');
  assert.equal(labels.get('gameConfig.combatRatings.enemyAttackType.wyrmAspirant:halberdSweep'),
    'Wyrm Aspirant — Halberd Sweep type');
});
