// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/score-studio-comparison.browser.mjs
// Real browser regression for staged comparisons, compact navigation and exact delete/Undo references.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '../tools/serve.mjs';
import { scoring } from '../src/content/generated/scoring.js';
import { GenerateSubclassCatalog } from '../src/model/subclassCardGenerator.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
// Browser plugin not available; use private Playwright contexts with shipped weights.
const targetRank = 3;
const targetCp = (targetRank - 1) * scoring.rank.width + 1;
const evidence = await mkdtemp(join(tmpdir(), 'score-comparison-final-'));
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const base = { name: 'Visible damage', class: 'reaver', rarity: 'common', cost: 0, staminaCost: 0,
  manaCost: 0, costRule: 'fixed', type: 'attack', icon: 'attack', keywords: [],
  tags: ['camp:physical', 'maneuver:attack', 'blood', 'theme:blood', 'source:weapon', 'classification.attack'],
  textTemplate: 'Deal {damage} damage. Apply {bleed} bleed.', damageSchool: 'physical',
  effects: [{ op: 'damage', target: 'enemy', amount: 8 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 1 }],
  _custom: true, _autoName: false };
const cards = ['subclass.qa.compact-a', 'subclass.qa.compact-b'].map((id, i) => ({ ...structuredClone(base), id, name: i ? 'Second card' : base.name }));
const facts = [];
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 1280, height: 650 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Test instrumentation is served only to this private context; production source stays private.
    await page.route('**/tools/score-studio/studio.js', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nglobalThis.__comparisonQa={capture:()=>JSON.parse(snapshotState()),measure:(id)=>{const card=state.cards.find(row=>row.id===id),face=withRebalancePreviewRegistry(()=>cardDefToFace(clone(card),state.scoring)),raw=ScoreCard(face,state.scoring).raw;return {damage:face.dmg,cp:CombatPower(raw,card.rarity,state.scoring),rank:RankOf(CombatPower(raw,card.rarity,state.scoring),state.scoring)};},seed:(id)=>{state.baselineRanks[id]=3;(state.scoring.overrides ||= {})[id]={rank:4,rarity:'common'};}};` });
    });
    await page.addInitScript(({ scoring, cards }) => localStorage.setItem('ashenspire:scoreStudioDraft:v1', JSON.stringify({ scoring, customCards: cards })), { scoring, cards });
    await page.goto(`${server.url}tools/score-studio/`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-card-id="subclass.qa.compact-a"]').waitFor({ timeout: 120000 });
    await page.locator('#card-selection-mode').check();
    await page.locator('input[data-card-selection="subclass.qa.compact-a"]').check();
    const before = await page.evaluate(() => __comparisonQa.capture());
    const original = await page.evaluate(id => __comparisonQa.measure(id), cards[0].id);
    await page.locator('#btn-quick-balance-cards').click();
    await page.locator('#rebalance-modal').waitFor();
    assert.equal(await page.locator('#rebal-navigation').isVisible(), false, 'one card without history has no empty navigation row');
    assert.equal(await page.locator('#rebal-card-before .illustrated-card-face').count(), 1);
    await page.locator('#rebal-target-rank').selectOption(String(targetRank));
    await page.locator('#rebal-target-cp').fill(String(targetCp));
    await page.locator('#rebal-costs-section summary').click();
    await page.locator('#rebal-sp').fill('0'); await page.locator('#rebal-mp').fill('0');
    await page.locator('#rebal-costs-section summary').click();
    await page.locator('#rebal-generate-names').check();
    await page.locator('#btn-rebal-preview').click();
    await page.waitForFunction(() => document.querySelector('#rebal-variation-position').textContent.includes('Variation 1'));
    assert.match(await page.locator('#rebal-diff').innerText(), new RegExp(`Damage: ${original.damage} → (?!${original.damage}(?:\\s|$))\\d+`), 'preview shows a real damage change under shipped weights');
    assert.match(await page.locator('#rebal-before-metrics').innerText(), new RegExp(`CP ${original.cp}(?:\\s|$)`));
    assert.match(await page.locator('#rebal-after-metrics').innerText(), new RegExp(`CP ${targetCp}(?:\\s|$)`), 'preview reaches the requested CP in the real Rank 3 band');
    assert.equal(await page.locator('#rebal-card-navigation').isVisible(), false);
    assert.equal(await page.locator('#rebal-version-navigation').isVisible(), true);
    assert.deepEqual(await page.evaluate(() => __comparisonQa.capture()), before, 'preview does not mutate draft or pins');
    await page.locator('#btn-rebal-revert').click();
    assert.match(await page.locator('#rebal-variation-position').innerText(), /Original/);
    assert.equal(await page.locator('#rebal-version-navigation').isVisible(), true, 'reverting keeps history reachable');
    await page.locator('#btn-rebal-next-variation').click();
    assert.match(await page.locator('#rebal-diff').innerText(), new RegExp(`Damage: ${original.damage} → (?!${original.damage}(?:\\s|$))\\d+`), 'preview shows a real damage change under shipped weights');
    await page.locator('#btn-rebal-reroll').click();
    await page.waitForFunction(() => document.querySelector('#rebal-variation-position').textContent.includes('Variation 2'));
    await page.locator('#btn-rebal-prev-variation').click();
    await page.locator('.rebalance-body').evaluate(node => { node.scrollTop = 0; });
    const geometry = await page.evaluate(() => {
      const box = selector => { const { x, y, width, height, bottom, right } = document.querySelector(selector).getBoundingClientRect(); return { x, y, width, height, bottom, right }; };
      return { dialog: box('#rebalance-modal'), header: box('.rebalance-header'), footer: box('.rebalance-footer'), summary: box('.rebalance-summary'), body: box('.rebalance-body'), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(geometry.overflow, false);
    assert.ok(geometry.header.bottom <= geometry.body.y + 1 && geometry.body.bottom <= geometry.footer.y + 1);
    assert.ok(geometry.footer.bottom <= viewport.height && geometry.dialog.right <= viewport.width);
    assert.ok(geometry.summary.y >= geometry.body.y && geometry.summary.y < geometry.footer.y, 'actual changes visible in first modal viewport');
    if (viewport.width > 650) assert.ok(geometry.dialog.height <= 640, 'desktop avoids blank filler below full cards');
    await page.screenshot({ path: join(evidence, `${viewport.width}x${viewport.height}.png`) });
    facts.push({ viewport, geometry, diff: await page.locator('#rebal-diff').innerText() });
    await page.locator('#btn-rebal-apply').click();
    await page.waitForFunction(() => !document.querySelector('#rebalance-modal').open);
    const applied = await page.evaluate(() => __comparisonQa.capture());
    assert.notDeepEqual(applied.cards.find(c => c.id === cards[0].id).effects, before.cards.find(c => c.id === cards[0].id).effects);
    const appliedMetrics = await page.evaluate(id => __comparisonQa.measure(id), cards[0].id);
    assert.equal(appliedMetrics.cp, targetCp);
    assert.equal(appliedMetrics.rank, targetRank);
    assert.notEqual(appliedMetrics.damage, original.damage);
    assert.deepEqual(applied.cards.filter(c => c.id !== cards[0].id), before.cards.filter(c => c.id !== cards[0].id), 'unselected cards remain byte-equivalent');
    await page.locator('#btn-undo').evaluate(node => node.click());
    assert.deepEqual(await page.evaluate(() => __comparisonQa.capture()), before, 'one Undo restores applied card, scoring and baseline ranks');
    await page.locator('input[data-card-selection="subclass.qa.compact-a"]').check();
    await page.locator('input[data-card-selection="subclass.qa.compact-b"]').check();
    await page.locator('#btn-quick-balance-cards').click();
    await page.locator('#rebalance-modal').waitFor();
    assert.equal(await page.locator('#rebal-card-navigation').isVisible(), true);
    await page.locator('#btn-rebal-next-card').click();
    assert.match(await page.locator('#rebal-card-position').innerText(), /2 of 2/);
    await page.locator('#rebalance-modal button[value="cancel"]').click();
    await page.locator('#tab-cards .gallery-content-type').selectOption('items');
    await page.locator('#btn-quick-balance-items').click();
    await page.locator('#rebalance-modal').waitFor();
    await page.locator('#rebal-scope').selectOption('current');
    assert.equal(await page.locator('#btn-rebal-next-card').getAttribute('aria-label'), 'Next item');
    assert.equal(await page.locator('#btn-rebal-next-card').getAttribute('title'), 'Next item');
    assert.equal(await page.locator('#rebal-effects-section').isVisible(), false);
    assert.equal(await page.locator('#rebal-navigation').isVisible(), false);
    assert.ok(await page.locator('#rebal-card-before').locator('.equipment-poker-card, .collectible-poker-card').count());
    await page.locator('#rebalance-modal button[value="cancel"]').click();
    assert.deepEqual(errors, []);
    await page.close();
  }
  // A generated card's inspector Delete must clean all list references, pins and baseline state, then Undo exactly.
  const catalog = GenerateSubclassCatalog({ subclassIds: ['bloodletter'], seed: 'delete-regression' }, { scoring });
  assert.equal(catalog.cards.length, 15);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/tools/score-studio/studio.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nglobalThis.__comparisonQa={capture:()=>JSON.parse(snapshotState()),measure:(id)=>{const card=state.cards.find(row=>row.id===id),face=withRebalancePreviewRegistry(()=>cardDefToFace(clone(card),state.scoring)),raw=ScoreCard(face,state.scoring).raw;return {damage:face.dmg,cp:CombatPower(raw,card.rarity,state.scoring),rank:RankOf(CombatPower(raw,card.rarity,state.scoring),state.scoring)};},seed:(id)=>{state.baselineRanks[id]=3;(state.scoring.overrides ||= {})[id]={rank:4,rarity:'common'};}};` });
  });
  await page.goto(`${server.url}tools/score-studio/`);
  await page.locator('.studio-card-tile').first().waitFor({ timeout: 120000 });
  await page.locator('#input-subclass-catalog').setInputFiles({ name: 'bloodletter.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(catalog)) });
  const id = catalog.cards[0].id;
  await page.locator(`[data-card-id="${id}"]`).waitFor();
  await page.locator('#subclass-catalog-modal').evaluate(node => node.close());
  await page.locator(`[data-card-id="${id}"]`).click();
  await page.evaluate(id => __comparisonQa.seed(id), id);
  const before = await page.evaluate(() => __comparisonQa.capture());
  await page.locator('#btn-delete-card').evaluate(node => node.click());
  const after = await page.evaluate(() => __comparisonQa.capture());
  assert.equal(after.cards.some(card => card.id === id), false);
  assert.equal(after.customDecks.some(deck => deck.cardIds?.includes(id)), false);
  assert.equal(after.subclassCatalog.lists.some(list => list.cardIds.includes(id)), false);
  assert.equal(after.baselineRanks[id], undefined);
  assert.equal(after.scoring.overrides[id], undefined);
  const { currentSubclassCatalog } = await import('../tools/score-studio/subclassCatalog.js');
  assert.equal(currentSubclassCatalog(after).cards.length, 14);
  await page.locator('#btn-undo').evaluate(node => node.click());
  assert.deepEqual(await page.evaluate(() => __comparisonQa.capture()), before, 'delete Undo restores exact cards/decks/catalog/scoring/baselineRanks');
  assert.equal(currentSubclassCatalog(await page.evaluate(() => __comparisonQa.capture())).cards.length, 15);
  await page.goto(`${server.url}docs/component-catalog.html`);
  await page.locator('#score-studio-composition').waitFor();
  await page.close();
  await writeFile(join(evidence, 'facts.json'), JSON.stringify(facts, null, 2));
  console.log(`PASS compact comparison, actual mechanics, versions, items, staged Apply/Undo and generated deletion. Evidence: ${evidence}`);
} finally { await browser.close(); await new Promise(resolve => server.server.close(resolve)); }
