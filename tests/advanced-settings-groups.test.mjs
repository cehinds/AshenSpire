import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryHandler, statsTopicPreviewHtml, activeAdvancedGroup, storedAdvancedTopic } from '../src/ui/screens/settings.js';
import { advancedSection, advancedSubgroups, statsSection, CLASS_TOPICS, STATS_TOPICS } from '../src/ui/models/AdvancedSettingsGroups.js';
import { statsTopicPreview } from '../src/ui/models/StatsPreviewModel.js';

test('grouping keeps every Advanced option reachable exactly once', () => {
  const rows = categoryHandler('Advanced').rows;
  const sections = [...new Set(rows.map(advancedSection))];
  const grouped = sections.flatMap(section => advancedSubgroups(rows, section).flatMap(group => group.rows));
  assert.equal(grouped.length, rows.length);
  assert.equal(new Set(grouped.map(row => row.key)).size, rows.length);
  assert.deepEqual(grouped.map(row => row.key).sort(), rows.map(row => row.key).sort());
});

// The owner's four asks, as one structure (2026-09-20): class defaults live in
// Progression, one driver holds the creation pool, "Assign points" is about
// points rather than tiers. The tier size first sat under General; since
// 2026-09-23 ("settings duplicated in multiple sections") it leads Stat
// conversions, because it REPLACES every per-stat tier there while it is off
// its default, and a dial a topic away from the rows it overrides is the
// duplication he reported.
test('Progression is the one driver: pool first, then each class, and the tier dial leads the rows it overrides', () => {
  const groups = advancedSubgroups(categoryHandler('Advanced').rows, 'Progression');
  // 2026-09-21: "I want level up and starting stats to be together too" — the
  // two read in a row, before the floors and the class tables they bound. What
  // the points turn into is a topic per trait under Stats (below).
  assert.deepEqual(groups.map(group => group.id).slice(0, 7),
    ['Assign points', 'Level-up', 'Equipment requirements', ...CLASS_TOPICS]);
  assert.ok(!groups.some(group => group.id === 'Stats & resources'), 'the formulas are edited under Stats, one topic per trait');

  const assign = groups.find(group => group.id === 'Assign points');
  // His sentence, in his order: the baseline he names first is the row he sees
  // first, then the points he places, then what they add up to, then the limits
  // that bound both.
  assert.deepEqual(assign.rows.map(row => row.label), [
    'Starting value for every attribute',
    'Points available to assign',
    'Total points on a character',
    'Lowest a stat may be set to',
    'Highest a stat may be set to',
    'Points may be taken back off a stat',
  ]);
  assert.ok(!categoryHandler('Advanced').rows.some(row => row.key === 'statTierSize'),
    'the tier dial retired with ruleset 6 — every stat states its own weights');

  // The floor under all of it, on screen beside the scale that has to clear it.
  const requirements = groups.find(group => group.id === 'Equipment requirements');
  assert.equal(requirements.rows[0].key, 'gameConfig.equipmentRequirements.scale', 'the across-the-board dial leads');
  assert.ok(requirements.rows.some(row => row.key === 'gameConfig.equipmentRequirements.ashStaff.intelligence'),
    'and every authored minimum has a row of its own');

  // What is left under General once the tier dial retired (ruleset 6, #1253).
  const general = groups.find(group => group.id === 'General');
  assert.deepEqual(general.rows.map(row => row.key), ['creationAutoAdvance']);
  assert.ok(!groups.some(group => group.id === 'Stat conversions'), 'no tier topic survives ruleset 6');

  for (const id of CLASS_TOPICS) {
    const group = groups.find(candidate => candidate.id === id);
    // Base HP is retired: the derived HP rule overwrites it at run creation.
    assert.equal(group.rows.length, 7, `${id} keeps five attributes and two flask rows`);
    assert.ok(group.rows.every(row => row.key.includes(`.${id.toLowerCase()}.`)));
  }
});

