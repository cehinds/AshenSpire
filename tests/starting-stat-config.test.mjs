import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { configuredContentBundle, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { attributeContentProblems } from '../src/model/attributes.js';
import { createRunState } from '../src/model/state.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { derivedStatFloorProblems } from '../src/model/startingStatConfig.js';

// The pool dial is exercised through the mode creation OFFERS. It used to be
// driven here through `pointbuy`, which is retired — and a retired mode is no
// longer rewritten at all, because the only thing that rewrite can reach is a
// save (see 'a mode no player can pick is never rewritten' below).
const poolKey = 'gameConfig.startingStats.lean.total';
const legacyPoolKey = 'gameConfig.startingStats.pointbuy.total';
test('pool changes redistribute every class exactly and leave authored content alone', () => {
  // 7 is the kit floor; below it no class can hold what it starts in.
  for (const total of [7, 10, 60, 100, 495]) {
    const configured = configuredContentBundle(contentBundle, { [poolKey]: total });
    assert.deepEqual(attributeContentProblems(configured), []);
    for (const preset of Object.values(configured.attributeRules.presets.lean)) assert.equal(Object.values(preset).reduce((a,b) => a+b, 0), total);
  }
  assert.equal(contentBundle.creationModes.find(m => m.id === 'lean').bonusPool, 3);
});

// ---- the pool converts nothing (owner, 2026-09-21) ------------------------
//
// "why are the stats so high?" — a character was scored on attributes it did
// not have. The mode carried `statConversionScale`, and the ratings receipt,
// the derived rows and the hand-size rule all DIVIDED by it, so a lean
// character entered every formula at five times the value on its own sheet.
// The ratio still shapes floors, ceilings and presets, where it is visible as
// whole attribute points; it reaches no formula. A configured threshold is now
// the threshold a run is born with, whatever pool it was born on.
test('a retuned pool moves the presets and leaves every threshold alone', () => {
  const settings = { [poolKey]: 10, 'gameConfig.derivedStatRules.rules.hp.constitution': 2 };
  const wide = configuredContentBundle(contentBundle, settings);
  assert.equal(wide.creationModes.find(m => m.id === 'lean').statConversionScale, undefined,
    'no mode carries a conversion scale, shipped or retuned');
  assert.equal(wide.derivedStatRules.rules.hp.constitution, 2, 'the configured weight is the one used');

  const registries = createRegistries(wide);
  const a = createRunState({ registries, classId: 'reaver', seed: 42, attributeMode: 'lean' });
  assert.equal(Object.values(a.attributes).reduce((x, y) => x + y), 10);

  // THE THRESHOLD THE RUN WAS BORN WITH IS THE ONE THAT WAS CONFIGURED. It
  // used to be multiplied by the mode's scale on its way into the snapshot, so
  // the row a save carried was never the row the panel showed.
  const row = a.derivedStatRuleSnapshot.rules.rules.hp;
  assert.equal(row.constitution, 2);
  const receipt = deriveStat(a.derivedStatRuleSnapshot.rules, 'hp',
    { attributes: a.attributes, classDef: registries.classes.get('reaver'), level: 1 });
  // Every attribute term the row carries, each floored on its own (the stock
  // HP row also reads STR and WIS); CON's is the configured 2.
  const terms = contentBundle.attributes.reduce((sum, { id }) => sum + Math.floor((a.attributes[id] || 0) * (row[id] || 0) + 1e-9), 0);
  assert.equal(receipt.value, row.base + terms);

  // A bigger pool buys more, which is the whole of what a pool now does.
  const narrow = createRunState({ registries: createRegistries(configuredContentBundle(contentBundle, settings)), classId: 'reaver', seed: 42, attributeMode: 'lean' });
  const wider = createRunState({ registries: createRegistries(configuredContentBundle(contentBundle, { ...settings, [poolKey]: 40 })), classId: 'reaver', seed: 42, attributeMode: 'lean' });
  assert(wider.maxHp > narrow.maxHp, 'fewer points buy less HP');
});

test('pool settings round trip, reject impossible budgets, and tolerate the retired scaling dial', () => {
  const settings = { [poolKey]: 10 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ [legacyPoolKey]: 2 }), contentBundle));

  // AN OLDER EXPORT STILL IMPORTS. `parseAdvancedConfigFile` refuses an unknown
  // key outright, which would have made the owner's own exported file
  // unimportable the day these dials were removed.
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
  const { scaledCards } = await import('../src/model/handRules.js');
  const rule = { statEnabled: true, stat: 'intelligence', baseline: 0, pointsPerCard: 5, base: 3, minimum: 1, maximum: 20 };
  assert.equal(scaledCards(rule, { intelligence: 2 }), 3);
  assert.equal(scaledCards(rule, { intelligence: 10 }), 5);
  // Ruleset 7: a hand count is a stat row, read the same way — 3 base +
  // floor(INT × 0.2) lands on the same 3 and 5. (The group above is the shape a
  // fight saved before ruleset 7 carries, still counted exactly.)
  const row = { base: 3, intelligence: 0.2, min: 1, max: 20 };
  assert.equal(scaledCards(row, { intelligence: 2 }), 3);
  assert.equal(scaledCards(row, { intelligence: 10 }), 5);
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
    // Was the Reaver's Base HP, retired in #1256 (the derived HP rule
    // overwrites it at birth, so it is no longer applied). Any other live
    // value makes the same point.
    'gameConfig.balance.rewards.cardChoices': 4,
  };
  const configured = configuredContentBundle(contentBundle, settings);
  assert.equal(validateContent(configured).ok, true, 'the bundle still validates, so nothing is thrown away');
  assert.equal(configured.balance.startingCinders, 99, 'an unrelated valid setting survives the refusal');
  assert.equal(configured.balance.rewards.cardChoices, 4);
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
    'gameConfig.startingStats.lean.total': 50,
    'gameConfig.startingStats.lean.bonusPool': 25,
  };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  const configured = configuredContentBundle(contentBundle, settings);
  const mode = configured.creationModes.find(row => row.id === 'lean');
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

