import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve('art/manual-shop-2026-10-02/qa');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
// The authoring preview does not need serve.mjs to hash the entire checkout
// for each version-module request. Keep its raw UNSTAMPED identity; the
// separate packed-game test checks the actual final artifact.
await page.route('**/src/buildversion.js', (route) => route.fulfill({ path: resolve('src/buildversion.js'), contentType: 'text/javascript' }));
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const url = `${process.env.BOOK_SHOP_URL || 'http://localhost:8768'}/art/manual-shop-2026-10-02/preview.html?library=1`;
const open = async () => { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.getByRole('button', { name: 'Read Spellbook', exact: true }).waitFor(); };
try {
  await open();
  await page.getByRole('button', { name: 'Read Spellbook', exact: true }).click();
  const spell = await page.evaluate(() => {
    const { run, registries } = window.bookShopPreview;
    return [...document.querySelectorAll('.book-lesson-option')].map((node) => node.dataset.lessonId).find((id) => !registries.classes.get(run.class).cardPool.includes(id));
  });
  assert.ok(spell);
  await page.locator(`[data-lesson-id="${spell}"]`).click();
  await page.locator('.book-learning-panel').screenshot({ animations: 'disabled', path: resolve(output, 'learning-spellbook.png') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.consumables.spellbook), 1);
  await page.getByRole('button', { name: 'Read Spellbook', exact: true }).click();
  await page.locator(`[data-lesson-id="${spell}"]`).click();
  await page.locator('.book-learning-confirm').click();
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.skills['item:magic-focus'].xp), 40);
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.deck.at(-1).cardId), spell);
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.consumables.spellbook), undefined);
  console.log('PASS: cross-class spell, cancel, XP and single consumption');
  await page.getByRole('button', { name: 'Read Starseer Class Book', exact: true }).click();
  await page.locator('[data-lesson-id="starseer"]').click();
  await page.locator('.book-learning-confirm').click();
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.class), 'reaver');
  await page.getByRole('button', { name: 'Inventory & class cards', exact: true }).click();
  const pickClass = async (id) => { await page.locator(`.inventory-face[data-inventory-item="class:${id}"]`).click(); };
  await pickClass('starseer');
  await page.locator('.armoury-class-action:visible').click();
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.class), 'starseer');
  await pickClass('starseer');
  await page.locator('.armoury-class-action:visible').click();
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.zones.core), null);
  await page.screenshot({ animations: 'disabled', path: resolve(output, 'learning-classless.png'), fullPage: true });
  await pickClass('reaver');
  await page.locator('.armoury-class-action:visible').click();
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.class), 'reaver');
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.skills['class:starseer'].xp), 40);
  console.log('PASS: class learning, equip, empty slot and progress retention');
  const responsive = [];
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await open();
    await page.getByRole('button', { name: 'Read Universal Tome', exact: true }).click();
    await page.locator('#book-learning-track').selectOption('item:shield');
    const pick = page.locator('.book-lesson-option[data-lesson-kind="card"]').first();
    await pick.focus(); await page.keyboard.press('Enter');
    const bounds = await page.locator('.book-learning-panel').evaluate((node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, scroll: node.scrollWidth, client: node.clientWidth }; });
    assert.ok(bounds.left >= -1 && bounds.right <= width + 1 && bounds.scroll <= bounds.client + 1, JSON.stringify(bounds));
    await page.screenshot({ animations: 'disabled', path: resolve(output, `learning-universal-${width}.png`), fullPage: true });
    await page.locator('.book-learning-confirm').click();
    assert.equal(await page.evaluate(() => window.bookShopPreview.run.skills['item:shield'].xp), 40);
    responsive.push({ width, ...bounds });
  }
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'learning-browser-results.json'), JSON.stringify({ passed: true, versionModule: 'raw authoring module; no server digest injection', crossClassSpell: spell, responsive, errors }, null, 2));
  console.log('PASS: mobile layout, keyboard choice, universal XP track; no runtime/network errors');
} finally { await browser.close(); }
