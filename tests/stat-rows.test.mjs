// tests/stat-rows.test.mjs — derived-stat ruleset 7: one row format, one table,
// one formula for every stat (owner, 2026-09-24).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState, initializeRunDerivedStats } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { DERIVED_STAT_IDS, statRowValue, deriveStat, resolvedRuleRow } from '../src/model/derivedStats.js';
import { attributeRatingReceipt } from '../src/model/ratingFormula.js';
import { scaledCards } from '../src/model/handRules.js';
import { validateContent } from '../src/model/validate.js';
import {
  LEGACY_HAND_GROUPS, LEGACY_STARTING_BY_CLASS, LEGACY_RATING_FORMULA, legacyHandRow, legacyRatingRow, migrateLegacyStatSettings,
  statRow, statRowCount, ratingsConfigFor, readsLegacyStatHomes,
} from '../src/model/statRows.js';
import { configuredContentBundle, normalizeAdvancedSettings, parseAdvancedConfigFile, hasLegacyAdvancedSettings } from '../src/model/advancedConfig.js';

const ATTRIBUTES = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
const at = (n, overrides = {}) => ({ ...Object.fromEntries(ATTRIBUTES.map((id) => [id, n])), ...overrides });
const table = contentBundle.derivedStatRules;

test('ruleset 7 carries twelve rows in ONE shape: base, five weights, perLevel, min, max', () => {
  assert.equal(table.rulesetVersion, 7);
  const ids = ['hp', 'mana', 'stamina', 'energy', 'openingHand', 'draw', 'handSize', 'ar', 'dr', 'pr', 'ward', 'poise'];
  assert.deepEqual(Object.keys(table.rules).sort(), [...ids].sort());
  assert.deepEqual([...DERIVED_STAT_IDS].sort(), [...ids].sort());
  // The opening hand alone adds its per-class form and the baseline it
  // counts from (#1294's "class base 3–5, +1 from stats"); each class entry
  // is a smaller row of the same shape.
  const legal = new Set(['base', ...ATTRIBUTES, 'perLevel', 'min', 'max']);
  for (const [id, row] of Object.entries(table.rules)) {
    for (const key of Object.keys(row)) {
      assert(legal.has(key) || (id === 'openingHand' && ['attributeBaseline', 'byClass'].includes(key)), `${id}.${key} is outside the one row shape`);
    }
    assert(Number.isInteger(row.base), `${id}.base is whole`);
    for (const [classId, classRow] of Object.entries(row.byClass || {})) {
      for (const key of Object.keys(classRow)) assert(legal.has(key), `${id}.byClass.${classId}.${key} is outside the one row shape`);
      assert(Number.isInteger(classRow.base), `${id}.byClass.${classId}.base is whole`);
    }
  }
});

test("the owner's budget: Mana and Stamina weights sum to 1; the combat ratings to 2", () => {
  const sum = (id) => ATTRIBUTES.reduce((total, attr) => total + (table.rules[id][attr] || 0), 0);
  assert.equal(sum('mana'), 1);
  assert.deepEqual(ATTRIBUTES.map((attr) => table.rules.mana[attr] || 0), [0.125, 0, 0.25, 0.5, 0.125]);
  assert.equal(table.rules.mana.base, 1);
  assert.equal(sum('stamina'), 1);
  for (const id of ['ar', 'dr', 'pr', 'ward', 'poise']) assert(Math.abs(sum(id) - 2) < 1e-9, `${id} sums to 2`);
});