// RESTATED WHEN THE CONVERSION SCALE WAS REMOVED (owner, 2026-09-21). #1238
// held the lean character's POOLS level with tuned2's by dividing every
// threshold by five — one lean point bought one tuned tier. That divisor is
// gone: a formula reads the attribute the sheet shows, so a lean point buys a
// lean point and the pools a stock character opens on are a fifth of what
// #1238 shipped. The property worth holding is no longer "the same pools as
// tuned2" — it is that every pool is the authored row read against the
// attribute, with nothing in between.
test('a stock lean character is priced by the rows, with no scale in between', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ registries, classId: 'reaver', seed: 7, attributeMode: 'lean' });
  assert.equal(run.attributeModeSnapshot.statConversionScale, undefined, 'the mode carries no scale');
  const rules = contentBundle.derivedStatRules.rules;
  // Ruleset 7: base plus each attribute's own floored term, as a rating reads,
  // kept within the row's own min and max. The stock rows read a spread of
  // attributes (owner, 2026-09-24), so every term the row carries is summed;
  // level 1 adds no level term.
  const pool = (id) => {
    const raw = rules[id].base + contentBundle.attributes.reduce((sum, { id: attributeId }) =>
      sum + Math.floor((run.attributes[attributeId] || 0) * (rules[id][attributeId] || 0) + 1e-9), 0);
    return Math.min(rules[id].max ?? Infinity, Math.max(rules[id].min ?? 0, raw));
  };
  assert.equal(run.energyMax, pool('energy'));
  assert.equal(run.drawPerTurn, pool('draw'));
  assert.equal(run.maxMana, pool('mana'));
  // The numbers those rows now state for a stock lean Reaver (STR 3, DEX 1,
  // CON 2, WIS 1, INT 1): Actions sit at their base of 3, draw at its base of 2
  // (INT 1 at 0.1 floors to nothing; its min is 2 as well), and Mana at its
  // base of 1 — WIS 1 at 0.5 a point floors to nothing, and no other term
  // reaches a whole point on the lean span.
  assert.deepEqual([run.energyMax, run.drawPerTurn, run.maxMana], [3, 2, 1]);
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

