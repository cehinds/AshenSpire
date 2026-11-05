import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryHandler, activeAdvancedGroup, storedAdvancedTopic } from '../src/ui/screens/settings.js';
import { advancedSection, advancedSubgroups } from '../src/ui/models/AdvancedSettingsGroups.js';

test('grouping keeps every Advanced option reachable exactly once', () => {
  const rows = categoryHandler('Advanced').rows;
  const sections = [...new Set(rows.map(advancedSection))];
  const grouped = sections.flatMap(section => advancedSubgroups(rows, section).flatMap(group => group.rows));
  assert.equal(grouped.length, rows.length);
  assert.equal(new Set(grouped.map(row => row.key)).size, rows.length);
  assert.deepEqual(grouped.map(row => row.key).sort(), rows.map(row => row.key).sort());
});

// ---- the refusal, on the row ----------------------------------------------
//
// The node suite cannot open the Settings panel (only tools/displayfirst.mjs
// and tools/advanced-config-preview.mjs do, in a real browser), so this drives
// the painter over the smallest tree that has the shape `settingsRowHtml`
// emits: a `.set-row` per setting, the control carrying `data-key`, and an
// `.as-labelstack` to write into. It proves the sentence lands on the offending
// row, stays off every other row, and LEAVES when the value becomes legal.
function stubPanel(keys) {
  const node = (className, dataset = {}) => {
    const self = {
      className, dataset, children: [], parent: null, textContent: '', attrs: {},
      setAttribute(name, value) { self.attrs[name] = value; },
      appendChild(child) { child.parent = self; self.children.push(child); return child; },
      remove() { self.parent.children = self.parent.children.filter(other => other !== self); },
      matches(selector) {
        if (selector.startsWith('.')) return String(self.className).split(/\s+/).includes(selector.slice(1));
        // `[data-row-problem]` is `dataset.rowProblem`, as in a real DOM.
        return selector.slice(1, -1).replace(/^data-/, '').replace(/-(.)/g, (_, c) => c.toUpperCase()) in self.dataset;
      },
      descendants() { return self.children.flatMap(child => [child, ...child.descendants()]); },
      querySelector(selector) { return self.descendants().find(child => child.matches(selector)) || null; },
      querySelectorAll(selector) {
        const [ancestor, leaf] = selector.split(' ');
        return self.descendants().filter(child => child.matches(leaf || ancestor)
          && (!leaf || !!child.closest(ancestor)));
      },
      closest(selector) { return self.matches(selector) ? self : (self.parent ? self.parent.closest(selector) : null); },
      ownerDocument: { createElement: () => node('') },
    };
    return self;
  };
  const container = node('panel');
  for (const key of keys) {
    const row = container.appendChild(node('as-row setting set-row'));
    const stack = row.appendChild(node('as-labelstack'));
    stack.appendChild(node('ls-label'));
    row.appendChild(node('set-num', { key }));
  }
  return container;
}

// ---- B1/B2/C5: the explanation renders, the reset finds its group ----------

// A stored tab id that this change retired ("Classes") made the painter fall
// back while the reset button read the raw value, asked for the subgroups of a
// group that no longer exists, got none, and reset nothing in silence.
test('a retired Advanced tab resolves to the same group for the painter and the reset', async () => {
  const { activeAdvancedGroup, ADVANCED_GROUP_IDS, categoryHandler } = await import('../src/ui/screens/settings.js');
  assert.ok(!ADVANCED_GROUP_IDS.includes('Classes'), 'the Classes tab is gone');
  const fallback = ADVANCED_GROUP_IDS[0];
  assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: 'Classes' }), fallback);
  assert.equal(activeAdvancedGroup({}), fallback);
  // Groups Core 2 retired (cleanup row 3e) resolve like any unknown tab.
  assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: 'Stats' }), fallback);
  assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: 'Interface' }), 'Interface');
  // and the group it resolves to has rows to reset, which 'Classes' did not.
  const rows = categoryHandler('Advanced').rows;
  assert.ok(advancedSubgroups(rows, activeAdvancedGroup({ settingsAdvancedCategory: 'Classes' })).length > 0);
  assert.equal(advancedSubgroups(rows, 'Classes').length, 0, 'which is what made the reset a silent no-op');
});