test('ONE row function drives every stat: pools, hand, ratings, poise all equal statRowValue', () => {
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const run = createRunState({ seed: 7, classId: 'starseer', registries });
  const level = 1;
  const own = (id) => statRowValue(resolvedRuleRow(run.derivedStatRuleSnapshot.rules, id), { attributes: run.attributes, level, lenientAttributes: true }).value;
  // Pools, through the run door.
  assert.equal(run.drawPerTurn, own('draw'));
  assert.equal(run.maxStamina, own('stamina') + run.equipmentPoolBonuses.maxStamina);
  assert.equal(run.energyMax, own('energy'));
  // Hand and ratings, through the fight door.
  const combat = createRunCombat({ registries, rng: createRng(1), run, enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.handMax, own('handSize'));
  assert.equal(combat.piles.hand.length, Math.min(own('openingHand'), own('handSize')));
  for (const id of ['ar', 'dr', 'pr', 'ward', 'poise']) {
    assert.equal(attributeRatingReceipt(combat.ratingsRules, run.attributes, id).value, own(id), `${id} rating attribute part`);
  }
  // deriveStat is the same function, read off a table.
  for (const id of DERIVED_STAT_IDS) assert.equal(deriveStat(run.derivedStatRuleSnapshot.rules, id, { attributes: run.attributes, level }).value, own(id));
});

test('per-term floors: a 0.125 weight adds nothing until the attribute reaches 8, and min/max clamp', () => {
  const row = { base: 1, wisdom: 0.125 };
  assert.equal(statRowValue(row, { attributes: { wisdom: 7 } }).value, 1);
  assert.equal(statRowValue(row, { attributes: { wisdom: 8 } }).value, 2);
  const clamped = { base: 2, intelligence: 1, min: 3, max: 5 };
  assert.equal(statRowValue(clamped, { attributes: { intelligence: 0 } }).value, 3);
  assert.equal(statRowValue(clamped, { attributes: { intelligence: 9 } }).value, 5);
  assert.equal(statRowValue({ base: 0, perLevel: 0.5 }, { attributes: {}, level: 4 }).value, 1);
});

test('the preserved rows read what ruleset 6 read at every attribute 5 and at 12 in the lead stat', () => {
  const legacyHand = Object.fromEntries(Object.entries({ starting: 'openingHand', turn: 'draw', capacity: 'handSize' })
    .map(([group, id]) => [id, legacyHandRow(LEGACY_HAND_GROUPS[group])]));
  for (const [id, legacy] of Object.entries(legacyHand)) {
    for (const attrs of [at(3), at(5), at(8), at(12), at(5, { intelligence: 12 })]) {
      assert.equal(statRowCount(resolvedRuleRow(table, id), attrs), statRowCount(legacy, attrs), `${id} at ${JSON.stringify(attrs)}`);
    }
  }
  for (const id of ['ar', 'dr', 'pr', 'ward']) {
    for (const attrs of [at(3), at(5), at(8), at(12)]) {
      assert.equal(statRowCount(resolvedRuleRow(table, id), attrs), statRowCount(legacyRatingRow(LEGACY_RATING_FORMULA.ratings[id]), attrs), `${id}`);
    }
  }
});

test('each retired home is refused by name at the content door', () => {
  const refused = (mutate, path) => {
    const bundle = { ...contentBundle, balance: structuredClone(contentBundle.balance) };
    mutate(bundle);
    const result = validateContent(bundle);
    assert(!result.ok && result.errors.some((error) => error.path === path && /retired/.test(error.msg)), `${path} refused by name`);
  };
  refused((b) => { b.balance.handMax = 5; }, 'balance.handMax');
  refused((b) => { b.balance.combatRatings = { multiplier: 1 }; }, 'balance.combatRatings.multiplier');
  refused((b) => { b.handRules = { starting: {} }; }, 'handRules.starting');
  refused((b) => { b.handRules = { turn: {} }; }, 'handRules.turn');
  refused((b) => { b.handRules = { capacity: {} }; }, 'handRules.capacity');
  refused((b) => { b.handRules = { startingByClass: {} }; }, 'handRules.startingByClass');
  // A ruleset-7 row may not spell the retired single-stat or tier fields.
  const bundle = { ...contentBundle, derivedStatRules: structuredClone(contentBundle.derivedStatRules) };
  bundle.derivedStatRules.rules.draw.pointsPerCard = 5;
  assert(!validateContent(bundle).ok, 'a hand-rule field on a stat row is refused');
});

// The ruleset-6 table exactly as it shipped, so a save born under it can be
// made here and restored under ruleset 7.
const RULESET_6 = {
  rulesetVersion: 6,
  defaults: { perLevel: 0, cap: null },
  rules: {
    energy: { base: 3, strength: 0.1, dexterity: 0.2, wisdom: 0.01, intelligence: 0.01, perLevel: 0.1 },
    draw: { base: 3, dexterity: 0.25, wisdom: 0.25, intelligence: 0.5, perLevel: 0.1 },
    hp: { base: 30, strength: 0.35, constitution: 4, wisdom: 0.1, perLevel: 2 },
    stamina: { base: 1, strength: 0.25, dexterity: 0.25, constitution: 0.5, wisdom: 0.1, perLevel: 0.2 },
    mana: { base: 1, strength: 0.1, constitution: 0.25, wisdom: 0.5, intelligence: 0.3, perLevel: 0.2 },
    poise: { base: 1, constitution: 1 },
  },
};

test('a ruleset-6 save restores identical values: pools, ratings and hand counts', () => {
  const old = { ...contentBundle };
  old.derivedStatRules = { ...RULESET_6, presentation: Object.fromEntries(Object.entries(contentBundle.derivedStatRules.presentation).filter(([id]) => RULESET_6.rules[id])) };
  const oldRegistries = createRegistries(old);
  const run = createRunState({ seed: 11, classId: 'herald', registries: oldRegistries });
  assert.equal(run.derivedStatRuleSnapshot.rulesetVersion, 6);
  const saved = structuredClone(run);
  // Restored under the live ruleset-7 registries.
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const restored = structuredClone(saved);
  initializeRunDerivedStats(restored, registries);
  for (const key of ['maxHp', 'maxMana', 'maxStamina', 'energyMax', 'drawPerTurn']) assert.equal(restored[key], saved[key], key);
  assert(readsLegacyStatHomes(restored));
  // Ratings: the frozen ruleset-6 formula, not the live rows.
  const config = ratingsConfigFor(registries, restored);
  for (const id of ['ar', 'dr', 'pr', 'ward', 'poise']) {
    const legacy = LEGACY_RATING_FORMULA.ratings[id];
    const expected = legacy.base + ATTRIBUTES.reduce((sum, attr) => sum + Math.floor(restored.attributes[attr] * legacy[attr] + 1e-9), 0);
    assert.equal(attributeRatingReceipt(config, restored.attributes, id).value, expected, id);
  }
  // Hand counts: the frozen hand-rule groups, exactly as the old formula.
  // The opening hand is #1294's, per class: the Herald's base and Wisdom.
  const legacyCount = (group) => {
    const rule = group === 'starting' ? { ...LEGACY_HAND_GROUPS.starting, ...LEGACY_STARTING_BY_CLASS.herald } : LEGACY_HAND_GROUPS[group];
    const points = restored.attributes[rule.stat];
    return Math.min(rule.maximum, Math.max(rule.minimum, rule.base + Math.floor(Math.max(0, points - rule.baseline) / rule.pointsPerCard)));
  };
  assert.equal(statRowCount(statRow(registries, restored, 'openingHand'), restored.attributes), legacyCount('starting'));
  assert.equal(statRowCount(statRow(registries, restored, 'draw'), restored.attributes), legacyCount('turn'));
  assert.equal(statRowCount(statRow(registries, restored, 'handSize'), restored.attributes), legacyCount('capacity'));
  const combat = createRunCombat({ registries, rng: createRng(3), run: restored, enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.handMax, legacyCount('capacity'));
});

test('a fight saved with the retired hand groups and rating multiplier restores and counts exactly', () => {
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  const combat = createRunCombat({ registries, rng: createRng(4), run, enemyIds: ['wanderingSoldier'] });
  const snapshot = serializeCombatSnapshot(combat);
  // Rewrite it into what a pre-ruleset-7 build wrote.
  const { rows, ...options } = snapshot.handRules;
  snapshot.handRules = { ...options, ...structuredClone(LEGACY_HAND_GROUPS) };
  snapshot.ratingsRules = { ...snapshot.ratingsRules, multiplier: 1.5, ratings: structuredClone(LEGACY_RATING_FORMULA.ratings) };
  const back = restoreCombatSnapshot({ registries, rng: createRng(4), snapshot });
  const rule = LEGACY_HAND_GROUPS.capacity;
  assert.equal(scaledCards(back.handRules.capacity, back.attributes),
    Math.min(rule.maximum, Math.max(rule.minimum, rule.base + Math.floor(Math.max(0, back.attributes.intelligence - rule.baseline) / rule.pointsPerCard))));
  const legacy = LEGACY_RATING_FORMULA.ratings.ar;
  const weighted = ATTRIBUTES.reduce((sum, attr) => sum + Math.floor(back.attributes[attr] * legacy[attr] + 1e-9), 0);
  assert.equal(attributeRatingReceipt(back.ratingsRules, back.attributes, 'ar').value, legacy.base + Math.floor(weighted * 1.5 + 1e-9));
});

test('legacy settings keys convert on import and on load: ratings, multiplier, hand groups, handMax', () => {
  const warnings = [];
  const converted = migrateLegacyStatSettings({
    'gameConfig.combatRatings.ratings.ar.strength': 1,
    'gameConfig.combatRatings.ratings.ward.base': 3,
    'gameConfig.handRules.capacity.base': 9,
    'gameConfig.handRules.starting.base': 4, // the shipped value: nothing to fit
    'gameConfig.balance.handMax': 7,
    'gameConfig.handRules.retain': false,
  }, warnings);
  assert.equal(converted['gameConfig.derivedStatRules.rules.ar.strength'], 1);
  assert.equal(converted['gameConfig.derivedStatRules.rules.ward.base'], 3);
  assert.equal(converted['gameConfig.handRules.retain'], false, 'a behaviour option is not a stat row and stays');
  for (const key of Object.keys(converted)) assert(!/combatRatings\.ratings|handRules\.(starting|turn|capacity)|balance\.handMax/.test(key), `${key} left in a retired home`);
  assert.equal(converted['gameConfig.derivedStatRules.rules.handSize.base'] !== undefined, true, 'a tuned capacity becomes the hand-size row');
  assert.equal(converted['gameConfig.derivedStatRules.rules.openingHand.base'], undefined, 'an untuned group keeps the new defaults');
  // The fitted capacity counts what the tuned group counted at the creation baseline.
  const fitted = Object.fromEntries(['base', ...ATTRIBUTES, 'min', 'max'].map((f) => [f, converted[`gameConfig.derivedStatRules.rules.handSize.${f}`]]));
  const legacy = legacyHandRow({ ...LEGACY_HAND_GROUPS.capacity, base: 9 });
  for (const n of [3, 5, 8, 12]) assert.equal(statRowCount(fitted, { intelligence: n }), statRowCount(legacy, { intelligence: n }), `INT ${n}`);
  assert(warnings.some((line) => /hand size|hand capacity/i.test(line)));
  // A multiplier folds into the weights, and says so.
  const scaledWarnings = [];
  const scaled = migrateLegacyStatSettings({ 'gameConfig.combatRatings.multiplier': 2 }, scaledWarnings);
  assert.equal(scaled['gameConfig.derivedStatRules.rules.ar.strength'], 1.5);
  assert(scaledWarnings.some((line) => /multiplier/.test(line)));
  // The profile door and the import door both run it.
  const profile = { 'gameConfig.handRules.turn.baseline': 2, 'gameConfig.combatRatings.ratings.dr.base': 2 };
  assert(hasLegacyAdvancedSettings(profile));
  normalizeAdvancedSettings(profile, contentBundle, []);
  assert.equal(profile['gameConfig.derivedStatRules.rules.dr.base'], 2);
  assert.equal(profile['gameConfig.handRules.turn.baseline'], undefined);
  const file = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides: { 'gameConfig.combatRatings.ratings.pr.intelligence': 1, 'gameConfig.balance.handMax': 6 } });
  const imported = parseAdvancedConfigFile(file, contentBundle, {}, [], []);
  assert.equal(imported['gameConfig.derivedStatRules.rules.pr.intelligence'], 1);
});