// ---- what the review of #1238 found, as properties -------------------------
//
// Every case below was a way for one dial to cost the owner something other
// than itself. They are the whole point of this driver, so each gets a test.

test('a raised equipment requirement never costs the owner his whole configuration', async () => {
  const { validateContent } = await import('../src/model/validate.js');
  const { advancedConfigProblems } = await import('../src/model/advancedConfig.js');
  const sword = (bundle) => bundle.equipment.equipmentRequirements.find(row => row.itemId === 'straightSword').minimum;

  // THE DEFECT THIS ANSWERS. validateContent refuses a preset that cannot hold
  // its class's kit, and rebuildRegistries answers a failed validation by
  // falling back to AUTHORED DEFAULTS — so a requirement raised past what the
  // presets carry discarded every other value he had tuned.
  for (const raise of [
    { 'gameConfig.equipmentRequirements.scale': 2 },
    { 'gameConfig.equipmentRequirements.scale': 10 },
    { 'gameConfig.equipmentRequirements.ashStaff.intelligence': 40 },
  ]) {
    const settings = { ...raise, 'gameConfig.balance.startingCinders': 99 };
    const configured = configuredContentBundle(contentBundle, settings);
    assert.equal(validateContent(configured).ok, true, `${JSON.stringify(raise)} still produces a bundle a run can be born from`);
    assert.equal(configured.balance.startingCinders, 99, 'and the unrelated setting beside it survives');
    assert.equal(sword(configured), 2, 'the authored table holds when the raise cannot be worn');
    assert.ok(advancedConfigProblems(contentBundle, settings).some(message => /Equipment requirements:/.test(message)),
      'and the refusal says so by name rather than falling back in silence');
  }

  // A raise the classes CAN be fitted around is applied, and the presets move
  // with it — this is the case the early return used to skip, because no
  // starting-stat dial had moved.
  const fitted = configuredContentBundle(contentBundle, { 'gameConfig.equipmentRequirements.straightSword.strength': 4 });
  assert.equal(validateContent(fitted).ok, true);
  assert.equal(sword(fitted), 4);
  assert.equal(fitted.attributeRules.presets.lean.reaver.strength, 4, 'the Reaver is re-fitted around its own kit');
  assert.deepEqual(advancedConfigProblems(contentBundle, { 'gameConfig.equipmentRequirements.straightSword.strength': 4 }), []);

  // Raising the pool first is the way through, and it says so in the refusal.
  const roomy = configuredContentBundle(contentBundle, {
    'gameConfig.equipmentRequirements.scale': 2, 'gameConfig.startingStats.lean.total': 20,
  });
  assert.equal(validateContent(roomy).ok, true);
  assert.equal(sword(roomy), 4, 'with room to carry it, the raised table applies');
});

test('a requirement of zero is a requirement the card does not print', () => {
  const configured = configuredContentBundle(contentBundle, { 'gameConfig.equipmentRequirements.scale': 0 });
  const sword = configured.equipment.armaments.find(row => row.id === 'straightSword');
  assert.equal(configured.equipment.equipmentRequirements.find(row => row.itemId === 'straightSword').minimum, 0,
    'the row stays in the table, because the dial has to be able to come back up');
  assert.equal(sword.requirements, undefined, 'but nothing is stamped on the piece, so no card says "Requires STR 0"');
});

test('a configuration exported before the default mode changed still imports whole', () => {
  // `explicitRows` used to emit class cells for the DEFAULT mode alone, so the
  // day the default moved every `…presets.tuned2.<class>.<attribute>` key in an
  // exported file became unknown — and parseAdvancedConfigFile answers an
  // unknown key by aborting the WHOLE file, taking every unrelated setting with
  // it. The current build could even export a file it then refused to import.
  const legacy = {
    'gameConfig.attributeRules.presets.tuned2.reaver.strength': 11,
    'gameConfig.attributeRules.presets.tuned2.starseer.intelligence': 9,
    'gameConfig.progression.xpMultiplier': 2,
  };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(legacy), contentBundle), legacy,
    'every key in the file round trips, the retired mode\'s cells included');
});

