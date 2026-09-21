import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { attributeContentProblems } from '../src/model/attributes.js';
import { createRunState } from '../src/model/state.js';
import { deriveStat } from '../src/model/derivedStats.js';

const poolKey = 'gameConfig.startingStats.pointbuy.total';
test('pool changes redistribute every class exactly and leave authored content alone', () => {
  for (const total of [5, 10, 60, 100, 495]) {
    const configured = configuredContentBundle(contentBundle, { [poolKey]: total });
    assert.deepEqual(attributeContentProblems(configured), []);
    for (const preset of Object.values(configured.attributeRules.presets.pointbuy)) assert.equal(Object.values(preset).reduce((a,b) => a+b, 0), total);
  }
  assert.equal(contentBundle.creationModes.find(m => m.id === 'pointbuy').bonusPool, 10);
});

// ---- the pool no longer normalizes anything (owner, 2026-09-21) -----------
//
// "why are the stats so high?" — a 12-point character was scoring the ratings
// of a 35-point one. The mode recorded `total ÷ oldTotal` and every formula
// downstream DIVIDED by it, so an attribute entered each formula at 2.92× the
// value on the sheet. The ratio still shapes floors, ceilings and presets,
// where it is visible as whole points; it reaches no formula.
test('a smaller pool lowers the pools it buys instead of normalizing them', () => {
  const settings = { [poolKey]: 10, 'gameConfig.derivedStatRules.rules.hp.pointsPerTier': 2 };
  const small = configuredContentBundle(contentBundle, settings);
  const large = configuredContentBundle(contentBundle, { ...settings, [poolKey]: 60 });
  assert.equal(small.creationModes.find(m => m.id === 'pointbuy').statConversionScale, undefined,
    'no conversion scale is written for any pool');
  assert.equal(small.derivedStatRules.rules.hp.pointsPerTier, 2, 'the configured threshold is the one used');

  const registries = createRegistries(small);
  const run = bundle => createRunState({ registries: createRegistries(bundle), classId: 'reaver', seed: 42, attributeMode: 'pointbuy' });
  const a = run(small);
  const b = run(large);
  assert.equal(Object.values(a.attributes).reduce((x, y) => x + y), 10);
  assert(a.maxHp < b.maxHp, 'fewer points buy less HP');
  // THE THRESHOLD THE RUN WAS BORN WITH IS THE ONE THAT WAS CONFIGURED. It
  // used to be multiplied by the pool ratio on its way into the snapshot, so
  // the row a save carried was never the row the panel showed.
  const row = a.derivedStatRuleSnapshot.rules.rules.hp;
  assert.equal(row.pointsPerTier, 2);
  const receipt = deriveStat(a.derivedStatRuleSnapshot.rules, 'hp',
    { attributes: a.attributes, classDef: registries.classes.get('reaver'), level: 1 });
  assert.equal(receipt.value, row.base + row.gainPerTier * Math.floor(a.attributes.constitution / row.pointsPerTier));
});

test('pool settings round trip, reject impossible budgets, and tolerate the retired scaling dial', () => {
  const settings = { [poolKey]: 10 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [poolKey]: 2 }), contentBundle));

  // AN OLDER EXPORT STILL IMPORTS. `parseAdvancedConfigFile` refuses an unknown
  // key outright, which would have made the owner's own exported file
  // unimportable the day its dial was removed.
  const stale = JSON.stringify({
    schemaVersion: JSON.parse(advancedConfigExport(settings)).schemaVersion,
    game: 'Ashen Spire',
    overrides: { ...settings, 'gameConfig.startingStats.autoScale': false, 'gameConfig.combatRatings.ratings.ar.gain': 2 },
  });
  const warnings = [];
  assert.deepEqual(parseAdvancedConfigFile(stale, contentBundle, {}, [], warnings), settings);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /multipliers/);
});


test('stat-driven hand sizes read the attribute the sheet shows', async () => {
  const { scaledCards, handRuleSummary, resolveHandRules } = await import('../src/model/handRules.js');
  const rule = { statEnabled: true, stat: 'intelligence', baseline: 0, pointsPerCard: 5, base: 3, minimum: 1, maximum: 20 };
  assert.equal(scaledCards(rule, { intelligence: 2 }), 3);
  assert.equal(scaledCards(rule, { intelligence: 10 }), 5);
  // handRuleSummary never had a scale to pass, so it described a hand the
  // engine did not deal whenever one was in force. One reading, one hand.
  const rules = resolveHandRules({}, contentBundle.attributes);
  const attributes = { strength: 12, dexterity: 12, constitution: 12, wisdom: 12, intelligence: 12 };
  assert.ok(handRuleSummary(rules, attributes).startsWith(`${Math.min(scaledCards(rules.capacity, attributes), scaledCards(rules.starting, attributes))} starting cards`));
});

// ---- the owner's report, as two properties (2026-09-20) --------------------
//
// "The new game assign and standard loadout don't seem to change on a new game
// despite having the values change in the settings." Two separate defects wore
// that one sentence, and each gets a test.

