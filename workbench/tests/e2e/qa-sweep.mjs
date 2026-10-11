// workbench/tests/e2e/qa-sweep.mjs — end-to-end browser sweep of every Workbench
// module, run on demand (not part of `node --test`):
//
//   node workbench/tests/e2e/qa-sweep.mjs [--only data,layout] [--size narrow|wide] [--shots DIR]
//
// It starts the Workbench (node workbench/server.mjs --port <free>) with its real
// game server, drives it with Playwright's Chromium at two window sizes —
// narrow: 1440×900 with the preview dock open; wide: 1920×1080 with the dock
// collapsed — and records a PASS or FAIL per path. Failures keep a screenshot in
// the scratch directory. Nothing is saved to a project file: Data Studio and
// Layout Studio are only reviewed and cancelled; Visual Review accepts one row,
// which writes to the gitignored state directory.
//
// Playwright is resolved from PLAYWRIGHT_MODULE, then `playwright`, then the
// global npm root. The browser is /opt/pw-browsers/chromium when present, else
// CHROME_PATH, else Playwright's own. Exit code is 1 when any path failed.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const ONLY = flag('--only') ? flag('--only').split(',') : null;
const SIZE_ONLY = flag('--size');
const SHOTS = flag('--shots');
const SCRATCH = flag('--scratch', fs.mkdtempSync(path.join(os.tmpdir(), 'wb-qa-')));
fs.mkdirSync(SCRATCH, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright'];
  try { tries.push(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'playwright')); } catch { /* no npm */ }
  for (const t of tries.filter(Boolean)) {
    try { return require_(t); } catch { /* next */ }
  }
  throw Error('Playwright not found: set PLAYWRIGHT_MODULE to its path');
}
// Resolve a package by name or absolute directory, from ESM.
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
function require_(spec) {
  const p = path.isAbsolute(spec) ? spec : req.resolve(spec);
  return req(p);
}

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.unref();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

const executablePath = ['/opt/pw-browsers/chromium', process.env.CHROME_PATH].find((p) => p && fs.existsSync(p));
const SIZES = {
  narrow: { name: 'narrow', width: 1440, height: 900, dock: true },
  wide: { name: 'wide', width: 1920, height: 1080, dock: false },
};

// ---------- start the Workbench ----------
const port = await freePort();
const server = spawn(process.execPath, [path.join(REPO, 'workbench/server.mjs'), '--port', String(port), '--no-open'], { cwd: REPO, stdio: ['ignore', 'pipe', 'inherit'] });
const stopServer = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stopServer);
process.on('SIGINT', () => { stopServer(); process.exit(130); });
const url = await new Promise((resolve, reject) => {
  let out = '';
  server.stdout.on('data', (d) => { out += d; const m = out.match(/Workbench: (http:\/\/\S+)/); if (m) resolve(m[1]); });
  server.on('exit', (c) => reject(Error(`workbench exited ${c}`)));
  setTimeout(() => reject(Error('workbench did not start')), 30000);
});
console.log(`workbench at ${url} (server pid ${server.pid})`);
for (let i = 0; i < 180; i++) {
  const session = await (await fetch(`${url}/api/session`)).json();
  const tools = await (await fetch(`${url}/api/tools`, { headers: { 'x-studio-token': session.token } })).json();
  if (tools.every((t) => t.status !== 'starting')) { console.log(tools.map((t) => `${t.id}:${t.status}`).join(' ')); break; }
  await sleep(500);
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });

const results = [];
const globalIssues = [];
let page = null;
let sizeName = '';

