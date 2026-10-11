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
  p.on('pageerror', (e) => {
    // The first stack frame says where the error was thrown.
    const frame = (e.stack || '').split('\n').find((l) => /\.m?js|\.html/.test(l))?.trim() ?? '';
    globalIssues.push({ size: size.name, kind: 'pageerror', detail: `${e.message.split('\n')[0]}${frame ? ` @ ${frame}` : ''}` });
  });
  p.on('requestfailed', (r) => globalIssues.push({ size: size.name, kind: 'requestfailed', detail: `${r.url()} ${r.failure()?.errorText || ''}` }));
  p.on('response', (r) => { if (r.status() >= 400) globalIssues.push({ size: size.name, kind: `http ${r.status()}`, detail: r.url() }); });
  p.on('console', (m) => { if (m.type() === 'error') globalIssues.push({ size: size.name, kind: 'console', detail: m.text().slice(0, 200) }); });
  p.setDefaultTimeout(8000);
  return { context, page: p };
}
const want = (id) => !ONLY || ONLY.includes(id);
// Screenshot names: the narrow (dock open) picture is `<module>.jpg`, the wide (dock collapsed) one `<module>-wide.jpg`.
const SHOT_NAMES = { 'motion-stance': 'motion-stance-readonly' };
const shot = async (name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const base = SHOT_NAMES[name.replace(/-(narrow|wide)$/, '')] ?? name.replace(/-(narrow|wide)$/, '');
  const file = sizeName === 'wide' ? `${base}-wide` : base;
  await page.screenshot({ path: path.join(SHOTS, `${file}.jpg`), type: 'jpeg', quality: 80 });
};

// ---------- the paths ----------