// A pool for a creation mode no player can pick is a dial whose only reachable
// effect is invalidating an old save; three of them read as three pools for
// one idea. They keep their keys (see the `retired` filter in settings.js) and
// leave the screen.
test('only the creation mode a player can pick is offered a pool', () => {
  const keys = categoryHandler('Advanced').rows.map(row => row.key);
  const pools = keys.filter(key => /^gameConfig\.startingStats\..+\.(total|bonusPool|baseline|minimum|maximum|belowBaseline)$/.test(key));
  assert.deepEqual(pools.sort(), [
    'gameConfig.startingStats.lean.baseline',
    'gameConfig.startingStats.lean.belowBaseline',
    'gameConfig.startingStats.lean.bonusPool',
    'gameConfig.startingStats.lean.maximum',
    'gameConfig.startingStats.lean.minimum',
    'gameConfig.startingStats.lean.total',
  ]);
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

test('a refused value is written under the row that caused it, and cleared when it is fixed', async () => {
  const { paintConfigProblems } = await import('../src/ui/screens/settings.js');
  const bad = 'gameConfig.startingStats.lean.total';
  const innocent = 'gameConfig.balance.startingCinders';
  const container = stubPanel([bad, innocent]);
  const read = key => container.querySelectorAll('.set-row [data-key]')
    .find(control => control.dataset.key === key).closest('.set-row')
    .querySelector('[data-row-problem]');

  const problems = paintConfigProblems(container, { [bad]: 4, [innocent]: 99 });
  assert.ok(problems.some(message => /refused/.test(message)));
  assert.match(read(bad).textContent, /refused/);
  assert.match(read(bad).textContent, /Starseer/);
  assert.equal(read(innocent), null, 'a healthy row says nothing');

  // Silent again the moment the number is legal — a warning that never leaves
  // is decoration, not a warning.
  assert.deepEqual(paintConfigProblems(container, { [bad]: 50, [innocent]: 99 }), []);
  assert.equal(read(bad), null);
});

// ---- the SAME refusal, reached the way a player reaches it -----------------
//
// The test above injects 8 straight into `settings`, which no field can do:
// `resolveNumberRow` clamps every typed value into the row's domain, so typing
// 8 into a row whose floor is 12 stored and displayed 12, the model then saw a
// legal number, and the sentence naming the Starseer's kit never appeared. It
// was reachable only by a programmatically injected value — i.e. only by the
// test above.
//
// This drives the screen's own commit decision (`commitNumberRow`, which the
// field and slider handlers call) and then the painter, so the clamp and the
// message are read from the same run.
test('a typed out-of-range number explains itself on its row, and the message matches the clamp', async () => {
  const { commitNumberRow, settingsRow, paintConfigProblems } = await import('../src/ui/screens/settings.js');
  const bad = 'gameConfig.startingStats.lean.total';
  const innocent = 'gameConfig.balance.startingCinders';
  const row = settingsRow(bad);
  const container = stubPanel([bad, innocent]);
  const settings = { [innocent]: 99 };
  const read = key => container.querySelectorAll('.set-row [data-key]')
    .find(control => control.dataset.key === key).closest('.set-row')
    .querySelector('[data-row-problem]');
  // What the field does on `change`: resolve, store, paint.
  const type = text => {
    const { value, refusal } = commitNumberRow(settings, row, text);
    settings[bad] = value;
    paintConfigProblems(container, settings, refusal ? [{ keys: [bad], message: refusal }] : []);
    return value;
  };

  // He types 4. The clamp is REAL — this is the trap, not an accident.
  assert.equal(type('4'), 7, 'the field clamps up to the row floor');
  assert.equal(settings[bad], 7, 'and 7 is what is stored, so the model sees nothing wrong');
  const said = read(bad).textContent;
  assert.match(said, /4 is outside 7–495 and was refused/, 'it names what he typed');
  assert.match(said, /Starseer/, 'and the class that set the floor');
  assert.match(said, /Ash Focus kit asks 3 Intelligence/, 'and the kit, which is why 7 is 7');
  assert.match(said, /The value in use is 7/, 'and the number actually in use');
  // The clamp-accurate part: the authored default did NOT stand here.
  assert.ok(!/The value in use is 8/.test(said), 'the authored default is not what is in use');
  assert.equal(read(innocent), null, 'a healthy row still says nothing');

  // Above the ceiling says the same kind of true thing about the other bound.
  assert.equal(type('999'), 495);
  assert.match(read(bad).textContent, /999 is outside 7–495/);
  assert.match(read(bad).textContent, /The value in use is 495/);

  // And it LEAVES the moment he types a number the row can take.
  assert.equal(type('50'), 50);
  assert.equal(read(bad), null, 'a legal value clears the row');
  assert.equal(commitNumberRow(settings, row, '50').refusal, null);
  // An empty field is not a zero, and unreadable is unset: neither is a refusal.
  for (const quiet of ['', '   ', 'lots']) assert.equal(commitNumberRow(settings, row, quiet).refusal, null, `'${quiet}' is unset, not refused`);
});

// ---- B1/B2/C5: the explanation renders, the reset finds its group ----------

// The kit-floor sentence is the only place a class cell's minimum explains
// itself, and the class topics compact a row's note away — so it was authored
// and never drawn. `floorNote` survives the compacting.
test('a class attribute row keeps the sentence naming its kit floor', async () => {
  const { categoryHandler } = await import('../src/ui/screens/settings.js');
  const rows = categoryHandler('Advanced').rows;
  const cell = rows.find(row => row.key === 'gameConfig.attributeRules.presets.lean.starseer.intelligence');
  assert.ok(cell, 'the Starseer Intelligence cell exists');
  assert.match(cell.floorNote, /Ash Focus kit this class starts in asks that much/);
  assert.match(cell.floorNote, /cannot go below 3/);
  assert.ok(cell.note.includes(cell.floorNote), 'the full note still carries it too');
  // A cell with no kit requirement has nothing to explain and says nothing.
  const free = rows.find(row => /attributeRules\.presets\.[^.]+\.[^.]+\./.test(row.key) && row.min === 1);
  assert.equal(free.floorNote, '');
});

// A stored tab id that this change retired ("Classes") made the painter fall
// back while the reset button read the raw value, asked for the subgroups of a
// group that no longer exists, got none, and reset nothing in silence.
test('a retired Advanced tab resolves to the same group for the painter and the reset', async () => {
  const { activeAdvancedGroup, ADVANCED_GROUP_IDS, categoryHandler } = await import('../src/ui/screens/settings.js');
  assert.ok(!ADVANCED_GROUP_IDS.includes('Classes'), 'the Classes tab is gone');
  const fallback = ADVANCED_GROUP_IDS[0];
  assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: 'Classes' }), fallback);
  assert.equal(activeAdvancedGroup({}), fallback);
  assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: 'Progression' }), 'Progression');
  // and the group it resolves to has rows to reset, which 'Classes' did not.
  const rows = categoryHandler('Advanced').rows;
  assert.ok(advancedSubgroups(rows, activeAdvancedGroup({ settingsAdvancedCategory: 'Classes' })).length > 0);
  assert.equal(advancedSubgroups(rows, 'Classes').length, 0, 'which is what made the reset a silent no-op');
});

