// Run the real Score Studio page in a private Chromium context.
// PLAYWRIGHT_MODULE and CHROME may point to existing local installations.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const evidence = await mkdtemp(join(tmpdir(), 'score-studio-json-rollback-'));
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // Test-only access to actual module bindings, using the existing browser QA pattern.
  await page.route('**/tools/score-studio/studio.js', async route => {
    const response = await route.fetch();
    const hook = `
      (() => {
        const inspector = renderInspector, sync = syncAllViews, history = pushHistory;
        let pushes = 0, fixtureIds = null;
        pushHistory = () => { pushes++; return history(); };
        globalThis.__jsonRollbackQa = {
          capture() { return { snapshot: snapshotState(), undo: [...state.undoStack], redo: [...state.redoStack],
            autoText: document.getElementById('toggle-auto-text').checked, storedAutoText: localStorage.getItem(AUTO_TEXT_KEY),
            undoDisabled: document.getElementById('btn-undo').disabled, redoDisabled: document.getElementById('btn-redo').disabled }; },
          seed(undoCount, redoCount) {
            renderInspector = inspector; syncAllViews = sync;
            const ids = fixtureIds ||= [...registries.cards.ids()].filter(id => state.cards.some(card => card.id === id)).slice(0, 2);
            state.cards = ids.map((id, index) => ({ id, name: index ? 'Other manual name' : 'Before', class: 'reaver',
              type: 'skill', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', icon: 'skill',
              tags: ['camp:physical', 'classification.skill'], kindIds: ['classification.skill'], keywords: [],
              effects: [{ op: 'block', target: 'self', amount: 3 }], textTemplate: 'Gain {block} Block.',
              _autoName: false, _autoText: false, _edited: true }));
            state.selectedCardId = ids[0]; state.items = []; state.selectedItemKey = null;
            state.customClasses = []; state.customDecks = []; state.subclassCatalog = null;
            state.baselineRanks = {}; state.artLayers = { version: 1, layers: [] };
            state.itemArtLayers = { version: 1, layers: [] };
            document.getElementById('toggle-auto-text').checked = true; writeStoredJson(AUTO_TEXT_KEY, true);
            syncAllViews();
            const snapshot = JSON.parse(snapshotState());
            const point = name => { const copy = structuredClone(snapshot); copy.cards[0].name = name; return JSON.stringify(copy); };
            state.undoStack = Array.from({ length: undoCount }, (_, i) => point('Undo ' + i));
            state.redoStack = Array.from({ length: redoCount }, (_, i) => point('Redo ' + i));
            updateUndoButtons(); clearTimeout(draftTimer); draftPending = false; pushes = 0;
            return this.capture();
          },
          apply(changes, failure = '') {
            openCardJson(state.selectedCardId);
            const next = JSON.parse(cardJsonDialog.querySelector('#card-json-text').value);
            Object.assign(next, changes);
            cardJsonDialog.querySelector('#card-json-text').value = JSON.stringify(next);
            let renderFailed = false;
            if (failure) renderInspector = () => { if (!renderFailed) { renderFailed = true; throw new Error('controlled late render failure'); } return inspector(); };
            if (failure === 'both') syncAllViews = () => { throw new Error('controlled rollback render failure'); };
            let escaped = null;
            try { applyCardJson(); } catch (error) { escaped = error.message; }
            finally { renderInspector = inspector; syncAllViews = sync; }
            const result = { ...this.capture(), pushes, escaped, error: cardJsonDialog.querySelector('#card-json-error').textContent,
              dialogOpen: cardJsonDialog.open, card: structuredClone(state.cards[0]) };
            if (cardJsonDialog.open) cardJsonDialog.close();
            return result;
          },
          showInvalid() {
            openCardJson(state.selectedCardId);
            const next = JSON.parse(cardJsonDialog.querySelector('#card-json-text').value);
            next.textTemplate = {};
            cardJsonDialog.querySelector('#card-json-text').value = JSON.stringify(next, null, 2);
            applyCardJson();
            return { ...this.capture(), error: cardJsonDialog.querySelector('#card-json-error').textContent };
          },
          custom() {
            const def = { ...state.cards[0], id: 'custom.json-rollback', _custom: true };
            state.cards = [def]; state.selectedCardId = def.id;
            const score = inGameScore(def), menu = cardMenuActions();
            renderInspector();
            return { score, reset: menu.find(row => row.label === 'Reset to default').enabled,
              summary: document.getElementById('inspector-score-summary').textContent };
          },
          existing() {
            const def = state.cards[0], score = inGameScore(def), menu = cardMenuActions();
            return { score, reset: menu.find(row => row.label === 'Reset to default').enabled };
          },
        };
      })();
    `;
    await route.fulfill({ response, body: (await response.text()) + hook });
  });
  await page.goto(server.url + 'tools/score-studio/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.__jsonRollbackQa && document.querySelectorAll('.studio-card-tile').length > 0, null, { timeout: 120000 });
  const run = async (name, fn) => {
    try { await fn(); console.log('PASS ' + name); }
    catch (error) { failures.push({ name, error: error.message.slice(0, 1400) }); console.log('FAIL ' + name + ': ' + error.message.slice(0, 300)); }
  };
  const seed = (undo = 2, redo = 2) => page.evaluate(([a, b]) => __jsonRollbackQa.seed(a, b), [undo, redo]);
  const apply = (changes, failure) => page.evaluate(([a, b]) => __jsonRollbackQa.apply(a, b), [changes, failure]);
  const unchanged = (after, before) => { for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], key); };

  await run('invalid optional text is refused before mutation or history writes', async () => {
    for (const textTemplate of [{}, [], 4, null]) {
      const before = await seed(40, 2), after = await apply({ textTemplate });
      assert.equal(after.pushes, 0);
      assert.match(after.error, /textTemplate.*text|string/i);
      assert.equal(after.dialogOpen, true); assert.equal(after.escaped, null); unchanged(after, before);
    }
  });
  await run('a late failed apply retains all available Redo entries and buttons', async () => {
    const before = await seed(2, 3), after = await apply({ name: 'Changed', textTemplate: 'Manual replacement' }, 'live');
    assert.equal(after.escaped, null); assert.match(after.error, /Not applied: controlled late render failure/);
    unchanged(after, before);
  });
  await run('a late failed apply retains the complete ordered 40-entry Undo history', async () => {
    const before = await seed(40, 0), after = await apply({ name: 'Changed', textTemplate: 'Manual replacement' }, 'live');
    assert.equal(after.escaped, null); assert.equal(after.undo.length, 40); unchanged(after, before);
  });
  await run('rollback render failure still restores all cards, history, Auto-text storage and buttons', async () => {
    const before = await seed(40, 3), after = await apply({ name: 'Changed', textTemplate: 'Manual replacement' }, 'both');
    assert.equal(after.escaped, null); assert.match(after.error, /Not applied: controlled late render failure/); unchanged(after, before);
  });
  await run('valid JSON adds exactly one Undo point and clears Redo normally', async () => {
    const before = await seed(2, 3), after = await apply({ name: 'JSON name', textTemplate: 'Manual replacement' });
    assert.equal(after.escaped, null); assert.equal(after.error, ''); assert.equal(after.dialogOpen, false); assert.equal(after.pushes, 1);
    assert.deepEqual(after.undo, [...before.undo, before.snapshot]); assert.deepEqual(after.redo, []);
    assert.equal(after.card.name, 'JSON name'); assert.equal(after.card.textTemplate, 'Manual replacement');
    assert.equal(after.card._autoName, false); assert.equal(after.card._autoText, false);
    assert.equal(after.autoText, false); assert.equal(after.storedAutoText, 'false'); assert.equal(after.redoDisabled, true);
  });
  await run('custom card comparisons and menu are safe; existing cards keep default comparison and reset', async () => {
    await seed();
    const existing = await page.evaluate(() => __jsonRollbackQa.existing());
    assert.ok(Number.isFinite(existing.score.cp)); assert.equal(existing.reset, true);
    const custom = await page.evaluate(() => __jsonRollbackQa.custom());
    assert.equal(custom.score, null); assert.equal(custom.reset, false); assert.match(custom.summary, /CP:/);
  });
  if (!failures.length) for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const before = await seed(40, 3), shown = await page.evaluate(() => __jsonRollbackQa.showInvalid());
    unchanged(shown, before); assert.match(shown.error, /textTemplate.*text/);
    await page.screenshot({ path: join(evidence, 'json-validation-' + viewport.width + 'x' + viewport.height + '.png') });
    await page.locator('[data-json-close]').click();
  }
  console.log(JSON.stringify({ cases: 6, passed: 6 - failures.length, failures, evidence }));
  assert.deepEqual(failures, []);
} finally { await browser.close(); await new Promise(resolve => server.server.close(resolve)); }
