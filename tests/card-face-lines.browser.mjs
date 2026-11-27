// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/card-face-lines.browser.mjs [--out <dir>] [--only id,id]
// Owner, 2026-11-17: the card face shows its real effect in a rules box of up to four lines of 20-25 characters,
// with 1px of inner padding, no bleed, and no single-word line except the last. Real Chromium, the game's own
// stylesheets, the real renderer and the real fitter, every player card (base and upgraded) under the default
// profile, at the phone (390x844) hand and inspector widths and the desktop (1280x800) hand and inspector widths.
// --out writes a screenshot of each width's row; --only limits the cards (for QA screenshots).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const out = arg('--out'), only = arg('--only');
// The game's stylesheets, in the order index.html loads them.
const sheets = [...readFileSync('index.html', 'utf8').matchAll(/href="(styles\/[^"]+\.css)"/g)].map(m => m[1]);
const page_ = 'zz-card-face-lines.html';
writeFileSync(page_, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${sheets.map(href => `<link rel="stylesheet" href="/${href}">`).join('')}
<body style="background:#222;margin:0"><div id="row" style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;padding:6px"></div>
<script type="module">
import { contentBundle } from '/src/content/index.js';
import { createRegistries } from '/src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '/src/model/gameProfile.js';
import { renderCard } from '/src/ui/components/card.js';
import { fitIllustratedCards } from '/src/ui/components/illustratedCardFitter.js';
const query = new URLSearchParams(location.search), w = +query.get('w'), level = query.get('level'), only = query.get('only');
if (query.get('phone') === '1') document.documentElement.dataset.formFactor = 'mobile';
const profile = resolveGameProfile('default');
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const rules = { combatExpansionVersion: 2, gameProfile: profile }, cards = [], ids = [];
const wanted = only ? only.split(',') : reg.cards.all().map(card => card.id);
for (const id of wanted) for (const upgraded of only ? [false] : [false, true]) {
  const el = renderCard(reg, { cardId: id, upgraded }, { level, rules, only: [] });
  el.style.width = w + 'px'; el.style.flex = '0 0 auto'; document.getElementById('row').appendChild(el); cards.push(el); ids.push(id + (upgraded ? '+' : ''));
}
await document.fonts?.ready; fitIllustratedCards(cards); await new Promise(r => setTimeout(r, 300)); fitIllustratedCards(cards);
// The rendered lines of a rules row: a word (which may span several text nodes, "1" + ".") sits on the line of its first rect.
const linesOf = text => {
  const nodes = [], walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  let all = '';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) { nodes.push({ node, start: all.length }); all += node.data; }
  const at = index => { let i = nodes.length - 1; while (i > 0 && nodes[i].start > index) i--; return [nodes[i].node, index - nodes[i].start]; };
  const words = [];
  for (const match of all.matchAll(/\\S+/g)) {
    const range = document.createRange(); range.setStart(...at(match.index)); range.setEnd(...at(match.index + match[0].length - 1)); range.setEnd(range.endContainer, range.endOffset + 1);
    const rect = range.getClientRects()[0]; if (rect) words.push({ word: match[0], top: rect.top, height: rect.height });
  }
  const lines = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(word.top - last.top) < word.height / 2) last.words.push(word.word); else lines.push({ top: word.top, words: [word.word] });
  }
  return lines.map(line => line.words.join(' '));
};
window.__rows = cards.map((card, i) => {
  const text = card.querySelector('.ic-text[data-card-binding="rules"]'), layer = text.parentElement;
  const box = layer.getBoundingClientRect(), inner = text.getBoundingClientRect(), style = getComputedStyle(text);
  const lines = linesOf(text);
  const words = [...text.querySelectorAll('*'), text].length && lines;
  // Bleed: the line boxes leave the rules box, or a glyph run leaves it sideways (0.5px rounding allowance). A glyph's
  // content box is taller than a 1.05 line box, so the vertical test is on the text's own box, not each run's.
  let bleed = text.scrollHeight > layer.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1
    || inner.top < box.top - 0.5 || inner.bottom > box.bottom + 0.5;
  const range = document.createRange(); range.selectNodeContents(text);
  for (const rect of range.getClientRects()) if (rect.width && (rect.left < box.left - 0.5 || rect.right > box.right + 0.5)) bleed = true;
  return { id: ids[i], text: lines.join(' / '), lines, bleed, clipped: style.webkitLineClamp !== 'none' && style.webkitLineClamp !== 'unset' && style.webkitLineClamp !== '' && style.display === '-webkit-box',
    padding: parseFloat(style.paddingTop), font: parseFloat(style.fontSize), maxChars: Math.max(...lines.map(line => line.length)) };
});
window.__done = true;
</script>`);
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
// Card widths measured in the running game (?shot=combat): the hand card and the inspector's card at each viewport.
const SURFACES = [
  { label: 'phone hand', viewport: { width: 390, height: 844 }, width: 123, level: 'glance', phone: true },
  { label: 'phone inspector', viewport: { width: 390, height: 844 }, width: 130, level: 'inspect', phone: true },
  { label: 'desktop hand', viewport: { width: 1280, height: 800 }, width: 172, level: 'glance', phone: false },
  { label: 'desktop inspector', viewport: { width: 1280, height: 800 }, width: 235, level: 'inspect', phone: false },
];
const failures = [];
try {
  if (out) mkdirSync(out, { recursive: true });
  for (const surface of SURFACES) {
    const page = await browser.newPage({ viewport: surface.viewport, deviceScaleFactor: out ? 2 : 1 });
    await page.goto(`${server.url}/${page_}?w=${surface.width}&level=${surface.level}&phone=${surface.phone ? 1 : 0}${only ? `&only=${only}` : ''}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__done', null, { timeout: 300000 });
    const rows = await page.evaluate(() => window.__rows);
    if (!only) assert.ok(rows.length >= 700, `${surface.label}: every player card rendered (${rows.length})`);
    for (const row of rows) {
      const where = `${surface.label}: ${row.id} "${row.text}"`;
      if (row.bleed) failures.push(`${where} bleeds out of its rules box`);
      if (row.clipped) failures.push(`${where} is clipped with an ellipsis`);
      if (row.lines.length > 4) failures.push(`${where} runs to ${row.lines.length} lines`);
      if (row.padding < 1) failures.push(`${where} has ${row.padding}px inner padding`);
      const lone = row.lines.slice(0, -1).find(line => !/\s/.test(line.trim()));
      if (lone) failures.push(`${where} has the single-word line "${lone}" before its last line`);
    }
    if (out) {
      await page.screenshot({ path: `${out}/${surface.label.replace(/\s+/g, '-')}.png`, fullPage: true });
      writeFileSync(`${out}/${surface.label.replace(/\s+/g, '-')}.json`, JSON.stringify(rows, null, 1));
    }
    console.log(`${surface.label}: ${rows.length} faces measured`);
    await page.close();
  }
  if (out) writeFileSync(`${out}/failures.txt`, failures.join('\n'));
  if (failures.length) console.log(failures.slice(0, 60).join('\n') + (failures.length > 60 ? `\n... ${failures.length - 60} more` : ''));
  assert.equal(failures.length, 0, `${failures.length} card faces break the four-line box`);
  console.log('card-face-lines browser: ok');
} finally { await browser.close(); await server.close?.(); rmSync(page_, { force: true }); }
process.exit(0);
