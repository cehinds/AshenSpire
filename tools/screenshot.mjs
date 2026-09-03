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
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // Playwright's managed Chromium, which CI images and dev containers often
  // have when no system Chrome is installed. $PLAYWRIGHT_BROWSERS_PATH names
  // the root; the glob is resolved below because the build number moves.
];

// Resolve a Playwright-managed Chromium if none of the fixed paths exist. This
// is the only browser present in some environments, and "no Chrome found" there
// is a false negative that silently costs the run its screenshots.
function playwrightChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root)
    .filter((d) => d.startsWith('chromium'))
    .sort()
    .reverse();
  for (const d of dirs) {
    for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = resolve(root, d, rel);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

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
  // Added 2026-09-03 (AS-HD-040). ?shot=customize has existed in src/main.js all
  // along and was never captured — so the ONE screen that draws the class figure
  // at full size had no photographic coverage at all. The class sprites were
  // replaced wholesale in #590 and not a single shot in this list would have
  // shown it, which is exactly how art changes ship unseen. Same defect Vira
  // recorded above for ?shot=death, one screen over.
  //
  // Still uncovered, and named so the next reader does not have to diff it:
  // compendium, components, crisis, event, profile, rest, reward, shop — nine
  // states in main.js against twelve here before this line.
  // `stable: true` — see captureStable below. These screens hold still once
  // they have settled, so two captures of one must come out byte-identical;
  // the animated screens above cannot make that promise and are not asked to.
  { name: 'customize', query: '?shot=customize', stable: true }, // character build — the class figure
  // One capture per class, and one off-default tint, because the class sprites
  // are four sources × five tints and a single default shot is evidence for one
  // of twenty. art.md §§145-150,189-192 wants every named variant.
  { name: 'class-reaver', query: '?shot=customize&shotClass=reaver', stable: true },
  { name: 'class-starseer', query: '?shot=customize&shotClass=starseer', stable: true },
  { name: 'class-rogue', query: '?shot=customize&shotClass=rogue', stable: true },
  { name: 'class-herald', query: '?shot=customize&shotClass=herald', stable: true },
  { name: 'class-rogue-ember', query: '?shot=customize&shotClass=rogue&shotTint=ember', stable: true },
];

const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const outDir = resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'docs/preview');

// --viewport WxH. The window size was hardcoded to the desktop shape, so this
// tool could only ever answer "how does it look on a desktop". RUNBOOKS/art.md
// §§145-150,181-192 wants an art change previewed at a phone size too, and a
// preview at the wrong shape is not evidence about the right one.
const vi = args.indexOf('--viewport');
const VIEWPORT = (() => {
  const raw = vi >= 0 ? args[vi + 1] : '1440x860';
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(raw || '');
  if (!m) {
    console.error(`screenshot: --viewport wants WxH (e.g. 390x844), got "${raw}"`);
    process.exit(1);
  }
  return `${m[1]},${m[2]}`;
})();

const browser = BROWSERS.find((p) => existsSync(p)) || playwrightChromium();
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
    // 8000 was not enough and failed at random: successive runs caught a
    // DIFFERENT screen mid fade-in each time (class-rogue-ember at mean
    // brightness 24, then class-starseer at 21, against 39.6 for a settled
    // frame). A capture that is sometimes a half-faded frame is not evidence,
    // and the flake is invisible unless you measure the brightness.
    args: [`--window-size=${VIEWPORT}`, '--virtual-time-budget=20000', `--screenshot=${out}`],
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

// A CAPTURE THAT IS NOT REPRODUCIBLE IS NOT EVIDENCE, AND THIS RACE IS STILL OPEN.
//
// The bug: a one-shot `--screenshot` fires whenever virtual time expires, and
// sometimes that is before the screen's content has finished coming up. The
// result is a half-faded frame — full layout, everything dim — that looks like
// a design choice rather than a fault. Nothing about it reads as wrong.
//
// I have already reported this fixed once, by raising --virtual-time-budget
// from 8s to 20s. THAT WAS WRONG. Measured afterwards over five full runs, 3 of
// 5 still produced one dim frame, in a DIFFERENT shot each time, and raising
// the budget further does not converge it — the capture point is simply not
// tied to the page being ready.
//
// So this does not try to out-wait the race. It requires the frame to be
// REPRODUCIBLE: capture twice, keep it only if the two are byte-identical.
// Measured across three clean runs, every `stable` shot here is byte-identical
// run to run, so agreement is a real bar rather than a hopeful one; a frame
// caught mid-fade disagrees with its own retake and is thrown away. After
// MAX_TRIES the run FAILS rather than committing a frame it cannot reproduce.
//
// This is not "run it until it looks right" — the difference is that the
// failure is now loud, and no capture reaches the folder unless the harness
// produced it twice. The screens above with live animation (map, combat, fx,
// the ambient embers) cannot pass this and are not marked `stable`; they are
// still captured once, and still carry the race. Fixing it AT SOURCE means
// waiting on a readiness signal from the app rather than on a timer, which is
// a change to the shot states themselves and belongs in its own commit.
const MAX_TRIES = 4;
async function captureStable(shot) {
  const out = resolve(outDir, `${shot.name}.png`);
  const probe = resolve(outDir, `.${shot.name}.probe.png`);
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    if (!(await capture(shot))) return false;
    if (!(await capture({ ...shot, name: `.${shot.name}.probe` }))) return false;
    const a = createHash('sha256').update(readFileSync(out)).digest('hex');
    const b = createHash('sha256').update(readFileSync(probe)).digest('hex');
    rmSync(probe, { force: true });
    if (a === b) return true;
    const more = attempt < MAX_TRIES ? ' — retaking' : '';
    console.error(`    ${shot.name}: frame not reproducible (try ${attempt}/${MAX_TRIES})${more}`);
  }
  console.error(`  ✗ ${shot.name}: no reproducible frame in ${MAX_TRIES} tries; NOT evidence.`);
  rmSync(out, { force: true });
  return false;
}

let failed = 0;
for (const shot of SHOTS) {
  const ok = shot.stable ? await captureStable(shot) : await capture(shot);
  if (!ok) failed++;
}

server.close();
process.exit(failed ? 1 : 0);