// Four names typed out here meant a renamed or added class sorted last and kept
// its full label, with nothing failing.
test('the class topics are derived from the content bundle, not transcribed', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  assert.deepEqual([...CLASS_TOPICS], contentBundle.classes.map(classDef => classDef.name));
  const rows = categoryHandler('Advanced').rows.filter(row => row.classTopic);
  assert.deepEqual([...new Set(rows.map(row => row.classTopic))].sort(), [...CLASS_TOPICS].sort(),
    'every class topic a row declares is one of them');
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
  for (const file of ['customize.js', 'rest.js', 'equipment.js']) {
    const source = readFileSync(new URL(`../src/ui/screens/${file}`, import.meta.url), 'utf8');
    for (let at = source.indexOf('attributeCardModels(registries'); at >= 0;
      at = source.indexOf('attributeCardModels(registries', at + 1)) {
      sites += 1;
      // `projection,` (shorthand) and `projection: …` both count.
      assert.match(source.slice(at, at + 300), /projection\s*[,:]/,
        `${file}: the attribute card at offset ${at} is priced from a run projection, not the authored table`);
    }
  }
  assert.equal(sites, 5, 'all five attribute-card call sites are covered (a new one must state its projection too)');
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
  // Beside the hand rules under Stats, the fallback says what it is rather
  // than spelling its key.
  assert.equal(spelled.get('handMax'), 'Fallback hand capacity');
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

// Two cards can share a name — the Reaver's "Enter: Bulwark" and the one the
// Guardian shield creates for any class; the Rogue's "Hamstring" attack and the
// colorless "Hamstring" skill. Their impact-override rows must say whose card
// each is. A card whose name is its own keeps its plain label.
test('an attack override names one card', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { combatRatingRows } = await import('../src/model/combatRatings.js');
  const rows = combatRatingRows(contentBundle).filter(row => row.statTopic === 'Attack overrides');
  const labelOf = (id) => rows.find(row => row.key === `gameConfig.combatRatings.attackImpact.${id}`)?.label;

  assert.equal(labelOf('enterBulwark'), 'Enter: Bulwark (Reaver) — impact override');
  assert.equal(labelOf('guardianBulwark'), 'Enter: Bulwark (All classes) — impact override');
  assert.equal(labelOf('hamstringRogue'), 'Hamstring (Rogue) — impact override');
  assert.equal(labelOf('hamstring'), 'Hamstring (All classes) — impact override');
  assert.equal(labelOf('strike'), 'Strike — impact override', 'a name no other card uses stays plain');

  assert.equal(new Set(rows.map(row => row.label)).size, rows.length, 'every override row names one card');
  assert.equal(rows.length, contentBundle.cards.length, 'one row per card, none dropped');
});