// Every screen that SPENDS a point must price it from the run, not the table.
// The creation brief, the character sheet and the Armoury already passed a
// projection; the point-buy modal and the shrine's level-up modal did not, so
// on a scale of a fifth they under-reported every gain by five.
test('every screen that offers a point hands the card the run it belongs to', async () => {
  const { readFileSync } = await import('node:fs');
  // A SCAN, NOT A PARSE, and bounded on purpose: `attributeCardModels` takes
  // its options object as the third argument, so `projection:` either appears
  // within the call or the call does not pass one. 300 characters is longer
  // than every call site in the tree and shorter than the gap to the next one.
  let sites = 0;
  for (const file of ['customize.js', 'rest.js', 'equipment.js', '../models/ProgressionInspectionModel.js']) {
    const source = readFileSync(new URL(`../src/ui/screens/${file}`, import.meta.url), 'utf8');
    for (let at = source.indexOf('attributeCardModels(registries'); at >= 0;
      at = source.indexOf('attributeCardModels(registries', at + 1)) {
      sites += 1;
      // `projection,` (shorthand) and `projection: …` both count.
      assert.match(source.slice(at, at + 300), /projection\s*[,:]/,
        `${file}: the attribute card at offset ${at} is priced from a run projection, not the authored table`);
    }
  }
  assert.equal(sites, 6, 'all six attribute-card call sites are covered (a new one must state its projection too)');
});

// ---- one menu, one language (owner, 2026-09-21) ----------------------------
//
// "why aren't the menus matching? … make them consistent with what I see with
// each other." Advanced spoke two: hand-authored rows carried a sentence a
// person wrote, and rows generated from `balance` were rebuilt from their KEY
// at render time — camelCase split and never capitalised, so "hand Max" and
// "levels · player Starting Level" sat two rows under "HP — base amount".
//
// The house style is measured, not chosen: the hand-authored corpus is 1234
// sentence-case leaves against 262 Title Case, so a generated leaf is sentence
// case and a generated subject is Title Case. Title-casing the leaves instead
// left Level-up, General and Experience & rewards each showing both styles at
// once, which is the same complaint wearing different clothes.

