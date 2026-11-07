import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatRatings, ratingReceipt } from '../src/model/combatRatings.js';
import { createCombat, dispatch, previewCard, previewIntent } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { computeAttackDamage, computeBlockGain, applyAttackDamage, executeAction, dealPoiseDamage } from '../src/engine/actions.js';
import { applyStatus } from '../src/engine/statuses.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
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

test('configuration exports include weights and reject invalid weight boundaries', () => {
  const settings = { 'gameConfig.combatRatings.statuses.burn.poise': 0.25, 'gameConfig.combatRatings.statuses.burn.ward': 0.75 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ 'gameConfig.combatRatings.impact.lightMaxWeight': 20 }), contentBundle));
});


test('old run snapshots retain the legacy rules while new runs opt into ratings', () => {
  assert.equal(configuredContentBundle(contentBundle, { schemaVersion: 1, overrides: {} }).balance.combatRatings.enabled, false);
  assert.equal(configuredContentBundle(contentBundle, advancedConfigSnapshot({})).balance.combatRatings.enabled, true);
});

// ---- the shape of a rating (owner, 2026-09-21) ----------------------------
//
// "all calculations should be sum(floor(statmult*stat)) + equipment bonus".
// Each attribute term is floored ON ITS OWN, so a weight is the rate that
// attribute converts at: a 0.25 weight is four points to the rating, whatever
// the other four stats are doing. The old formula pooled the weighted points
// and floored the total, which let four stats each short of their own
// threshold add up to a rating nobody's weights had promised — and divided
// that pool by the creation scale besides.
//
// RULESET 7 (owner, 2026-09-24) retired the one global multiplier: a rating
// is a row of the derived-stat table, tuned by its own
// `derivedStatRules.rules.<id>.<field>` keys, and a new config carries no
// multiplier at all.
test('every rating is the sum of its floored attribute terms', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const run = createRunState({ seed: 42, classId: 'reaver', registries });
  run.loadout = null; run.relics = [];
  run.attributes = { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 8 };

  const rules = resolveCombatRatings({
    'gameConfig.derivedStatRules.rules.ar.strength': 1,
    'gameConfig.derivedStatRules.rules.ar.dexterity': 0.5,
    'gameConfig.derivedStatRules.rules.ar.constitution': 0,
    'gameConfig.derivedStatRules.rules.ar.wisdom': 0.25,
    'gameConfig.derivedStatRules.rules.ar.intelligence': 0.25,
  }, contentBundle);
  // floor(1×1) + floor(0.5×1) + 0 + floor(0.25×1) + floor(0.25×8) = 1 + 0 + 0 + 0 + 2
  assert.equal(ratingReceipt(registries, run, rules).totals.ar, 3);

  // A NON-EMPTY POOL IS NOT A TERM. Three attributes at 1 under a 0.5 weight
  // contribute nothing each and nothing together.
  const halves = resolveCombatRatings({
    'gameConfig.derivedStatRules.rules.ar.strength': 0.5,
    'gameConfig.derivedStatRules.rules.ar.dexterity': 0.5,
    'gameConfig.derivedStatRules.rules.ar.constitution': 0.5,
    'gameConfig.derivedStatRules.rules.ar.wisdom': 0,
    'gameConfig.derivedStatRules.rules.ar.intelligence': 0,
  }, contentBundle);
  assert.equal(ratingReceipt(registries, run, halves).totals.ar, 0);

  // A new config has no global multiplier: the row is the whole formula.
  assert.equal(resolveCombatRatings({}, contentBundle).multiplier, undefined);
  assert.equal(rules.multiplier, undefined);

  const zeroWeights = resolveCombatRatings(Object.fromEntries(
    ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']
      .map(id => [`gameConfig.derivedStatRules.rules.ar.${id}`, 0]),
  ), contentBundle);
  const zeroReceipt = ratingReceipt(registries, run, zeroWeights);
  const { renderPlayerPoise } = await import('../src/ui/components/equipmentReceipts.js');
  const zeroHtml = renderPlayerPoise({
    ratings: zeroReceipt.totals,
    ratingSources: zeroReceipt.sources,
    ratingAttributes: zeroReceipt.attributeReceipts,
    note: '',
  });
  assert.match(zeroHtml, /data-rating-id="ar"[\s\S]*?No weighted attributes[\s\S]*?\(<b>0<\/b>\)/);
  assert.doesNotMatch(zeroHtml, /\(\)/);
  // The one row formula has no global multiplier to print (ruleset 7).
  assert.doesNotMatch(zeroHtml, /global ×/);
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
    [5, 2, 3, 5, 0, 10],
    'Slashing Strike is 5 base + (2 sword base AR + 3 attribute AR) + 0 rarity',
  );
  assert.deepEqual(
    [guard.receipt.base, guard.receipt.rating.equipmentBase, guard.receipt.rating.attributeValue, guard.receipt.rating.value, guard.receipt.rarityBonus, guard.receipt.value],
    [3, 5, 1, 6, 0, 9],
    'Shield Defend is 3 base + (5 shield base DR + 1 attribute DR) + 0 rarity',
  );
  assert.deepEqual(
    [technique.receipt.base, technique.receipt.rating.id, technique.receipt.rating.value, technique.receipt.value],
    [0, 'ar', 5, 5],
    'Weapon Technique explicitly uses its source weapon AR',
  );

  const html = renderRoleCopies(surface);
  assert.doesNotMatch(html, /\btier\b/i);
  assert.doesNotMatch(html, /pointsPerTier/);
  assert.match(html, /5 base \+ 5 AR \(weapon\) \+ 0 rarity =/);
  assert.match(html, /3 base \+ 6 DR \(shield\) \+ 0 rarity =/);

  const ratingHtml = renderPlayerPoise(surface.poise);
  assert.deepEqual(surface.poise.ratingAttributes.ar.values,
    { strength: 3, dexterity: 1, constitution: 2, wisdom: 1, intelligence: 1 });
  for (const id of ['ar', 'dr', 'pr', 'poise', 'ward']) assert.match(ratingHtml, new RegExp(`data-rating-id="${id}"`));
  // Each primary bonus contributes once. Wayfarer Plate adds DR 1 and Poise 8.
  assert.match(ratingHtml, /data-rating-id="ar"[\s\S]*?Attributes[\s\S]*?Strength <b>3<\/b> × 1 → floor = <b>3<\/b>[\s\S]*?Calculation[\s\S]*?<b>0<\/b> base[\s\S]*?<b>2<\/b> Straight Sword[\s\S]*?= <strong>5<\/strong>/);
  assert.match(ratingHtml, /data-rating-id="dr"[\s\S]*?Dexterity <b>1<\/b> × 1 → floor = <b>1<\/b>[\s\S]*?<b>2<\/b> Straight Sword[\s\S]*?<b>5<\/b> Round Shield[\s\S]*?<b>1<\/b> Wayfarer Plate[\s\S]*?= <strong>9<\/strong>/);
  assert.match(ratingHtml, /data-rating-id="pr"[\s\S]*?Intelligence <b>1<\/b> × 1 → floor = <b>1<\/b>[\s\S]*?= <strong>1<\/strong>/);
  assert.match(ratingHtml, /data-rating-id="poise"[\s\S]*?Constitution <b>2<\/b> × 1 → floor = <b>2<\/b>[\s\S]*?<b>8<\/b> Wayfarer Plate[\s\S]*?= <strong>11<\/strong>/);
  assert.match(ratingHtml, /data-rating-id="ward"[\s\S]*?Wisdom <b>1<\/b> × 1 → floor = <b>1<\/b>[\s\S]*?= <strong>2<\/strong>/);
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