// A player editing an armour rating has to know WHICH armour. Each class starts
// in a free outfit that shares its name with an "All classes" set piece — the
// Reaver's plain Wayfarer Plate and the Wayfarer Plate set (+2 Block, +4 max HP,
// STR 3) are different items with different keys, and both rows used to read
// "Wayfarer Plate (reaver)".
test('every armour rating row names one piece of armour', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { combatRatingRows } = await import('../src/model/combatRatings.js');
  const rows = combatRatingRows(contentBundle).filter(row => row.statTopic === 'Armour ratings');
  assert.ok(rows.length > 0);

  const byLabel = new Map();
  for (const row of rows) {
    assert.ok(!byLabel.has(row.label), `"${row.label}" names two keys: ${byLabel.get(row.label)} and ${row.key}`);
    byLabel.set(row.label, row.key);
  }

  const labelOf = (key) => rows.find(row => row.key === `gameConfig.combatRatings.itemRatings.${key}`)?.label;
  assert.equal(labelOf('armor:reaver:default.ar'), 'Wayfarer Plate (Reaver, starting armour) — AR');
  assert.equal(labelOf('armor:reaver:wayfarerPlate.ar'), 'Wayfarer Plate (Reaver) — AR');
  assert.equal(labelOf('armor:starseer:default.ward'), 'Nightweave (Starseer, starting armour) — Ward');
  // A class is named the way the rest of the menu names it, never by its id.
  assert.ok(!rows.some(row => /\((reaver|starseer|herald|rogue)[,)]/.test(row.label)), 'no row names a class by its lower-case id');
  // Exactly one starting armour per class, the same rule loadout.js enforces.
  assert.equal(rows.filter(row => row.key.endsWith('.ar') && / starting armour\)/.test(row.label)).length,
    contentBundle.classes.length);
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
  // still names it.
  const legacy = { 'gameConfig.balance.energy': 3, 'gameConfig.balance.draw': 5 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(legacy), contentBundle), legacy);

  // The row that IS read keeps its place and says what it actually governs.
  const handMax = rows.find(candidate => candidate.key === 'gameConfig.balance.handMax');
  assert.ok(!handMax.retired, 'handMax is read (engine/combat.js, engine/actions.js) and stays');
  assert.match(handMax.note, /Stats → Draw & hand → Hand capacity/, 'and points at the row a fight actually uses');
});