test('co-op reads the same rows: each seat counts cards and ratings by its own run', () => {
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const seats = ['starseer', 'reaver'].map((classId, index) => {
    const run = createRunState({ seed: 20 + index, classId, registries });
    return { id: `p${index + 1}`, classId, maxHp: run.maxHp, hp: run.hp, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn,
      attributes: run.attributes, derivedStatRuleSnapshot: run.derivedStatRuleSnapshot, deck: run.deck, relicIds: [], flasks: [], level: 1 };
  });
  const C = createCoopCombat({ registries, rng: createRng(9), players: seats, enemyIds: ['wanderingSoldier'] });
  for (const seat of seats) {
    const P = C.players.get(seat.id);
    const own = (id) => statRowCount(statRow(registries, seat, id), seat.attributes);
    assert.equal(P.handMax, own('handSize'), `${seat.classId} hand size`);
    assert.equal(P.piles.hand.length, Math.min(own('openingHand'), own('handSize')), `${seat.classId} opening hand`);
    assert.equal(P.entity.drawPerTurn, own('draw'), `${seat.classId} draw row`);
    assert.deepEqual(P.ratingRows.ar, statRow(registries, seat, 'ar'));
  }
});

test('a pre-ruleset-7 draw or poise row is read as what it meant then; a marked one as what it means now', () => {
  const old = {
    'gameConfig.derivedStatRules.rules.draw.base': 3,
    'gameConfig.derivedStatRules.rules.draw.intelligence': 0.5,
    'gameConfig.derivedStatRules.rules.poise.constitution': 1,
    'gameConfig.combatRatings.ratings.poise.constitution': 1.5,
    'gameConfig.handRules.turn.base': 3,
  };
  const warnings = [];
  const converted = migrateLegacyStatSettings(old, warnings);
  // The co-op-only draw is set aside; the tuned turn draw becomes the row.
  assert.notEqual(converted['gameConfig.derivedStatRules.rules.draw.intelligence'], 0.5);
  assert.equal(converted['gameConfig.derivedStatRules.rules.draw.base'] !== undefined, true);
  // The rating Poise wins over the ratings-off pool.
  assert.equal(converted['gameConfig.derivedStatRules.rules.poise.constitution'], 1.5);
  assert(warnings.some((line) => /old Draw row/.test(line)));
  // A profile this build marked keeps its rows as they are.
  const marked = { statRowsVersion: 7, 'gameConfig.derivedStatRules.rules.draw.base': 3 };
  assert.equal(hasLegacyAdvancedSettings(marked), false);
  assert.equal(migrateLegacyStatSettings(marked), marked);
  // Normalising a profile whose stat rows it read marks it; one with none is left alone.
  const profile = { 'gameConfig.handRules.turn.base': 3 };
  normalizeAdvancedSettings(profile, contentBundle, []);
  assert.equal(profile.statRowsVersion, 7);
  const untouched = { sfxVolume: 0.4 };
  normalizeAdvancedSettings(untouched, contentBundle, []);
  assert.deepEqual(untouched, { sfxVolume: 0.4 });
  // An exported file carries the stamp, and a stamped file's draw row imports as written.
  const stamped = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', statRows: 7, overrides: { 'gameConfig.derivedStatRules.rules.draw.base': 3 } });
  assert.equal(parseAdvancedConfigFile(stamped, contentBundle, {}, [], [])['gameConfig.derivedStatRules.rules.draw.base'], 3);
  const unstamped = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides: { 'gameConfig.derivedStatRules.rules.draw.base': 3 } });
  assert.equal(parseAdvancedConfigFile(unstamped, contentBundle, {}, [], [])['gameConfig.derivedStatRules.rules.draw.base'], undefined);
});

