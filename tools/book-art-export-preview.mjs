// Transparent composition exports from the same renderer used by the game.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = resolve('docs/preview/book-library/layers/composites');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 320, height: 320 } });
await page.route('**/src/buildversion.js', (route) => route.fulfill({ path: resolve('src/buildversion.js'), contentType: 'text/javascript' }));
try {
  await page.goto(`${process.env.BOOK_SHOP_URL || 'http://localhost:8768'}/docs/preview/book-library/layers/atelier.html`, { waitUntil: 'networkidle' });
  const ids = await page.evaluate(async () => {
    const { BOOK_ART_PRESETS } = await import('/src/content/bookArtPresets.js');
    document.body.replaceChildren(); document.body.style.cssText = 'margin:0;background:transparent'; document.documentElement.style.background = 'transparent';
    return Object.keys(BOOK_ART_PRESETS);
  });
  for (const id of ids) for (const cover of ['classic', 'scholar', 'field']) {
    await page.evaluate(async ({ id, cover }) => {
      const { renderBookArt } = await import('/docs/preview/book-library/layers/painted/render.js');
      const { BOOK_ART_PRESETS } = await import('/src/content/bookArtPresets.js');
      const book = renderBookArt({ id }, { recipe: { ...BOOK_ART_PRESETS[id], cover } });
      book.style.width = '320px'; document.body.replaceChildren(book);
      await Promise.all([...book.querySelectorAll('image')].map((node) => new Promise((done, fail) => {
        const img = new Image(); img.onload = done; img.onerror = fail; img.src = node.getAttribute('href');
      })));
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    }, { id, cover });
    await page.screenshot({ path: resolve(out, `${id}-${cover}.png`), omitBackground: true, animations: 'disabled' });
  }
  console.log('Exported 30 transparent book compositions (10 identities × 3 covers).');
} finally { await browser.close(); }