test('every Advanced row reads like every other Advanced row', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { advancedConfigRows } = await import('../src/model/advancedConfig.js');
  const { compactRowLabel } = await import('../src/ui/screens/settings.js');
  const rows = advancedConfigRows(contentBundle).filter(row => !row.retired && row.label);

  for (const row of rows) {
    // The opening character of a label is the tell: the old key-derived labels
    // all began lower case because nothing ever capitalised them.
    assert.match(row.label[0], /[A-Z0-9]/, `"${row.label}" (${row.key}) opens like a sentence, not like a key`);
    // A key's own spelling never reaches the player, and nothing is lost by
    // that: search reads the rendered row text AND the input's `data-key`
    // (settings.js, `filterAdvancedRows`), which is the full path.
    assert.ok(!/gameConfig\./.test(row.label), `"${row.label}" does not quote its key`);
    assert.ok(!/[a-z][A-Z]/.test(row.label.replace(/ — | · /g, ' ')), `"${row.label}" carries no unsplit camelCase`);
  }

  // The generated rows in particular: Title Case subjects, a sentence-case
  // leaf, and the context that leaf needs — and no two in a group collapse to
  // the same words.
  const generated = rows.filter(row => row.searchPath && row.configPath?.[0] === 'balance');
  assert.ok(generated.length > 50, 'the balance table really is the bulk of this menu');
  const ACRONYM = /^(HP|XP|AR|DR|PR|MP|UI|ID|%)$/;
  for (const row of generated) {
    assert.match(row.label, /^[A-Z0-9%]/);
    assert.equal(row.note.startsWith('Authored balance value:'), false,
      `"${row.label}" no longer shows the engine's own spelling as its note`);
    // The leaf reads as a phrase. Anything after its first word is lower case
    // unless it is an acronym — which is what "Resistance cap" and "Strength
    // required" beside it already do.
    const cut = row.label.lastIndexOf(' — ');
    const leaf = cut < 0 ? row.label : row.label.slice(cut + 3);
    for (const word of leaf.split(' ').slice(1)) {
      assert.ok(/^[a-z0-9]/.test(word) || ACRONYM.test(word),
        `"${row.label}" reads as a phrase, not a heading — "${word}" is shouted`);
    }
    // And the subjects are headings, because they name a thing.
    if (cut >= 0) for (const subject of row.label.slice(0, cut).split(' · ')) {
      assert.match(subject, /^[A-Z0-9%]/, `"${row.label}" names its owner like a heading`);
    }
  }
  // The three that used to be shouted, spelled out.
  const spelled = new Map(generated.map(row => [row.searchPath, row.label]));
  // The fallback hand capacity used to be the third; ruleset 7 retired it
  // (every fight reads the Hand size stat row), so it is no row at all.
  assert.equal(spelled.has('handMax'), false);
  assert.equal(spelled.get('startingCinders'), 'Starting cinders');
  assert.equal(spelled.get('levels.playerStartingLevel'), 'Levels — Player starting level');
  assert.equal(spelled.get('rest.hpSmallPct'), 'Rest — HP small %', 'an acronym survives inside a sentence-case leaf');
  // `levels.enemyScaling.{hp,damage,block,poise}.perLevel` were four rows all
  // called "Per Level" before the context was added — this is that, asserted.
  // (They are retired now, inert #238 content, but still labelled for import.)
  const scaling = advancedConfigRows(contentBundle).filter(row => row.searchPath?.startsWith('levels.enemyScaling.'));
  assert.equal(spelled.get('levels.enemyScaling.hp.perLevel'), undefined, 'enemy scaling is off the screen');
  assert.equal(scaling.find(row => row.searchPath === 'levels.enemyScaling.hp.perLevel').label, 'Levels · Enemy Scaling · HP — Per level');
  assert.equal(new Set(scaling.map(row => row.label)).size, scaling.length,
    'no two enemy-scaling rows share a label');

  // And the tab does not say its own name back in every line beneath it.
  assert.equal(compactRowLabel('Levels · Enemy Scaling · HP — Per level', 'Enemy scaling'), 'HP — Per level');
  assert.equal(compactRowLabel('Reaver — Strength', 'Reaver'), 'Strength');
  assert.equal(compactRowLabel('Level Up — Points per level min', 'Level-up'), 'Points per level min');
  assert.equal(compactRowLabel('Starting cinders', 'Starting values'), 'Starting cinders', 'nothing to strip, nothing stripped');
  assert.equal(compactRowLabel('Level · XP — Base', 'Experience & rewards'), 'Level · XP — Base', 'an unrelated tab strips nothing');
  assert.equal(compactRowLabel('Reaver — Reaver', 'Reaver'), 'Reaver', 'a row never renders blank');

  // A TAB NAME CAN SPAN SEVERAL SUBJECTS. Matching one at a time missed every
  // such tab, so Rewards → Equipment drops showed "Equipment · Drops —
  // Enabled" nine times over, and Rules → Skill class opened every row with
  // the two words already above it.
  assert.equal(compactRowLabel('Equipment · Drops — Enabled', 'Equipment drops'), 'Enabled');
  assert.equal(compactRowLabel('Equipment · Drops · Chance — Treasure', 'Equipment drops'), 'Chance — Treasure');
  assert.equal(compactRowLabel('Skill · XP — Base', 'Skill xp'), 'Base');
  assert.equal(compactRowLabel('Skill · Class · XP — Base', 'Skill class'), 'XP — Base');
  // A tab that RENAMES what it covers matches nothing rather than guess:
  // "Card prices" is not "Card Cost".
  assert.equal(compactRowLabel('Shop · Card Cost · Common — 0', 'Shop · Card prices'), 'Shop · Card Cost · Common — 0');
  // A leaf carrying its own em dash still splits where a reader would.
  assert.equal(compactRowLabel('Attack Overrides — Enter: Bulwark — impact override', 'Attack overrides'),
    'Enter: Bulwark — impact override');
  // The blank-row guard covers a blank LEAF too, not just a spent subject list.
  assert.equal(compactRowLabel('Reaver — ', 'Reaver'), 'Reaver — ', 'a blank leaf keeps the whole label');
  assert.equal(compactRowLabel(undefined, 'Reaver'), '');
});

// Two rows can be told apart by their label, or they cannot be set apart at
// all. This is the measure, across every tab as the screen renders it — the
// one exception is documented in the assertion itself.
test('no tab renders two rows a player cannot tell apart', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { advancedConfigRows } = await import('../src/model/advancedConfig.js');
  const { compactRowLabel } = await import('../src/ui/screens/settings.js');
  const { advancedSubgroups, advancedSection } = await import('../src/ui/models/AdvancedSettingsGroups.js');

  const rows = advancedConfigRows(contentBundle).filter(row => !row.retired && row.label);
  const collisions = [];
  for (const section of new Set(rows.map(advancedSection))) {
    for (const sub of advancedSubgroups(rows, section)) {
      const seen = new Map();
      for (const row of sub.rows) {
        const rendered = compactRowLabel(row.label, sub.id);
        assert.ok(rendered, `${section} → ${sub.id}: ${row.key} renders a blank label`);
        if (seen.has(rendered)) collisions.push(`${section} → ${sub.id}: "${rendered}"`);
        else seen.set(rendered, row.key);
      }
    }
  }
  // There used to be 22: each class's starting armour shown twice under one
  // name (20), and two pairs of cards sharing a name in Attack overrides (2).
  // Both now say which item or card they are, so the menu has none.
  assert.deepEqual(collisions, [], 'no tab shows two rows a player cannot tell apart');
});

