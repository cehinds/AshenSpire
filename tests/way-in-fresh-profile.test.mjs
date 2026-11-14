// The way in on a fresh profile (Wave 2, W2-D): New Game opens creation for slot 1
// with no slot picker, the fixed-class Class step carries Begin, the opening
// leaves on any key or click, and a new run's single start node is preselected.
// Browser counts live in tools/quick-start-inputs.mjs (budget in
// tools/core-entry-fixture.mjs); this file pins the decisions each piece makes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { creationFooterPlan } from '../src/ui/models/CreationWorkspaceModel.js';
import { saveSlotSelectionModel } from '../src/ui/models/SaveSlotSelectionModel.js';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const slice = (text, from, to) => {
  const a = text.indexOf(from); const b = text.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `source boundary ${from}`);
  return text.slice(a, b);
};

// Run the title's real startNewGame against a profile's slot list.
function newGameOn(slots) {
  const body = slice(source('src/ui/screens/title.js'), '  const startNewGame = () => {', '  const openNewReview');
  const calls = [];
  const run = runInNewContext(`${body}\nstartNewGame`, {
    currentSlots: slots, saveSlotSelectionModel, onNew: (slot) => calls.push(['new', slot]), openModal: (kind) => calls.push(['door', kind]),
  });
  run();
  return calls;
}
const slots = (...summaries) => summaries.map((summary, at) => ({ slot: at + 1, summary }));

test('a fresh profile: New Game opens creation for slot 1, no slot picker', () => {
  assert.deepEqual(newGameOn(slots(null, null, null)), [['new', 1]]);
});

test('a profile with a save still shows the slot picker', () => {
  assert.deepEqual(newGameOn(slots(null, { className: 'Reaver' }, null)), [['door', 'new']]);
  assert.deepEqual(newGameOn(slots({ className: 'Reaver' }, { className: 'Reaver' }, { className: 'Reaver' })), [['door', 'new']]);
});

test('the Class step of the Class-then-Review flow carries Begin; longer flows are unchanged', () => {
  const fixed = ['class', 'review'];
  assert.equal(creationFooterPlan({ categories: fixed, current: 'class' }).quickBegin, true);
  assert.equal(creationFooterPlan({ categories: fixed, current: 'review' }).quickBegin, false);
  assert.equal(creationFooterPlan({ categories: fixed, current: 'review' }).primary, 'begin');
  const long = ['class', 'attributes', 'equipment', 'review'];
  for (const current of long) assert.equal(creationFooterPlan({ categories: long, current }).quickBegin, false);
  const customize = source('src/ui/screens/customize.js');
  assert.match(customize, /start\.hidden = plan\.primary !== 'begin' && !plan\.quickBegin/);
});

test('the start node is preselected only when it is the single reachable node of a new run', () => {
  const map = source('src/ui/screens/map.js');
  assert.match(map, /const soleStartId = !selectedId && !mapAdapter && !current && reachable\.size === 1/);
  const expr = (reachable, current = null, selectedId = null, mapAdapter = null) => runInNewContext(
    'const soleStartId = !selectedId && !mapAdapter && !current && reachable.size === 1 ? [...reachable][0] : null; soleStartId',
    { reachable: new Set(reachable), current, selectedId, mapAdapter });
  assert.equal(expr(['a']), 'a');
  assert.equal(expr(['a', 'b']), null);
  assert.equal(expr(['a'], 'n0'), null);
});

test('the opening skips on any key or click after its first scene has been up 600 ms', () => {
  const prologue = source('src/ui/screens/prologue.js');
  assert.match(prologue, /SKIP_AFTER_MS = 600/);
  assert.match(prologue, /document\.addEventListener\('keydown',anyKeySkips,true\)/);
  assert.match(prologue, /root\.addEventListener\('click',anyClickSkips,true\)/);
  assert.match(prologue, /!preview && !editorPreview/);
});

test('pressing Enter on a node shows Entering before the screen is built', () => {
  const map = source('src/ui/screens/map.js');
  const travel = slice(map, '  function travelTo(id) {', '  // The press is taken at once');
  assert.ok(travel.indexOf('showEntering()') < travel.indexOf('leaving(onPick)'));
  const main = source('src/main.js');
  assert.match(main, /function afterEntryPaint\(action\)/);
  for (const open of ['showEvent(res.eventId)', 'showShop()', "beginGameProfileReward({ source: 'treasure'", 'startFightNow(pool, nodeId)']) {
    assert.ok(main.includes(`afterEntryPaint(() => ${open}`), `${open} waits for the busy state to paint`);
  }
});
