// tests/stat-rows.test.mjs — derived-stat ruleset 7: one row format, one table,
// one formula for every stat (owner, 2026-09-24).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState, initializeRunDerivedStats } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { DERIVED_STAT_IDS, statRowValue, deriveStat, resolvedRuleRow } from '../src/model/derivedStats.js';
import { attributeRatingReceipt } from '../src/model/ratingFormula.js';
import { scaledCards } from '../src/model/handRules.js';
import { validateContent } from '../src/model/validate.js';
import { statRow, statRowCount, ratingsConfigFor } from '../src/model/statRows.js';
import { configuredContentBundle, normalizeAdvancedSettings, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';

const ATTRIBUTES = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
const at = (n, overrides = {}) => ({ ...Object.fromEntries(ATTRIBUTES.map((id) => [id, n])), ...overrides });
const table = contentBundle.derivedStatRules;

test('ruleset 7 carries twelve rows in ONE shape: base, five weights, perLevel, min, max', () => {
  assert.equal(table.rulesetVersion, 7);
  const ids = ['hp', 'mana', 'stamina', 'energy', 'openingHand', 'draw', 'handSize', 'ar', 'dr', 'pr', 'ward', 'poise'];
  assert.deepEqual(Object.keys(table.rules).sort(), [...ids].sort());
  assert.deepEqual([...DERIVED_STAT_IDS].sort(), [...ids].sort());
  // The three hand rows count from a baseline (the retired groups' "points
  // before bonuses", restated exactly), and the opening hand alone adds its
  // per-class form (#1294's "class base 3–5, +1 from stats"); each class
  // entry is a smaller row of the same shape.
  const legal = new Set(['base', ...ATTRIBUTES, 'perLevel', 'min', 'max']);
  for (const [id, row] of Object.entries(table.rules)) {
    for (const key of Object.keys(row)) {
      assert(legal.has(key) || (['openingHand', 'draw', 'handSize'].includes(id) && key === 'attributeBaseline') || (id === 'openingHand' && key === 'byClass'), `${id}.${key} is outside the one row shape`);
    }
    assert(Number.isInteger(row.base), `${id}.base is whole`);
    for (const [classId, classRow] of Object.entries(row.byClass || {})) {
      for (const key of Object.keys(classRow)) assert(legal.has(key), `${id}.byClass.${classId}.${key} is outside the one row shape`);
      assert(Number.isInteger(classRow.base), `${id}.byClass.${classId}.base is whole`);
    }
  }
});

test("Mana weights sum to 1; Stamina scales from base 3; each combat rating has one primary point", () => {
  const sum = (id) => ATTRIBUTES.reduce((total, attr) => total + (table.rules[id][attr] || 0), 0);
  assert.equal(sum('mana'), 1);
  assert.deepEqual(ATTRIBUTES.map((attr) => table.rules.mana[attr] || 0), [0.125, 0, 0.25, 0.5, 0.125]);
  assert.equal(table.rules.mana.base, 1);
  assert.ok(Math.abs(sum('stamina') - 0.9) < 1e-9);
  assert.deepEqual(ATTRIBUTES.map(attr => table.rules.stamina[attr] || 0), [0, 0.25, 0.25, 0.2, 0.2]);
  assert.equal(table.rules.stamina.perLevel, 0.1);
  assert.equal(table.rules.stamina.base, 3);
  for (const id of ['ar', 'dr', 'pr', 'ward', 'poise']) assert.equal(sum(id), 1, `${id} sums to 1`);
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

test('hand scaling remains preserved while ratings use their single primary bonus', () => {
  for (const attrs of [at(3), at(5), at(8), at(12), at(5, { intelligence: 12 })]) {
    const draw = Math.min(10, 4 + Math.floor(Math.max(0, attrs.intelligence - 4) / 5));
    assert.equal(statRowCount(resolvedRuleRow(table, 'draw'), attrs), draw);
    assert.equal(statRowCount(resolvedRuleRow(table, 'openingHand'), attrs), draw);
    assert.equal(statRowCount(resolvedRuleRow(table, 'handSize'), attrs), Math.min(20, 7 + Math.floor(Math.max(0, attrs.intelligence - 4) / 5)));
  }
  assert.equal(statRowCount(resolvedRuleRow(table, 'handSize'), at(14)), 9, 'hand size 7 + 2 at INT 14');
  for (const id of ['ar', 'dr', 'pr', 'ward']) {
    for (const attrs of [at(3), at(5), at(8), at(12)]) {
      assert.equal(statRowCount(resolvedRuleRow(table, id), attrs), attrs.strength + (id === 'ward' ? 1 : 0), `${id}`);
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

test('retired stat keys are dropped with one warning and nothing is converted: ratings, multiplier, hand groups, handMax', () => {
  const retired = {
    'gameConfig.combatRatings.ratings.ar.strength': 1,
    'gameConfig.combatRatings.ratings.ward.base': 3,
    'gameConfig.combatRatings.multiplier': 2,
    'gameConfig.handRules.capacity.base': 9,
    'gameConfig.handRules.turn.pointsPerCard': 3,
    'gameConfig.handRules.startingByClass.reaver.base': 5,
    'gameConfig.balance.handMax': 7,
    statRowsVersion: 7,
  };
  const keep = { 'gameConfig.handRules.retain': false, 'gameConfig.derivedStatRules.rules.draw.base': 3 };
  // The profile door.
  const profile = { ...retired, ...keep };
  const warnings = [];
  assert.equal(normalizeAdvancedSettings(profile, contentBundle, warnings), profile, 'the same object');
  assert.deepEqual(profile, keep, 'only the retired keys went; a behaviour option and a row key stay as written');
  assert.equal(warnings.length, 1, 'one warning for the whole stat family');
  assert.match(warnings[0], /formula and multiplier.*retired/);
  // The mirrored spelling goes too.
  const mirrored = { 'settings.gameConfig.balance.handMax': 7, 'settings.gameConfig.combatRatings.ratings.pr.intelligence': 1 };
  normalizeAdvancedSettings(mirrored, contentBundle, []);
  assert.deepEqual(mirrored, {});
  // The import door: the file lands without them, no row key is written for them.
  const file = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides: { ...retired, ...keep } });
  const importWarnings = [];
  const imported = parseAdvancedConfigFile(file, contentBundle, {}, [], importWarnings);
  assert.deepEqual(imported, keep);
  assert.equal(importWarnings.length, 1);
  // A row key is a row key: an unstamped file's draw row imports as written.
  const unstamped = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', overrides: { 'gameConfig.derivedStatRules.rules.draw.base': 3 } });
  assert.equal(parseAdvancedConfigFile(unstamped, contentBundle, {}, [], [])['gameConfig.derivedStatRules.rules.draw.base'], 3);
  // Unchanged input is returned as is.
  const clean = { sfxVolume: 0.4 };
  normalizeAdvancedSettings(clean, contentBundle, []);
  assert.deepEqual(clean, { sfxVolume: 0.4 });
});

test('a hand holds at least one card: a hand size under 1 is refused before a fight can open empty', () => {
  const file = JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', statRows: 7, overrides: { 'gameConfig.derivedStatRules.rules.handSize.max': 0 } });
  assert.throws(() => parseAdvancedConfigFile(file, contentBundle, {}, [], []));
  const bundle = { ...contentBundle, derivedStatRules: structuredClone(contentBundle.derivedStatRules) };
  bundle.derivedStatRules.rules.handSize.min = 0;
  assert(!validateContent(bundle).ok);
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

test('rating receipts show a row bound', async () => {
  const { renderPlayerPoise } = await import('../src/ui/components/equipmentReceipts.js');
  const { attributeRatingReceipt: receiptOf } = await import('../src/model/ratingFormula.js');
  const config = { ratings: { ar: { base: 0, strength: 1, max: 1 }, dr: { base: 0 }, pr: { base: 0 }, poise: { base: 0 }, ward: { base: 0 } } };
  const ar = receiptOf(config, { strength: 2 }, 'ar');
  const html = renderPlayerPoise({ ratings: { ar: 3 }, ratingAttributes: { ar }, ratingSources: [{ kind: 'equipment', name: 'Sword', ar: 2 }], note: '' });
  assert.match(html, /<b>-1<\/b> held to its max/);
});

test('a saved fight whose hand size can reach 0 is refused at the fight door', async () => {
  const { handRulesProblems, resolveHandRules } = await import('../src/model/handRules.js');
  const rows = { openingHand: { base: 4 }, draw: { base: 2 }, handSize: { base: 7, min: 1, max: 30 } };
  assert.deepEqual(handRulesProblems(resolveHandRules({}, rows)), []);
  for (const handSize of [{ base: 0, min: 0 }, { base: 7 }, { base: 7, min: 1, max: 0 }]) {
    assert(handRulesProblems(resolveHandRules({}, { ...rows, handSize })).some((line) => /handSize min and max/.test(line)), JSON.stringify(handSize));
  }
});

// Codex, #1296 (second round): a sparse legacy rating edit keeps its formula,
// a saved level is a real level, Mana keeps a ceiling of at least 1, and a
// bound that moves a number is said wherever the number is explained.
test('bounds are said; saved levels and Mana ceilings are held', async () => {
  const { combatSnapshotProblems } = await import('../src/model/combatSnapshot.js');
  const registries = createRegistries(configuredContentBundle(contentBundle, {}));
  const run = createRunState({ seed: 6, classId: 'herald', registries });
  const saved = serializeCombatSnapshot(createRunCombat({ registries, rng: createRng(6), run, enemyIds: ['wanderingSoldier'] }));
  for (const characterLevel of [0, -2, 1.5, '3']) {
    assert(combatSnapshotProblems({ ...saved, characterLevel }).some((line) => /characterLevel/.test(line)), String(characterLevel));
  }
  const { characterLevel: _level, ...legacy } = saved;
  assert(!combatSnapshotProblems(legacy).some((line) => /characterLevel/.test(line)), 'absent stays legal');

  const { advancedConfigRows } = await import('../src/model/advancedConfig.js');
  assert.equal(advancedConfigRows(contentBundle).find((row) => row.key === 'gameConfig.derivedStatRules.rules.mana.max').min, 1);

  const { attributeCardModels } = await import('../src/model/creationBrief.js');
  const { statProjection } = await import('../src/model/statProjection.js');
  const capped = createRegistries(configuredContentBundle(contentBundle, { 'gameConfig.derivedStatRules.rules.hp.max': 40 }));
  const cappedRun = createRunState({ seed: 6, classId: 'reaver', registries: capped });
  const con = attributeCardModels(capped, cappedRun.attributes, { projection: statProjection(capped, cappedRun) }).find((card) => card.id === 'constitution');
  assert.match(con.face.summary, /HP per pt \(max 40\)/);
  // ...and a rating row's Max reaches its fact too (Codex, #1321).
  const arCapped = createRegistries(configuredContentBundle(contentBundle, { 'gameConfig.derivedStatRules.rules.ar.max': 3 }));
  const arRun = createRunState({ seed: 6, classId: 'reaver', registries: arCapped });
  const str = attributeCardModels(arCapped, arRun.attributes, { projection: statProjection(arCapped, arRun) }).find((card) => card.id === 'strength');
  assert(str.reveal.lines.some((line) => /^AR: floor\(1 × STR\) \(at most 3\)$/.test(line)), str.reveal.lines.join(' | '));
  assert.match(str.face.summary, /AR weight 1 \(max 3\)/, 'the cap reaches the face beside the other feeds');
  assert.doesNotMatch(con.face.summary, /weight/, 'an uncapped rating stays off a face that has feeds');
  // A weight with no exact cycle still says its cap (Codex, #1321).
  const odd = createRegistries(configuredContentBundle(contentBundle, { 'gameConfig.derivedStatRules.rules.hp.strength': 0.3333, 'gameConfig.derivedStatRules.rules.hp.max': 40 }));
  const oddRun = createRunState({ seed: 6, classId: 'reaver', registries: odd });
  const oddStr = attributeCardModels(odd, oddRun.attributes, { projection: statProjection(odd, oddRun) }).find((card) => card.id === 'strength');
  assert(oddStr.reveal.lines.includes('HP scales with Strength (at most 40)'), oddStr.reveal.lines.join(' | '));
  assert.match(oddStr.face.summary, /HP scales \(max 40\)/);
});

// A run saved under ruleset 1–6 bounds a row with the retired `cap`; its
// attribute cards say it as they say a Max (Codex, #1321).
