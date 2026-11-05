// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/card-face-roomy.browser.mjs
// Real Chromium, the real fitter, every authored card (base and upgraded) at the phone hand, the phone reward door and
// the desktop glance width. The roomy face (cardFaceBudget.js) must never overflow its box, never drop under its floor
// font, and a long-rules card must show four or more lines at that floor; a one-liner must be left exactly as it was.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync, rmSync } from 'node:fs';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const page_ = 'zz-card-face-roomy.html';
writeFileSync(page_, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${['base', 'tokens.generated', 'ui', 'combat', 'kit', 'responsive-type', 'player-polish', 'illustrated-cards', 'combat-expansion'].map(n => `<link rel="stylesheet" href="/styles/${n}.css">`).join('')}
<div id="row" style="display:flex;gap:8px;flex-wrap:wrap"></div>
<script type="module">
import { contentBundle } from '/src/content/index.js';
import { createRegistries } from '/src/model/registries.js';
import { renderCard } from '/src/ui/components/card.js';
import { fitIllustratedCards } from '/src/ui/components/illustratedCardFitter.js';
const w = +new URLSearchParams(location.search).get('w'), reg = createRegistries(contentBundle), cards = [], ids = [];
for (const card of reg.cards.all()) for (const upgraded of [false, true]) {
  const el = renderCard(reg, { cardId: card.id, upgraded }, { level: 'glance', rules: { combatExpansionVersion: 2 }, only: [] });
  el.style.width = w + 'px'; document.getElementById('row').appendChild(el); cards.push(el); ids.push(card.id + (upgraded ? '+' : ''));
}
await document.fonts?.ready; fitIllustratedCards(cards); await new Promise(r => setTimeout(r, 300)); fitIllustratedCards(cards);
const receipt = { version: 1, targetId: 'foe', hits: [{ incoming: 13, hpLoss: 9, sources: [{ id: 'base', label: 'Base', amount: 13, stage: 'base' }] }], totalDamage: 9 };
window.__receiptCards = [];
for (const [cardId, id] of [['serratedBlade', 'roomy'], ['guardCounter', 'compact']]) {
  const el = renderCard(reg, { cardId }, { level: 'glance', rules: { combatExpansionVersion: 2 }, only: [], preview: { values: [{ op: 'damage', value: 13, hits: 1, damageReceipt: receipt }] } });
  el.style.width = w + 'px'; document.getElementById('row').appendChild(el); window.__receiptCards.push([id, el]);
}
await new Promise(r => setTimeout(r, 100)); fitIllustratedCards(window.__receiptCards.map(([, el]) => el)); await new Promise(r => setTimeout(r, 100)); fitIllustratedCards(window.__receiptCards.map(([, el]) => el));
window.__ids = ids; window.__cards = cards; window.__done = true;
</script>`);
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const rowOf = () => window.__cards.map((card, i) => {
  const text = card.querySelector('.ic-text[data-card-binding="rules"]'), layer = text.parentElement, face = card.querySelector('.illustrated-card-face');
  const font = parseFloat(text.style.fontSize), lineHeight = parseFloat(text.style.lineHeight) || 1.05;
  return { id: window.__ids[i], roomy: face.dataset.rulesRoomy, font, max: parseFloat(text.dataset.maxFont) * face.clientWidth / Number(face.dataset.designWidth),
    lines: Math.round(text.scrollHeight / (font * lineHeight)), tall: text.scrollHeight > layer.clientHeight + 1, wide: text.scrollWidth > text.clientWidth + 1 };
});
try {
  for (const [viewport, width] of [[{ width: 360, height: 800 }, 108], [{ width: 360, height: 800 }, 152], [{ width: 1366, height: 768 }, 182.4]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${server.url}${page_}?w=${width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__done', null, { timeout: 180000 });
    const rows = await page.evaluate(rowOf), label = `${viewport.width}x${viewport.height} card ${width}px`;
    assert.ok(rows.length >= 700, `${label}: every authored card rendered`);
    for (const row of rows) assert.ok(!row.tall && !row.wide, `${label}: ${row.id} overflows its rules box`);
    // The floor: 70% of the face's own full size, and never under 10 px unless the full size already is.
    for (const row of rows.filter(r => r.roomy === 'true')) {
      assert.ok(row.font >= row.max * 0.7 - 0.05, `${label}: ${row.id} fitted ${row.font}px, under 70% of ${row.max}px`);
      assert.ok(row.font >= Math.min(10, row.max) - 0.05, `${label}: ${row.id} fitted ${row.font}px, under the 10px floor`);
      assert.ok(row.lines <= 5, `${label}: ${row.id} shows ${row.lines} lines`);
    }
    assert.ok(rows.filter(r => r.roomy === 'true').length >= (width < 120 ? 50 : 200), `${label}: roomy faces are shown`);
    if (width >= 150) {
      const long = rows.find(r => r.id === 'serratedBlade');
      assert.equal(long.roomy, 'true'); assert.ok(long.lines >= 4, `${label}: serratedBlade shows ${long.lines} lines`); assert.ok(long.font < long.max, 'the long text shrank');
    }
    const one = rows.find(r => r.id === 'guardCounter');
    assert.notEqual(one.roomy, 'true', `${label}: a one-liner has no roomy reading`); assert.ok(Math.abs(one.font - one.max) < 0.05, `${label}: a one-liner keeps its full size`);
    // A damage receipt stays inspectable after the fit, whichever reading won (nodes kept, or clones rebound).
    const probes = await page.evaluate(async () => {
      const out = [];
      for (const [, el] of window.__receiptCards) {
        const face = el.querySelector('.illustrated-card-face'), nums = [...el.querySelectorAll('[data-face-kind="damage"] .val')];
        nums[0]?.click(); await new Promise(r => setTimeout(r, 400));
        out.push({ reading: el.querySelector('.ic-text[data-card-binding="rules"]').dataset.faceReading, roomy: face.dataset.rulesRoomy, count: nums.length,
          bound: nums.every(n => n.dataset.damageReceipt === 'true' && n.tabIndex === 0 && n.getAttribute('role') === 'button'),
          opened: document.body.textContent.includes('Damage calculation') });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); document.body.click(); await new Promise(r => setTimeout(r, 300));
      }
      return out;
    });
    for (const probe of probes) assert.ok(probe.count > 0 && probe.bound && probe.opened, `${label}: receipt lost after the fit ${JSON.stringify(probe)}`);
    if (width >= 150) assert.equal(probes[0].reading, 'roomy', `${label}: the receipt card took the roomy reading`);
    assert.equal(probes[1].reading, 'compact', `${label}: a one-liner keeps its painted nodes`);
    await page.close();
  }
  console.log('card-face-roomy browser: ok');
} finally { await browser.close(); await server.close?.(); rmSync(page_, { force: true }); }
process.exit(0);