test('a mode no player can pick is never rewritten', async () => {
  const { createRunState: born } = await import('../src/model/state.js');
  // A retired mode's KEYS stay importable, but APPLYING one can only reach a
  // save: a run written before `attributeModeSnapshot` existed is validated
  // against the LIVE mode at the load door, and save.js ARCHIVES what fails
  // there. Rewriting tuned2's total would archive exactly the runs tuned2 was
  // kept in the table for.
  const settings = { 'gameConfig.startingStats.tuned2.total': 8, 'gameConfig.balance.startingCinders': 99 };
  const configured = configuredContentBundle(contentBundle, settings);
  const tuned2 = configured.creationModes.find(row => row.id === 'tuned2');
  assert.equal(tuned2.baseline * 5 + tuned2.bonusPool, 35, 'tuned2 keeps the total its saves were admitted against');
  assert.deepEqual(configured.attributeRules.presets.tuned2, contentBundle.attributeRules.presets.tuned2);
  assert.equal(configured.balance.startingCinders, 99, 'and the settings beside it still apply');
  // The mode creation DOES offer still moves, in the same configuration.
  const both = configuredContentBundle(contentBundle, { ...settings, 'gameConfig.startingStats.lean.total': 12 });
  const lean = both.creationModes.find(row => row.id === 'lean');
  assert.equal(lean.baseline * 5 + lean.bonusPool, 12);
  // And a run created under the retired mode is still born on its own numbers.
  const run = born({ registries: createRegistries(configured), classId: 'reaver', seed: 3, attributeMode: 'tuned2' });
  assert.equal(Object.values(run.attributes).reduce((a, b) => a + b, 0), 35);
});

test('a refused baseline costs the baseline, not the points typed beside it', async () => {
  const { advancedConfigProblemRows } = await import('../src/model/advancedConfig.js');
  const key = (dial) => `gameConfig.startingStats.lean.${dial}`;
  const settings = { [key('baseline')]: 0, [key('bonusPool')]: 5 };
  const mode = configuredContentBundle(contentBundle, settings).creationModes.find(row => row.id === 'lean');
  assert.deepEqual([mode.baseline, mode.bonusPool], [1, 5],
    'the baseline holds at its authored value and the valid points-to-assign row still applies');
  const [problem] = advancedConfigProblemRows(contentBundle, settings);
  assert.deepEqual(problem.keys, [key('baseline')], 'and only the baseline row is told');
});

test('an attribute card never promises more than the rule pays', async () => {
  const { attributeCardModels } = await import('../src/model/creationBrief.js');
  const { statProjection } = await import('../src/model/statProjection.js');
  const hpLine = (bundle) => {
    const registries = createRegistries(bundle);
    const run = createRunState({ registries, classId: 'reaver', seed: 5 });
    const card = attributeCardModels(registries, run.attributes, {
      projection: statProjection(registries, run),
      equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
    }).find(row => row.id === 'constitution');
    return { card, run, registries };
  };
  // The authored row, read against the attribute the sheet shows: four HP a
  // point. It used to read +20, because the lean mode divided the tier by five
  // before anything saw it (#1238); with that divisor gone the card states the
  // row.
  assert.ok(hpLine(contentBundle).card.reveal.lines.includes('HP +4 every 1 point'));

  // A THRESHOLD THAT IS NOT A WHOLE NUMBER OF TIERS PER POINT. A tier of 0.6
  // buys ONE tier for some points and two for others: `floor((con + 1) / 0.6)
  // − floor(con / 0.6)` is 1 at the preset. The card said more than the run
  // paid — a card that promises more than the rule pays is worse than one that
  // says nothing. The pool no longer produces such a tier; the Advanced
  // threshold row still can, so the property is driven by that row instead.
  // The stock HP row also reads STR, and the raised run below pays for its CON
  // point with a STR point — so STR's HP weight is zeroed here, or the trade
  // itself would cost HP the card never promised for Constitution.
  const wide = configuredContentBundle(contentBundle, {
    'gameConfig.derivedStatRules.rules.hp.pointsPerTier': 0.6,
    'gameConfig.derivedStatRules.rules.hp.strength': 0,
  });
  const { card, run, registries } = hpLine(wide);
  const stated = /HP \+(\d+) every 1 point/.exec(card.reveal.lines.find(line => line.startsWith('HP ')))?.[1];
  const raised = createRunState({
    registries, classId: 'reaver', seed: 5,
    attributes: { ...run.attributes, constitution: run.attributes.constitution + 1,
      strength: run.attributes.strength - 1 },
  });
  assert.ok(Number(stated) <= raised.maxHp - run.maxHp,
    `the card states ${stated} HP a point and the run pays ${raised.maxHp - run.maxHp}`);
});

