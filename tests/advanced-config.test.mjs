import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import {
  advancedConfigRows,
  advancedConfigProblems,
  advancedConfigStructuralProblems,
  advancedConfigSnapshot,
  advancedConfigExport,
  configuredContentBundle,
  presentationConfig,
  saveAdvancedConfigFile,
  parseAdvancedConfigFile,
} from '../src/model/advancedConfig.js';

test('settings files round trip and leave unrelated settings untouched', () => {
  const source = { 'gameConfig.presentation.rowAScale': 1.5, 'gameConfig.presentation.gridShape': 'circle' };
  const current = { 'gameConfig.presentation.rowBScale': 2 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(source), contentBundle, current), source);
  assert.deepEqual(current, { 'gameConfig.presentation.rowBScale': 2 });
});

test('settings import refuses malformed, oversized, unknown and invalid values atomically', () => {
  for (const text of ['{', '{}', ' '.repeat(1024 * 1024 + 1),
    advancedConfigExport({ 'gameConfig.presentation.rowAScale': 90 }),
    advancedConfigExport({ 'gameConfig.presentation.gridShape': 'triangle' }),
    advancedConfigExport({ 'gameConfig.presentation.playerGridColor': 'red' }),
    advancedConfigExport({ 'gameConfig.unknown': true }),
    '{"game":"Ashen Spire","schemaVersion":1,"overrides":{"__proto__":{}}}',
  ]) assert.throws(() => parseAdvancedConfigFile(text, contentBundle));
});

test('settings import accepts exported legacy advanced settings using their row definitions', () => {
  const rows = [{ cat: 'Advanced', key: 'levelUpValue', type: 'number', integer: true, min: 1, max: 20, def: 1 },
    { cat: 'Advanced', key: 'cardMotif', type: 'choice', choices: ['band', 'plain'], def: 'plain' }];
  const text = advancedConfigExport({ levelUpValue: 3, cardMotif: 'band' }, {}, ['cardMotif']);
  assert.deepEqual(parseAdvancedConfigFile(text, contentBundle, {}, rows), { levelUpValue: 3, cardMotif: 'band' });
});

test('advanced configuration inventory is complete, grouped, and uniquely keyed', () => {
  const rows = advancedConfigRows(contentBundle);
  assert(rows.length > 250);
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
  for (const classDef of contentBundle.classes) {
    for (const attribute of contentBundle.attributes) {
      assert(rows.some((row) => row.key.endsWith(`.${classDef.id}.${attribute.id}`)));
    }
  }
  assert(rows.some((row) => row.key === 'gameConfig.progression.xpMultiplier'));
  assert(rows.some((row) => row.key === 'gameConfig.presentation.playerSpriteScale'));
  assert(rows.some((row) => row.key === 'gameConfig.presentation.playerSpawnColumn'));
  assert(rows.some((row) => row.key === 'gameConfig.presentation.enemySpawnColumn'));
});

test('configured bundle overlays starting stats and progression without mutating authored content', () => {
  const configured = configuredContentBundle(contentBundle, {
    'gameConfig.attributeRules.presets.lean.reaver.strength': 4,
    'gameConfig.attributeRules.presets.lean.reaver.dexterity': 1,
    'gameConfig.attributeRules.presets.lean.reaver.constitution': 1,
    'gameConfig.balance.xp.combatWin': 30,
    'gameConfig.progression.xpMultiplier': 2,
    'gameConfig.progression.rewardMultiplier': 0.5,
    'gameConfig.derivedStatRules.defaults.pointsPerTier': 3,
  });
  assert.equal(configured.attributeRules.presets.lean.reaver.strength, 4);
  assert.equal(contentBundle.attributeRules.presets.lean.reaver.strength, 3);
  assert.equal(configured.balance.xp.combatWin, 60);
  assert.equal(configured.balance.xp.kill.boss, contentBundle.balance.xp.kill.boss * 2);
  assert.equal(contentBundle.balance.xp.combatWin, 50);
  assert.equal(configured.balance.rewards.cinders.normal[0], Math.round(contentBundle.balance.rewards.cinders.normal[0] * 0.5));
  assert.equal(configured.derivedStatRules.defaults.pointsPerTier, 3);
});

test('an incomplete class-stat edit is named and keeps the last valid authored preset active', () => {
  const settings = { 'gameConfig.attributeRules.presets.lean.reaver.strength': 4 };
  assert.match(advancedConfigProblems(contentBundle, settings)[0], /Reaver.*total 8/);
  const configured = configuredContentBundle(contentBundle, settings);
  assert.deepEqual(configured.attributeRules.presets.lean.reaver, contentBundle.attributeRules.presets.lean.reaver);
});

