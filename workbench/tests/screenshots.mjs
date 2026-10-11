// workbench/tests/screenshots.mjs — capture the Workbench for docs/workbench/screenshots/.
//
//   node workbench/tests/screenshots.mjs [--port 4300] [--out <dir>]
//
// --out defaults to docs/workbench/screenshots (relative paths are from the
// repository root); CI writes to a temporary folder and uploads it as an
// artifact (.github/workflows/workbench.yml). Run tools/engine-export.mjs
// first so Engine Export shows the tables.
//
// Starts the Workbench with its child tools, drives it with Playwright's
// Chromium at 1600×900 and saves one JPEG per screen, at most 300 KB each
// (lower quality when needed). Playwright is resolved from PLAYWRIGHT_MODULE, the
// local node_modules, or the global npm root; it is a dev-only dependency and
// is never committed. The browser is /opt/pw-browsers/chromium when present,
// else CHROME_PATH, else Playwright's own.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const at = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : args[i + 1]; };
const PORT = Number(at('--port', process.env.WORKBENCH_PORT || 4300));
const OUT = path.resolve(REPO, at('--out', 'docs/workbench/screenshots'));
const LIMIT = 300 * 1024;

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright'];
  try { tries.push(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim(), 'playwright')); } catch { /* no npm */ }
  for (const t of tries.filter(Boolean)) { try { return require(t); } catch { /* next */ } }
  throw Error('Playwright not found: npm i -g playwright (or set PLAYWRIGHT_MODULE)');
}
const executablePath = ['/opt/pw-browsers/chromium', process.env.CHROME_PATH].find((p) => p && fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [path.join(REPO, 'workbench/server.mjs'), '--port', String(PORT), '--no-open'], { cwd: REPO, stdio: ['ignore', 'pipe', 'inherit'] });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
const url = await new Promise((resolve, reject) => {
  let out = '';
  server.stdout.on('data', (d) => { out += d; const m = out.match(/Workbench: (http:\/\/\S+)/); if (m) resolve(m[1]); });
  server.on('exit', (c) => reject(Error(`workbench exited ${c}`)));
  setTimeout(() => reject(Error('workbench did not start')), 20000);
});
console.log(`workbench at ${url}`);

const session = await (await fetch(`${url}/api/session`)).json();
const call = async (p, body) => (await fetch(`${url}/api/${p}`, { method: body ? 'POST' : 'GET', headers: { 'x-studio-token': session.token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
for (let i = 0; i < 120; i++) {
  const tools = await call('tools');
  if (tools.every((t) => t.status !== 'starting')) { console.log(tools.map((t) => `${t.id}:${t.status}`).join(' ')); break; }
  await sleep(500);
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error:', e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.error('console:', m.text().slice(0, 300)); });
fs.mkdirSync(OUT, { recursive: true });

async function shot(name) {
  await sleep(300);
  // Always JPEG, so the names the READMEs link never change; lower the
  // quality until the file fits the 300 KB budget.
  const file = path.join(OUT, `${name}.jpg`);
  let buf;
  for (const quality of [82, 74, 66, 58]) { buf = await page.screenshot({ type: 'jpeg', quality }); if (buf.length <= LIMIT) break; }
  fs.rmSync(path.join(OUT, `${name}.png`), { force: true });
  fs.writeFileSync(file, buf);
  console.log(`${path.relative(REPO, file)}  ${Math.round(buf.length / 1024)} KB`);
}
const go = async (label, wait = 1500) => { await page.click(`.rail-item[aria-label^="${label}"]`); await sleep(wait); };

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* none */ } });
await page.reload({ waitUntil: 'domcontentloaded' });
await sleep(7000);
await shot('01-home');

await go('Content Editor', 5000); await shot('02-content-editor');
// Ctrl+K typed inside the (cross-origin) studio frame still opens the palette.
await page.locator('#view-editor iframe').first().contentFrame().locator('body').click({ position: { x: 150, y: 40 } }).catch(() => {});
const inFrame = await page.evaluate(() => document.activeElement?.tagName === 'IFRAME');
await page.keyboard.press('Control+k');
await sleep(400);
if (!inFrame) console.warn('skipped: focus did not reach the Content Editor frame');
else if (await page.locator('#palette').isHidden()) { console.error('FAIL: Ctrl+K inside the Content Editor frame did not open the palette'); process.exitCode = 1; }
else console.log('Ctrl+K from the Content Editor frame opens the palette');
await page.keyboard.press('Escape');
await go('UI Studio', 5000); await shot('03-ui-studio');
await go('Pose & FX', 6000); await shot('04-pose-fx');
await go('Library', 7000); await shot('05-library');
await go('Engine Export', 2000); await shot('06-engine-export');

await go('Build & Checks', 800);
await page.click(`#view-jobs [data-run="tool-tests"]`);
for (let i = 0; i < 240; i++) {
  const { runs } = await call('jobs');
  if (runs[0] && runs[0].id === 'tool-tests' && runs[0].status !== 'running') { console.log(`tool-tests: ${runs[0].status} in ${runs[0].durationMs} ms`); break; }
  await sleep(500);
}
await sleep(800);
await page.click('[data-toggle-run]');
await sleep(1200);
await page.evaluate(() => { const pre = document.querySelector('.run-log'); if (pre) pre.scrollTop = pre.scrollHeight; document.querySelector('#view-jobs').scrollTop = 0; });
await shot('07-build-checks');

await go('Home', 800);
await page.keyboard.press('Control+k');
await page.keyboard.type('pre');
await sleep(400);
await shot('08-command-palette');
await page.keyboard.press('Escape');

await page.click('.brand');
await page.keyboard.press('?');
await sleep(400);
await shot('09-shortcuts');
await page.keyboard.press('Escape');

await go('Library', 1500);
await page.evaluate(() => { document.querySelector('#view-library').scrollTop = 0; });
await page.click('[data-device="phone"]');
await sleep(3000);
await shot('10-preview-phone');

await go('Home', 300);
await page.click('#rail-settings'); await sleep(1200);
await shot('11-settings');

await browser.close();
stop();
process.exit(process.exitCode || 0);