async function dataStudio() {
  await goModule('Data Studio');
  await waitVisible('.ds-grid .gk-row');
  // Wide (dock collapsed) the table list is a fixed sidebar and the toggle and Close are hidden.
  const listToggle = () => page.locator('.ds-tables-toggle').isVisible();
  await check('Data: Tables toggle opens the list', async () => {
    if (!(await listToggle())) return 'table list is a fixed sidebar at this width';
    await page.click('.ds-tables-toggle');
    expect(await page.getAttribute('.ds-tables-toggle', 'aria-expanded') === 'true', 'aria-expanded did not become true');
  });
  await check('Data: Close button closes the table list', async () => {
    if (!(await listToggle())) return 'table list is a fixed sidebar at this width';
    await page.click('.ds-list-close');
    expect(await page.getAttribute('.ds-tables-toggle', 'aria-expanded') === 'false', 'list still open after Close');
  });
  await check('Data: Escape closes the table list', async () => {
    if (!(await listToggle())) return 'table list is a fixed sidebar at this width';
    await page.click('.ds-tables-toggle');
    await page.focus('.ds-find');
    await page.keyboard.press('Escape');
    expect(await page.getAttribute('.ds-tables-toggle', 'aria-expanded') === 'false', 'list still open after Escape');
  });
  await check('Data: pick a table from the list', async () => {
    if (await listToggle()) await page.click('.ds-tables-toggle');
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
    if (!(await page.locator('.ds-drawer-close').isVisible())) return 'no drawer Close control at this width';
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
    expect((await textOf('.view.active button[data-act="review"]')).includes('(1)'), 'review count not 1');
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
    // The banner stays up: the row drawer can cover its close button at this width.
    await page.fill('.view.active .gk-search', '');
    await sleep(300);
    expect(landed === 0, `paste landed on ${landed} visible cell(s) instead of being refused`);
    expect(bannerUp > 0, 'no refusal banner shown');
    expect(/not applied/i.test(bannerText), `banner text was "${bannerText.slice(0, 120)}"`);
    return 'refused with banner';
  });
  await check('Data: undo and redo buttons in the header', async () => {
    // Undo and Redo are disabled when there is nothing to step; click only the enabled one.
    const undoOn = !(await page.locator(VUNDO).isDisabled());
    if (undoOn) await page.click(VUNDO);
    await sleep(200);
    const redoOn = !(await page.locator(VREDO).isDisabled());
    if (redoOn) await page.click(VREDO);
    await sleep(200);
    return `undo ${undoOn ? 'stepped' : 'disabled'}, redo ${redoOn ? 'stepped' : 'disabled'}`;
  });
  await check('Data: Review & save opens the diff and Cancel closes it', async () => {
    await clickAt('.gk-cell[data-r="0"][data-c="1"]');
    await page.keyboard.press('F2');
    await waitVisible('.gk-editor');
    await page.fill('.gk-editor', 'QA Diff');
    await page.keyboard.press('Enter');
    await sleep(200);
    // The row drawer covers the toolbar's right end at this width; close it first.
    if (await page.locator('.view.active .ds-drawer-close').isVisible()) await page.click('.view.active .ds-drawer-close');
    await sleep(200);
    await page.click('.view.active button[data-act="review"]');
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
  await waitVisible('.view.active .ck-item');
  const V = '.view.active ';
  // Eight pointer moves from (x, y) by (dx, dy): a drag the canvas reads as a gesture.
  const dragBy = async (x, y, dx, dy) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
    await page.mouse.up();
    await sleep(300);
  };
  const centreOf = async (sel) => {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) throw Error(`no box for ${sel}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // Region 2 is the scene band. Its lower edge (scene / hand) is the edge the config owns, so its bottom handle resizes it.
  const BAND = `${V}.ck-item >> nth=1`;
  const bandGeom = () => page.locator(BAND).evaluate((n) => `${n.style.top} ${n.style.height}`);
  const undoOn = () => page.isEnabled(VUNDO);
  const reviewOn = () => page.isEnabled(`${V}[data-review]`);
  const DLG = 'dialog.lay-dlg[open]';
  // Opens Review changes, checks it shows a diff, then Cancel closes it without saving.
  const reviewAndCancel = async () => {
    expect(await reviewOn(), 'Review changes is disabled while a change is pending');
    await page.click(`${V}[data-review]`);
    await page.locator(`${DLG} .lay-hunk`).first().waitFor({ state: 'visible', timeout: 8000 });
    const changed = await page.locator(`${DLG} .lay-ln.is-add, ${DLG} .lay-ln.is-del`).count();
    expect(changed > 0, 'the review opened without a diff');
    await page.click(`${DLG} button[data-dlg="close"]:text-is("Cancel")`);
    await sleep(300);
    expect(await page.evaluate(() => document.querySelector('dialog')?.open !== true), 'dialog still open after Cancel');
    return changed;
  };
  let bandStart = null;
  let slotStart = null;
  const SLOT = `${V}.ck-item[data-id^="slot:"] >> nth=0`;
  const slotGeom = () => page.locator(SLOT).evaluate((n) => `${n.style.left} ${n.style.top}`);

  await check('Layout: Fit the wireframe', async () => {
    await page.click('.view.active button[data-act="fit"]');
    await sleep(300);
    return await textOf('.view.active .ck-zoom');
  });
  await check('Layout: select a region opens the inspector', async () => {
    await page.click('.view.active .ck-item >> nth=0', { force: true });
    await sleep(300);
    expect(await page.locator('.view.active .lay-insp input[data-key]').count() > 0, 'inspector has no fields after selecting a region');
  });
  await check('Layout: a centre drag of a band snaps back and the toast says the layout places it', async () => {
    const geom = await bandGeom();
    const undo = await undoOn();
    const c = await centreOf(BAND);
    await dragBy(c.x, c.y, 0, 48);
    const after = await bandGeom();
    expect(after === geom, `a pure move changed the band (${geom} -> ${after})`);
    expect((await undoOn()) === undo, 'a pure move changed the Undo history');
    await page.getByText('positioned by the layout').first().waitFor({ state: 'visible', timeout: 3000 });
    return 'snapped back; toast shown';
  });
  await check('Layout: drag the band\'s bottom handle to resize it', async () => {
    const c = await centreOf(BAND);
    await page.mouse.click(c.x, c.y);
    await sleep(200);
    const handle = `${V}.ck-handle[data-handle="s"]`;
    await page.locator(handle).waitFor({ state: 'visible', timeout: 3000 });
    bandStart = await bandGeom();
    const h = await centreOf(handle);
    await dragBy(h.x, h.y, 0, 48);
    const after = await bandGeom();
    expect(after !== bandStart, `the bottom handle did not resize the band (${bandStart} -> ${after})`);
    expect(await undoOn(), 'Undo is disabled after the resize');
    await shot(`layout-${sizeName}`);
    return `${bandStart} -> ${after}`;
  });
  await check('Layout: Review changes shows the diff, and Cancel closes it', async () => {
    const changed = await reviewAndCancel();
    expect((await bandGeom()) !== bandStart, 'Cancel reverted the resize');
    return `${changed} changed lines`;
  });
  await check('Layout: undo restores the band height', async () => {
    await page.click(VUNDO);
    await sleep(300);
    const now = await bandGeom();
    expect(now === bandStart, `undo did not restore the band (${now}, was ${bandStart})`);
    return `restored to ${bandStart}`;
  });
  await check('Layout: More menu opens and lists the coming modes', async () => {
    await page.click('.view.active .lay-more > summary');
    await sleep(200);
    expect(await page.locator('.view.active .lay-more[open] .lay-more-list').count() === 1, 'More menu did not open');
    await page.click('.view.active .lay-more > summary');
  });
  await check('Layout: Battlefield mode draws the formation slots', async () => {
    await page.click(`${V}.lay-modes [data-mode="battlefield"]`);
    await sleep(800);
    await page.locator(SLOT).waitFor({ state: 'visible', timeout: 8000 });
    return `${await page.locator(`${V}.ck-item[data-id^="slot:"]`).count()} slots`;
  });
  await check('Layout: Battlefield: drag a slot and see it move', async () => {
    slotStart = await slotGeom();
    const c = await centreOf(SLOT);
    await dragBy(c.x, c.y, 48, 0);
    const after = await slotGeom();
    expect(after !== slotStart, `slot did not move (${slotStart} -> ${after})`);
    expect(await undoOn(), 'Undo is disabled after the slot move');
    return `${slotStart} -> ${after}`;
  });
  await check('Layout: Battlefield: undo restores the slot', async () => {
    await page.click(VUNDO);
    await sleep(300);
    const now = await slotGeom();
    expect(now === slotStart, `undo did not restore the slot (${now}, was ${slotStart})`);
  });
  await check('Layout: Battlefield: Review changes shows the diff, and Cancel closes it', async () => {
    const c = await centreOf(SLOT);
    await dragBy(c.x, c.y, 48, 0);
    const changed = await reviewAndCancel();
    await page.click(VUNDO);
    await sleep(300);
    expect((await slotGeom()) === slotStart, 'undo did not restore the slot after the review');
    return `${changed} changed lines`;
  });
  try { await page.click(`${V}.lay-modes [data-mode="config"]`); await sleep(400); } catch { /* the mode tab is always drawn */ }
}

async function entityBrowser() {
  await goModule('Entity Browser', 2000);
  // The count and the tile frame are attached in the DOM; the frame is not always laid out yet.
  await page.waitForSelector('.view.active .ent-count', { state: 'attached' });
  await page.waitForSelector('.view.active .ent-center iframe', { state: 'attached' });
  await check('Entity: switch through every kind', async () => {
    const tabs = await page.locator('.view.active .ent-chips button[role="tab"]:has-text("Armaments"), .view.active .ent-chips button[role="tab"]:has-text("Armor"), .view.active .ent-chips button[role="tab"]:has-text("Potions"), .view.active .ent-chips button[role="tab"]:has-text("Relics"), .view.active .ent-chips button[role="tab"]:has-text("Cards"), .view.active .ent-chips button[role="tab"]:has-text("Statuses"), .view.active .ent-chips button[role="tab"]:has-text("Stances"), .view.active .ent-chips button[role="tab"]:has-text("Keywords"), .view.active .ent-chips button[role="tab"]:has-text("Enemies"), .view.active .ent-chips button[role="tab"]:has-text("Classes")').count();
    const seen = [];
    for (let i = 0; i < tabs; i++) {
      const tab = page.locator('.view.active .ent-chips button[role="tab"]').nth(i);
      await tab.click();
      await sleep(350);
      seen.push((await tab.textContent()).trim().replace(/–.*/, ''));
    }
    expect(tabs === 10, `expected 10 kind tabs, found ${tabs}`);
    return seen.join(', ');
  });
  await check('Entity: a text filter narrows the count, Clear filters restores it', async () => {
    await page.click('.view.active .ent-chips button[role="tab"]:has-text("Armaments")');
    if (await page.locator('.view.active .ent-filter-toggle').isVisible()) await page.click('.view.active .ent-filter-toggle');
    await sleep(300);
    const all = await textOf('.view.active .ent-count');
    await page.fill('.view.active .ent-q', 'blade');
    await sleep(400);
    const some = await textOf('.view.active .ent-count');
    expect(some !== all, `count did not change: ${all} / ${some}`);
    await page.click('.view.active .ent-reset');
    await sleep(300);
    expect((await textOf('.view.active .ent-count')) === all, 'Clear filters did not restore the count');
    if (await page.getAttribute('.view.active .ent-filter-toggle', 'aria-expanded').catch(() => null) === 'true') await page.click('.view.active .ent-filter-toggle');
    return `${all} -> ${some}`;
  });
  await check('Entity: a select filter changes the count', async () => {
    // Armour is the kind that carries class rows, so its Class facet has options.
    await page.click('.view.active .ent-chips button[role="tab"]:has-text("Armor")');
    await sleep(300);
    if (await page.locator('.view.active .ent-filter-toggle').isVisible() && await page.getAttribute('.view.active .ent-filter-toggle', 'aria-expanded') !== 'true') await page.click('.view.active .ent-filter-toggle');
    const sel = page.locator('.view.active select[data-f="class"]');
    const opts = await sel.locator('option').count();
    expect(opts > 1, 'class filter has no options');
    await sel.selectOption({ index: 1 });
    await sleep(400);
    await page.click('.view.active .ent-reset');
    await sleep(200);
    // At this width the filter pane is an overlay over the grid; close it so the tiles can be clicked.
    if (await page.getAttribute('.view.active .ent-filter-toggle', 'aria-expanded').catch(() => null) === 'true') await page.click('.view.active .ent-filter-toggle');
  });
  let pickedId = null;
  await check('Entity: a grid tile opens the drawer and sets the id', async () => {
    await page.click('.view.active .ent-chips button[role="tab"]:has-text("Armaments")');
    await sleep(400);
    const frame = page.frameLocator('.view.active .ent-center iframe');
    await frame.locator('body[data-entities-ready="true"]').waitFor({ timeout: 20000 });
    const tile = frame.locator('[data-entity-id]').first();
    await tile.click({ timeout: 8000 });
    await sleep(500);
    pickedId = new URL(`${url}/${await hashNow()}`).hash;
    expect((await hashNow()).includes('id='), `hash has no id: ${await hashNow()}`);
    return await hashNow();
  });
  await check('Entity: every drawer tab is clickable', async () => {
    const names = [];
    const tabs = page.locator('.view.active .ent-tabs [role="tab"]');
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
    const w = await page.locator('.view.active .ent-drawer').boundingBox();
    expect(w && w.width > 40, 'drawer is not open after a deep link with id');
    return `drawer width ${Math.round(w.width)}px`;
  });
  await check('Entity: armour "Edit in Data Studio" selects the class row', async () => {
    await page.evaluate(() => { location.hash = '#mod=entities&kind=armor'; });
    await sleep(1200);
    await page.click('.view.active .ent-chips button[role="tab"]:has-text("Armor")');
    await sleep(500);
    // Prefer a class-keyed piece (id "classId:outfit"); a plain id is linked by row alone.
    const frame = page.frameLocator('.view.active .ent-center iframe');
    await frame.locator('body[data-entities-ready="true"]').waitFor({ timeout: 20000 });
    const keyed = frame.locator('[data-entity-id*=":"]').first();
    const tile = (await keyed.count()) ? keyed : frame.locator('[data-entity-id]').first();
    await tile.click();
    await sleep(500);
    const entId = new URLSearchParams((await hashNow()).replace(/^#/, '')).get('id');
    expect(entId, 'no armour id in the entity link after picking a piece');
    await page.click('.view.active .ent-ds');
    await sleep(1500);
    const h = await hashNow();
    expect(h.includes('mod=data'), `not a Data Studio link: ${h}`);
    // The active row must be this armour piece's row: one of its cells holds the outfit id.
    const row = await page.evaluate((id) => {
      const act = document.querySelector('.view.active .gk-cell.gk-active');
      if (!act) return { active: null, hit: false };
      const r = act.dataset.r;
      const outfit = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
      const hit = [...document.querySelectorAll(`.view.active .gk-cell[data-r="${r}"]`)].some((c) => c.textContent.trim() === outfit);
      return { active: r, hit };
    }, entId);
    expect(row.active !== null, 'no active row in Data Studio');
    expect(row.hit, `active row ${row.active} does not hold "${entId}"`);
    return `${entId} -> row ${row.active}`;
  });
  await check('Entity: Try in fight keeps the chosen main hand', async () => {
    await page.evaluate(() => { location.hash = '#mod=entities&kind=armaments'; });
    await sleep(1200);
    await page.click('.view.active .ent-chips button[role="tab"]:has-text("Armaments")');
    await sleep(400);
    await page.frameLocator('.view.active .ent-center iframe').locator('body[data-entities-ready="true"]').waitFor({ timeout: 20000 });
    await page.frameLocator('.view.active .ent-center iframe').locator('[data-entity-id]').first().click();
    await sleep(400);
    await page.click('.view.active .ent-tabs [role="tab"]:has-text("Try in fight")');
    await sleep(400);
    const main = await page.locator('.view.active .ent-try select[name="mainHand"]').inputValue().catch(() => null);
    const chosen = await page.locator('.view.active .ent-try select[name="mainHand"] option:checked').count();
    expect(main !== null && chosen >= 0, 'no main hand selector in Try in fight');
    await page.click('.view.active .ent-tabs [role="tab"]:has-text("Card")');
    await sleep(300);
    await page.click('.view.active .ent-tabs [role="tab"]:has-text("Try in fight")');
    await sleep(300);
    const again = await page.locator('.view.active .ent-try select[name="mainHand"]').inputValue();
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
    await page.click('.view.active .ast-kinds button:has(span:text-is("Sprites"))');
    await sleep(400);
    const sprites = await textOf('.ast-count');
    await page.click('.view.active .ast-kinds button[data-kind=""]');
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
    await page.locator('.view.active .ast-tile').first().click();
    await sleep(600);
    expect(await page.locator('.view.active .ast-drawer:not([hidden])').count() > 0, 'detail drawer did not open');
  });
  await check('Assets: zoom in and out in detail', async () => {
    const label = () => page.locator('.view.active .ast-zlabel').textContent();
    const before = await label();
    await page.click('.view.active .ast-zoombar button[data-zoom="in"]');
    await sleep(200);
    const zoomedIn = await label();
    await page.click('.view.active .ast-zoombar button[data-zoom="out"]');
    await sleep(200);
    expect(zoomedIn !== before, `zoom in did not change the level (${before})`);
    return `${before} -> ${zoomedIn} -> ${await label()}`;
  });
  await check('Assets: Used in lists references', async () => {
    expect(await page.getByText(/Used in/i).count() > 0, 'no "Used in" section in detail');
  });
  await check('Assets: frames playback controls work', async () => {
    // Frames show only for an animated asset: step the grid until a picked tile has a Frames section.
    await page.fill('.view.active .ast-q', 'greatsword');
    await sleep(400);
    const tiles = page.locator('.view.active .ast-tile');
    const n = Math.min(await tiles.count(), 40);
    let found = false;
    for (let i = 0; i < n && !found; i++) {
      if (await page.locator('.view.active .ast-drawer:not([hidden])').count()) await page.click('.view.active .ast-drawer-close');
      await tiles.nth(i).click();
      await sleep(250);
      found = await page.locator('.view.active .ast-frames:not([hidden])').count() > 0;
    }
    expect(found, `no animated asset among the first ${n} tiles (count "${await textOf('.view.active .ast-count')}", search "${await page.inputValue('.view.active .ast-q')}")`);
    await page.click('.view.active .ast-frame-play');
    await sleep(400);
    const playing = await page.getAttribute('.view.active .ast-frame-play', 'aria-pressed');
    await page.click('.view.active .ast-frame-play');
    await sleep(200);
    expect(playing === 'true', `Play did not start (aria-pressed ${playing})`);
    return `frames playing then stopped (${await page.locator('.view.active .ast-frame-label').textContent()})`;
  });
  await check('Assets: compare two assets side by side and onion skin', async () => {
    await page.keyboard.press('Escape');
    await sleep(300);
    const boxes = page.locator('.ast-tile input[type="checkbox"]');
    await boxes.nth(0).check({ force: true });
    await boxes.nth(1).check({ force: true });
    await page.click('.ast-compare-btn');
    await sleep(600);
    expect(await page.locator('.view.active .ast-compare:not([hidden])').count() > 0, 'compare view not shown');
    const side = await page.getAttribute('.view.active .ast-cmp-stage', 'data-mode');
    await page.click('.view.active .ast-cmp-bar button:has-text("Onion")');
    await sleep(300);
    const onion = await page.getAttribute('.view.active .ast-cmp-stage', 'data-mode');
    expect(side === 'side' && onion === 'onion', `compare modes were ${side} then ${onion}`);
    await page.click('.view.active .ast-cmp-close');
    await sleep(300);
    return 'side by side, then onion skin';
  });
  await check('Assets: switching module stops frame timer and audio', async () => {
    await goModule('Data Studio');
    const playing = await page.evaluate(() => [...document.querySelectorAll('audio, video')].filter((m) => !m.paused).length);
    expect(playing === 0, `${playing} media element(s) still playing`);
    await goModule('Asset Gallery');
  });
  await check('Assets: Open in Entity Browser for a class asset', async () => {
    // Class assets are equipment/…/icon_<id> or body_<class>_<id>: search for icons and open one.
    await page.fill('.view.active .ast-q', 'ashStaff');
    await sleep(400);
    const tiles = page.locator('.view.active .ast-tile');
    const n = Math.min(await tiles.count(), 20);
    let linked = false;
    for (let i = 0; i < n && !linked; i++) {
      if (await page.locator('.view.active .ast-drawer:not([hidden])').count()) await page.click('.view.active .ast-drawer-close');
      await tiles.nth(i).click();
      await sleep(250);
      linked = await page.locator('.view.active .ast-open-entity:not([hidden])').count() > 0;
    }
    expect(linked, `no class asset among the first ${n} icon tiles has an Entity Browser link`);
    await page.click('.view.active .ast-open-entity');
    await sleep(1200);
    expect((await hashNow()).includes('mod=entities'), 'did not open Entity Browser');
  });
  await shot(`assets-${sizeName}`);
}

async function visualReview() {
  await goModule('Visual Review', 1500);
  await waitVisible('.rv-run');
  await check('Review: pick one screen and capture on Desk', async () => {
    // Screens: open the picker, clear it with None, then tick Title with real clicks.
    await page.click('.view.active .rv-pick > summary');
    await page.click('.view.active .rv-pick [data-pick="none"]');
    await page.click('.view.active .rv-pick-list input[value="title"]');
    await page.click('.view.active .rv-pick > summary');
    await page.click('.view.active .rv-seg button:has-text("Desk")');
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
    await page.locator('.view.active button:has-text("View")').first().click();
    await sleep(600);
    // Only the detail's own view modes: the module's other tabs also carry data-mode.
    const detailModes = '.view.active .rv-detail [data-mode]';
    const modes = await page.locator(detailModes).evaluateAll((els) => els.map((e) => e.dataset.mode));
    expect(modes.length === 5, `expected the five view modes, found ${modes.length}`);
    for (const m of modes) {
      await page.locator(`${detailModes}[data-mode="${m}"]`).first().click();
      await sleep(250);
      expect(await page.getAttribute(`${detailModes}[data-mode="${m}"]`, 'aria-pressed') === 'true', `mode "${m}" did not become pressed`);
    }
    return modes.join(', ');
  });
  await check('Review: accept one row writes a baseline', async () => {
    const btn = page.locator('.view.active .rv-accept').first();
    if (await btn.isDisabled()) throw Error('Accept disabled with no capture running');
    await btn.click();
    await sleep(1200);
    expect(await page.getByText(/Accepted 1 baseline/i).count() > 0 || await page.getByText(/Accepted/i).count() > 0, 'no "Accepted" toast');
  });
  await check('Review: side-by-side detail fits both pictures in the view', async () => {
    // A fresh load, so this is the first detail opened: its view has not been fitted yet.
    // Drop the detail from the hash first: a reload would reopen the linked detail rather than the list.
    await page.evaluate(() => { history.replaceState(null, '', '#mod=review'); location.reload(); });
    await sleep(2500);
    await waitVisible('.view.active .rv-run', 20000);
    await page.locator('.view.active button[data-open="desk/title"]').first().click();
    // Wait for every picture in the stage to decode, so the measured size is the real one.
    await page.waitForFunction(() => { const imgs = [...document.querySelectorAll('.view.active .rv-stage img')]; return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 10000 }).catch(() => {});
    await sleep(400);
    const fit = await page.evaluate(() => {
      const d = document.querySelector('.view.active .rv-detail');
      const v = d?.querySelector('.rv-view');
      const s = d?.querySelector('.rv-stage');
      const imgs = [...(s?.querySelectorAll('img') ?? [])].filter((i) => i.naturalWidth);
      return { mode: s?.dataset.mode ?? null, imgs: imgs.length, stageW: Math.round(s?.getBoundingClientRect().width ?? 0), viewW: Math.round(v?.getBoundingClientRect().width ?? 0), zoom: d?.querySelector('.rv-zl')?.textContent ?? '' };
    });
    expect(fit.mode === 'side', `detail did not open in side-by-side (${JSON.stringify(fit)})`);
    // Both pictures when the screen has a baseline; a screen with only a capture still shows one.
    expect(fit.imgs >= 1, `no picture loaded in the side-by-side detail (${JSON.stringify(fit)})`);
    expect(/\d+%$/.test(fit.zoom), `the view was never fitted: no zoom level shown (${JSON.stringify(fit)})`);
    expect(fit.stageW <= fit.viewW,`side-by-side stage ${fit.stageW}px is wider than the view ${fit.viewW}px (zoom ${fit.zoom})`);
    return `zoom ${fit.zoom}, stage ${fit.stageW}px in ${fit.viewW}px`;
  });
  await shot(`review-${sizeName}`);
}

async function motionStudio() {
  await goModule('Motion Studio', 2000);
  await waitVisible('.view.active .mo-play');
  const V = '.view.active ';
  // The Library and Inspector are overlays at this width; open or close one to the wanted state.
  const overlay = async (name, want) => {
    // Wide (dock collapsed) the Library and Inspector are fixed panels and their toggles are hidden.
    if (!(await page.locator(`${V}.mo-toggle[data-overlay="${name}"]`).isVisible())) return;
    const now =await page.getAttribute(`${V}.mo-toggle[data-overlay="${name}"]`, 'aria-expanded');
    if ((now === 'true') === want) { await sleep(100); return; }
    // An open overlay can cover its own toggle at this width: close it through the scrim.
    if (!want && await page.locator(`${V}.mo-scrim`).isVisible()) await page.click(`${V}.mo-scrim`, { position: { x: 4, y: 4 } });
    else await page.click(`${V}.mo-toggle[data-overlay="${name}"]`);
    await sleep(250);
  };
  await check('Motion: open the library overlay and pick a renewal attack', async () => {
    await overlay('lib', true);
    const item = page.locator(`${V}.mo-item[data-kind="animation"]`).first();
    await item.waitFor({ state: 'visible', timeout: 8000 });
    const id = await item.getAttribute('data-id');
    expect(/renewal/i.test(id || ''), `first animation is "${id}", not a renewal attack`);
    await item.click();
    await sleep(1200);
    await overlay('lib', false);
    return id;
  });
  await check('Motion: play, pause, scrub, change speed, toggle onion skin', async () => {
    const play = `${V}.mo-play`;
    const before = await textOf(play);
    await page.click(play);
    await sleep(500);
    const playing = await textOf(play);
    await page.click(play);
    await sleep(200);
    const paused = await textOf(play);
    expect(before !== playing && playing !== paused, `play label did not toggle: ${before} / ${playing} / ${paused}`);
    await page.locator(`${V}.mo-scrub`).fill('120');
    await sleep(300);
    const time = await textOf(`${V}.mo-time`);
    await page.selectOption(`${V}.mo-speed`, '0.5');
    const speed = await page.inputValue(`${V}.mo-speed`);
    await page.check(`${V}.mo-onion-prev`, { force: true });
    const onion = await page.isChecked(`${V}.mo-onion-prev`);
    await page.uncheck(`${V}.mo-onion-prev`, { force: true });
    expect(speed === '0.5' && onion, `speed ${speed}, onion ${onion}`);
    return `${playing} → ${paused} · ${time} · speed ${speed} · onion on`;
  });
  await check('Motion: drag an anchor that is topmost at its centre; inspector follows, undo restores, library shows Unsaved', async () => {
    await page.click(`${V}button[data-mode="edit"]`);
    await sleep(600);
    // Anchors are drawn above the effects. Pick one whose centre is not covered by another item.
    // The canvas draws items in z-order, so the topmost item under a point is the last .ck-item (in DOM order) whose box holds it.
    // (.ck-item has pointer-events: none: the kit resolves the hit in its model, so elementFromPoint cannot see an item.)
    const pick = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.view.active .mo-edit .ck-item')];
      const nodes = items.filter((n) => n.dataset.id?.startsWith('anchor:'));
      const seen = [];
      for (const n of nodes) {
        n.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = n.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        const covering = items.filter((o) => { const q = o.getBoundingClientRect(); return x >= q.left && x <= q.right && y >= q.top && y <= q.bottom; });
        const top = covering[covering.length - 1];
        if (top === n) return { id: n.dataset.id, x, y };
        seen.push(`${n.dataset.id} covered by ${top?.dataset.id ?? 'nothing'}`);
      }
      return { none: seen.slice(0, 4).join(' | ') || `${nodes.length} anchors drawn` };
    });
    expect(pick && !pick.none, `no anchor is topmost at its centre: ${pick?.none ?? 'no anchors drawn'}`);
    const name = pick.id.slice('anchor:'.length);
    // The anchor's inspector fieldset holds its X and Y (0..1), the values the drag changes.
    const read = () => page.evaluate((n) => {
      const f = document.querySelector(`.view.active .mo-anchor[data-anchor="${n}"]`);
      return f ? [...f.querySelectorAll('input')].map((i) => i.value).join(',') : null;
    }, name);
    const v0 = await read();
    expect(v0 !== null, `no Inspector fields for anchor ${name}`);
    await page.mouse.move(pick.x, pick.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(pick.x + i * 4, pick.y + i * 3);
    await page.mouse.up();
    await sleep(400);
    const v1 = await read();
    expect(v1 !== v0, `the Inspector did not follow the drag of ${name} (${v0} -> ${v1})`);
    await overlay('lib', true);
    const unsaved = await page.locator(`${V}.mo-item[aria-current="true"] .mo-item-dirty`).count();
    await overlay('lib', false);
    expect(unsaved > 0, 'the library shows no Unsaved badge for the edited file');
    await shot(`motion-${sizeName}`);
    await page.click(`${V}[data-mod-undo]`);
    await sleep(400);
    const v2 = await read();
    expect(v2 === v0, `undo did not restore ${name} (${v1} -> ${v2}, was ${v0})`);
    await page.click(`${V}button[data-mode="stage"]`);
    return `anchor ${name} X,Y ${v0} -> ${v1} -> undo ${v2}`;
  });
  await check('Motion: stance file is read-only with the generated note', async () => {
    await overlay('lib', true);
    const item = page.locator(`${V}.mo-item[data-kind="stance"]`).first();
    await item.waitFor({ state: 'visible', timeout: 8000 });
    await item.click();
    await sleep(1200);
    await overlay('lib', false);
    const note = await page.locator(`${V}.mo-generated`).count();
    expect(note > 0, 'no generated note on the stance file');
    // Open the Inspector so the generated note and its fields are in the picture, then measure them.
    await overlay('insp', true);
    const totalInputs = await page.locator(`${V}.mo-insp input`).count();
    const enabledInputs = await page.locator(`${V}.mo-insp input:not([disabled])`).count();
    await shot(`motion-stance-${sizeName}`);
    await overlay('insp', false);
    expect(totalInputs > 0, 'the stance Inspector shows no fields');
    expect(enabledInputs === 0, `${enabledInputs} of ${totalInputs} Inspector fields are editable on a generated stance file`);
    return `generated note shown; ${totalInputs} Inspector fields, all read-only`;
  });
  await check('Motion: Open in Asset Gallery from the library', async () => {
    // The link appears in the Inspector for a file with source frames: pick an animation that has them.
    // Walk outfit, animation and stance entries until a selected file shows the link (an outfit shows its painted frames).
    // An enabled link only: a disabled one carries its reason in its title (no source frame for that pose).
    const LINK = `${V}.mo-x-assets:not([disabled])`;
    let btn = page.locator(LINK).first();
    for (const kind of ['outfit', 'animation', 'stance']) {
      const items = page.locator(`${V}.mo-item[data-kind="${kind}"]`);
      const n = Math.min(await items.count(), 8);
      for (let i = 0; i < n && await btn.count() === 0; i++) {
        await overlay('lib', true);
        await items.nth(i).click();
        await sleep(700);
        await overlay('lib', false);
        await overlay('insp', true);
        btn = page.locator(LINK).first();
        if (await btn.count() === 0) await overlay('insp', false);
      }
    }
    if (await btn.count() === 0) {
      const why = await page.locator(`${V}.mo-x-assets[disabled]`).first().getAttribute('title').catch(() => null);
      throw Error(`no selected animation or stance has an enabled "Open source frames in Asset Gallery"${why ? ` (last reason: ${why})` : ''}`);
    }
    await btn.click();
    await sleep(1200);
    expect(await activeView() === 'view-mod-assets' || (await hashNow()).includes('mod=assets'), 'did not open Asset Gallery');
    return await hashNow();
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