test('cross-field ranges are refused instead of reaching a new run inverted', () => {
  const settings = { 'gameConfig.balance.rewards.cinders.normal.0': 100 };
  assert.match(advancedConfigStructuralProblems(contentBundle, settings)[0], /rewards\.cinders\.normal/);
  assert.match(advancedConfigProblems(contentBundle, settings)[0], /first value/);
});

test('snapshot and export contain only versioned game-config overrides in deterministic order', () => {
  const settings = {
    volume: 20,
    'gameConfig.presentation.enemySpriteScale': 1.2,
    'gameConfig.balance.startingCinders': 99,
  };
  const snapshot = advancedConfigSnapshot(settings);
  assert.deepEqual(Object.keys(snapshot.overrides), [
    'gameConfig.balance.startingCinders',
    'gameConfig.presentation.enemySpriteScale',
  ]);
  const exported = JSON.parse(advancedConfigExport({ ...settings, cardMotif: 'band' }, { contentVersion: 'test' }, ['cardMotif']));
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.game, 'Ashen Spire');
  assert.equal(exported.overrides['settings.cardMotif'], 'band');
  const { ['settings.cardMotif']: ignored, ...runtimeOverrides } = exported.overrides;
  assert.deepEqual(runtimeOverrides, snapshot.overrides);
});

test('presentation config clamps numbers and refuses unknown rows', () => {
  const config = presentationConfig({
    'gameConfig.presentation.playerSpriteScale': 8,
    'gameConfig.presentation.enemySpawnRow': 'A',
    'gameConfig.presentation.playerSpawnRow': 'sideways',
    'gameConfig.presentation.playerSpawnColumn': '2',
    'gameConfig.presentation.enemySpawnColumn': '9',
  });
  assert.equal(config.playerSpriteScale, 2);
  assert.equal(config.enemySpawnRow, 'A');
  assert.equal(config.playerSpawnRow, 'C');
  assert.equal(config.playerSpawnColumn, '2');
  assert.equal(config.enemySpawnColumn, '3');
});

test('formation defaults put the player at C2 and enemies at C3', () => {
  const config = presentationConfig({});
  assert.equal(`${config.playerSpawnRow}${config.playerSpawnColumn}`, 'C2');
  assert.equal(`${config.enemySpawnRow}${config.enemySpawnColumn}`, 'C3');
});

test('formation appearance validates scales, colors, shapes and offsets', () => {
  const config = presentationConfig({
    'gameConfig.presentation.rowAScale': 50,
    'gameConfig.presentation.rowBScale': -1,
    'gameConfig.presentation.frontOffsetX': 500,
    'gameConfig.presentation.gridShape': 'triangle',
    'gameConfig.presentation.playerGridColor': '#00ff88',
    'gameConfig.presentation.enemyGridColor': 'url(invalid)',
  });
  assert.equal(config.rowAScale, 3);
  assert.equal(config.rowBScale, .25);
  assert.equal(config.frontOffsetX, 150);
  assert.equal(config.gridShape, 'wide-rhombus');
  assert.equal(config.playerGridColor, '#00ff88');
  assert.equal(config.enemyGridColor, '#e1a679');
});

test('legacy row and column names migrate to the six-cell formation grid', () => {
  const config = presentationConfig({
    'gameConfig.presentation.playerSpawnRow': 'front',
    'gameConfig.presentation.enemySpawnRow': 'front',
    'gameConfig.presentation.playerSpawnColumn': 'right',
    'gameConfig.presentation.enemySpawnColumn': 'left',
  });
  assert.deepEqual({
    player: `${config.playerSpawnRow}${config.playerSpawnColumn}`,
    enemy: `${config.enemySpawnRow}${config.enemySpawnColumn}`,
  }, { player: 'A2', enemy: 'C3' });
});

test('a renamed balance path keeps its stored override, and the new key wins when both are stored', () => {
  const legacy = 'gameConfig.balance.shrine.healPct';
  const current = 'gameConfig.balance.rest.hpPartialPct';
  assert.equal(configuredContentBundle(contentBundle, { [legacy]: 50 }).balance.rest.hpPartialPct, 50,
    'a profile written before the rename still tunes the partial rest');
  assert.equal(configuredContentBundle(contentBundle, { [legacy]: 50, [current]: 60 }).balance.rest.hpPartialPct, 60,
    'the current key wins over the legacy one');
  assert.deepEqual(advancedConfigSnapshot({ [legacy]: 50 }).overrides, { [current]: 50 },
    'a snapshot carries the current key, never the retired one');
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport({ [legacy]: 50 }), contentBundle), { [current]: 50 },
    'an exported file naming the retired key imports under the current one');
});

