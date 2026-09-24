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
  normalizeAdvancedSettings,
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
  // Read before the overlay so a mutation shows whatever the stock number is.
  const authoredCombatWin = contentBundle.balance.xp.combatWin;
  assert.notEqual(authoredCombatWin, 60);
  const configured = configuredContentBundle(contentBundle, {
    'gameConfig.attributeRules.presets.lean.reaver.strength': 4,
    'gameConfig.attributeRules.presets.lean.reaver.dexterity': 1,
    'gameConfig.attributeRules.presets.lean.reaver.constitution': 1,
    'gameConfig.balance.xp.combatWin': 30,
    'gameConfig.progression.xpMultiplier': 2,
    'gameConfig.progression.cinderMultiplier': 0.5,
    'gameConfig.derivedStatRules.defaults.pointsPerTier': 3,
  });
  assert.equal(configured.attributeRules.presets.lean.reaver.strength, 4);
  assert.equal(contentBundle.attributeRules.presets.lean.reaver.strength, 3);
  assert.equal(configured.balance.xp.combatWin, 60);
  assert.equal(configured.balance.xp.kill.boss, contentBundle.balance.xp.kill.boss * 2);
  assert.equal(contentBundle.balance.xp.combatWin, authoredCombatWin);
  assert.equal(configured.balance.rewards.cinders.normal[0], Math.round(contentBundle.balance.rewards.cinders.normal[0] * 0.5));
  // The retired tier dial's key does not write the table: a ruleset-6 table
  // has no tier, so writing one would fail validation and throw every other
  // configured value away.
  assert.equal(configured.derivedStatRules.defaults.pointsPerTier, undefined);
  assert.deepEqual(configured.derivedStatRules.defaults, contentBundle.derivedStatRules.defaults);
});

test('an incomplete class-stat edit is named and keeps the last valid authored preset active', () => {
  const settings = { 'gameConfig.attributeRules.presets.lean.reaver.strength': 4 };
  assert.match(advancedConfigProblems(contentBundle, settings)[0], /Reaver.*total 8/);
  const configured = configuredContentBundle(contentBundle, settings);
  assert.deepEqual(configured.attributeRules.presets.lean.reaver, contentBundle.attributeRules.presets.lean.reaver);
});

