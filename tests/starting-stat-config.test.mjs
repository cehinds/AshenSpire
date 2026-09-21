import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { attributeContentProblems } from '../src/model/attributes.js';
import { createRunState } from '../src/model/state.js';

const poolKey = 'gameConfig.startingStats.pointbuy.total';
test('pool changes redistribute every class exactly and leave authored content alone', () => {
  for (const total of [5, 10, 60, 100, 495]) {
    const configured = configuredContentBundle(contentBundle, { [poolKey]: total });
    assert.deepEqual(attributeContentProblems(configured), []);
    for (const preset of Object.values(configured.attributeRules.presets.pointbuy)) assert.equal(Object.values(preset).reduce((a,b) => a+b, 0), total);
  }
  assert.equal(contentBundle.creationModes.find(m => m.id === 'pointbuy').bonusPool, 10);
});

test('automatic scaling changes thresholds; manual mode keeps configured thresholds', () => {
  const settings = { [poolKey]: 10, 'gameConfig.derivedStatRules.rules.hp.pointsPerTier': 2 };
  const auto = configuredContentBundle(contentBundle, settings);
  const manual = configuredContentBundle(contentBundle, { ...settings, 'gameConfig.startingStats.autoScale': false });
  assert.equal(auto.creationModes.find(m => m.id === 'pointbuy').statConversionScale, 1/6);
  assert.equal(manual.creationModes.find(m => m.id === 'pointbuy').statConversionScale, undefined);
  assert.equal(manual.derivedStatRules.rules.hp.pointsPerTier, 2);
  const a = createRunState({ registries: createRegistries(auto), classId: 'reaver', seed: 42, attributeMode: 'pointbuy' });
  const b = createRunState({ registries: createRegistries(manual), classId: 'reaver', seed: 42, attributeMode: 'pointbuy' });
  assert.equal(Object.values(a.attributes).reduce((x,y) => x+y), 10);
  assert(a.maxHp > b.maxHp);
});

test('pool and conversion settings round trip and reject impossible budgets', () => {
  const settings = { [poolKey]: 10, 'gameConfig.startingStats.autoScale': false };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [poolKey]: 2 }), contentBundle));
});


test('stat-driven hand sizes use normalized attributes when auto scaling is enabled', async () => {
  const { scaledCards } = await import('../src/model/handRules.js');
  const rule = { statEnabled: true, stat: 'intelligence', baseline: 0, pointsPerCard: 5, base: 3, minimum: 1, maximum: 20 };
  assert.equal(scaledCards(rule, { intelligence: 2 }, 0.2), 5);
  assert.equal(scaledCards(rule, { intelligence: 2 }), 3);
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

  const pooled = configuredContentBundle(contentBundle, { 'gameConfig.startingStats.lean.total': 50 });
  assert.equal(validateContent(pooled).ok, true, 'a legal pool produces a bundle a run can be born from');
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    assert.equal(Object.values(run(pooled, classId).attributes).reduce((a, b) => a + b, 0), 50,
      `${classId} starts the run on the configured pool, not the authored 8`);
  }
  // The kit floor is the thing that was never read: scaling down must leave
  // every class able to hold the weapon it starts holding. The equipment table
  // was restated for the lean span, so the numbers it asks for are smaller —
  // the property is that the floor is still READ, not that it is still 8.
  // 7 is the floor itself — the Starseer's 3 Intelligence plus a point in each
  // of the other four — so at 7 every class's table is pinned to what its kit
  // asks for and nothing is left over to hide a mistake.
  const floorTotal = configuredContentBundle(contentBundle, { 'gameConfig.startingStats.lean.total': 7 });
  assert.equal(validateContent(floorTotal).ok, true);
  assert.deepEqual(run(floorTotal, 'starseer').attributes,
    { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 3 },
    'the Ash Focus staff still asks 3 Intelligence, and the rest is one point each');
  assert.ok(run(floorTotal, 'reaver').attributes.strength >= 2, 'the Iron Vanguard sword still asks 2 Strength');

  const small = configuredContentBundle(contentBundle, { 'gameConfig.startingStats.lean.total': 12 });
  assert.equal(validateContent(small).ok, true);
  assert.ok(run(small, 'starseer').attributes.intelligence >= 3, 'the Ash Focus staff still asks 3 Intelligence');
  assert.ok(run(small, 'reaver').attributes.strength >= 2, 'the Iron Vanguard sword still asks 2 Strength');

  const tuned = configuredContentBundle(contentBundle, {
    'gameConfig.attributeRules.presets.lean.reaver.strength': 4,
    'gameConfig.attributeRules.presets.lean.reaver.dexterity': 1,
    'gameConfig.attributeRules.presets.lean.reaver.constitution': 1,
    'gameConfig.attributeRules.presets.lean.reaver.wisdom': 1,
    'gameConfig.attributeRules.presets.lean.reaver.intelligence': 1,
    'gameConfig.classes.reaver.maxHp': 61,
  });
  assert.deepEqual(run(tuned, 'reaver').attributes,
    { strength: 4, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 },
    'a class default the owner typed is the one the run is born with');
});

