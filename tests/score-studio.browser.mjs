// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/score-studio.browser.mjs
// Like the other tests/*.browser.mjs files it is run by hand: no workflow or run-node.mjs list picks these up.
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

  // 2b. The Score Breakdown formula adds up to the CP the inspector shows.
  const breakdown = await page.evaluate(() => ({
    formula: document.getElementById('breakdown-formula')?.textContent || '',
    summaryCp: document.querySelector('.inspector-score-big')?.textContent || '',
  }));
  const formulaParts = breakdown.formula.match(/^Raw (-?[\d.]+) − rarity (-?[\d.]+) = CP (-?[\d.]+)/);
  assert.ok(formulaParts, `breakdown formula line is shown (${breakdown.formula})`);
  assert.equal(Number(formulaParts[1]) - Number(formulaParts[2]), Number(formulaParts[3]), 'raw minus rarity equals CP in the formula');
  assert.equal(`CP ${formulaParts[3]}`, breakdown.summaryCp.trim(), 'the formula CP matches the inspector CP');

  // 2c. An edit that changes nothing the score reads keeps the score. The edited copy used to skip the game's
  //     card projection, so retyping Acid Splash's own name charged it an extra MP and dropped CP 13 to CP 5.
  const stable = await page.evaluate(() => {
    document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"]').click();
    const before = document.getElementById('breakdown-formula').textContent;
    const input = document.getElementById('edit-name');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { before, after: document.getElementById('breakdown-formula').textContent };
  });
  assert.equal(stable.after, stable.before, 'retyping the same name leaves the score unchanged');

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

  // 6. Removing the effects a card's text names flags the stale {tokens}, under the text box and on the tile.
  //    Acid Splash's text is "Apply {frail} Frail and {vulnerable} Vulnerable."
  const stale = await page.evaluate(() => {
    const tile = document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"]');
    tile.click();
    while (document.querySelector('#active-features-list [data-rm-eff]')) {
      document.querySelector('#active-features-list [data-rm-eff]').click();
    }
    return {
      warnings: document.getElementById('text-warnings').innerText,
      tileMarked: Boolean(document.querySelector('.studio-card-tile[data-card-id="core.acidSplash"] .text-warn-chip')),
    };
  });
  assert.match(stale.warnings, /Card text mentions \{frail\}, but the card has no Frail effect\./, 'a removed status is named as a stale token');
  assert.ok(stale.tileMarked, 'the gallery tile is marked when its card text has stale tokens');

  assert.deepEqual(pageErrors, [], 'no uncaught errors while editing');
  await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
  await page.close();
  console.log('score-studio browser: ok');
} finally {
  await browser.close();
  await server.close?.();
}
process.exit(0);