test('cross-field ranges are refused instead of reaching a new run inverted', () => {
  // One past the authored high end, so the low end is inverted whatever the
  // stock band is.
  const settings = { 'gameConfig.balance.rewards.cinders.normal.0': contentBundle.balance.rewards.cinders.normal[1] + 1 };
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
  // An invalid color falls back to the stock default, never passes through.
  assert.equal(config.enemyGridColor, presentationConfig({}).enemyGridColor);
  assert.match(config.enemyGridColor, /^#[0-9a-f]{6}$/i);
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

// Ruleset 6 retired every per-stat tier and the "Stat points per tier" dial
// with its bounds. An exported file naming any of them still imports: those
// entries are skipped with one named warning, everything else lands.
test('an export naming a retired stat tier imports, skipping only that entry', () => {
  const file = JSON.parse(advancedConfigExport({ 'gameConfig.derivedStatRules.rules.hp.constitution': 5 }));
  Object.assign(file.overrides, {
    'gameConfig.derivedStatRules.rules.hp.gainPerTier': 7,
    'gameConfig.derivedStatRules.defaults.pointsPerTier': 2,
    'gameConfig.balance.levelUp.tierSizeMax': 30,
  });
  const text = JSON.stringify(file);
  const warnings = [];
  const imported = parseAdvancedConfigFile(text, contentBundle, {}, [], warnings);
  assert.deepEqual(imported, { 'gameConfig.derivedStatRules.rules.hp.constitution': 5 });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /direct attribute weights/);
});

// Codex (#1253): only the six real stat ids are retired. A misspelt id is a
// typo, and a typo must still refuse the whole file rather than be skipped.
test('a misspelt stat id under a retired tier key is refused, not skipped', () => {
  const file = JSON.parse(advancedConfigExport({ 'gameConfig.derivedStatRules.rules.hp.constitution': 5 }));
  file.overrides['gameConfig.derivedStatRules.rules.hhp.pointsPerTier'] = 2;
  assert.throws(() => parseAdvancedConfigFile(JSON.stringify(file), contentBundle, {}, [], []), /hhp/);
});

// EVERY GENERATED BALANCE ROW DESCRIBES ITSELF, and describes itself only
// once. All 325 of them used to carry the same sentence — "Authored balance
// value: <path>. Applies to a new run." — so the description under a row said
// nothing the key above it had not (owner, 2026-09-21). These three assertions
// are what keep that from coming back: a number with no sentence beside it in
// content/balance.js falls through to the old fallback and fails the first; a sentence
// copied onto a second row fails the second; a family written as a list rather
// than a rule fails one or the other the next time content adds a member.
test('every generated balance row carries its own description', () => {
  const generated = advancedConfigRows(contentBundle).filter((row) => row.generatedBalance);
  assert.ok(generated.length > 300, `expected the balance leaves to be generated, got ${generated.length}`);

  const undescribed = generated.filter((row) => row.note.startsWith('Authored balance value:'));
  assert.deepEqual(undescribed.map((row) => row.searchPath), [],
    'these balance numbers have no sentence beside them in src/content/balance.js');

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
// no new note — the family's one sentence covers it. The same rule covers talents, classes, and the
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
// validator (`model/levels.js` is imported by `model/validate.js` alone);
// `energy`, `draw` and `graceRefillAtRunStart` have no reader at all; the
// level-up bounds are read from the authored table by the controls they bound,
// never from an override; and the swap allowance waits on a mode no setting
// chooses. A note that described any of them as working machinery would be
// worse than the boilerplate it replaced, because a player would move it and
// watch nothing happen.
test('a balance row nothing reads says so in its description', () => {
  const rows = new Map(advancedConfigRows(contentBundle)
    .filter((row) => row.generatedBalance).map((row) => [row.searchPath, row.note]));
  // DERIVED FROM WHAT IS HIDDEN, not listed here. #1256 retires a generated
  // row from the screen exactly when nothing reads it, so every retired row is
  // one whose note must say so. `graceRefillAtRunStart` is the one inert row
  // still on screen, named because nothing marks it.
  const hidden = advancedConfigRows(contentBundle)
    .filter((row) => row.generatedBalance && row.retired).map((row) => row.searchPath);
  const inert = [...hidden, 'graceRefillAtRunStart'];
  // 18, not 20: ruleset 6 (#1253) deleted `levelUp.tierSizeMin/Max` outright
  // with the tier dial, so those two are no longer rows to hide.
  assert.ok(inert.length >= 18, `expected the inert rows to be generated, got ${inert.length}`);
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

// A SENTENCE STAYS WITH ITS NUMBER. The notes moved into content/balance.js so
// that an author editing a number sees the sentence describing it (owner,
// 2026-09-23). Sitting in the same object keeps them in view; this test is
// what keeps them TOGETHER. A note that claims no number — its number renamed
// or removed and the sentence left behind — fails here by name. So does a
// number two family sentences in one block both claim, because which of them
// wins would be an order nobody reading balance.js could see.
test('every note in balance.js sits beside a number it describes', async () => {
  const { balance, NOTE } = await import('../src/content/balance.js');
  const { noteMatches } = await import('../src/model/balanceNotes.js');

  // THE NUMBERS SETTINGS SHOWS, not only the ones typed in balance.js. The
  // card-value tables (`damage.*.cardBonuses`) are empty in the authored table
  // and filled per card when the rows are built (materializeCardValueBonuses),
  // so a note for them describes numbers that exist only once materialised.
  const leaves = [...new Set([
    ...advancedConfigRows(contentBundle).filter((row) => row.generatedBalance).map((row) => row.searchPath),
  ])];
  (function walk(value, path) {
    if (typeof value === 'number' || typeof value === 'boolean') { leaves.push(path.join('.')); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
  })(balance, []);

  const claimed = new Set();
  for (const leaf of leaves) {
    const matches = noteMatches(leaf, balance);
    for (const match of matches) claimed.add(`${leaf.split('.').slice(0, match.depth).join('.')}|${match.key}`);
    const patternsByBlock = new Map();
    for (const match of matches.filter((entry) => !entry.literal)) {
      patternsByBlock.set(match.depth, [...(patternsByBlock.get(match.depth) || []), match.key]);
    }
    for (const keys of patternsByBlock.values()) {
      assert.equal(keys.length, 1, `${leaf} is claimed by ${keys.join(' and ')} in one [NOTE] block`);
    }
  }

  const orphans = [];
  (function walkBlocks(value, path) {
    if (!value || typeof value !== 'object') return;
    const block = value[NOTE];
    if (block) {
      for (const key of Object.keys(block)) {
        if (!claimed.has(`${path.join('.')}|${key}`)) orphans.push(`${path.join('.') || '(balance)'} → ${key}`);
      }
    }
    for (const [key, child] of Object.entries(value)) walkBlocks(child, [...path, key]);
  })(balance, []);
  assert.deepEqual(orphans, [], 'these notes describe a number that is not beside them');

  // Every blank in every sentence is filled. A blank nothing fills is left as
  // `{name}` on purpose, so this is the line that reads it.
  const unfilled = advancedConfigRows(contentBundle)
    .filter((row) => row.generatedBalance && /\{\w+\}/.test(row.note))
    .map((row) => `${row.searchPath}: ${row.note}`);
  assert.deepEqual(unfilled, [], 'these notes left a blank unfilled');
});

// A NOTE IS INVISIBLE TO EVERYTHING THAT READS BALANCE AS NUMBERS. That is the
// whole reason the key is a Symbol: validate.js refuses an unknown key in 27
// places, leafRows would turn a string sibling into a row, and a run snapshot
// is JSON. None of them may meet a sentence. The clone half is stated rather
// than hidden — a configured bundle (structuredClone) carries no notes, which
// is fine because the rows are built from the authored bundle, and would not
// be if that ever changed.
test('a note is invisible to everything that reads balance as numbers', async () => {
  const { balance, NOTE } = await import('../src/content/balance.js');
  const texts = [];
  (function collect(value) {
    if (!value || typeof value !== 'object') return;
    for (const note of Object.values(value[NOTE] || {})) texts.push(typeof note === 'string' ? note : note.text);
    for (const child of Object.values(value)) collect(child);
  })(balance);
  assert.ok(texts.length > 100, `expected the notes to be found, got ${texts.length}`);

  const json = JSON.stringify(balance);
  const leaked = texts.filter((text) => json.includes(text.slice(0, 40)));
  assert.deepEqual(leaked, [], 'a note reached the JSON form of balance');
  assert.ok(!Object.keys(balance.shop).some((key) => typeof balance.shop[key] === 'string'),
    'no balance object gains a string key from its notes');
  assert.equal(structuredClone(balance.shop)[NOTE], undefined, 'a clone carries no notes');
});

// EVERY VARIABLE A RELIC OR TALENT CARRIES HAS A PHRASE. The family sentence
// for both reads `balanceWords.effects`, and a variable missing from it falls
// back to "the <variable> it uses" — a sentence that is not wrong, and says
// nothing. A relic added with a new variable fails here and names it.
test('every relic and talent variable has a phrase in balanceWords', async () => {
  const { balance, balanceWords } = await import('../src/content/balance.js');
  const variables = new Set([...Object.values(balance.powers), ...Object.values(balance.classTree)]
    .flatMap((row) => Object.keys(row)));
  const missing = [...variables].filter((variable) => !Object.hasOwn(balanceWords.effects, variable));
  assert.deepEqual(missing, [], 'these variables have no phrase in balanceWords.effects');
});

// THE OWNER'S ×20 IS BAKED INTO THE AUTHORED TABLE (2026-09-24), so every
// reader of `balance.rewards.cinders` pays the same, and the row is a new key,
// `progression.cinderMultiplier`, at 1. The old `rewardMultiplier` scaled a
// table twenty times smaller, so a stored or exported value is carried across
// ÷ 20 and pays what it paid.
const CINDER = 'gameConfig.progression.cinderMultiplier';
const OLD_CINDER = 'gameConfig.progression.rewardMultiplier';
const v1File = (overrides) => JSON.stringify({ schemaVersion: 1, game: 'Ashen Spire', build: {}, overrides });

test('the authored cinder table carries the owner\'s ×20 and the new row defaults to 1', () => {
  assert.deepEqual(contentBundle.balance.rewards.cinders.normal, [900, 1500]);
  assert.deepEqual(contentBundle.balance.rewards.cinders.elite, [2100, 3000]);
  assert.deepEqual(contentBundle.balance.rewards.cinders.boss, [4500, 5400]);
  const rows = advancedConfigRows(contentBundle);
  const row = rows.find((candidate) => candidate.key === CINDER);
  assert.equal(row.def, 1);
  assert.equal(row.label, 'Cinder gain multiplier');
  assert.equal(row.min, 0);
  assert.equal(row.max, 20);
  assert.equal(row.integer, false);
  assert.ok(!rows.some((candidate) => candidate.key === OLD_CINDER), 'the old key has no row');
  assert.deepEqual(configuredContentBundle(contentBundle, {}).balance.rewards.cinders.normal, [900, 1500]);
  assert.deepEqual(configuredContentBundle(contentBundle, { [CINDER]: 0.5 }).balance.rewards.cinders.normal, [450, 750]);
});

test('a stored rewardMultiplier is carried across as ÷ 20 and pays what it paid', () => {
  const owner = { [OLD_CINDER]: 20 };
  const warnings = [];
  normalizeAdvancedSettings(owner, contentBundle, warnings);
  // …and marked as read by a ruleset-7 build (model/statRows.js).
  assert.deepEqual(owner, { [CINDER]: 1, statRowsVersion: 7 });
  assert.equal(warnings.length, 1);
  assert.deepEqual(configuredContentBundle(contentBundle, owner).balance.rewards.cinders.normal, [900, 1500]);

  const two = { [OLD_CINDER]: 2 };
  normalizeAdvancedSettings(two, contentBundle);
  assert.equal(two[CINDER], 0.1);
  assert.deepEqual(configuredContentBundle(contentBundle, two).balance.rewards.cinders.normal, [90, 150]);

  // Un-normalized readers (an old run snapshot) read it the same way.
  assert.deepEqual(configuredContentBundle(contentBundle, { [OLD_CINDER]: 2 }).balance.rewards.cinders.normal, [90, 150]);
  assert.deepEqual(configuredContentBundle(contentBundle, { overrides: { [OLD_CINDER]: 20 }, ratingsVersion: 1 }).balance.rewards.cinders.normal, [900, 1500]);

  // Both present: the new key wins and the old is dropped.
  const both = { [OLD_CINDER]: 20, [CINDER]: 3 };
  normalizeAdvancedSettings(both, contentBundle);
  assert.deepEqual(both, { [CINDER]: 3, statRowsVersion: 7 });

  // The export never writes the old key.
  const exported = advancedConfigExport({ [OLD_CINDER]: 2 }, {}, [CINDER]);
  assert.ok(!exported.includes('rewardMultiplier'));
  assert.equal(JSON.parse(exported).overrides[CINDER], 0.1);
});

test('a v1 file carrying rewardMultiplier 20 imports as cinderMultiplier 1, with a warning', () => {
  const warnings = [];
  const changes = parseAdvancedConfigFile(v1File({ [OLD_CINDER]: 20, [`settings.${OLD_CINDER}`]: 20 }), contentBundle, {},
    advancedConfigRows(contentBundle), warnings);
  assert.deepEqual(changes, { [CINDER]: 1 });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /divided by 20/);
  const newer = [];
  assert.deepEqual(parseAdvancedConfigFile(v1File({ [OLD_CINDER]: 20, [CINDER]: 2 }), contentBundle, {}, [], newer), { [CINDER]: 2 },
    'the new key wins when both are present');
  assert.deepEqual(newer, []);
});

test('a file written on the old, higher defaults still imports', () => {
  const old = {
    'gameConfig.balance.level.xp.base': 100,
    'gameConfig.balance.skill.class.xp.base': 60,
    'gameConfig.balance.skill.xp.base': 30,
    'gameConfig.balance.handMax': 10,
    'gameConfig.balance.flaskCapacity': 4,
    'gameConfig.balance.xp.combatWin': 50,
    'gameConfig.balance.xp.kill.normal': 25,
    'gameConfig.classes.reaver.startingFlaskAllocation.hp': 3,
    'gameConfig.classes.reaver.startingFlaskAllocation.mana': 1,
    'gameConfig.classes.starseer.startingFlaskAllocation.hp': 2,
    'gameConfig.classes.starseer.startingFlaskAllocation.mana': 2,
    'gameConfig.classes.rogue.startingFlaskAllocation.hp': 3,
    'gameConfig.classes.rogue.startingFlaskAllocation.mana': 1,
    'gameConfig.classes.herald.startingFlaskAllocation.hp': 3,
    'gameConfig.classes.herald.startingFlaskAllocation.mana': 1,
  };
  // Ruleset 7 retired `balance.handMax` (every fight reads the handSize stat
  // row), so it is converted away — said once — and everything else imports.
  const warnings = [];
  const { 'gameConfig.balance.handMax': _retired, ...kept } = old;
  assert.deepEqual(parseAdvancedConfigFile(v1File(old), contentBundle, {}, [], warnings), kept);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /fallback hand capacity was retired/);
  // And a larger tuning of the curves than either build shipped.
  const larger = { 'gameConfig.balance.level.xp.base': 1000, 'gameConfig.balance.skill.class.xp.base': 1000, 'gameConfig.balance.skill.xp.base': 1000 };
  assert.deepEqual(parseAdvancedConfigFile(v1File(larger), contentBundle), larger);
});