test('a hand holds at least one card: a hand size under 1 is refused before a fight can open empty', () => {
  const file = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', statRows: 7, overrides: { 'gameConfig.derivedStatRules.rules.handSize.max': 0 } });
  assert.throws(() => parseAdvancedConfigFile(file, contentBundle, {}, [], []));
  const bundle = { ...contentBundle, derivedStatRules: structuredClone(contentBundle.derivedStatRules) };
  bundle.derivedStatRules.rules.handSize.min = 0;
  assert(!validateContent(bundle).ok);
});

test('an old run keeps the hand it was born with, from its own configuration snapshot', () => {
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  run.derivedStatRuleSnapshot = { ...run.derivedStatRuleSnapshot, rulesetVersion: 6, rules: { ...run.derivedStatRuleSnapshot.rules, rulesetVersion: 6 } };
  run.advancedConfigSnapshot = { schemaVersion: 1, overrides: { 'gameConfig.handRules.capacity.base': 9 } };
  // The live profile has been converted and holds no hand-rule keys.
  assert.equal(statRow(registries, run, 'handSize', { settings: {} }).base, 9);
});

test('Max 999 is no ceiling, and the ratings-off Poise meter reads the row with its level and bounds', async () => {
  const configured = configuredContentBundle(contentBundle, { 'gameConfig.derivedStatRules.rules.hp.max': 999, 'gameConfig.derivedStatRules.rules.ar.max': 999 });
  assert.equal(configured.derivedStatRules.rules.hp.max, undefined);
  assert.equal(configured.balance.combatRatings.ratings.ar.max, undefined);
  assert.equal(configuredContentBundle(contentBundle, { 'gameConfig.derivedStatRules.rules.hp.max': 500 }).derivedStatRules.rules.hp.max, 500);
  const { playerPoiseThresholdReceipt } = await import('../src/model/statProjection.js');
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const run = createRunState({ seed: 2, classId: 'reaver', registries });
  const rules = structuredClone(run.derivedStatRuleSnapshot);
  rules.rules.rules.poise = { ...rules.rules.rules.poise, perLevel: 1, max: 6 };
  const base = { loadout: run.loadout, relics: [], class: 'reaver', attributes: run.attributes, derivedStatRuleSnapshot: rules };
  const bare = { ...base, loadout: { ...run.loadout } };
  const attributePart = (level) => playerPoiseThresholdReceipt({ ...registries, balance: { ...registries.balance, combatRatings: undefined } }, { ...bare, level: { level } }).attribute;
  assert.equal(attributePart(20), 6, 'held to its max');
  assert(attributePart(1) <= attributePart(3));
});

