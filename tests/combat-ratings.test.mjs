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
    delete snapshot.ratingsRules.ratings[id].multiplier;
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
// the item card, the rating receipt, the fight — says 2.
test('an item rating setting IS the item’s rating, on the card and in combat', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { equipmentCardModel } = await import('../src/model/equipmentCard.js');
  const settings = { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 2 };
  const authored = contentBundle.equipment.armaments.find(p => p.id === 'straightSword');
  assert.equal(authored.attackRating, 5, 'the authored sword is the thing being moved');

  const configured = configuredContentBundle(contentBundle, settings);
  const sword = configured.equipment.armaments.find(p => p.id === 'straightSword');
  assert.equal(sword.attackRating, 2, 'the column the card prints carries the configured number');
  const tuned = createRegistries(configured);
  assert.equal(equipmentCardModel(tuned, sword).facts.find(f => f.label === 'Attack').value, 2);

  const run = createRunState({ seed: 42, classId: 'reaver', registries: tuned });
  const rules = resolveCombatRatings(settings, contentBundle);
  const receipt = ratingReceipt(tuned, run, rules);
  assert.equal(receipt.sources.find(s => s.name === 'Straight Sword').ar, 2, 'not 5, and not 5 + 2');
  const attributes = receipt.sources.find(s => s.name === 'Attributes').ar;
  assert.equal(receipt.totals.ar, attributes + 2, 'the item’s own AR, with the attribute bonus on top');
});

// "if a staff says PR of 1 then my wizard with a +2 to PR should have a PR of
// +3 for all cards that scale off PR" — the magical weapon's Attack Rating is
// PR, so the PR row is the one that moves its column.
test('a magical weapon’s PR row is its Attack Rating, and attribute PR adds to it', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const settings = { 'gameConfig.combatRatings.itemRatings.armament:ashStaff.pr': 1 };
  const configured = configuredContentBundle(contentBundle, settings);
  const staff = configured.equipment.armaments.find(p => p.id === 'ashStaff');
  assert.equal(staff.attackRating, 1);
  const tuned = createRegistries(configured);
  const run = createRunState({ seed: 7, classId: 'starseer', registries: tuned });
  run.loadout.sets.rightHand[0] = 'ashStaff';
  run.attributes = { ...run.attributes, wisdom: 2, intelligence: 2 };
  const rules = resolveCombatRatings(settings, contentBundle);
  const receipt = ratingReceipt(tuned, run, rules);
  assert.equal(receipt.sources.find(s => s.name === 'Ash Staff').pr, 1);
  assert.equal(receipt.totals.pr, 3, 'WIS 2 and INT 2 at 0.5 each is +2, and the staff says 1');
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
    { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 8 });
  const sword = configuredContentBundle(contentBundle, legacy).equipment.armaments.find(p => p.id === 'straightSword');
  assert.equal(sword.attackRating, 8, '5 authored + the 3 the old dial added');
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
  assert.equal(resumed.sources.find(s => s.name === 'Straight Sword').ar, 8, 'authored 5 + the 3, once');
  assert.equal(resumed.totals.ar, attributes + 8, 'not 11, which is what adding both homes gives');
});

// An item's rating is a whole number in the column it is written to, and the
// row's ceiling is the old one, so the two sums the migration cannot keep
// exactly are named at the import door rather than found later.
test('a legacy bonus that cannot be kept exactly says so', () => {
  const warnings = [];
  const file = (overrides) => JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides });
  const fractional = parseAdvancedConfigFile(file({ 'gameConfig.combatRatings.bonuses.armament:straightSword.ar': 0.5 }),
    contentBundle, {}, [], warnings);
  assert.deepEqual(fractional, { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 6 }, '5.5 rounds');
  assert.match(warnings.join(' '), /rounded/);
  assert.match(warnings.join(' '), /Straight Sword AR 5\.5→6/);

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
    'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 8,
    'settings.musicEnabled': true,
  }, 'the old key is gone and unrelated settings are untouched');

  // Which is what closes the gap the reviewer named: the row now opens on the
  // number the card shows.
  const row = advancedConfigRows(contentBundle).find(r => r.key === 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar');
  assert.equal(profile[row.key], 8);
  assert.equal(row.def, 5, 'and the authored value is still what Reset returns it to');
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
  assert.equal(pieceWeight(set), 3, 'a set’s Poise IS its weight — the row’s note says so');
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
  assert.equal(configured.equipment.armaments.find(p => p.id === 'straightSword').attackRating, 5);
  assert.equal(configured.equipment.armour.find(p => p.classId === 'reaver' && p.id === 'default').poiseThreshold, 8);
  // And an older run, which `configuredContentBundle` forces off by version.
  const older = configuredContentBundle(contentBundle, { schemaVersion: 1, overrides: { 'gameConfig.combatRatings.itemRatings.armament:straightSword.ar': 1 } });
  assert.equal(older.balance.combatRatings.enabled, false);
  assert.equal(older.equipment.armaments.find(p => p.id === 'straightSword').attackRating, 5);
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
    assert.equal(resolveNumberRow(settings, row), 5);
    assert.equal(configuredContentBundle(contentBundle, settings).equipment.armaments.find(p => p.id === 'straightSword').attackRating, 5);
  }
});