test('a setting that moves nothing is off the screen and still imports', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { advancedConfigRows, advancedConfigExport, parseAdvancedConfigFile } = await import('../src/model/advancedConfig.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createRunState } = await import('../src/model/state.js');

  // `balance.energy` and `balance.draw` duplicated "Actions — base amount" and
  // "Draw — base amount" in a different group, with different numbers — and
  // nothing reads them: a run's pools come from the derived-stat rules.
  const born = (patch) => {
    const bundle = { ...contentBundle, balance: structuredClone(contentBundle.balance) };
    Object.assign(bundle.balance, patch);
    return createRunState({ registries: createRegistries(bundle), classId: 'reaver', seed: 9 });
  };
  const stock = born({});
  const moved = born({ energy: 99, draw: 99 });
  assert.deepEqual([moved.energyMax, moved.drawPerTurn], [stock.energyMax, stock.drawPerTurn],
    'they are inert — which is why they may not sit in the menu beside the rows that are not');

  const rows = advancedConfigRows(contentBundle);
  for (const path of ['energy', 'draw']) {
    const row = rows.find(candidate => candidate.key === `gameConfig.balance.${path}`);
    assert.ok(row, `the ${path} key is still known, so an exported file carrying it still imports`);
    assert.equal(row.retired, true, `and it is off the screen`);
  }
  // Retired, not deleted: parseAdvancedConfigFile aborts a whole file on one
  // unknown key, so removing the row would refuse every configuration that
  // still names it. The file lands; the dead keys are skipped by name (review
  // of #1294), since nothing would ever read them back.
  const legacy = { 'gameConfig.balance.energy': 3, 'gameConfig.balance.draw': 5 };
  // The fallback hand size WAS read — by co-op fights — and ruleset 7 made
  // the Hand size stat row govern every fight instead. So it is no row at all,
  // and a file naming it converts rather than refusing: the key is dropped,
  // the warning points at the row a fight actually uses.
  assert.ok(!rows.some(candidate => candidate.key === 'gameConfig.balance.handMax'), 'handMax is not a row since ruleset 7');
  const warnings = [];
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport({ ...legacy, 'gameConfig.balance.handMax': 5 }), contentBundle, {}, [], warnings), {});
  assert.equal(warnings.length, 2, warnings.join(' | '));
  assert.ok(warnings.some((line) => /no longer used and were skipped\. Everything else in the file was imported\./.test(line)), warnings.join(' | '));
  assert.ok(warnings.some((line) => /Stats → Draw & hand → Hand size/.test(line)), 'and points at the row a fight actually uses');
});

// ---- ONE HOME PER SETTING (owner, 2026-09-23) -------------------------------
// "a lot of the advanced settings have settings duplicated in multiple sections
// making it hard to tell which does what." Three properties, asserted together:
// the catch-all tabs are gone, rows that share a quantity share a topic, and a
// row that moved nothing is off the screen but still imports.
test('every setting has one home, and rows sharing a quantity sit together', async () => {
  const { ADVANCED_GROUP_IDS } = await import('../src/ui/screens/settings.js');
  for (const gone of ['Rules', 'Gameplay', 'Tuning', 'Card size', 'Debug', 'Combat', 'Stats', 'Recovery', 'Shops']) {
    assert.ok(!ADVANCED_GROUP_IDS.includes(gone), `${gone} is not a tab of its own any more`);
  }
  const rows = categoryHandler('Advanced').rows;
  for (const row of rows) assert.ok(ADVANCED_GROUP_IDS.includes(advancedSection(row)), `${row.key} is filed under a real tab`);

  const where = (key) => {
    const row = rows.find(candidate => candidate.key === key);
    assert.ok(row, `${key} is on the screen`);
    const section = advancedSection(row);
    const sub = advancedSubgroups(rows, section).find(group => group.rows.includes(row));
    return `${section} → ${sub.id}`;
  };
  assert.equal(where('gameConfig.presentation.settingsWidthPercent'), 'Wireframes → Window', 'window size sits with the modal width it is clamped by');

  // The formation editor is mounted with the rows of its topic, wherever that
  // topic is filed. It looked under Interface after the topic moved to
  // Battlefield and got none (Codex, on #1256).
  const { formationLayoutRows } = await import('../src/ui/screens/settings.js');
  const formation = advancedSubgroups(rows, 'Battlefield').find(group => group.id === 'Formation layout');
  assert.ok(formation && formation.rows.length > 0, 'Battlefield opens on the formation layout');
  assert.deepEqual(formationLayoutRows().map(row => row.key), formation.rows.map(row => row.key),
    'the editor is handed exactly the rows its topic shows');
});

