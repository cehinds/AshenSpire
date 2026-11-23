// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/score-studio.browser.mjs
// Real Chromium on the real Score Studio page (tools/score-studio/). Guards the audit's broken basics:
// card faces render at card size (the game's card stylesheets are linked), an edit reaches the local
// draft (auto-save runs after the edit, not before), and the card face shows what the inspector edits.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');

const CORE_POOL_SIZE = 106;
const DRAFT_KEY = 'ashenspire:scoreStudioDraft:v1';
const DRAFT_SETTLE_MS = 400;
const STUDIO_PATH = 'tools/score-studio/';

const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${server.url}${STUDIO_PATH}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction((count) => document.querySelectorAll('.studio-card-tile').length >= count, CORE_POOL_SIZE, { timeout: 120000 });

  // 1. The gallery holds the core pool, and the page raised no errors while booting.
  const tiles = await page.locator('.studio-card-tile').count();
  assert.equal(tiles, CORE_POOL_SIZE, `gallery shows the ${CORE_POOL_SIZE}-card core pool`);
  assert.deepEqual(pageErrors, [], 'no uncaught errors while the studio boots');

  // 2. A card face is card-shaped. Without illustrated-cards.css its layers stack in flow and the face runs
  //    over ten times taller than it is wide.
  const face = await page.evaluate(() => {
    const box = document.querySelector('.studio-card-stage .illustrated-card-face').getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  assert.ok(face.width > 0 && face.height < face.width * 2, `card face is card-shaped (${Math.round(face.width)}x${Math.round(face.height)})`);

  // 3. A weight edit reaches the local draft. The draft used to be written before the edit was applied.
  const draftWeight = await page.evaluate(async ({ key, settle }) => {
    document.querySelector('.studio-tab[data-tab="weights"]').click();
    const input = document.querySelector('#weights-container input');
    const next = Number(input.value) + 3;
    input.value = String(next);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, settle));
    document.querySelector('.studio-tab[data-tab="cards"]').click();
    return { next, saved: JSON.parse(localStorage.getItem(key))?.scoring?.costs?.sp?.weight };
  }, { key: DRAFT_KEY, settle: DRAFT_SETTLE_MS });
  assert.equal(draftWeight.saved, draftWeight.next, 'the draft holds the weight just typed');

  // 4. Renaming the selected card changes the name on its tile.
  const renamed = await page.evaluate(() => {
    const name = 'Studio Smoke Name';
    const input = document.getElementById('edit-name');
    input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const selected = document.querySelector('.studio-card-tile.is-selected .studio-card-stage');
    return { name, tileText: selected.innerText };
  });
  assert.ok(renamed.tileText.includes(renamed.name), 'the tile shows the edited name');

  // 5. Changing the SP cost changes the cost shown on the inspector's card.
  const cost = await page.evaluate(() => {
    const shown = () => document.querySelector('#inspector-card-preview [data-card-binding="stamina"]')?.textContent.trim();
    const input = document.getElementById('edit-sp');
    const next = Number(input.value) + 2;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { next: String(next), shown: shown() };
  });
  assert.equal(cost.shown, cost.next, 'the inspector card shows the edited SP cost');

  assert.deepEqual(pageErrors, [], 'no uncaught errors while editing');
  await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
  await page.close();
  console.log('score-studio browser: ok');
} finally {
  await browser.close();
  await server.close?.();
}
process.exit(0);