test('a configured pool and a configured class default both reach a new run', async () => {
  const { validateContent } = await import('../src/model/validate.js');
  const run = (configured, classId) => createRunState({
    registries: createRegistries(configured), classId, seed: 7,
    attributeMode: configured.attributeRules.defaultMode,
  });

  const pooled = configuredContentBundle(contentBundle, { 'gameConfig.startingStats.tuned2.total': 50 });
  assert.equal(validateContent(pooled).ok, true, 'a legal pool produces a bundle a run can be born from');
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    assert.equal(Object.values(run(pooled, classId).attributes).reduce((a, b) => a + b, 0), 50,
      `${classId} starts the run on the configured pool, not the authored 35`);
  }
  // The kit floor is the thing that was never read: scaling down must leave
  // every class able to hold the weapon it starts holding.
  const small = configuredContentBundle(contentBundle, { 'gameConfig.startingStats.tuned2.total': 12 });
  assert.equal(validateContent(small).ok, true);
  assert.equal(run(small, 'starseer').attributes.intelligence, 8, 'the Ash Focus staff still asks 8 Intelligence');
  assert.equal(run(small, 'reaver').attributes.strength, 5, 'the Iron Vanguard sword still asks 5 Strength');

  const tuned = configuredContentBundle(contentBundle, {
    'gameConfig.attributeRules.presets.tuned2.reaver.strength': 12,
    'gameConfig.attributeRules.presets.tuned2.reaver.dexterity': 6,
    'gameConfig.attributeRules.presets.tuned2.reaver.constitution': 9,
    'gameConfig.attributeRules.presets.tuned2.reaver.wisdom': 3,
    'gameConfig.attributeRules.presets.tuned2.reaver.intelligence': 5,
    'gameConfig.classes.reaver.maxHp': 61,
  });
  assert.deepEqual(run(tuned, 'reaver').attributes,
    { strength: 12, dexterity: 6, constitution: 9, wisdom: 3, intelligence: 5 },
    'a class default the owner typed is the one the run is born with');
});

test('a refused value is named on its own row and costs nothing but itself', async () => {
  const { validateContent } = await import('../src/model/validate.js');
  const { advancedConfigProblems, advancedConfigProblemRows } = await import('../src/model/advancedConfig.js');

  // His screenshot: every pool set to 8. Eight cannot hold the Starseer's
  // staff, so it is refused — and the run used to lose EVERY other tuned value
  // with it, because rebuildRegistries discarded the whole configured bundle
  // when validateContent failed.
  const settings = {
    'gameConfig.startingStats.tuned2.total': 8,
    'gameConfig.balance.startingCinders': 99,
    'gameConfig.classes.reaver.maxHp': 61,
  };
  const configured = configuredContentBundle(contentBundle, settings);
  assert.equal(validateContent(configured).ok, true, 'the bundle still validates, so nothing is thrown away');
  assert.equal(configured.balance.startingCinders, 99, 'an unrelated valid setting survives the refusal');
  assert.equal(configured.classes.find(row => row.id === 'reaver').maxHp, 61);
  assert.equal(configured.creationModes.find(row => row.id === 'tuned2').baseline * 5
    + configured.creationModes.find(row => row.id === 'tuned2').bonusPool, 35, 'the refused pool holds at its last good value');

  const [problem] = advancedConfigProblemRows(contentBundle, settings);
  assert.deepEqual(problem.keys, ['gameConfig.startingStats.tuned2.total'], 'the sentence is addressed to the row that caused it');
  assert.match(problem.message, /refused/);
  assert.match(problem.message, /Starseer/, 'it names the class and kit that set the floor');
  assert.match(problem.message, /every other setting you changed is still applied/);

  // The same property one level down: one class's table can be wrong without
  // taking another class's correct table with it.
  const mixed = {
    'gameConfig.attributeRules.presets.tuned2.reaver.strength': 2,
    'gameConfig.attributeRules.presets.tuned2.herald.strength': 7,
    'gameConfig.attributeRules.presets.tuned2.herald.wisdom': 9,
    'gameConfig.balance.startingCinders': 99,
  };
  const partial = configuredContentBundle(contentBundle, mixed);
  assert.equal(validateContent(partial).ok, true);
  assert.deepEqual(partial.attributeRules.presets.tuned2.reaver, contentBundle.attributeRules.presets.tuned2.reaver,
    'the Reaver falls back to its authored table');
  assert.equal(partial.attributeRules.presets.tuned2.herald.strength, 7, 'the Herald keeps the table the owner typed');
  assert.equal(partial.balance.startingCinders, 99);
  assert.ok(advancedConfigProblems(contentBundle, mixed).some(message => /Reaver/.test(message)));
  assert.ok(!advancedConfigProblems(contentBundle, mixed).some(message => /Herald/.test(message)));
});

test('the new points-available key round trips, and a retired mode key still imports', () => {
  const settings = {
    'gameConfig.startingStats.tuned2.total': 50,
    'gameConfig.startingStats.tuned2.bonusPool': 25,
  };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  const configured = configuredContentBundle(contentBundle, settings);
  const mode = configured.creationModes.find(row => row.id === 'tuned2');
  assert.deepEqual([mode.baseline, mode.bonusPool], [5, 25],
    'the baseline is what is left of the total once the assignable points are taken out');

  // He already has an exported configuration naming the retired modes' pools.
  // Those rows left the screen; their keys did not leave the file format.
  const legacy = { 'gameConfig.startingStats.pointbuy.total': 40, 'gameConfig.startingStats.standard.total': 40 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(legacy), contentBundle), legacy);
});