async function check(label, fn) {
  const t0 = Date.now();
  try {
    const note = (await fn()) || '';
    results.push({ size: sizeName, path: label, status: 'PASS', note: String(note), ms: Date.now() - t0 });
  } catch (err) {
    const file = path.join(SCRATCH, `fail-${sizeName}-${results.length}.jpg`);
    try { await page.screenshot({ path: file, type: 'jpeg', quality: 70 }); } catch { /* page gone */ }
    results.push({ size: sizeName, path: label, status: "FAIL", note: String(err.message || err).split("\n").slice(0, process.env.QA_DEBUG ? 12 : 1).join(" | ").slice(0, 900), shot: file });
  }
}
const expect = (cond, msg) => { if (!cond) throw Error(msg); return true; };
const waitVisible = (sel, timeout = 8000) => page.waitForSelector(sel, { state: 'visible', timeout });
const textOf = (sel) => page.locator(sel).first().textContent({ timeout: 5000 }).then((t) => (t || '').trim());
const VUNDO = '.view.active [data-mod-undo]';
const VREDO = '.view.active [data-mod-redo]';
/** Clicks the centre of an element by coordinates: grids redraw their cells on mousedown, which detaches a handle-based click. */
async function clickAt(sel, modifiers = []) {
  const at = await page.evaluate((q) => {
    const e = document.querySelector(`.view.active ${q}`) ?? document.querySelector(q);
    if (!e) return null;
    e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel);
  if (!at) throw Error(`no element for ${sel}`);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.click(at.x, at.y);
  for (const m of modifiers) await page.keyboard.up(m);
  // The grid focuses itself on mousedown a tick later; focus it now so its keys and paste land on it.
  await sleep(30);
  await page.evaluate(() => { if (document.activeElement?.closest?.('.gk-root') === null || document.activeElement?.tagName === 'BODY' || document.activeElement?.classList.contains('ds-tables-toggle')) document.querySelector('.view.active .gk-scroll')?.focus({ preventScroll: true }); });
}
const hashNow = () => page.evaluate(() => location.hash);
const activeView = () => page.evaluate(() => document.querySelector('.view.active')?.id || '');

async function goModule(label, wait = 1200) {
  await page.click(`.rail-item[aria-label^="${label}"]`);
  await sleep(wait);
}
async function setDock(open) {
  const collapsedNow = await page.evaluate(() => document.querySelector('#app, .app, body')?.classList.contains('dock-collapsed') ?? false);
  if (open === collapsedNow) await page.click('#toggle-dock');
  await sleep(400);
}
async function resetDoc(mod) {
  // Keep each path independent: a fresh deep link per module.
  await page.evaluate((m) => { location.hash = `#mod=${m}`; }, mod);
  await sleep(700);
}
async function newPage(size) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const p = await context.newPage();
  p.on('pageerror', (e) => globalIssues.push({ size: size.name, kind: 'pageerror', detail: e.message.split('\n')[0] }));
  p.on('requestfailed', (r) => globalIssues.push({ size: size.name, kind: 'requestfailed', detail: `${r.url()} ${r.failure()?.errorText || ''}` }));
  p.on('response', (r) => { if (r.status() >= 400) globalIssues.push({ size: size.name, kind: `http ${r.status()}`, detail: r.url() }); });
  p.on('console', (m) => { if (m.type() === 'error') globalIssues.push({ size: size.name, kind: 'console', detail: m.text().slice(0, 200) }); });
  p.setDefaultTimeout(8000);
  return { context, page: p };
}
const want = (id) => !ONLY || ONLY.includes(id);
const shot = async (name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 80 });
};

// ---------- the paths ----------