// ---- ruleset 6 review findings (Codex, #1253) ------------------------------

// A card states the cadence the floors PAY. Under a divisor of 3, HP's weight
// of 4 pays +1, +1, +2 across three Constitution points; "+1.33 every 1" was
// an average no single point ever delivered.
test('an attribute card states the floored cadence, not an average rate', async () => {
  const { attributeCardModels } = await import('../src/model/creationBrief.js');
  const { statProjection } = await import('../src/model/statProjection.js');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ registries, classId: 'reaver', seed: 11,
    derivedStatOptions: { explicitOverride: { defaults: { pointsPerIncrease: 3 } } } });
  const card = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run) })
    .find((row) => row.id === 'constitution');
  assert.ok(card.reveal.lines.includes('HP +4 every 3 points'), card.reveal.lines.join(' | '));
  assert.ok(!card.reveal.lines.some((line) => /\d\.\d/.test(line) && line.startsWith('HP')), 'no fractional HP promise');
  // And the shipped rule, with no divisor, reads point for point.
  const stock = createRunState({ registries, classId: 'reaver', seed: 11 });
  const stockCard = attributeCardModels(registries, stock.attributes, { projection: statProjection(registries, stock) })
    .find((row) => row.id === 'constitution');
  assert.ok(stockCard.reveal.lines.includes('HP +4 every 1 point'), stockCard.reveal.lines.join(' | '));
});

// The Poise pool's per-level growth reaches the meter, not only the sheet.
test('the Poise pool grows with the level on the meter as on the sheet', async () => {
  const { playerPoiseThresholdReceipt, statProjection } = await import('../src/model/statProjection.js');
  // The pool is read only while ratings are off, and its rows are set aside
  // while they are on (#1260), so ratings are switched off by their own row.
  const configured = configuredContentBundle(contentBundle, { 'gameConfig.derivedStatRules.rules.poise.perLevel': 1,
    'gameConfig.combatRatings.enabled': false });
  const registries = createRegistries(configured);
  const run = createRunState({ registries, classId: 'reaver', seed: 12 });
  const atOne = playerPoiseThresholdReceipt(registries, run).attribute;
  run.level = { ...run.level, level: 4 };
  assert.equal(playerPoiseThresholdReceipt(registries, run).attribute, atOne + 3, 'three levels, three points');
  assert.equal(statProjection(registries, run).derived.find((row) => row.id === 'poise').levelBonus, 3,
    'and the sheet says the same');
});

// ---- ruleset 6 review findings (internal review, #1253) --------------------