test('percent rows are bounded to 100 and the town cap to at least 1, as validation will insist', () => {
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  for (const path of ['rest.hpSmallPct', 'rest.hpPartialPct', 'rest.mana.floorPct']) {
    const row = rows.get(`gameConfig.balance.${path}`);
    assert.deepEqual([row.min, row.max, row.integer], [0, 100, true], `${path} is a whole percent`);
  }
  assert.equal(rows.get('gameConfig.balance.atlas.townsPerActMax').min, 1, 'a route must hold its hub');
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ 'gameConfig.balance.rest.hpPartialPct': 135 }), contentBundle),
    'a percent past 100 is refused at import');
});

test('desktop export uses Save As and writes the deterministic JSON', async () => {
  let written = '';
  const result = await saveAdvancedConfigFile({ 'gameConfig.balance.startingCinders': 7 }, {
    window: {
      showSaveFilePicker: async () => ({
        createWritable: async () => ({ write: async (value) => { written = value; }, close: async () => {} }),
      }),
    },
    document: {},
  });
  assert.equal(result.method, 'save-as');
  assert.equal(JSON.parse(written).overrides['gameConfig.balance.startingCinders'], 7);
});

test('mobile and unsupported desktop export fall back to a local browser download', async () => {
  let clicked = false;
  let revoked = false;
  const anchor = { hidden: false, click: () => { clicked = true; }, remove: () => {} };
  const result = await saveAdvancedConfigFile({}, {
    window: {
      URL: { createObjectURL: () => 'blob:config', revokeObjectURL: () => { revoked = true; } },
      setTimeout: (callback) => callback(),
    },
    document: { createElement: () => anchor, body: { appendChild: () => {} } },
  });
  assert.equal(result.method, 'download');
  assert.equal(anchor.download, 'ashen-spire-game-config.json');
  assert(clicked);
  assert(revoked);
});

// EVERY GENERATED BALANCE ROW DESCRIBES ITSELF, and describes itself only
// once. All 325 of them used to carry the same sentence — "Authored balance
// value: <path>. Applies to a new run." — so the description under a row said
// nothing the key above it had not (owner, 2026-09-21). These three assertions
// are what keep that from coming back: a path model/balanceNotes.js does not
// cover falls through to the old fallback and fails the first; a sentence
// copied onto a second row fails the second; a family written as a list rather
// than a rule fails one or the other the next time content adds a member.
test('every generated balance row carries its own description', () => {
  const generated = advancedConfigRows(contentBundle).filter((row) => row.generatedBalance);
  assert.ok(generated.length > 300, `expected the balance leaves to be generated, got ${generated.length}`);

  const undescribed = generated.filter((row) => row.note.startsWith('Authored balance value:'));
  assert.deepEqual(undescribed.map((row) => row.searchPath), [],
    'these balance paths have no sentence in src/model/balanceNotes.js');

  const byNote = new Map();
  for (const row of generated) {
    if (!byNote.has(row.note)) byNote.set(row.note, []);
    byNote.get(row.note).push(row.searchPath);
  }
  const shared = [...byNote.values()].filter((paths) => paths.length > 1);
  assert.deepEqual(shared, [], 'these balance rows describe themselves with the same words');

  for (const row of generated) {
    // A LIVE ROW SAYS WHEN IT TAKES EFFECT; an inert one must not, because
    // "Applies to a new run" under "nothing reads it" is the sentence
    // contradicting itself in its own last clause.
    const live = row.note.endsWith('Applies to a new run.');
    const declaredInert = /not yet read|nothing reads it|retired flag/.test(row.note);
    assert.ok(live !== declaredInert,
      `${row.searchPath} must either say when it takes effect or say nothing reads it, and not both: ${row.note}`);
    assert.ok(row.note.length > 'Applies to a new run.'.length + 20, `${row.searchPath} says too little`);
  }
});

