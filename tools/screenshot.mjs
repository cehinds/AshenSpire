// tools/screenshot.mjs — capture real screenshots of the game into docs/preview/.
//
// Serves the project on a local port, then drives headless Chrome/Edge through
// the app's ?shot= states (see main.js): title, map (a fresh seeded run), and
// combat (first fight of that run). No dependencies beyond a local Chrome/Edge.
//
//   node tools/screenshot.mjs            → docs/preview/{title,map,combat}.png
//   node tools/screenshot.mjs --out DIR  → capture into DIR instead

import { spawn } from 'node:child_process';
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
  { name: 'title', query: '' },
  { name: 'map', query: '?shot=map' },
  { name: 'combat', query: '?shot=combat' },
  { name: 'fx', query: '?shot=fx' }, // combat FX posed frozen mid-animation
  { name: 'boss-intro', query: '?shot=boss' }, // boss name splash, held
  { name: 'coop-combat', query: '?shot=coop' }, // LAN co-op combat board (2 players)
  { name: 'coop-map', query: '?shot=coopmap' }, // LAN co-op shared map
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
function capture(shot) {
  const out = resolve(outDir, `${shot.name}.png`);
  return new Promise((done) => {
    const child = spawn(browser, [
      '--headless=new',
      '--disable-gpu',
      '--window-size=1440,860',
      '--virtual-time-budget=8000',
      `--screenshot=${out}`,
      `http://localhost:${port}/${shot.query}`,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    const killer = setTimeout(() => child.kill(), 30000);
    child.on('close', () => {
      clearTimeout(killer);
      // Chrome can exit 0 even when the write fails — trust its own report.
      const ok = /bytes written to file/.test(output) && existsSync(out);
      console.log(`  ${ok ? '✓' : '✗'} ${shot.name} → ${out}`);
      if (!ok) console.error(`    ${output.trim().split('\n').slice(-2).join(' | ')}`);
      done(ok);
    });
    child.on('error', (e) => {
      clearTimeout(killer);
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