test('rating receipts show a row bound, and an old run\'s attribute cards name its own rating formula', async () => {
  const { renderPlayerPoise } = await import('../src/ui/components/equipmentReceipts.js');
  const { attributeRatingReceipt: receiptOf } = await import('../src/model/ratingFormula.js');
  const config = { ratings: { ar: { base: 0, strength: 1, max: 1 }, dr: { base: 0 }, pr: { base: 0 }, poise: { base: 0 }, ward: { base: 0 } } };
  const ar = receiptOf(config, { strength: 2 }, 'ar');
  const html = renderPlayerPoise({ ratings: { ar: 3 }, ratingAttributes: { ar }, ratingSources: [{ kind: 'equipment', name: 'Sword', ar: 2 }], note: '' });
  assert.match(html, /<b>-1<\/b> held to its max/);
  const { statProjection } = await import('../src/model/statProjection.js');
  const { attributeCardModels } = await import('../src/model/creationBrief.js');
  const registries = createRegistries(configuredContentBundle(contentBundle, { 'gameConfig.combatRatings.ratings.ar.strength': 2 }));
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  run.derivedStatRuleSnapshot = { ...run.derivedStatRuleSnapshot, rulesetVersion: 6, rules: { ...run.derivedStatRuleSnapshot.rules, rulesetVersion: 6 } };
  const cards = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run) });
  const strength = cards.find((card) => card.id === 'strength');
  assert(strength.reveal.lines.some((line) => line === 'AR: floor(2 × STR)'), strength.reveal.lines.join(' | '));
});

