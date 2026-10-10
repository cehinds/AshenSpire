import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Execute the actual probe step without booting a browser as an import side
// effect. Native dispatch, geometry, and the complete six-input route are CI's
// browser boundary; these cases verify its visibility/accounting/refusal logic.
const source = readFileSync(new URL('../tools/quick-start-inputs.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  const dismissFirstCombatTutorial = async () => {');
const end = source.indexOf('  // From wherever a new climb lands', start);
assert.ok(start >= 0 && end > start);
const stepSource = source.slice(start, end) + '\ndismissFirstCombatTutorial';

function fixture({ absent = false, hidden = false, disabled = false, width = 70, height = 44,
  style = {}, refuses = false } = {}) {
  let mounted = !absent;
  const inputs = [];
  const game = { cardsPlayedThisCombat: 0, energy: 3, mana: 1, rng: { seed: 42, streams: { shuffle: 3 } } };
  const original = structuredClone(game);
  const button = { hidden, disabled, getBoundingClientRect: () => ({ width, height }) };
  const document = { querySelector(selector) {
    assert.equal(selector, '.combat .tut-skip'); return mounted ? button : null;
  } };
  const context = { evalIn: async expression => runInNewContext(expression, {
    document, getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', ...style }),
  }), click: async (selector, label) => {
    assert.equal(selector, '.combat .tut-skip');
    inputs.push(label); // The production click helper spends once and dispatches native press/release.
    if (!refuses) mounted = false;
  } };
  return { run: runInNewContext(stepSource, context), inputs, game, original };
}

test('visible tutorial is dismissed through one counted click without paying or playing a card', async () => {
  const probe = fixture();
  assert.equal(await probe.run(), true);
  assert.deepEqual(probe.inputs, ['Skip the first-combat tutorial']);
  assert.deepEqual(probe.game, probe.original);
  assert.equal(await probe.run(), false, 'the completed tutorial cannot spend another input');
  assert.equal(probe.inputs.length, 1);
});

test('absent, hidden, disabled, or unpainted Skip never consumes an input', async () => {
  for (const state of [{ absent: true }, { hidden: true }, { disabled: true }, { width: 0 }, { height: 0 },
    { style: { display: 'none' } }, { style: { visibility: 'hidden' } }, { style: { visibility: 'collapse' } },
    { style: { opacity: '0' } }]) {
    const probe = fixture(state);
    assert.equal(await probe.run(), false);
    assert.deepEqual(probe.inputs, []);
    assert.deepEqual(probe.game, probe.original);
  }
});

test('a refused native Skip fails before first-card selection instead of mutating tutorial visibility', async () => {
  const probe = fixture({ refuses: true });
  await assert.rejects(probe.run(), /native tutorial Skip did not close/);
  assert.deepEqual(probe.inputs, ['Skip the first-combat tutorial']);
  assert.deepEqual(probe.game, probe.original);
});

test('the actual route dismisses before card selection and retains its original input and target deadlines', () => {
  const route = source.slice(source.indexOf('  const toFirstCardPlay = async () => {'), source.indexOf('  const report ='));
  assert.ok(route.indexOf('await dismissFirstCombatTutorial();') < route.indexOf('    const kind = await evalIn'));
  assert.match(source, /const BUDGET = 6;/);
  assert.match(route, /Date\.now\(\) - t0 < 5000/);
  assert.match(route, /'the first card play', 8000/);
});
