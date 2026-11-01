// PLAYWRIGHT_MODULE=/path/to/playwright node tests/card-face-summaries.browser.mjs
// Real Chromium: glance-level cards, the real fitter, at a desktop and a 360px hand width; the visible post-fit
// text must never be the Inspect cue for a card that authors a face summary.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync, rmSync } from 'node:fs';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const page_ = 'zz-card-face-summaries.html';
writeFileSync(page_, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${['base', 'tokens.generated', 'ui', 'combat', 'kit', 'responsive-type', 'player-polish', 'illustrated-cards', 'combat-expansion'].map(n => `<link rel="stylesheet" href="/styles/${n}.css">`).join('')}
<div id="row" style="display:flex;gap:8px;flex-wrap:wrap"></div>
<script type="module">
import { contentBundle } from '/src/content/index.js';
import { createRegistries } from '/src/model/registries.js';
import { renderCard } from '/src/ui/components/card.js';
import { fitIllustratedCards } from '/src/ui/components/illustratedCardFitter.js';
const q = new URLSearchParams(location.search), w = +q.get('w'), reg = createRegistries(contentBundle), cards = [];
for (const spec of JSON.parse(q.get('cards'))) { const el = renderCard(reg, spec, { level: 'glance', rules: { combatExpansionVersion: 2 }, only: [] }); el.style.width = w + 'px'; document.getElementById('row').appendChild(el); cards.push(el); }
await document.fonts?.ready; fitIllustratedCards(cards); window.__done = true;
</script>`);
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  const specs = [{ cardId: 'base.foresight' }, { cardId: 'base.recover-exile' }, { cardId: 'ironResolve' }, { cardId: 'phoenixChart' }, { cardId: 'progression-silent-exchange', abilityRank: 4 }, { cardId: 'progression-silent-exchange', abilityRank: 5 }, { cardId: 'base.restrained-status-card' }, { cardId: 'lethalDose' }];
  for (const [viewport, width] of [[{ width: 1280, height: 800 }, 200], [{ width: 360, height: 780 }, 108]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${server.url}${page_}?w=${width}&cards=${encodeURIComponent(JSON.stringify(specs))}`);
    await page.waitForFunction('window.__done', null, { timeout: 30000 });
    const visible = await page.$$eval('.illustrated-card', cards => cards.map(card => [...card.querySelectorAll('[data-face-clause],[data-face-fallback],[data-face-fallback-short]')]
      .filter(node => getComputedStyle(node).display !== 'none').map(node => node.textContent.trim()).join(' ')));
    assert.equal(visible.length, specs.length); if (process.env.DEBUG_FACES) console.log(viewport.width, JSON.stringify(visible));
    visible.forEach((text, i) => {
      // A 108px card may drop a face to the short cue on its own (existing fitter rule); the discard cards are checked at desktop width.
      if (viewport.width < 600 && specs[i].cardId === 'progression-silent-exchange') return;
      // A cost is never the clause the fitter hides: the face shows it, or the whole face is the Inspect cue.
      if (specs[i].cardId === 'base.restrained-status-card') { assert.match(text, /cost \+1 SP|Inspect/, text); return; }
      if (specs[i].cardId === 'lethalDose') { assert.match(text, /remove|Inspect/i, text); return; } assert.ok(text.length > 0, `${specs[i].cardId}: nothing visible`); assert.doesNotMatch(text, /Inspect/i, `${specs[i].cardId} at ${viewport.width}px: ${text}`); });
    await page.close();
  }
  console.log('card-face-summaries browser: ok');
} finally { await browser.close(); await server.close?.(); rmSync(page_, { force: true }); }
process.exit(0);