test('an old run with ratings on names its rating Poise on its cards; a ratings-off Poise edit is not migrated', async () => {
  const { statProjection } = await import('../src/model/statProjection.js');
  const { attributeCardModels } = await import('../src/model/creationBrief.js');
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  run.derivedStatRuleSnapshot = { ...run.derivedStatRuleSnapshot, rulesetVersion: 6, rules: { ...run.derivedStatRuleSnapshot.rules, rulesetVersion: 6 } };
  const cards = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run) });
  const strength = cards.find((card) => card.id === 'strength');
  assert(strength.reveal.lines.some((line) => line === 'Poise: floor(0.5 × STR)'), strength.reveal.lines.join(' | '));
  const off = migrateLegacyStatSettings({ 'gameConfig.combatRatings.enabled': false, 'gameConfig.combatRatings.ratings.poise.base': 50 });
  assert.equal(off['gameConfig.derivedStatRules.rules.poise.base'], undefined);
  assert.equal(off['gameConfig.combatRatings.ratings.poise.base'], undefined);
});

test("an old run's attribute cards name its own hand groups, not the live hand rows", async () => {
  const { statProjection } = await import('../src/model/statProjection.js');
  const { attributeCardModels } = await import('../src/model/creationBrief.js');
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const run = createRunState({ seed: 4, classId: 'starseer', registries });
  // A ruleset-6 snapshot never had the openingHand/handSize rows.
  const rules = Object.fromEntries(Object.entries(run.derivedStatRuleSnapshot.rules.rules)
    .filter(([id]) => id !== 'openingHand' && id !== 'handSize'));
  run.derivedStatRuleSnapshot = { ...run.derivedStatRuleSnapshot, rulesetVersion: 6, rules: { ...run.derivedStatRuleSnapshot.rules, rulesetVersion: 6, rules } };
  run.advancedConfigSnapshot = { ...(run.advancedConfigSnapshot || {}), overrides: { ...(run.advancedConfigSnapshot?.overrides || {}), 'gameConfig.handRules.starting.pointsPerCard': 3, 'gameConfig.handRules.turn.pointsPerCard': 4 } };
  const lines = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run) })
    .find((card) => card.id === 'intelligence').reveal.lines;
  assert(lines.includes('Opening hand +1 every 3 points'), lines.join(' | '));
  // Its solo turn draw is its tuned `turn` group, not the snapshot's co-op draw row.
  assert(lines.includes('Draw / turn +1 every 4 points'), lines.join(' | '));
  assert(lines.includes(`Hand size +1 every ${LEGACY_HAND_GROUPS.capacity.pointsPerCard} points`), lines.join(' | '));
  assert(!lines.some((line) => /^(Opening hand|Hand size) \+\d+ every (20|100) points$/.test(line)), lines.join(' | '));
});