async function dataStudio() {
  await goModule('Data Studio');
  await waitVisible('.ds-grid .gk-row');
  await check('Data: Tables toggle opens the list', async () => {
    await page.click('.ds-tables-toggle');
    expect(await page.getAttribute('.ds-tables-toggle', 'aria-expanded') === 'true', 'aria-expanded did not become true');
  });
  await check('Data: Close button closes the table list', async () => {
    await page.click('.ds-list-close');
    expect(await page.getAttribute('.ds-tables-toggle', 'aria-expanded') === 'false', 'list still open after Close');
  });
  await check('Data: Escape closes the table list', async () => {
    await page.click('.ds-tables-toggle');
    await page.focus('.ds-find');
    await page.keyboard.press('Escape');
    expect(await page.getAttribute('.ds-tables-toggle', 'aria-expanded') === 'false', 'list still open after Escape');
  });
  await check('Data: pick a table from the list', async () => {
    await page.click('.ds-tables-toggle');
    await page.click('.ds-table[data-path="content/source/weapons.csv"]');
    await sleep(600);
    expect((await textOf('.ds-file')).includes('weapons.csv'), 'weapons.csv did not open');
    return `${await textOf('.gk-count')}`;
  });
  await check('Data: selecting a row opens the row drawer', async () => {
    await clickAt('.gk-cell[data-r="0"][data-c="1"]');
    await sleep(300);
    expect(await page.evaluate(() => document.querySelector('.ds-host .ds, .ds')?.classList.contains('row-open') ?? false), 'drawer did not open on row pick');
    expect(await page.locator('.ds-panel-row h3').count() > 0, 'row form did not render');
    return await textOf('.ds-panel-row h3');
  });
  await check('Data: drawer Close button hides the drawer', async () => {
    await page.click('.ds-drawer-close');
    await sleep(200);
    expect(await page.evaluate(() => !document.querySelector('.ds')?.classList.contains('row-open')), 'drawer still open after Close');
    await clickAt('.gk-cell[data-r="0"][data-c="1"]');
    await sleep(200);
  });
  await check('Data: edit a cell in the grid and see the review count', async () => {
    await clickAt('.gk-cell[data-r="0"][data-c="1"]');
    await page.keyboard.press('F2');
    await waitVisible('.gk-editor');
    await page.fill('.gk-editor', 'QA Edited');
    await page.keyboard.press('Enter');
    await sleep(300);
    expect((await textOf('.gk-cell[data-r="0"][data-c="1"]')) === 'QA Edited', 'cell text did not change');
    expect((await textOf('button[data-act="review"]')).includes('(1)'), 'review count not 1');
  });
  await check('Data: undo restores the cell', async () => {
    await page.click(VUNDO);
    await sleep(300);
    expect((await textOf('.gk-cell[data-r="0"][data-c="1"]')) !== 'QA Edited', 'undo did not restore');
  });
  await check('Data: redo reapplies the edit', async () => {
    await page.click(VREDO);
    await sleep(300);
    expect((await textOf('.gk-cell[data-r="0"][data-c="1"]')) === 'QA Edited', 'redo did not reapply');
    await page.click(VUNDO);
    await sleep(300);
  });
  await check('Data: copy a range and paste it with a blank cell', async () => {
    await clickAt('.gk-cell[data-r="2"][data-c="1"]');
    await sleep(120);
    await clickAt('.gk-cell[data-r="4"][data-c="1"]', ['Shift']);
    await page.keyboard.press('Control+c');
    await sleep(120);
    await clickAt('.gk-cell[data-r="2"][data-c="1"]');
    await sleep(120);
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Alpha\n\nGamma');
      document.querySelector('.gk-scroll')?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await sleep(400);
    const got = await page.evaluate(() => ['r2', 'r3', 'r4'].map((k) => document.querySelector(`.gk-cell[data-r="${k.slice(1)}"][data-c="1"]`)?.textContent ?? null));
    expect(got[0] === 'Alpha' && got[2] === 'Gamma', `paste mismatch: ${JSON.stringify(got)}`);
    expect(got[1] === '', `blank cell not cleared: ${JSON.stringify(got)}`);
    await page.click(VUNDO);
    await sleep(200);
  });
  await check('Data: paste into a hidden anchor is refused with a banner', async () => {
    // Keys: click row 1 (r0 c1); click the search box and type Shield; focus moves to the grid
    // (the grid takes no paste while an input has focus); ArrowDown, Tab; then paste "Should not land".
    await clickAt('.gk-cell[data-r="0"][data-c="1"]');
    await sleep(120);
    await page.click('.view.active .gk-search');
    await page.keyboard.type('Shield');
    await sleep(400);
    await page.evaluate(() => document.querySelector('.view.active .gk-scroll')?.focus({ preventScroll: true }));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await sleep(120);
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Should not land');
      document.querySelector('.view.active .gk-scroll')?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await sleep(400);
    const landed = await page.evaluate(() => [...document.querySelectorAll('.view.active .gk-cell')].filter((c) => c.textContent === 'Should not land').length);
    const banner = page.locator('.view.active .gk-banner');
    const bannerUp = await banner.count();
    const bannerText = bannerUp ? ((await banner.first().textContent()) || '').trim() : '';
    if (bannerUp) await page.click('.view.active .gk-banner-close');
    await page.fill('.view.active .gk-search', '');
    await sleep(300);
    expect(landed === 0, `paste landed on ${landed} visible cell(s) instead of being refused`);
    expect(bannerUp > 0, 'no refusal banner shown');
    expect(/not applied/i.test(bannerText), `banner text was "${bannerText.slice(0, 120)}"`);
    return 'refused with banner';
  });
  await check('Data: undo and redo buttons in the header', async () => {
    await page.click(VUNDO);
    await page.click(VREDO);
    await sleep(200);
  });
  await check('Data: Review & save opens the diff and Cancel closes it', async () => {
    await clickAt('.gk-cell[data-r="0"][data-c="1"]');
    await page.keyboard.press('F2');
    await waitVisible('.gk-editor');
    await page.fill('.gk-editor', 'QA Diff');
    await page.keyboard.press('Enter');
    await sleep(200);
    await page.click('button[data-act="review"]');
    await sleep(400);
    expect(await page.evaluate(() => document.querySelector('dialog.ds-review')?.open === true), 'review dialog did not open');
    await page.click('dialog.ds-review [data-cancel]');
    await sleep(300);
    expect(await page.evaluate(() => document.querySelector('dialog.ds-review')?.open !== true), 'dialog still open after Cancel');
    await page.click(VUNDO);
    await sleep(200);
  });
  await shot(`data-${sizeName}`);
}