// A SAVED FIGHT PREDATES THE MULTIPLIERS — and, since ruleset 7, a new one
// postdates them. `combatSnapshotProblems` validates a restored snapshot's own
// rating rules, so a config with no `multiplier` (a save from before it
// existed, and every config this build writes) must validate, while a save
// that DOES carry one is still held to its domain.
test('a combat save written before the multipliers still validates and resumes', async () => {
  const { combatRatingProblems } = await import('../src/model/combatRatings.js');
  const legacy = resolveCombatRatings({}, contentBundle);
  assert.equal(legacy.multiplier, undefined, 'a new config carries no multiplier');
  assert.deepEqual(combatRatingProblems(legacy), []);
  const run = { attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 } };
  // Current rows at every attribute 10 (see the first test above).
  assert.deepEqual(ratingReceipt(registries, run, legacy).totals, { ar: 10, dr: 10, pr: 10, poise: 11, ward: 11 });
  // A written multiplier is still held to its domain.
  assert.deepEqual(combatRatingProblems({ ...legacy, multiplier: -1 }), ['Invalid rating multiplier']);
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
  const { wisdom, base } = rules.ratings.ward;
  assert.equal(ward, base + Math.floor(run.attributes.wisdom * wisdom));
  assert.equal(ward, 3, 'a base of 1 plus the displayed WIS 2 at +1 per point');
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

// A per-item plus (`bonuses.<item>.<rating>`) is a retired dial: it is dropped
// with one warning, never converted into the item's rating.
test('a stored per-item bonus is dropped with a warning and nothing is converted', () => {
  const legacy = { 'gameConfig.combatRatings.bonuses.armament:straightSword.ar': 3, 'gameConfig.combatRatings.bonuses.armor:oldMail.poise': 2 };
  const warnings = [];
  const file = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides: { ...legacy, ...Object.fromEntries(Object.entries(legacy).map(([k, v]) => [`settings.${k}`, v])) } });
  assert.deepEqual(parseAdvancedConfigFile(file, contentBundle, {}, [], warnings), {}, 'the file lands, with no item rating written');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /per-item rating bonuses are retired/);
  const sword = configuredContentBundle(contentBundle, legacy).equipment.armaments.find(p => p.id === 'straightSword');
  assert.equal(sword.attackRating, 2, 'the authored value stands: the plus is not added');
});

// One number, one row, wherever it is read: the profile itself is brought
// forward at boot, so the settings row cannot open on a different value from
// the one the card and the fight are using.
test('a stored profile drops the retired per-item bonus and keeps the rest', async () => {
  const { normalizeAdvancedSettings } = await import('../src/model/advancedConfig.js');
  const profile = { 'gameConfig.combatRatings.bonuses.armament:straightSword.ar': 3, 'gameConfig.combatRatings.itemRatings.armament:straightSword.ward': 4, 'settings.musicEnabled': true };
  const warnings = [];
  assert.equal(normalizeAdvancedSettings(profile, contentBundle, warnings), profile, 'the same object main.js holds');
  assert.deepEqual(profile, {
    'gameConfig.combatRatings.itemRatings.armament:straightSword.ward': 4,
    'settings.musicEnabled': true,
  }, 'the old key is gone, a current item rating and unrelated settings are untouched');
  assert.equal(warnings.length, 1);
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
