// tools/screenshot.mjs — capture real screenshots of the game into docs/preview/.
//
// Serves the project on a local port, then drives headless Chrome/Edge through
// the app's ?shot= states (see main.js): startup, title, map (a fresh seeded run), and
// combat (first fight of that run). No dependencies beyond a local Chrome/Edge.
//
//   node tools/screenshot.mjs            → docs/preview/{startup,title,map,combat,...}.png
//   node tools/screenshot.mjs --out DIR  → capture into DIR instead

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const SHOTS = [
  { name: 'startup', query: '?shot=startup' },
  { name: 'title', query: '?shot=title' },
  { name: 'map', query: '?shot=map' },
  { name: 'combat', query: '?shot=combat' },
  { name: 'fx', query: '?shot=fx' }, // combat FX posed frozen mid-animation
  { name: 'boss-intro', query: '?shot=boss' }, // boss name splash, held
  // Added 2026-07-28 (Vira, reviewing #10). ?shot=death shipped in src/main.js and
  // never reached this list — so the one screen I added a state FOR, because nothing
  // could photograph it, still was not photographed by the preview generator. 10
  // states in main.js, 9 here. The PNG is deliberately NOT in the same commit:
  // running this tool rewrites ALL of docs/preview/ under the new high-contrast
  // default, which is a visible artifact change and Constantine's to see coming. The
  // list is right now; the folder is still stale, which was already true and recorded.
  { name: 'death', query: '?shot=death' }, // YOU PERISHED — the worst contrast in the game
  { name: 'coop-combat', query: '?shot=coop' }, // LAN co-op combat board (2 players)
  { name: 'coop-map', query: '?shot=coopmap' }, // LAN co-op shared map
  { name: 'coop-reward', query: '?shot=coopreward' }, // per-member reward pick
  { name: 'coop-shrine', query: '?shot=coopshrine' }, // rest / smith / Mend an ally
  { name: 'coop-catchup', query: '?shot=coopcatchup' }, // reconnect catch-up series
];

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const outDir = resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'docs/preview');

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('screenshot: no Chrome/Edge found — install one or add its path to BROWSERS.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const { server, port } = await serve({ root: ROOT, port: 8123, open: false });

// IMPORTANT: async spawn, not spawnSync — the page is served by THIS process,
// so a synchronous spawn would block the event loop and deadlock Chrome's
// requests against our own server.
// ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
// Chrome's own TMPDIR inside it, and removes it whatever happens. This function
// launches ONE BROWSER PER SHOT and passed no `--user-data-dir`, so every shot
// stranded a `/tmp/.org.chromium.Chromium.*` — the single densest source of the
// 2208 measured on this box. `awaitEndpoint` is off: one-shot `--screenshot=`
// never prints a DevTools endpoint, it writes a file and exits.
async function capture(shot) {
  const out = resolve(outDir, `${shot.name}.png`);
  const { child, close: dropBrowser } = await launchBrowser({
    prefix: 'shot-', browser, headless: '--headless=new', awaitEndpoint: false,
    args: ['--window-size=1440,860', '--virtual-time-budget=8000', `--screenshot=${out}`],
    urlArg: `http://localhost:${port}/${shot.query}`,
  });
  return new Promise((done) => {
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    const killer = setTimeout(() => { dropBrowser(); }, 30000);
    child.on('close', () => {
      clearTimeout(killer);
      dropBrowser();
      // Chrome can exit 0 even when the write fails — trust its own report.
      const ok = /bytes written to file/.test(output) && existsSync(out);
      console.log(`  ${ok ? '✓' : '✗'} ${shot.name} → ${out}`);
      if (!ok) console.error(`    ${output.trim().split('\n').slice(-2).join(' | ')}`);
      done(ok);
    });
    child.on('error', (e) => {
      clearTimeout(killer);
      dropBrowser();
      console.error(`  ✗ ${shot.name}: ${e.message}`);
      done(false);
    });
  });
}

let failed = 0;
for (const shot of SHOTS) {
  if (!(await capture(shot))) failed++;
}

server.close();
process.exit(failed ? 1 : 0);