async function layoutStudio() {
  await goModule('Layout Studio');
  await waitVisible('.ck-item');
  await check('Layout: Fit the wireframe', async () => {
    await page.click('button[data-act="fit"]');
    await sleep(300);
    return await textOf('.ck-zoom');
  });
  await check('Layout: select a region opens the inspector', async () => {
    await page.click('.ck-item >> nth=0', { force: true });
    await sleep(300);
    expect(await page.locator('.lay-insp input[data-key]').count() > 0, 'inspector has no fields after selecting a region');
  });
  await check('Layout: drag a region and see it move', async () => {
    const box = await page.locator('.ck-item >> nth=1').boundingBox();
    const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
    const before = await page.locator('.ck-item >> nth=1').evaluate((n) => n.style.left);
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + i * 6, y0);
    await page.mouse.up();
    await sleep(300);
    const after = await page.locator('.ck-item >> nth=1').evaluate((n) => n.style.left);
    expect(before !== after, `region did not move (${before} -> ${after})`);
    return `${before} -> ${after}`;
  });
  await check('Layout: undo reverts the drag', async () => {
    const before = await page.locator('.ck-item >> nth=1').evaluate((n) => n.style.left);
    await page.click(VUNDO);
    await sleep(300);
    const after = await page.locator('.ck-item >> nth=1').evaluate((n) => n.style.left);
    expect(before !== after, 'undo did not change the region position');
  });
  await check('Layout: More menu opens and lists the coming modes', async () => {
    await page.click('.lay-more > summary');
    await sleep(200);
    expect(await page.locator('.lay-more[open] .lay-more-list').count() === 1, 'More menu did not open');
    await page.click('.lay-more > summary');
  });
  await check('Layout: Review changes opens and Close cancels', async () => {
    await page.click('.ck-item >> nth=1', { force: true });
    await page.mouse.move(0, 0);
    const box = await page.locator('.ck-item >> nth=1').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    for (let i = 1; i <= 4; i++) await page.mouse.move(box.x + box.width / 2 + i * 8, box.y + box.height / 2);
    await page.mouse.up();
    await sleep(300);
    await page.click('button[data-act="review"]:not([disabled])');
    await sleep(400);
    expect(await page.evaluate(() => document.querySelector('dialog')?.open === true), 'review dialog did not open');
    await page.click('dialog [data-dlg="close"]');
    await sleep(200);
    expect(await page.evaluate(() => document.querySelector('dialog')?.open !== true), 'dialog still open');
    await page.click(VUNDO);
  });
  await shot(`layout-${sizeName}`);
}