test('a row that moved nothing is retired: off the screen, still importable', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { advancedConfigRows, advancedConfigExport, parseAdvancedConfigFile } = await import('../src/model/advancedConfig.js');
  const all = advancedConfigRows(contentBundle);
  const shown = new Set(categoryHandler('Advanced').rows.map(row => row.key));
  const retired = [
    'gameConfig.balance.levelUp.pointsPerLevelMin', 'gameConfig.balance.levelUp.pointsPerLevelMax',
    'gameConfig.balance.levels.enemyScaling.hp.perLevel', 'gameConfig.balance.levels.enemyScaling.poise.max',
    'gameConfig.balance.equipment.swapAllowancePerTurn',
    ...contentBundle.classes.map(classDef => `gameConfig.classes.${classDef.id}.maxHp`),
  ];
  for (const key of retired) {
    const row = all.find(candidate => candidate.key === key);
    assert.ok(row, `${key} is still known`);
    assert.equal(row.retired, true, `${key} is retired`);
    assert.ok(!shown.has(key), `${key} is off the screen`);
  }
  assert.ok(!shown.has('mapHeaderSeed'), 'the seed toggle the header never honoured is off the screen');
  const legacy = { 'gameConfig.balance.levelUp.pointsPerLevelMax': 20, 'gameConfig.classes.reaver.maxHp': 84 };
  const warnings = [];
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(legacy, {}, Object.keys(legacy)), contentBundle, {}, [], warnings), {},
    'an exported file naming a retired key still imports, in either spelling, the dead keys skipped');
  assert.match(warnings.join(' '), /Reaver — Base HP/);

  // AND IS NEVER APPLIED (review, #1256): a stale pair that disagrees used to
  // land in the bundle and refuse the whole configuration over a row no longer
  // on screen.
  const { configuredContentBundle, advancedConfigStructuralProblems } = await import('../src/model/advancedConfig.js');
  const stale = { 'gameConfig.balance.levelUp.pointsPerLevelMin': 15, 'gameConfig.balance.levelUp.pointsPerLevelMax': 3, 'gameConfig.classes.reaver.maxHp': 500 };
  assert.deepEqual(advancedConfigStructuralProblems(contentBundle, stale), [], 'an inert value cannot refuse the configuration');
  const configured = configuredContentBundle(contentBundle, stale);
  assert.equal(configured.balance.levelUp.pointsPerLevelMin, contentBundle.balance.levelUp.pointsPerLevelMin);
  // The tier dial's bounds are not rows at all since ruleset 6 (#1253): the dial
  // is gone, and its keys are skipped on import with the named warning.
  assert.ok(!all.some(candidate => candidate.key === 'gameConfig.balance.levelUp.tierSizeMin'), 'tier bounds are not rows');
  assert.equal(configured.classes.find(classDef => classDef.id === 'reaver').maxHp,
    contentBundle.classes.find(classDef => classDef.id === 'reaver').maxHp);
});

test('a typed out-of-range number explains itself on its row, and the message matches the clamp', async () => {
  const { settingsRow, typedNumberRefusal, resolveNumberRow } = await import('../src/ui/screens/settings.js');
  const row = settingsRow('gameConfig.presentation.formationGap');
  assert.equal(typedNumberRefusal(row, String(row.def)), null, 'a legal value leaves no message');
  assert.equal(typedNumberRefusal(row, ''), null, 'an empty field is not a zero');
  const message = typedNumberRefusal(row, '99');
  assert.ok(message.includes(`${row.min}–${row.max}`) && message.includes('was refused'));
  const used = resolveNumberRow({ [row.key]: '99' }, row);
  assert.equal(used, row.max, 'the clamp is what the message says is in use');
  assert.ok(message.includes(`The value in use is ${used}`));
});