// A NAME IN A NOTE IS THE CONTENT'S NAME, never a copy of it. Renaming a relic
// renames its rows; a relic added to balance.powers gets a real sentence with
// no edit to balanceNotes.js. The same rule covers talents, classes, and the
// rows of an authored list, which name themselves by their own id or tag.
test('generated balance descriptions derive their names from the bundle', () => {
  const rows = new Map(advancedConfigRows(contentBundle)
    .filter((row) => row.generatedBalance).map((row) => [row.searchPath, row.note]));
  const note = (path) => {
    const found = rows.get(path);
    assert.ok(found, `no generated row for ${path}`);
    return found;
  };

  const relic = (contentBundle.relics || []).find((entry) => entry.id === 'ivoryComb');
  assert.ok(note('powers.ivoryComb.n').startsWith(`${relic.name} —`),
    `the relic's own name should open its row: ${note('powers.ivoryComb.n')}`);

  // THE TIER AND THE CLASS COME FROM THE TREE, not from this file. Hard-coding
  // "tier-1 Reaver" would fail a content retune that moved the talent — which
  // is the opposite of what a test about derivation should do.
  const talent = (contentBundle.nodes || []).find((node) => node.id === 'ironFooting');
  const row = (contentBundle.classTree || []).find((entry) => entry.nodeId === 'ironFooting');
  const owner = (contentBundle.classes || []).find((entry) => entry.id === row.classId);
  assert.ok(note('classTree.ironFooting.block').startsWith(`${talent.label}, a tier-${row.tier} ${owner.name} talent`),
    `the tree's own tier and class should open its row: ${note('classTree.ironFooting.block')}`);

  // AN AUTHORED LIST IS FOUND BY ITS OWN KEY, never by an index. Both of these
  // lists invite reordering — swapCostByCategory is documented as ordered,
  // first match wins — and a reorder must not fail a test about naming.
  const viewIndex = contentBundle.balance.equipment.views.findIndex((view) => view.id === 'grid');
  assert.match(note(`equipment.views.${viewIndex}.figure`), /the grid Armoury view/);
  const heavyIndex = contentBundle.balance.equipment.swapCostByCategory.findIndex((entry) => entry.tag === 'heavy');
  assert.match(note(`equipment.swapCostByCategory.${heavyIndex}.cost`), /tagged heavy/);
  const growthIndex = contentBundle.balance.flaskGrowth.findIndex((entry) => entry.id === 'goldenSprout');
  const sprout = (contentBundle.relics || []).find((entry) => entry.id === 'goldenSprout');
  assert.match(note(`flaskGrowth.${growthIndex}.amount`), new RegExp(sprout.name));
  const fillIndex = contentBundle.balance.poise.onFill.findIndex((entry) => entry.status === 'staggered');
  assert.match(note(`poise.onFill.${fillIndex}.stacks`), /Staggered/);
});

// A SENTENCE MAY NOT PROMISE A DIAL IS LIVE WHEN IT IS NOT. The rows under
// `balance.levels` are authored for #238 and read by nothing but their own
// validator; `energy`, `draw` and `graceRefillAtRunStart` have no reader at
// all. A note that described them as working machinery would be worse than the
// boilerplate it replaced, because a player would move them and watch nothing
// happen. This is the guard on that, and it is a real one: `model/levels.js`
// is imported by `model/validate.js` alone, for its problem reporters.
test('a balance row nothing reads says so in its description', () => {
  const rows = new Map(advancedConfigRows(contentBundle)
    .filter((row) => row.generatedBalance).map((row) => [row.searchPath, row.note]));
  const inert = [...rows.keys()].filter((path) => path.startsWith('levels.'))
    .concat(['energy', 'draw', 'graceRefillAtRunStart']);
  assert.ok(inert.length > 13, `expected the inert rows to be generated, got ${inert.length}`);
  for (const path of inert) {
    assert.match(rows.get(path), /not yet read|nothing reads it|retired flag/,
      `${path} is not read by the game and its description must say so`);
    assert.ok(!rows.get(path).endsWith('Applies to a new run.'),
      `${path} is read by nothing, so it applies to no run either`);
  }
});

// THE PANEL MUST KEEP THE SENTENCE, and that is a separate claim from the row
// carrying one. The Advanced panel rewrites a generated row before drawing it
// (the label becomes the path, because a leaf named "0" or "min" names
// nothing), and that rewrite used to throw the note away and write 'Applies to
// a new run.' in its place. Every other test here would pass if it started
// doing that again, so this one holds the branch itself (Copilot, #1243).
test('the Advanced panel keeps a generated row\'s own description', async () => {
  const { compactAdvancedRow } = await import('../src/ui/screens/settings.js');
  const rows = advancedConfigRows(contentBundle).filter((row) => row.generatedBalance);
  for (const row of rows.slice(0, 40)) {
    const drawn = compactAdvancedRow(row, 'Rewards', 'Combat rewards');
    assert.equal(drawn.note, row.note, `${row.searchPath} lost its description on the way to the panel`);
    assert.match(drawn.label, / · |^[a-z]/i, `${row.searchPath} should be labelled by its path`);
    assert.ok(!drawn.label.includes('gameConfig.balance.'), 'the key prefix is not part of the label');
  }

  // The class-table branch beside it still compacts, so this test cannot pass
  // by the rewrite having been removed altogether.
  const classRow = advancedConfigRows(contentBundle)
    .find((row) => row.classTopic && row.floorNote);
  const compacted = compactAdvancedRow(classRow, 'Progression', classRow.classTopic);
  assert.equal(compacted.note, classRow.floorNote);
  assert.ok(!compacted.label.includes(' — '), 'the class topic already names the class');
});