// ---- ONE HOME PER SETTING (owner, 2026-09-23) -------------------------------
// "a lot of the advanced settings have settings duplicated in multiple sections
// making it hard to tell which does what." Three properties, asserted together:
// the catch-all tabs are gone, rows that share a quantity share a topic, and a
// row that moved nothing is off the screen but still imports.
test('every setting has one home, and rows sharing a quantity sit together', async () => {
  const { ADVANCED_GROUP_IDS } = await import('../src/ui/screens/settings.js');
  const { WITHOUT_RATINGS, DRAW_FALLBACK } = await import('../src/ui/models/AdvancedSettingsGroups.js');
  for (const gone of ['Rules', 'Gameplay', 'Tuning', 'Card size', 'Debug']) {
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
  // The legacy poise meter sits with the Poise rating that replaces it, under
  // its own subsection heading.
  for (const key of ['gameConfig.balance.poise.growthMult', 'gameConfig.balance.stagger.player.actionLoss',
    'gameConfig.derivedStatRules.rules.poise.base']) {
    assert.equal(where(key), 'Stats → Poise');
    assert.equal(statsSection(rows.find(row => row.key === key)), WITHOUT_RATINGS);
  }
  // The fallback hand size and the legacy draw sit with the hand rules.
  for (const key of ['gameConfig.balance.handMax', 'gameConfig.derivedStatRules.rules.draw.base']) {
    assert.equal(where(key), 'Stats → Draw & hand');
    assert.equal(statsSection(rows.find(row => row.key === key)), DRAW_FALLBACK);
  }
  assert.equal(where('swapCostRule'), 'Equipment → Equipment swapping', 'the swap rule sits with its numbers');
  assert.equal(where('gameConfig.balance.equipment.swapCost'), 'Equipment → Equipment swapping');
  assert.equal(where('gameConfig.progression.rewardMultiplier'), 'Rewards → Combat rewards', 'the Cinder multiplier sits with the Cinders');
  assert.equal(rows.find(row => row.key === 'gameConfig.progression.rewardMultiplier').label, 'Cinder gain multiplier',
    'and no longer claims to multiply experience');
  assert.equal(where('shopSell'), 'Rewards → Shop stock & services');
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
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(legacy), contentBundle), legacy,
    'an exported file naming a retired key still imports');

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

// ---- Advanced → Stats: one home per trait (owner, 2026-09-21) --------------
//
// "stat conversion should be its own section under stats, and have sub
// sections for actions, draw, hp, stamina, mana, etc, but it should include
// everything pertaining to that trait instead of in 5 different menus."
test('Stats is the one menu for each trait: formulas, hand rules, ratings and their constants', () => {
  const rows = categoryHandler('Advanced').rows;
  const stats = advancedSubgroups(rows, 'Stats');
  assert.deepEqual(stats.slice(0, 11).map(group => group.id), STATS_TOPICS.slice(0, 11));
  const topicOf = (key) => stats.find(group => group.rows.some(row => row.key === key))?.id;
  assert.equal(topicOf('gameConfig.derivedStatRules.rules.energy.dexterity'), 'Actions');
  assert.equal(topicOf('gameConfig.derivedStatRules.rules.draw.base'), 'Draw & hand', 'the Draw conversion sits beside the hand rules');
  assert.equal(topicOf('gameConfig.handRules.starting.base'), 'Draw & hand');
  assert.equal(topicOf('gameConfig.balance.handMax'), 'Draw & hand', 'the co-op hand capacity too');
  assert.equal(topicOf('gameConfig.derivedStatRules.rules.hp.perLevel'), 'HP', 'level growth is part of the trait');
  assert.equal(topicOf('gameConfig.derivedStatRules.rules.mana.wisdom'), 'Mana');
  assert.equal(topicOf('gameConfig.balance.mana.minActionCost'), 'Mana');
  for (const key of ['gameConfig.combatRatings.ratings.poise.constitution', 'gameConfig.derivedStatRules.rules.poise.base',
    'gameConfig.balance.poise.growthMult', 'gameConfig.balance.stagger.player.actionLoss', 'gameConfig.combatRatings.resistance.physicalK']) {
    assert.equal(topicOf(key), 'Poise', `${key} is a Poise rule`);
  }
  assert.equal(topicOf('gameConfig.combatRatings.ratings.ward.wisdom'), 'Ward');
  assert.equal(topicOf('gameConfig.combatRatings.ratings.ar.strength'), 'Attack rating (AR)');
  // Every term of a trait is editable where the trait is.
  for (const id of ['energy', 'draw', 'hp', 'stamina', 'mana', 'poise']) {
    const own = rows.filter(row => row.derivedStatId === id).map(row => row.key.split('.').at(-1));
    assert.deepEqual(own, ['base', 'strength', 'dexterity', 'constitution', 'wisdom', 'intelligence', 'perLevel'], `${id}: base, a weight per attribute, growth per level`);
  }
  // The tabs these came from are gone or no longer hold them.
  for (const gone of ['Ratings & Resistance', 'Hand & Draw']) assert.equal(advancedSubgroups(rows, gone).length, 0, `${gone} is merged into Stats`);
  assert.ok(!advancedSubgroups(rows, 'Progression').some(group => group.id === 'Stats & resources'));
  assert.ok(!advancedSubgroups(rows, 'Combat').some(group => group.rows.some(row => /\.mana\./.test(row.key))));
  const keys = stats.flatMap(group => group.rows.map(row => row.key));
  assert.equal(new Set(keys).size, keys.length, 'no row is filed twice');
});

test('each Stats subsection is one unbroken run, so its heading is drawn once', async () => {
  const { WITHOUT_RATINGS, DRAW_FALLBACK } = await import('../src/ui/models/AdvancedSettingsGroups.js');
  const topics = advancedSubgroups(categoryHandler('Advanced').rows, 'Stats');
  const runsOf = (group) => group.rows.map(statsSection).filter((section, index, all) => index === 0 || section !== all[index - 1]);
  for (const group of topics) {
    const runs = runsOf(group);
    assert.equal(new Set(runs).size, runs.length, `${group.id}: ${runs.join(' / ')}`);
  }
  const of = (id) => runsOf(topics.find(group => group.id === id));
  assert.deepEqual(of('Draw & hand'), ['Starting hand', 'Turn draws', 'Hand capacity', 'Retention & discards', DRAW_FALLBACK]);
  assert.deepEqual(of('HP'), ['Formula', 'Level growth']);
  // The rows a switch turns off come after every row in force.
  assert.deepEqual(of('Poise'), ['Rating formula', 'Resistance & breaks', WITHOUT_RATINGS]);
  assert.deepEqual(of('Mana'), ['Formula', 'Level growth', 'Mana cards']);
});

test('a profile last on a merged tab opens on Stats', () => {
  assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: 'Ratings & Resistance' }), 'Stats');
  assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: 'Hand & Draw' }), 'Stats');
  // A topic that moved out of a tab that still exists follows it (Codex, #1252).
  for (const [tab, topic] of [['Progression', 'Stat conversions'], ['Progression', 'Stats & resources'], ['Combat', 'Poise'], ['Rules', 'Mana']]) {
    assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: tab, [`settingsAdvancedSubgroup.${tab}`]: topic }), 'Stats', `${tab} → ${topic}`);
  }
  assert.equal(activeAdvancedGroup({ settingsAdvancedCategory: 'Progression', 'settingsAdvancedSubgroup.Progression': 'Level-up' }), 'Progression',
    'a topic that stayed keeps its tab');
  // And opens on the topic its rows went to, not Overview.
  assert.equal(storedAdvancedTopic({ settingsAdvancedCategory: 'Hand & Draw' }, 'Stats'), 'Draw & hand');
  assert.equal(storedAdvancedTopic({ settingsAdvancedCategory: 'Combat', 'settingsAdvancedSubgroup.Combat': 'Poise' }, 'Stats'), 'Poise');
  assert.equal(storedAdvancedTopic({ settingsAdvancedCategory: 'Rules', 'settingsAdvancedSubgroup.Rules': 'Mana' }, 'Stats'), 'Mana');
  assert.equal(storedAdvancedTopic({ settingsAdvancedCategory: 'Hand & Draw', 'settingsAdvancedSubgroup.Stats': 'HP' }, 'Stats'), 'HP',
    'a topic chosen on Stats itself wins');
});