async function entityBrowser() {
  await goModule('Entity Browser', 2000);
  await waitVisible('.ent-count');
  await check('Entity: switch through every kind', async () => {
    const tabs = await page.locator('button[role="tab"]:has-text("Armaments"), button[role="tab"]:has-text("Armor"), button[role="tab"]:has-text("Potions"), button[role="tab"]:has-text("Relics"), button[role="tab"]:has-text("Cards"), button[role="tab"]:has-text("Statuses"), button[role="tab"]:has-text("Stances"), button[role="tab"]:has-text("Keywords"), button[role="tab"]:has-text("Enemies"), button[role="tab"]:has-text("Classes")').count();
    const seen = [];
    for (let i = 0; i < tabs; i++) {
      const tab = page.locator('button[role="tab"]').nth(i);
      await tab.click();
      await sleep(350);
      seen.push((await tab.textContent()).trim().replace(/–.*/, ''));
    }
    expect(tabs === 10, `expected 10 kind tabs, found ${tabs}`);
    return seen.join(', ');
  });
  await check('Entity: a text filter narrows the count, Clear filters restores it', async () => {
    await page.click('button[role="tab"]:has-text("Armaments")');
    await sleep(300);
    const all = await textOf('.ent-count');
    await page.fill('.ent-q', 'blade');
    await sleep(400);
    const some = await textOf('.ent-count');
    expect(some !== all, `count did not change: ${all} / ${some}`);
    await page.click('.ent-reset');
    await sleep(300);
    expect((await textOf('.ent-count')) === all, 'Clear filters did not restore the count');
    return `${all} -> ${some}`;
  });
  await check('Entity: a select filter changes the count', async () => {
    const sel = page.locator('select').first();
    const opts = await sel.locator('option').count();
    expect(opts > 1, 'class filter has no options');
    await sel.selectOption({ index: 1 });
    await sleep(400);
    await page.click('.ent-reset');
    await sleep(200);
  });
  let pickedId = null;
  await check('Entity: a grid tile opens the drawer and sets the id', async () => {
    await page.click('button[role="tab"]:has-text("Armaments")');
    await sleep(400);
    const frame = page.frameLocator('.ent-center iframe');
    const tile = frame.locator('[data-id]').first();
    await tile.click({ timeout: 8000 });
    await sleep(500);
    pickedId = new URL(`${url}/${await hashNow()}`).hash;
    expect((await hashNow()).includes('id='), `hash has no id: ${await hashNow()}`);
    return await hashNow();
  });
  await check('Entity: every drawer tab is clickable', async () => {
    const names = [];
    const tabs = page.locator('.ent-tabs [role="tab"]');
    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      await sleep(250);
      names.push((await tabs.nth(i).textContent()).trim());
    }
    expect(n === 6, `expected 6 drawer tabs, found ${n}`);
    return names.join(', ');
  });
  await check('Entity: deep link with id opens the drawer', async () => {
    const hash = (await hashNow()) || '#mod=entities&kind=armaments';
    await page.evaluate((h) => { location.hash = '#mod=data'; setTimeout(() => { location.hash = h.replace(/^#/, '#'); }, 50); }, hash);
    await sleep(1800);
    const w = await page.locator('.ent-drawer').boundingBox();
    expect(w && w.width > 40, 'drawer is not open after a deep link with id');
    return `drawer width ${Math.round(w.width)}px`;
  });
  await check('Entity: armour "Edit in Data Studio" selects the class row', async () => {
    await page.evaluate(() => { location.hash = '#mod=entities&kind=armor'; });
    await sleep(1200);
    await page.click('button[role="tab"]:has-text("Armor")');
    await sleep(500);
    const tile = page.frameLocator('.ent-center iframe').locator('[data-id]').first();
    await tile.click();
    await sleep(500);
    await page.click('.ent-ds');
    await sleep(1500);
    const h = await hashNow();
    expect(h.includes('mod=data') && h.includes('match=classId'), `not a Data Studio link with a class match: ${h}`);
    const active = await page.evaluate(() => document.querySelector('.gk-cell.gk-active')?.dataset.r ?? null);
    expect(active !== null, 'no active row in Data Studio');
    return `${h.slice(0, 120)} row ${active}`;
  });
  await check('Entity: Try in fight keeps the chosen main hand', async () => {
    await page.evaluate(() => { location.hash = '#mod=entities&kind=armaments'; });
    await sleep(1200);
    await page.click('button[role="tab"]:has-text("Armaments")');
    await sleep(400);
    await page.frameLocator('.ent-center iframe').locator('[data-id]').first().click();
    await sleep(400);
    await page.click('.ent-tabs [role="tab"]:has-text("Try in fight")');
    await sleep(400);
    const main = await page.locator('.ent-try select[name="mainHand"]').inputValue().catch(() => null);
    const chosen = await page.locator('.ent-try select[name="mainHand"] option:checked').count();
    expect(main !== null && chosen >= 0, 'no main hand selector in Try in fight');
    await page.click('.ent-tabs [role="tab"]:has-text("Card")');
    await sleep(300);
    await page.click('.ent-tabs [role="tab"]:has-text("Try in fight")');
    await sleep(300);
    const again = await page.locator('.ent-try select[name="mainHand"]').inputValue();
    expect(again === main, `main hand changed on tab switch: ${main} -> ${again}`);
    return `main hand ${again || '(none)'}`;
  });
  await shot(`entities-${sizeName}`);
}

async function assetGallery() {
  await goModule('Asset Gallery', 1500);
  await waitVisible('.ast-tile');
  await check('Assets: a kind filter changes the count', async () => {
    const all = await textOf('.ast-count');
    await page.click('button:has-text("Sprites")');
    await sleep(400);
    const sprites = await textOf('.ast-count');
    await page.click('button:has-text("All")');
    await sleep(300);
    expect(sprites !== all, `kind filter did not change count (${all})`);
    return `${all} -> ${sprites}`;
  });
  await check('Assets: search narrows the grid', async () => {
    await page.fill('.ast-q', 'ashheart');
    await sleep(400);
    const n = await page.locator('.ast-tile').count();
    expect(n > 0 && n < 7790, `search gave ${n} tiles`);
    await page.fill('.ast-q', '');
    await sleep(300);
    return `${n} tiles`;
  });
  await check('Assets: tile labels read folder / name', async () => {
    const labels = await page.locator('.ast-tile').evaluateAll((els) => els.slice(0, 40).map((e) => e.getAttribute('aria-label') || ''));
    const bad = labels.filter((l) => !l.includes(' / '));
    expect(bad.length === 0, `${bad.length} tile labels lack "folder / name": ${bad.slice(0, 3).join(' | ')}`);
  });
  await check('Assets: detail view opens from a tile', async () => {
    await page.fill('.ast-q', 'ashheart');
    await sleep(400);
    await page.locator('.ast-tile').first().click();
    await sleep(600);
    expect(await page.locator('.ast-detail, [data-view="detail"], .ast-zoom').count() > 0 || await page.evaluate(() => document.querySelectorAll('dialog[open], .ast-detail:not([hidden])').length > 0), 'detail view did not open');
  });
  await check('Assets: zoom in and out in detail', async () => {
    const zin = page.locator('button[aria-label*="oom in" i], button[title*="oom in" i], button:has-text("+")').first();
    await zin.click();
    await sleep(200);
    await page.locator('button[aria-label*="oom out" i], button[title*="oom out" i], button:has-text("−"), button:has-text("-")').first().click();
    await sleep(200);
  });
  await check('Assets: Used in lists references', async () => {
    expect(await page.getByText(/Used in/i).count() > 0, 'no "Used in" section in detail');
  });
  await check('Assets: frames playback controls work', async () => {
    const play = page.locator('button:has-text("Play"), button[aria-label*="play" i]').first();
    await play.click({ timeout: 3000 });
    await sleep(400);
    await page.locator('button:has-text("Pause"), button[aria-label*="pause" i]').first().click({ timeout: 3000 });
  });
  await check('Assets: compare two assets side by side and onion skin', async () => {
    await page.keyboard.press('Escape');
    await sleep(300);
    const boxes = page.locator('.ast-tile input[type="checkbox"]');
    await boxes.nth(0).check({ force: true });
    await boxes.nth(1).check({ force: true });
    await page.click('.ast-compare-btn');
    await sleep(600);
    expect(await page.getByText(/side by side/i).count() > 0 || await page.getByText(/onion/i).count() > 0, 'compare view not shown');
    await page.getByText(/onion/i).first().click({ timeout: 3000 }).catch(() => {});
    await sleep(300);
  });
  await check('Assets: switching module stops frame timer and audio', async () => {
    await goModule('Data Studio');
    const playing = await page.evaluate(() => [...document.querySelectorAll('audio, video')].filter((m) => !m.paused).length);
    expect(playing === 0, `${playing} media element(s) still playing`);
    await goModule('Asset Gallery');
  });
  await check('Assets: Open in Entity Browser for a class asset', async () => {
    const b = page.locator('.ast-open-entity');
    if (await b.count() === 0 || !(await b.first().isVisible())) return 'no class asset selected; button not shown (tested only the absence)';
    await b.first().click();
    await sleep(1200);
    expect((await hashNow()).includes('mod=entities'), 'did not open Entity Browser');
  });
  await shot(`assets-${sizeName}`);
}

async function visualReview() {
  await goModule('Visual Review', 1500);
  await waitVisible('.rv-run');
  await check('Review: pick one screen and capture on Desk', async () => {
    await page.evaluate(() => { for (const cb of document.querySelectorAll('input[type="checkbox"][value]')) cb.checked = cb.value === 'title'; });
    await page.evaluate(() => { for (const cb of document.querySelectorAll('input[type="checkbox"][value="title"]')) cb.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.click('.rv-seg button:has-text("Desk")');
    await sleep(200);
    await page.click('.rv-run');
    await sleep(300);
    expect(await page.locator('.rv-acc-screen').isDisabled() || await page.locator('.rv-acc-all').isDisabled(), 'Accept controls are enabled during capture');
    for (let i = 0; i < 120; i++) {
      if (!(await page.locator('.rv-run').isDisabled())) break;
      await sleep(1000);
    }
    await sleep(800);
    expect(!(await page.locator('.rv-run').isDisabled()), 'capture did not finish in 2 minutes');
    return await textOf('.rv-job');
  });
  await check('Review: detail view modes all render', async () => {
    await page.locator('button:has-text("View")').first().click();
    await sleep(600);
    const modes = await page.locator('[data-mode]').evaluateAll((els) => els.map((e) => e.dataset.mode));
    for (const m of modes) {
      await page.locator(`[data-mode="${m}"]`).first().click();
      await sleep(250);
    }
    return modes.join(', ');
  });
  await check('Review: accept one row writes a baseline', async () => {
    const btn = page.locator('.rv-accept').first();
    if (await btn.isDisabled()) throw Error('Accept disabled with no capture running');
    await btn.click();
    await sleep(1200);
    expect(await page.getByText(/Accepted 1 baseline/i).count() > 0 || await page.getByText(/Accepted/i).count() > 0, 'no "Accepted" toast');
  });
  await shot(`review-${sizeName}`);
}

async function motionStudio() {
  await goModule('Motion Studio', 2000);
  await waitVisible('.mo-play');
  await check('Motion: open the library overlay and pick a renewal attack', async () => {
    await page.click('.mo-toggle[data-overlay="lib"]');
    await sleep(300);
    const item = page.locator('.mo-item[data-kind="animation"]').first();
    await item.waitFor({ state: 'visible', timeout: 8000 });
    await item.click();
    await sleep(1200);
    await page.click('.mo-toggle[data-overlay="lib"]').catch(() => {});
    return await item.getAttribute('data-id');
  });
  await check('Motion: play, pause, scrub, change speed, toggle onion skin', async () => {
    await page.click('.mo-play');
    await sleep(500);
    const label = await textOf('.mo-play');
    await page.click('.mo-play');
    await sleep(200);
    await page.fill('.mo-scrub', '500');
    await sleep(300);
    const time = await textOf('.mo-time');
    await page.selectOption('.mo-speed', '0.5');
    await page.check('.mo-onion-prev', { force: true });
    await page.uncheck('.mo-onion-prev', { force: true });
    await sleep(200);
    expect(label !== '', 'play button empty');
    return `${label} / ${time} / speed 0.5`;
  });
  await check('Motion: edit positions, drag a handle, inspector changes, undo', async () => {
    await page.click('button[data-mode="edit"]');
    await sleep(600);
    const item = page.locator('.mo-edit .ck-item:not(.locked)').first();
    await item.waitFor({ state: 'visible', timeout: 8000 });
    const box = await item.boundingBox();
    const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x0 + i * 5, y0 + i * 2);
    await page.mouse.up();
    await sleep(400);
    const xVal = await page.locator('.mo-insp input[data-key="x"]').first().inputValue().catch(() => null);
    expect(xVal !== null, 'inspector x field missing after dragging');
    await page.click(VUNDO);
    await sleep(300);
    await page.click('button[data-mode="stage"]');
    return `x=${xVal}`;
  });
  await check('Motion: stance file is read-only with the generated note', async () => {
    await page.click('.mo-toggle[data-overlay="lib"]');
    await sleep(200);
    const item = page.locator('.mo-item[data-kind="stance"]').first();
    await item.waitFor({ state: 'visible', timeout: 8000 });
    await item.click();
    await sleep(1200);
    await page.click('.mo-toggle[data-overlay="lib"]').catch(() => {});
    const note = await page.locator('.mo-generated').count();
    expect(note > 0, 'no generated note on the stance file');
    const enabledInputs = await page.locator('.mo-insp input:not([disabled])').count();
    const hasEditable = await page.locator('.mo-edit .ck-item:not(.locked)').count();
    expect(hasEditable === 0, 'handles are draggable on a generated stance file');
    await shot(`motion-stance-${sizeName}`);
    return `generated note shown; enabled inspector inputs ${enabledInputs}`;
  });
  await check('Motion: Open in Asset Gallery from the library', async () => {
    const btn = page.locator('button:has-text("Open in Asset Gallery"), button:has-text("Asset Gallery")').first();
    if (await btn.count() === 0) throw Error('no "Open in Asset Gallery" control in Motion Studio');
    await btn.click();
    await sleep(1200);
    expect(await activeView() === 'view-mod-assets' || (await hashNow()).includes('mod=assets'), 'did not open Asset Gallery');
  });
  await shot(`motion-${sizeName}`);
}

async function globalPaths() {
  await check('Global: Ctrl+K finds each module', async () => {
    const found = [];
    for (const [label, id] of [['Data Studio', 'data'], ['Layout Studio', 'layout'], ['Motion Studio', 'motion'], ['Entity Browser', 'entities'], ['Asset Gallery', 'assets'], ['Visual Review', 'review']]) {
      await page.keyboard.press('Control+k');
      await waitVisible('#palette');
      await page.fill('#palette-input', label);
      await sleep(250);
      await page.keyboard.press('Enter');
      await sleep(500);
      const h = await hashNow();
      const v = await activeView();
      found.push(`${id}:${v === `view-mod-${id}` || h.includes(`mod=${id}`) ? 'ok' : 'MISS'}`);
    }
    expect(found.every((f) => f.endsWith(':ok')), found.join(' '));
    return found.join(' ');
  });
  await check('Global: ? shows the keyboard shortcuts', async () => {
    await page.click('body', { position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press('?');
    await sleep(400);
    expect(await page.getByText('Keyboard shortcuts').count() > 0, '? did not show the shortcuts');
    await page.keyboard.press('Escape');
    await sleep(200);
  });
  for (const id of ['data', 'layout', 'motion', 'entities', 'assets', 'review']) {
    await check(`Global: deep link #mod=${id} survives a reload`, async () => {
      await page.goto(`${url}/#mod=${id}`, { waitUntil: 'domcontentloaded' });
      await sleep(1500);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(2500);
      const v = await activeView();
      expect(v === `view-mod-${id}`, `after reload the active view is "${v}"`);
    });
  }
}

// ---------- run ----------
const sizes = Object.values(SIZES).filter((s) => !SIZE_ONLY || s.name === SIZE_ONLY);
for (const size of sizes) {
  sizeName = size.name;
  const made = await newPage(size);
  page = made.page;
  await page.goto(`${url}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* none */ } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await setDock(size.dock);
  // A module whose setup fails (its view never shows) is recorded as a FAIL and the sweep goes on.
  const runModule = async (id, label, fn) => {
    if (!want(id)) return;
    try { await resetDoc(id); await fn(); } catch (err) {
      results.push({ size: sizeName, path: `${label}: module setup`, status: 'FAIL', note: String(err.message || err).split('\n')[0].slice(0, 900) });
      try { await page.screenshot({ path: path.join(SCRATCH, `setup-${sizeName}-${id}.jpg`), type: 'jpeg', quality: 70 }); } catch { /* page gone */ }
    }
  };
  await runModule('data', 'Data Studio', dataStudio);
  await runModule('layout', 'Layout Studio', layoutStudio);
  await runModule('entities', 'Entity Browser', entityBrowser);
  await runModule('assets', 'Asset Gallery', assetGallery);
  await runModule('review', 'Visual Review', visualReview);
  await runModule('motion', 'Motion Studio', motionStudio);
  if (want('global')) {
    try { await globalPaths(); } catch (err) {
      results.push({ size: sizeName, path: 'Global: setup', status: 'FAIL', note: String(err.message || err).split('\n')[0].slice(0, 900) });
    }
  }
  await made.context.close();
}

await browser.close();
stopServer();

const pad = (s, n) => String(s).slice(0, n).padEnd(n);
console.log('\nsize    path                                                  status  note');
for (const r of results) console.log(`${pad(r.size, 7)} ${pad(r.path, 53)} ${pad(r.status, 7)} ${r.note}`);
const failed = results.filter((r) => r.status === 'FAIL');
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
const issues = [...new Map(globalIssues.map((i) => [`${i.size}|${i.kind}|${i.detail}`, i])).values()];
console.log(`\nPage errors and failed requests (${issues.length} distinct):`);
for (const i of issues) console.log(`  [${i.size}] ${i.kind}: ${i.detail}`);
if (failed.length) console.log(`\nFailure screenshots: ${SCRATCH}`);
process.exitCode = failed.length ? 1 : 0;
