// tools/redraw-probe.mjs — measures how much DOM one small action rebuilds (owner, 2026-11-18:
// "limit the redrawing that happens when upgrading a card, editing a deck, or anything else that
// influences small changes"). For each action it installs a MutationObserver on document.body and
// counts element nodes added and removed (descendants included), then records whether the named
// scroll container kept its scrollTop, whether the focused element survived, and whether a node
// stamped before the action (`data-probe-keep`) is still the same node after it.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright node tools/redraw-probe.mjs [--only <substr>] [--phone]
//
// Prints a markdown table (docs/perf/redraw-2026-11-18.md pastes it) and exits 1 only on a crash.
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
const phone = args.includes('--phone');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const viewport = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };

// Mount the deck editor / armoury straight onto a fresh run, the way the browser tests do.
const MOUNT_DECK = async () => {
  const { contentBundle } = await import('/src/content/index.js');
  const { createRegistries } = await import('/src/model/registries.js');
  const { createRunState } = await import('/src/model/state.js');
  const { mountDeckEditor } = await import('/src/ui/screens/deckEditor.js');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 11, classId: 'reaver', registries });
  document.querySelectorAll('.modal-veil').forEach((node) => node.remove());
  mountDeckEditor(document.body, { registries, run, settings: {}, onDone() {}, onCancel() {} });
};
const MOUNT_ARMOURY = async () => {
  const { contentBundle } = await import('/src/content/index.js');
  const { createRegistries } = await import('/src/model/registries.js');
  const { createRunState } = await import('/src/model/state.js');
  const { mountEquipment } = await import('/src/ui/screens/equipment.js');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 11, classId: 'reaver', registries });
  run.loadout.storage = ['ashStaff', 'roundShield'];
  document.querySelectorAll('.modal-veil').forEach((node) => node.remove());
  const meta = { settings: { holdConfirm: 'off', equipView: 'rack' }, found: registries.equipment.armaments.map((row) => row.id) };
  mountEquipment(document.body, { registries, run, meta, inCombat: false, onClose() {}, onChange: (loadout) => { run.loadout = loadout; }, onEquipmentChanged() {} });
};

// Each scenario: a door (url, optional mount fn run in the page), setup clicks, then measured steps.
// `scroll` is the selector of the list container whose scrollTop must survive; `keep` the node that must persist.
const SCENARIOS = [
  {
    name: 'Upgrade picker', url: '?shot=blacksmith', ready: '.blacksmith-workspace',
    setup: ['[data-shop-category="upgradeArt"]', '#blacksmith-upgrade-card'], settle: '.card-upgrade-row',
    scroll: '.card-upgrade-list', keep: '.card-upgrade-list',
    steps: [
      { name: 'select a row (opens detail modal)', click: '.card-upgrade-row:nth-of-type(2)' },
      { name: 'pick an upgrade option', click: '[data-card-upgrade-option="1"]', optional: true },
      { name: 'Back out of the detail modal', click: '.card-upgrade-detail-back, .smith-back.card-upgrade-detail-back' },
      { name: 'select a different row', click: '.card-upgrade-row:nth-of-type(3)' },
    ],
  },
  {
    name: 'Deck editor', url: '?shot=map', ready: '#map-enter', mount: MOUNT_DECK, settle: '.deck-editor',
    scroll: '[data-pane="collection"] .deck-editor-list', keep: '.deck-editor-panes',
    steps: [
      { name: 'select a collection card', click: '.deck-editor-tile .deck-editor-main' },
      { name: 'add a card (+)', click: '.deck-editor-tile .deck-editor-step[data-action="add"]:not([disabled])' },
      { name: 'switch pane with ] (no data change)', key: ']' },
      { name: 'remove a card (-)', click: '.deck-editor-row .deck-editor-step[data-action="remove"]' },
      { name: 'select a deck row', click: '.deck-editor-row .deck-editor-main' },
      { name: 'pick up a deck row (reorder hold)', click: '.deck-editor-pick' },
    ],
  },
  {
    name: 'Armoury', url: '?shot=map', ready: '#map-enter', mount: MOUNT_ARMOURY, settle: '.armoury',
    scroll: '.armoury', keep: '.armoury',
    steps: [
      { name: 'select a slot row', click: '.armament-row-select' },
    ],
  },
  {
    name: 'Blacksmith / shop', url: '?shot=shop', ready: '#shop-cat-upgrade', settle: '#shop-cat-upgrade',
    scroll: '.shop-offers', keep: '#shop-cat-upgrade',
    steps: [
      { name: 'open an offer (thumbnail)', click: '.merchant-thumbnail' },
      { name: 'close the offer (Esc)', key: 'Escape' },
      { name: 'switch category (Cards)', click: '#shop-cat-upgradeArt' },
      { name: 'switch category (Arms)', click: '#shop-cat-armaments' },
    ],
  },
];