// A v2 snapshot restored once is handed back as v3 and written to the next
// save. Its normalized defaults had no `perLevel`, which the v3 validator
// requires, so the SECOND load refused the save and archived the run.
test('a restored v2 snapshot restores again as v3', async () => {
  const { readFileSync } = await import('node:fs');
  const { restoreDerivedStatRuleSnapshot } = await import('../src/model/derivedStats.js');
  const save = JSON.parse(readFileSync(new URL('./fixtures/run-save-hp-5597166.json', import.meta.url), 'utf8'));
  const options = { attributeIds: contentBundle.attributes.map((row) => row.id), classFields: ['maxHp'], damageSchools: [] };
  const once = restoreDerivedStatRuleSnapshot(save.derivedStatRuleSnapshot, options);
  assert.equal(once.snapshotVersion, 3);
  const twice = restoreDerivedStatRuleSnapshot(structuredClone(once), options);
  const thrice = restoreDerivedStatRuleSnapshot(structuredClone(twice), options);
  assert.deepEqual(thrice, twice, 'from the second restore on, a restore changes nothing');
  const attributes = save.attributes;
  const classDef = contentBundle.classes.find((row) => row.id === save.class);
  for (const id of Object.keys(once.rules.rules)) {
    assert.equal(deriveStat(twice.rules, id, { attributes, classDef, level: 7 }).value,
      deriveStat(once.rules, id, { attributes, classDef, level: 7 }).value, `${id} prices the same`);
  }
});

// A normalized `{ every, gain }` cadence pays `steps × gain` unrounded, as it
// always did; only the ruleset-6 decimal is floored.
test('a legacy level cadence is not rounded, a ruleset-6 decimal is', async () => {
  const { levelBonus } = await import('../src/model/derivedStats.js');
  assert.equal(levelBonus({ perLevel: 0.5, perLevelEvery: 5 }, 6), 0.5, 'legacy: one step of 0.5');
  assert.equal(levelBonus({ perLevel: { every: 5, gain: 0.5 } }, 11), 1, 'retired shape read directly');
  assert.equal(levelBonus({ perLevel: 0.2 }, 5), 0, 'decimal: four fifths is not yet a point');
  assert.equal(levelBonus({ perLevel: 0.2 }, 6), 1, 'decimal: five fifths is one');
});

// `gainPerTier` / `sourceStat` describe a single-stat TIERED row; on a
// ruleset-6 row whose weight already carries the coefficient they would
// multiply it twice, so a layer that spells them is refused by name.
test('a ruleset-6 table refuses a legacy per-row gain layer by name', async () => {
  const { resolveDerivedStatRules } = await import('../src/model/derivedStats.js');
  const options = { attributeIds: contentBundle.attributes.map((row) => row.id), classFields: ['maxHp'] };
  assert.throws(() => resolveDerivedStatRules(contentBundle.derivedStatRules,
    { ...options, explicitOverride: { rules: { hp: { pointsPerTier: 1, gainPerTier: 4 } } } }), /gainPerTier/);
  // A table-wide legacy divisor still means what it did.
  const divided = resolveDerivedStatRules(contentBundle.derivedStatRules,
    { ...options, explicitOverride: { defaults: { pointsPerTier: 2 } } });
  assert.equal(divided.rules.hp.pointsPerIncrease, 2);
});

// A run's own snapshot decides which card a stat is on. Moving HP from
// Constitution to Strength in Settings after a run started must not move the
// line on that run's cards (Codex, #1253).
test('a run lists a stat on the card its own snapshot scales it with', async () => {
  const { attributeCardModels } = await import('../src/model/creationBrief.js');
  const { statProjection } = await import('../src/model/statProjection.js');
  // The run starts on an HP row that reads Constitution alone, set here — the
  // stock row also reads STR and WIS, which would put an HP line on the
  // Strength card from the run's own snapshot.
  const conOnly = { 'gameConfig.derivedStatRules.rules.hp.strength': 0, 'gameConfig.derivedStatRules.rules.hp.wisdom': 0 };
  const registries = createRegistries(configuredContentBundle(contentBundle, conOnly));
  const run = createRunState({ registries, classId: 'reaver', seed: 13 });
  assert.equal(run.derivedStatRuleSnapshot.rules.rules.hp.strength || 0, 0, 'the run was born with HP on Constitution only');
  const moved = createRegistries(configuredContentBundle(contentBundle, {
    ...conOnly,
    'gameConfig.derivedStatRules.rules.hp.constitution': 0,
    'gameConfig.derivedStatRules.rules.hp.strength': 4,
  }));
  const cards = attributeCardModels(moved, run.attributes, { projection: statProjection(moved, run) });
  const lines = (id) => cards.find((card) => card.id === id).reveal.lines;
  assert.ok(lines('constitution').includes('HP +4 every 1 point'), lines('constitution').join(' | '));
  assert.ok(!lines('strength').some((line) => line.startsWith('HP ')), lines('strength').join(' | '));
  // With no run, the live table is what a card can describe.
  const preview = attributeCardModels(moved, run.attributes).find((card) => card.id === 'strength').reveal.lines;
  assert.ok(preview.includes('HP +4 every 1 point'), preview.join(' | '));
});

