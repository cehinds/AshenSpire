// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/score-studio-template-boundaries.browser.mjs
// Run the actual authoring UI; expose its context only for read-only assertions.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/focusedRebalanceUi.js', async route => {
    const response = await route.fetch(), source = await response.text();
    const entry = 'export function initFocusedRebalanceUi(ctx) {';
    assert.ok(source.includes(entry));
    await route.fulfill({ response, body: source.replace(entry, `${entry} globalThis.__boundaryContext = ctx;`) });
  });
  await page.goto(`${server.url}tools/score-studio/`); await page.waitForSelector('.studio-card-tile');
  await page.evaluate(() => {
    document.getElementById('btn-subclass-lists').click();
    const classes = document.getElementById('subclass-class'); classes.value = 'reaver'; classes.dispatchEvent(new Event('change'));
    document.getElementById('subclass-style').value = 'bloodletter';
    document.getElementById('subclass-rank').value = '3';
    document.getElementById('subclass-seed').value = 'boundary-test';
    document.getElementById('btn-subclass-generate').click();
  });
  await page.waitForFunction(() => __boundaryContext.state.cards.filter(card => card.id.startsWith('subclass.bloodletter.')).length === 15);
  await page.evaluate(() => document.getElementById('subclass-catalog-modal').close());
  const snapshot = () => page.evaluate(async () => {
    const state = __boundaryContext.state, { currentSubclassCatalog } = await import('/tools/score-studio/subclassCatalog.js');
    return { cards: JSON.stringify(state.cards), decks: JSON.stringify(state.customDecks), catalog: JSON.stringify(state.subclassCatalog), undo: state.undoStack.length,
      exported: currentSubclassCatalog(state, ['bloodletter']).cards.map(card => card.id), count: state.cards.length };
  });
  const initial = await snapshot(); assert.equal(initial.exported.length, 15);

  // The legacy manager still permits Active/Export, while every mutation is
  // disabled and defended if a stale or synthetic event reaches its handler.
  await page.locator('#btn-custom-decks').evaluate(button => button.click());
  for (const attribute of ['data-add-selected', 'data-del-deck', 'data-assign-deck']) {
    const node = page.locator(`[${attribute}="subclass-list.bloodletter"]`);
    assert.equal(await node.isDisabled(), true);
    await node.dispatchEvent(attribute === 'data-assign-deck' ? 'change' : 'click', { bubbles: true });
  }
  assert.deepEqual(await snapshot(), initial);
  await page.locator('[data-active-deck="subclass-list.bloodletter"]').click();
  assert.equal(await page.evaluate(() => __boundaryContext.state.customDecks.find(deck => deck.id === 'subclass-list.bloodletter').isActiveDeckList), true);
  await page.locator('[data-active-deck="subclass-list.bloodletter"]').click();
  await page.evaluate(() => document.getElementById('decks-modal').close());

  // Hidden/stale options cannot bypass the same policy at either generator.
  await page.locator('#btn-batch-generate-cards').evaluate(button => button.click());
  assert.equal(await page.locator('#gen-deck option[value="subclass-list.bloodletter"]').count(), 0);
  const beforeBlocked = await snapshot();
  for (const id of ['subclass-list.bloodletter', 'deleted.custom.deck']) {
    await page.evaluate(id => { const select = document.getElementById('gen-deck'); select.append(new Option('Stale destination', id)); select.value = id; document.getElementById('btn-gen-run').click(); }, id);
    assert.deepEqual(await snapshot(), beforeBlocked);
    assert.match(await page.locator('#studio-toast').textContent(), id.startsWith('subclass') ? /copy.*custom deck/i : /no longer exists/i);
  }
  await page.evaluate(() => document.getElementById('generate-modal').close());
  await page.locator('#btn-auto-balance-cards').evaluate(button => button.click()); await page.waitForSelector('#rebalance-modal[open]');
  await page.evaluate(() => {
    const scope = document.getElementById('rebal-scope'); scope.value = 'deck:subclass-list.bloodletter'; scope.dispatchEvent(new Event('change'));
    document.getElementById('rebal-count').value = '16'; document.getElementById('rebal-gen-shortage').checked = true;
    const mode = document.getElementById('rebal-pool-mode'); mode.checked = true; mode.dispatchEvent(new Event('change'));
  });
  const beforePool = await snapshot(); await page.locator('#btn-rebal-apply').evaluate(button => button.click());
  assert.deepEqual(await snapshot(), beforePool); assert.match(await page.locator('#studio-toast').textContent(), /copy.*custom deck/i);
  await page.evaluate(() => document.getElementById('rebalance-modal').close());

  // A real custom deck remains a writable generation target.
  await page.locator('#btn-custom-decks').evaluate(button => button.click());
  await page.locator('#new-deck-name').fill('Writable boundary test'); await page.locator('#new-deck-from-filter').uncheck(); await page.locator('#btn-create-deck').click();
  const customId = await page.evaluate(() => __boundaryContext.state.customDecks.find(deck => deck.name === 'Writable boundary test').id);
  await page.evaluate(() => document.getElementById('decks-modal').close());
  await page.locator('#btn-batch-generate-cards').evaluate(button => button.click());
  await page.evaluate(id => { document.getElementById('gen-deck').value = id; document.getElementById('gen-count').value = '1'; document.getElementById('gen-rank').value = '1'; document.getElementById('gen-seed').value = 'boundary-custom'; }, customId);
  const beforeGenerate = await snapshot(); await page.locator('#btn-gen-run').evaluate(button => button.click());
  const generated = await snapshot(); assert.equal(generated.count, beforeGenerate.count + 1); assert.deepEqual(generated.exported, initial.exported);
  assert.equal(await page.evaluate(id => __boundaryContext.state.customDecks.find(deck => deck.id === id).cardIds.length, customId), 1);

  // Explicit quota trimming cleans all references and one Undo restores them.
  await page.evaluate(() => { const filter = document.getElementById('filter-deck'); filter.value = 'subclass-list.bloodletter'; filter.dispatchEvent(new Event('change')); });
  await page.locator('#btn-auto-balance-cards').evaluate(button => button.click()); await page.waitForSelector('#rebalance-modal[open]');
  await page.evaluate(() => {
    const scope = document.getElementById('rebal-scope'); scope.value = 'filtered'; scope.dispatchEvent(new Event('change'));
    document.getElementById('rebal-count').value = '14'; document.getElementById('rebal-trim-surplus').checked = true; document.getElementById('rebal-gen-shortage').checked = false;
    const mode = document.getElementById('rebal-pool-mode'); mode.checked = true; mode.dispatchEvent(new Event('change'));
  });
  const beforeTrim = await snapshot(); await page.locator('#btn-rebal-apply').evaluate(button => button.click());
  const trimmed = await snapshot(); assert.equal(trimmed.count, beforeTrim.count - 1); assert.equal(trimmed.exported.length, 14); assert.equal(trimmed.undo, beforeTrim.undo + 1);
  await page.locator('#btn-undo').evaluate(button => button.click()); const undone = await snapshot();
  for (const key of ['cards', 'decks', 'catalog']) assert.equal(undone[key], beforeTrim[key], `Undo restores ${key}`);
  assert.deepEqual(errors, []); console.log('score-studio template boundaries: ok');
} finally { await browser.close(); await server.close?.(); }
process.exit(0);