// ---- RUNS STARTED BETWEEN #1294 AND RULESET 7 --------------------------------
// #1294 shipped each class's opening hand as hand rules read per fight:
// clamp(classBase + floor(max(0, primary − 1) ÷ 2), 4, 6), tunable through
// `handRules.startingByClass.<class>.base/stat`, with a stored 3–15 pair (the
// retired default) dropped. A run born under ruleset 6 in that window restores
// exactly that hand, and the profile keys it was tuned with convert exactly.
const CLASS_HAND = { reaver: [3, 'strength'], rogue: [4, 'dexterity'], herald: [4, 'wisdom'], starseer: [5, 'intelligence'] };
const hand1294 = (base, primary, { minimum = 4, maximum = 6 } = {}) => Math.min(maximum, Math.max(minimum, base + Math.floor(Math.max(0, primary - 1) / 2)));
const ruleset6Run = (classId, registries, overrides = null) => {
  const run = createRunState({ seed: 3, classId, registries });
  const rules = Object.fromEntries(Object.entries(run.derivedStatRuleSnapshot.rules.rules).filter(([id]) => !['openingHand', 'handSize', 'ar', 'dr', 'pr', 'ward'].includes(id)));
  run.derivedStatRuleSnapshot = { ...run.derivedStatRuleSnapshot, rulesetVersion: 6, rules: { ...run.derivedStatRuleSnapshot.rules, rulesetVersion: 6, rules } };
  if (overrides) run.advancedConfigSnapshot = { schemaVersion: 1, ratingsVersion: 1, overrides };
  return run;
};

test("a run started between #1294 and ruleset 7 opens on #1294's class hand, at every primary 1–12", () => {
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  for (const [classId, [base, stat]] of Object.entries(CLASS_HAND)) {
    const run = ruleset6Run(classId, registries);
    assert(readsLegacyStatHomes(run));
    for (let primary = 1; primary <= 12; primary += 1) {
      const attributes = { ...at(1), [stat]: primary };
      assert.equal(statRowCount(statRow(registries, run, 'openingHand'), attributes), hand1294(base, primary), `${classId} ${stat} ${primary}`);
    }
    // And the fight it opens deals it, and carries the class's group.
    const combat = createRunCombat({ registries, rng: createRng(3), run, enemyIds: ['wanderingSoldier'] });
    assert.equal(combat.piles.hand.length, Math.min(run.deck.length, hand1294(base, run.attributes[stat])), classId);
    assert.deepEqual(combat.handRules.rows.openingHand, statRow(registries, run, 'openingHand'), 'the fight\'s hand rules carry it');
  }
  // Its own #1294 tuning restores too — and the retired 3–15 pair it may have
  // pinned is read as #1294 read it: dropped.
  const tunedRun = ruleset6Run('reaver', registries, {
    'gameConfig.handRules.startingByClass.reaver.base': 5,
    'gameConfig.handRules.startingByClass.reaver.stat': 'constitution',
    'gameConfig.handRules.starting.maximum': 15,
    'gameConfig.handRules.starting.minimum': 3,
  });
  for (let primary = 1; primary <= 12; primary += 1) {
    assert.equal(statRowCount(statRow(registries, tunedRun, 'openingHand'), { ...at(1), constitution: primary }), hand1294(5, primary));
  }
});