// Codex (#1253): a fractional Actions/draw base made a run the run door
// refuses, and zeroing every Mana input made one with 0 Mana, which no save
// can hold. Both are refused where they are set, by name.
test('a stat base is whole points, and Mana cannot be configured to zero', async () => {
  const { validateContent } = await import('../src/model/validate.js');
  const { advancedConfigProblemRows, advancedConfigRows } = await import('../src/model/advancedConfig.js');
  const said = (bundle) => validateContent(bundle).errors.map((e) => `${e.path}: ${e.msg}`).join(' | ');

  const fractional = configuredContentBundle(contentBundle, { 'gameConfig.derivedStatRules.rules.energy.base': 3.5 });
  assert.match(said(fractional), /rules\.energy\.base: must be a whole number/);
  const row = advancedConfigRows(contentBundle).find((r) => r.key === 'gameConfig.derivedStatRules.rules.energy.base');
  assert.equal(row.integer, true, 'the row takes whole numbers only');

  const zero = { 'gameConfig.derivedStatRules.rules.mana.base': 0, 'gameConfig.derivedStatRules.rules.mana.wisdom': 0 };
  assert.match(said(configuredContentBundle(contentBundle, zero)), /derivedStatRules\.rules\.mana: Mana would be 0/);
  const problems = advancedConfigProblemRows(contentBundle, zero);
  const mana = problems.find((p) => /Mana would be 0/.test(p.message));
  assert.ok(mana && mana.keys.includes('gameConfig.derivedStatRules.rules.mana.base'), 'and the Settings rows say so');
  // One point of Mana from the weakest allocation is enough. WIS pays a whole
  // point here by setting — the stock 0.5 floors WIS 1 to nothing, so base 0
  // alone is now (rightly) refused for the stock weights.
  assert.ok(!advancedConfigProblemRows(contentBundle, {
    'gameConfig.derivedStatRules.rules.mana.base': 0,
    'gameConfig.derivedStatRules.rules.mana.wisdom': 1,
  }).some((p) => /Mana would be/.test(p.message)), 'base 0 with WIS 1 still yields 1');
  assert.ok(validateContent(contentBundle).ok, 'the shipped table passes both');
});

// Codex (#1253): the floor is the weakest character creation ALLOWS, not every
// attribute at its minimum. Lean spends all eight points, so at Mana base 0
// and every weight 0.5 the all-ones character (0 Mana) cannot be made, and
// every legal one has at least 2 — that configuration is safe and must pass.
test('the Mana floor prices only characters creation can make', async () => {
  const { advancedConfigProblemRows } = await import('../src/model/advancedConfig.js');
  const ids = contentBundle.attributes.map((row) => row.id);
  const key = (field) => `gameConfig.derivedStatRules.rules.mana.${field}`;
  const halves = Object.fromEntries([[key('base'), 0], ...ids.map((id) => [key(id), 0.5])]);
  const floorOf = (overrides) => derivedStatFloorProblems(configuredContentBundle(contentBundle, overrides));
  assert.deepEqual(floorOf(halves), [], 'every legal lean character has Mana');
  assert.ok(!advancedConfigProblemRows(contentBundle, halves).some((p) => /Mana would be/.test(p.message)));
  // A real zero is still refused, and the message names the character that has it.
  const thin = Object.fromEntries([[key('base'), 0], ...ids.map((id) => [key(id), id === 'wisdom' ? 0.2 : 0])]);
  const [problem] = floorOf(thin);
  assert.match(problem.message, /Mana would be 0/);
  assert.match(problem.message, /wisdom 1/);
});