test('a refused value is named on its own row and costs nothing but itself', async () => {
  const { validateContent } = await import('../src/model/validate.js');
  const { advancedConfigProblems, advancedConfigProblemRows } = await import('../src/model/advancedConfig.js');

  // His screenshot's shape, restated on the lean scale: a total below the kit
  // floor. Six cannot hold the Starseer's staff and leave every other
  // attribute a point, so it is refused — and the run used to lose EVERY other
  // tuned value with it, because rebuildRegistries discarded the whole
  // configured bundle when validateContent failed.
  const settings = {
    'gameConfig.startingStats.lean.total': 6,
    'gameConfig.balance.startingCinders': 99,
    'gameConfig.classes.reaver.maxHp': 61,
  };
  const configured = configuredContentBundle(contentBundle, settings);
  assert.equal(validateContent(configured).ok, true, 'the bundle still validates, so nothing is thrown away');
  assert.equal(configured.balance.startingCinders, 99, 'an unrelated valid setting survives the refusal');
  assert.equal(configured.classes.find(row => row.id === 'reaver').maxHp, 61);
  assert.equal(configured.creationModes.find(row => row.id === 'lean').baseline * 5
    + configured.creationModes.find(row => row.id === 'lean').bonusPool, 8, 'the refused pool holds at its last good value');

  const [problem] = advancedConfigProblemRows(contentBundle, settings);
  assert.deepEqual(problem.keys, ['gameConfig.startingStats.lean.total'], 'the sentence is addressed to the row that caused it');
  assert.match(problem.message, /refused/);
  assert.match(problem.message, /Starseer/, 'it names the class and kit that set the floor');
  assert.match(problem.message, /every other setting you changed is still applied/);

  // The same property one level down: one class's table can be wrong without
  // taking another class's correct table with it.
  const mixed = {
    'gameConfig.attributeRules.presets.lean.reaver.strength': 2,
    'gameConfig.attributeRules.presets.lean.herald.strength': 2,
    'gameConfig.attributeRules.presets.lean.herald.wisdom': 2,
    'gameConfig.balance.startingCinders': 99,
  };
  const partial = configuredContentBundle(contentBundle, mixed);
  assert.equal(validateContent(partial).ok, true);
  assert.deepEqual(partial.attributeRules.presets.lean.reaver, contentBundle.attributeRules.presets.lean.reaver,
    'the Reaver falls back to its authored table');
  assert.equal(partial.attributeRules.presets.lean.herald.strength, 2, 'the Herald keeps the table the owner typed');
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

// ---- the reframe (owner, 2026-09-20) ---------------------------------------
//
// "the default stat for each stat is 1 and assign allows a user to assign 3
// points … I'd like to have more stat customization options in general to be
// able to make this change in the settings."

test('the shipped default IS his sentence: 1 in every stat and 3 to assign', () => {
  const lean = contentBundle.creationModes.find(row => row.id === 'lean');
  assert.equal(contentBundle.attributeRules.defaultMode, 'lean');
  assert.deepEqual(
    { baseline: lean.baseline, bonusPool: lean.bonusPool, minimum: lean.minimum, maximum: lean.maximum },
    { baseline: 1, bonusPool: 3, minimum: 1, maximum: 4 },
    'baseline 1, three points to place, and a ceiling of exactly what the pool can pay for');
  for (const [classId, preset] of Object.entries(contentBundle.attributeRules.presets.lean)) {
    const values = Object.values(preset);
    assert.equal(values.reduce((a, b) => a + b, 0), 8, `${classId} carries 5 × 1 + 3`);
    assert.ok(values.every(value => value >= 1 && value <= 4), `${classId} sits inside 1–4`);
    assert.equal(values.filter(value => value > 1).reduce((sum, value) => sum + (value - 1), 0), 3,
      `${classId} opens with exactly three points placed on top of the baseline`);
  }
  assert.deepEqual(attributeContentProblems(contentBundle), []);
});

test('a stock lean character is the stock tuned character it replaced', () => {
  // The scale is a fifth — one lean point IS one tuned tier of five — so a
  // character who assigns nothing has the pools tuned2 opened with. This is the
  // property that keeps "low stats" from silently meaning "a third less action
  // economy"; 8/35 (the ratio of the totals) failed it at 2 Actions and 4 draw.
  const registries = createRegistries(contentBundle);
  const run = createRunState({ registries, classId: 'reaver', seed: 7, attributeMode: 'lean' });
  assert.equal(run.attributeModeSnapshot.statConversionScale, 1 / 5);
  assert.equal(run.energyMax, 3, 'three Actions a turn, as under tuned2');
  assert.equal(run.drawPerTurn, 5, 'five cards a turn, as under tuned2');
  // Every attribute the Reaver leaves at the baseline converts exactly as a
  // tuned2 attribute at ITS baseline of five did: Mana and Stamina are 5.
  assert.equal(run.maxMana, 5);
});

test('the baseline is a dial, and it decides the total when it is set', () => {
  const key = (dial) => `gameConfig.startingStats.lean.${dial}`;
  const raised = configuredContentBundle(contentBundle, { [key('baseline')]: 4, [key('bonusPool')]: 5 });
  const mode = raised.creationModes.find(row => row.id === 'lean');
  assert.deepEqual([mode.baseline, mode.bonusPool], [4, 5],
    '4 in every stat plus 5 to assign — the total is the arithmetic in his sentence, not a third number');
  for (const preset of Object.values(raised.attributeRules.presets.lean)) {
    assert.equal(Object.values(preset).reduce((a, b) => a + b, 0), 25, '4 × 5 + 5');
  }
  // With no baseline typed the total still drives and the baseline is derived
  // from it — (total − points available) ÷ 5, the remainder joining the points
  // to assign. Unchanged to the letter, which is what keeps every configuration
  // exported before the baseline row existed resolving to its own numbers.
  const byTotal = configuredContentBundle(contentBundle, { [key('total')]: 20 });
  const totalled = byTotal.creationModes.find(row => row.id === 'lean');
  assert.deepEqual([totalled.baseline, totalled.bonusPool], [3, 5],
    'the authored 3 points to assign are kept, 17 ÷ 5 is the baseline, and the 2 left over join the pool');
});

test('the floor, the ceiling and the reclaim clause are dials too', () => {
  const key = (dial) => `gameConfig.startingStats.lean.${dial}`;
  const configured = configuredContentBundle(contentBundle, {
    [key('baseline')]: 5, [key('bonusPool')]: 10, [key('minimum')]: 2, [key('maximum')]: 9, [key('belowBaseline')]: false,
  });
  const mode = configured.creationModes.find(row => row.id === 'lean');
  assert.deepEqual(
    { baseline: mode.baseline, bonusPool: mode.bonusPool, minimum: mode.minimum, maximum: mode.maximum, belowBaseline: mode.belowBaseline },
    { baseline: 5, bonusPool: 10, minimum: 2, maximum: 9, belowBaseline: 'forbid' });
  assert.deepEqual(attributeContentProblems(configured), [], 'the configured mode is content a run can be born from');
});

test('an impossible limit is refused on its own row and costs nothing else', async () => {
  const { advancedConfigProblemRows } = await import('../src/model/advancedConfig.js');
  const key = (dial) => `gameConfig.startingStats.lean.${dial}`;
  // A floor above the baseline is the one shape attributeContentProblems
  // refuses outright ("minimum 3 exceeds baseline 1"), so it never reaches the
  // content door: the row that carries it is the row that is told.
  const settings = { [key('minimum')]: 3, 'gameConfig.balance.startingCinders': 99 };
  const configured = configuredContentBundle(contentBundle, settings);
  assert.equal(configured.creationModes.find(row => row.id === 'lean').minimum, 1, 'the floor holds at its last good value');
  assert.equal(configured.balance.startingCinders, 99, 'an unrelated valid setting survives the refusal');
  const problem = advancedConfigProblemRows(contentBundle, settings).find(row => row.keys[0] === key('minimum'));
  assert.match(problem.message, /Lowest a stat may be set to/);
  assert.match(problem.message, /every other setting you changed is still applied/);
});

test('equipment requirements are dials, one by one and across the board', async () => {
  const { validateContent } = await import('../src/model/validate.js');
  const requirement = (bundle, itemId) => bundle.equipment.equipmentRequirements
    .find(row => row.itemId === itemId).minimum;
  const piece = (bundle, itemId) => bundle.equipment.armaments.find(row => row.id === itemId);

  const halved = configuredContentBundle(contentBundle, { 'gameConfig.equipmentRequirements.scale': 0.5 });
  assert.equal(validateContent(halved).ok, true);
  assert.equal(requirement(halved, 'greatsword'), 2, '3 halved and rounded');
  assert.equal(requirement(halved, 'ashStaff'), 2);
  // THE COPY EACH PIECE CARRIES MOVES WITH THE TABLE. `requirements.attributes`
  // is what the equip door, the item card and smithing read; a configured table
  // that left it behind would show one number and enforce another.
  assert.equal(piece(halved, 'greatsword').requirements.attributes.strength, 2);
  assert.equal(contentBundle.equipment.armaments.find(row => row.id === 'greatsword').requirements.attributes.strength, 3,
    'the authored bundle is untouched');

  const mixed = configuredContentBundle(contentBundle, {
    'gameConfig.equipmentRequirements.scale': 0.5,
    'gameConfig.equipmentRequirements.greatsword.strength': 4,
  });
  assert.equal(requirement(mixed, 'greatsword'), 4, 'a row of its own overrides the multiplier');
  assert.equal(requirement(mixed, 'ashStaff'), 2, 'and leaves every other row on the multiplier');

  // The floor under the pool moves with them: lowering what the Ash Focus asks
  // lets a smaller total through than the authored table allowed.
  const free = {
    'gameConfig.equipmentRequirements.scale': 0,
    'gameConfig.startingStats.lean.total': 5,
  };
  const opened = configuredContentBundle(contentBundle, free);
  assert.equal(validateContent(opened).ok, true);
  const mode = opened.creationModes.find(row => row.id === 'lean');
  assert.equal(mode.baseline * 5 + mode.bonusPool, 5, 'one point each is legal once nothing asks for more');
  const { advancedConfigProblems } = await import('../src/model/advancedConfig.js');
  assert.deepEqual(advancedConfigProblems(contentBundle, free), [],
    'and the total is not refused against a floor his own settings removed');
});

test('every new dial and requirement row survives export and import', () => {
  const settings = {
    'gameConfig.startingStats.lean.baseline': 3,
    'gameConfig.startingStats.lean.bonusPool': 6,
    'gameConfig.startingStats.lean.minimum': 2,
    'gameConfig.startingStats.lean.maximum': 9,
    'gameConfig.startingStats.lean.belowBaseline': false,
    'gameConfig.equipmentRequirements.scale': 0.5,
    'gameConfig.equipmentRequirements.greatsword.strength': 4,
  };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
});