test('the worked example recomputes from the edited values and shows the whole sum', async () => {
  // Ruleset 6: base + Σ floor(attribute × weight) + floor((level − 1) × per level).
  const settings = {
    'gameConfig.derivedStatRules.rules.energy.base': 2,
    'gameConfig.derivedStatRules.rules.energy.dexterity': 0,
    'gameConfig.derivedStatRules.rules.energy.strength': 0.3,
  };
  const current = { strength: 11, dexterity: 2, constitution: 3, wisdom: 4, intelligence: 5 };
  const actions = statsTopicPreview(settings, 'Actions', current);
  assert.equal(actions.subject.current, true);
  assert.equal(actions.examples[0].lines[0].total, 2 + Math.floor(11 * 0.3));
  assert.match(actions.examples[0].lines[0].expression, /^2 base \+ STR 11 × 0\.3 → 3$/);
  assert.match(actions.examples[0].hint, /3 more STR would add 1 to Actions/, 'the next point that moves the floored term');
  assert.match(statsTopicPreviewHtml(settings, 'Actions', current), /= 5<\/b>/);

  // Out of a run the example is a named class, and says so.
  const example = statsTopicPreview({ settingsStatsExampleClass: 'herald' }, 'HP');
  assert.equal(example.subject.current, false);
  assert.match(example.subject.label, /Herald/);
  assert.equal(example.examples[0].lines.length, 2, 'HP shows level 1 and the next level that adds to it');
  // A character in play is shown at its own level (Codex review, #1252).
  const veteran = statsTopicPreview({}, 'HP', { constitution: 2 }, 11);
  assert.equal(veteran.examples[0].lines[0].label, 'HP at level 11');
  assert.equal(veteran.examples[0].lines[0].total, 30 + 2 * 4 + Math.floor(10 * 1), 'ten levels of growth by level 11');
  assert.match(veteran.examples[0].lines[0].expression, /10 levels × 1 → 10/);
  assert.equal(veteran.examples[0].lines[1].label, 'HP at level 12', 'and the next level that adds to it');
  assert.match(veteran.subject.label, /level 11/);
  const mana = statsTopicPreview({}, 'Mana', { wisdom: 2 }, 3);
  assert.equal(mana.examples[0].lines[1].label, 'Mana at level 6', 'a decimal per level moves on the level its floor does');

  // A new Reaver starts with its Forsaken Medallion (Codex review, #1252):
  // the example is the HP a new Reaver actually has, and names the relic.
  const { createRunState } = await import('../src/model/state.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { configuredContentBundle } = await import('../src/model/advancedConfig.js');
  const { contentBundle } = await import('../src/content/index.js');
  const born = (classId, settings = {}) => createRunState({ seed: 0, classId, registries: createRegistries(configuredContentBundle(contentBundle, settings)) });
  const hpLine = statsTopicPreview({ settingsStatsExampleClass: 'reaver' }, 'HP').examples[0].lines[0];
  assert.equal(hpLine.total, born('reaver').maxHp);
  assert.match(hpLine.expression, /from Forsaken Medallion/);
  const edited = { settingsStatsExampleClass: 'starseer', 'gameConfig.derivedStatRules.rules.mana.base': 3 };
  assert.equal(statsTopicPreview(edited, 'Mana').examples[0].lines[0].total, born('starseer', edited).maxMana, 'an edit reaches the example as it reaches a run');
  assert.match(statsTopicPreview({}, 'Overview', { constitution: 2 }, 11).examples[0].hint, /current level/);

  // Hand rules: every term of the opening hand is on the line.
  const hand = statsTopicPreview({
    'gameConfig.handRules.starting.base': 4,
    'gameConfig.handRules.starting.baseline': 5,
    'gameConfig.handRules.starting.pointsPerCard': 2,
  }, 'Draw & hand', { intelligence: 9 });
  const opening = hand.examples[0].lines[0];
  assert.equal(opening.total, 6);
  assert.match(opening.expression, /4 base \+ 2 extra cards \(INT 9 − 5, ÷ 2, whole cards only\)/);
  assert.match(hand.examples[1].legacy, /LAN/, 'the Draw conversion says who still uses it');
  assert.equal(hand.examples[0].lines[1].label, 'Each turn, at most', 'filling to capacity is a ceiling, not a promise');
  assert.match(statsTopicPreview({ 'gameConfig.handRules.reshuffle': false }, 'Draw & hand').examples[0].lines[1].expression, /not reshuffled/);
  const fixed = statsTopicPreview({
    'gameConfig.handRules.drawMode': 'fixed',
    'gameConfig.handRules.turn.base': 10,
    'gameConfig.handRules.capacity.base': 5,
  }, 'Draw & hand', { intelligence: 1 });
  assert.equal(fixed.examples[0].lines[1].total, 5, 'a fixed draw never shows more than capacity allows');
  assert.match(fixed.examples[0].lines[1].expression, /limited to capacity 5/);
  const replacing = statsTopicPreview({
    'gameConfig.handRules.drawMode': 'fixed', 'gameConfig.handRules.promptDiscard': true, 'gameConfig.handRules.replaceDiscards': true,
  }, 'Draw & hand');
  assert.match(replacing.examples[0].lines[1].label, /before replacements/, 'a replaced discard can draw past the base amount');
  const deepSettings = { 'gameConfig.handRules.starting.base': 20, 'gameConfig.handRules.starting.maximum': 30, 'gameConfig.handRules.capacity.base': 20 };
  const deep = statsTopicPreview(deepSettings, 'Draw & hand');
  assert.equal(deep.examples[0].lines[0].total, born('reaver', deepSettings).deck.length, 'an opening hand cannot exceed the starting deck');
  // `startingDeckSize` budgets only filler; bound cards ride on top, so the
  // cap is the deck the example run was actually dealt (Codex review, #1252).
  const tinyBudget = { ...deepSettings, 'gameConfig.balance.startingDeckSize': 1, settingsStatsExampleClass: 'reaver' };
  const dealt = born('reaver', tinyBudget).deck.length;
  assert.ok(dealt > 1, 'bound cards survive a filler budget of 1');
  assert.equal(statsTopicPreview(tinyBudget, 'Draw & hand').examples[0].lines[0].total, dealt, 'the cap is the dealt deck, not the filler budget');

  // Ratings: the same receipt combat uses, written term by term like a pool.
  const poise = statsTopicPreview({ 'gameConfig.combatRatings.multiplier': 2 }, 'Poise', { strength: 3, constitution: 2 });
  assert.equal(poise.examples[0].lines[0].total, 1 + Math.floor((Math.floor(3 * 0.5) + 2) * 2));
  assert.match(poise.examples[0].lines[0].expression, /STR 3 × 0\.5 → 1 \+ CON 2 × 1 → 2/);
  // With ratings off, Poise shows the conversion combat then uses, and no formula.
  const off = statsTopicPreview({ 'gameConfig.combatRatings.enabled': false }, 'Poise', { constitution: 2 });
  assert.deepEqual(off.examples.map(entry => entry.kind), ['derived']);
  assert.equal(statsTopicPreview({}, 'Status bonuses'), null, 'a table topic has no example');
});

// Review of the rebuilt #1252: the example is the one a run gets, even when a
// setting elsewhere is refused.
test('a refused configuration is named, and the example shows the rules a run keeps', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { contentBundle } = await import('../src/content/index.js');
  const authored = (classId) => createRunState({ seed: 0, classId, registries: createRegistries(contentBundle) });
  // A refusal on another tab no longer blanks every example.
  const flasks = statsTopicPreview({ 'gameConfig.balance.flaskCapacity': 9, settingsStatsExampleClass: 'reaver' }, 'HP');
  assert.match(flasks.refused, /flask/i);
  assert.equal(flasks.examples[0].kind, 'derived');
  assert.equal(flasks.examples[0].lines[0].total, authored('reaver').maxHp);
  assert.match(statsTopicPreviewHtml({ 'gameConfig.balance.flaskCapacity': 9 }, 'HP'), /set-example-refused/);
  // A Mana table the game refuses shows the Mana a run keeps, not 0.
  const zero = statsTopicPreview({ 'gameConfig.derivedStatRules.rules.mana.base': 0, 'gameConfig.derivedStatRules.rules.mana.wisdom': 0, settingsStatsExampleClass: 'herald' }, 'Mana');
  assert.match(zero.refused, /Mana would be 0/);
  assert.equal(zero.examples[0].lines[0].total, authored('herald').maxMana);
  assert.equal(statsTopicPreview({}, 'HP').refused, null);
});

test('the example shows what a run is born with at the edges', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { configuredContentBundle } = await import('../src/model/advancedConfig.js');
  const { contentBundle } = await import('../src/content/index.js');
  // HP is at least 1, as the run door clamps it.
  const settings = { 'gameConfig.derivedStatRules.rules.hp.base': 0, 'gameConfig.derivedStatRules.rules.hp.constitution': 0, settingsStatsExampleClass: 'rogue' };
  const line = statsTopicPreview(settings, 'HP').examples[0].lines[0];
  assert.equal(line.total, createRunState({ seed: 0, classId: 'rogue', registries: createRegistries(configuredContentBundle(contentBundle, settings)) }).maxHp);
  assert.equal(line.total, 1);
  assert.match(line.expression, /raised to 1/);
  // A typed weight is shown as the number that was multiplied.
  const eighth = statsTopicPreview({ 'gameConfig.derivedStatRules.rules.draw.perLevel': 0.125 }, 'Draw & hand', { intelligence: 1 }, 9);
  assert.match(eighth.examples[1].lines[0].expression, /8 levels × 0\.125 → 1/);
});