test("#1294's opening-hand settings convert exactly onto the opening-hand row", () => {
  const legacy = {
    'gameConfig.handRules.startingByClass.reaver.base': 5,
    'gameConfig.handRules.startingByClass.herald.stat': 'intelligence',
    'gameConfig.handRules.starting.maximum': 7,
  };
  const converted = normalizeAdvancedSettings({ ...legacy }, contentBundle);
  assert(Object.keys(converted).every((key) => !key.startsWith('gameConfig.handRules.')), 'no hand-rule count key survives');
  const registries = createRegistries(configuredContentBundle(contentBundle, converted));
  const expected = { reaver: [5, 'strength'], rogue: [4, 'dexterity'], herald: [4, 'intelligence'], starseer: [5, 'intelligence'] };
  for (const [classId, [base, stat]] of Object.entries(expected)) {
    for (let primary = 1; primary <= 12; primary += 1) {
      const attributes = { ...at(1), [stat]: primary };
      assert.equal(statRowCount(statRow(registries, { class: classId }, 'openingHand'), attributes), hand1294(base, primary, { maximum: 7 }), `${classId} ${stat} ${primary}`);
    }
  }
  // An exported file from #1294 converts the same way, mirrors and all.
  const file = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides: { ...legacy, ...Object.fromEntries(Object.entries(legacy).map(([k, v]) => [`settings.${k}`, v])) } });
  const imported = parseAdvancedConfigFile(file, contentBundle);
  assert.equal(imported['gameConfig.derivedStatRules.rules.openingHand.byClass.reaver.base'], 5);
  assert.equal(imported['gameConfig.derivedStatRules.rules.openingHand.byClass.herald.intelligence'], 0.5);
  assert.equal(imported['gameConfig.derivedStatRules.rules.openingHand.byClass.herald.wisdom'], 0);
  assert.equal(imported['gameConfig.derivedStatRules.rules.openingHand.max'], 7);
});

test('a saved fight whose hand size can reach 0 is refused at the fight door', async () => {
  const { handRulesProblems, resolveHandRules } = await import('../src/model/handRules.js');
  const rows = { openingHand: { base: 4 }, draw: { base: 2 }, handSize: { base: 7, min: 1, max: 30 } };
  assert.deepEqual(handRulesProblems(resolveHandRules({}, rows)), []);
  for (const handSize of [{ base: 0, min: 0 }, { base: 7 }, { base: 7, min: 1, max: 0 }]) {
    assert(handRulesProblems(resolveHandRules({}, { ...rows, handSize })).some((line) => /handSize min and max/.test(line)), JSON.stringify(handSize));
  }
});

test('a saved fight with an unpriceable hand or rating row, or rating rules without rows, is refused (Codex, #1296)', async () => {
  const { handRulesProblems, resolveHandRules } = await import('../src/model/handRules.js');
  const { combatSnapshotProblems } = await import('../src/model/combatSnapshot.js');
  const rows = { openingHand: { base: 4 }, draw: { base: 2 }, handSize: { base: 7, min: 1, max: 30 } };
  for (const draw of [{ base: 2, rounding: 'bogus' }, { base: 2, pointsPerIncrease: 0 }, { base: 2, mystery: 1 }]) {
    assert(handRulesProblems(resolveHandRules({}, { ...rows, draw })).some((line) => /draw/.test(line)), JSON.stringify(draw));
  }
  const registries = createRegistries(configuredContentBundle(contentBundle, { 'gameConfig.combatRatings.enabled': true }));
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  const snapshot = serializeCombatSnapshot(createRunCombat({ registries, rng: createRng(4), run, enemyIds: ['wanderingSoldier'] }));
  assert(snapshot.ratingsRules, 'the fight carries rating rules');
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  const { ratings, ...withoutRows } = snapshot.ratingsRules;
  assert(combatSnapshotProblems({ ...snapshot, ratingsRules: withoutRows }).some((line) => /missing rating rows/.test(line)));
  const badAr = { ...snapshot.ratingsRules, ratings: { ...ratings, ar: { ...ratings.ar, rounding: 'bogus' } } };
  assert(combatSnapshotProblems({ ...snapshot, ratingsRules: badAr }).some((line) => /Combat ratings: ar/.test(line)));
});
