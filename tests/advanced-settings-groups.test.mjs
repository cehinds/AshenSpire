import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryHandler } from '../src/ui/screens/settings.js';
import { advancedSection, advancedSubgroups, CLASS_TOPICS } from '../src/ui/models/AdvancedSettingsGroups.js';

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
// points rather than tiers, and the tier size sits under General.
test('Progression is the one driver: pool first, then each class, and the tier size under General', () => {
  const groups = advancedSubgroups(categoryHandler('Advanced').rows, 'Progression');
  assert.deepEqual(groups.map(group => group.id).slice(0, 6), ['Assign points', 'Equipment requirements', ...CLASS_TOPICS]);
  assert.equal(advancedSection({ key: 'statTierSize' }), 'Progression', 'the tier size left the Classes tab with it');

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
  assert.ok(!assign.rows.some(row => row.key === 'statTierSize'), 'points, not tiers');

  // The floor under all of it, on screen beside the scale that has to clear it.
  const requirements = groups.find(group => group.id === 'Equipment requirements');
  assert.equal(requirements.rows[0].key, 'gameConfig.equipmentRequirements.scale', 'the across-the-board dial leads');
  assert.ok(requirements.rows.some(row => row.key === 'gameConfig.equipmentRequirements.ashStaff.intelligence'),
    'and every authored minimum has a row of its own');

  // The tier size AND its own bounds: one dial, one place.
  const general = groups.find(group => group.id === 'General');
  assert.deepEqual(general.rows.map(row => row.key).sort(), [
    'creationAutoAdvance',
    'gameConfig.balance.levelUp.tierSizeMax',
    'gameConfig.balance.levelUp.tierSizeMin',
    'statTierSize',
  ]);

  for (const id of CLASS_TOPICS) {
    const group = groups.find(candidate => candidate.id === id);
    assert.equal(group.rows.length, 8, `${id} keeps five attributes, base HP and two flask rows`);
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