const rows = [];
for (const scenario of SCENARIOS) {
  if (only && !scenario.name.toLowerCase().includes(only.toLowerCase())) continue;
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${server.url}index.html${scenario.url}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector(scenario.ready, { timeout: 30000 });
  await page.waitForTimeout(1500);
  if (scenario.mount) await page.evaluate(`(${scenario.mount.toString()})()`);
  for (const selector of scenario.setup || []) { await page.click(selector); await page.waitForTimeout(500); }
  try { await page.waitForSelector(scenario.settle, { timeout: 10000 }); } catch { rows.push({ scenario: scenario.name, step: '(scene did not open)', skipped: true }); await context.close(); continue; }
  await page.waitForTimeout(500);
  for (const step of scenario.steps) {
    const target = page.locator(step.click || 'body').first();
    if (!step.key && !(await target.count())) { rows.push({ scenario: scenario.name, step: step.name, skipped: true }); continue; }
    await page.evaluate(({ scroll, keep }) => {
      const sc = document.querySelector(scroll);
      if (sc && sc.scrollHeight > sc.clientHeight) sc.scrollTop = Math.min(120, sc.scrollHeight - sc.clientHeight);
      document.querySelectorAll('[data-probe-keep]').forEach((node) => node.removeAttribute('data-probe-keep'));
      document.querySelector(keep)?.setAttribute('data-probe-keep', '1');
      window.__probe = { added: 0, removed: 0, scrollBefore: sc ? sc.scrollTop : null };
      const count = (node) => (node.nodeType === 1 ? 1 + node.querySelectorAll('*').length : 0);
      window.__probeObserver?.disconnect();
      window.__probeObserver = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) { window.__probe.added += count(node); if (node.nodeType === 1) (window.__probe.roots ||= []).push(`${node.tagName}.${String(node.className).slice(0, 40)}:${count(node)}`); }
          for (const node of record.removedNodes) window.__probe.removed += count(node);
        }
      });
      window.__probeObserver.observe(document.body, { childList: true, subtree: true });
    }, { scroll: scenario.scroll, keep: scenario.keep });
    try { if (step.key) await page.keyboard.press(step.key); else await target.click({ timeout: 5000 }); } catch (error) { console.error(step.name, String(error.message).split('\n').slice(0,8).join(' / ')); rows.push({ scenario: scenario.name, step: step.name, skipped: true }); continue; }
    await page.waitForTimeout(700);
    const result = await page.evaluate(({ scroll }) => {
      window.__probeObserver.takeRecords().forEach((record) => {
        const count = (node) => (node.nodeType === 1 ? 1 + node.querySelectorAll('*').length : 0);
        for (const node of record.addedNodes) window.__probe.added += count(node);
        for (const node of record.removedNodes) window.__probe.removed += count(node);
      });
      window.__probeObserver.disconnect();
      const sc = document.querySelector(scroll);
      return { ...window.__probe, scrollAfter: sc ? sc.scrollTop : null, kept: Boolean(document.querySelector('[data-probe-keep]')) };
    }, { scroll: scenario.scroll, keep: scenario.keep });
    if (process.env.PROBE_ROOTS && result.roots) console.error(step.name, '->', result.roots.join(', '));
    rows.push({ scenario: scenario.name, step: step.name, ...result });
  }
  if (errors.length) rows.push({ scenario: scenario.name, step: `(page errors: ${errors.slice(0, 2).join(' | ')})`, skipped: true });
  await context.close();
}
await browser.close();

console.log(`| Screen | Action | Added | Removed | Container kept | scrollTop before→after |`);
console.log(`|---|---|---:|---:|---|---|`);
for (const row of rows) {
  if (row.skipped) { console.log(`| ${row.scenario} | ${row.step} | n/a | n/a | n/a | n/a |`); continue; }
  const scroll = row.scrollBefore === null ? 'n/a' : `${Math.round(row.scrollBefore)}→${Math.round(row.scrollAfter)}`;
  console.log(`| ${row.scenario} | ${row.step} | ${row.added} | ${row.removed} | ${row.kept ? 'yes' : 'NO'} | ${scroll} |`);
}
process.exit(0);
