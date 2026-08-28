// tools/overlapreader.mjs — the two-knob refusal, observed at the boot door:
// overlap does not flatten without its reader.
//
// THE TRAP IT PINS (named in my 08-14 log, ruled by Sunna the same day):
// balance.ui.handLayoutModes offering 'overlap' and balance.ui.inspectHold.ms
// being 0 are each defensible rows alone — overlap is a legal layout, ms 0 is
// the inspect gesture's legal off position. TOGETHER they author a ten-card
// hand of ~27-30 viewport px slivers (tools/handlayout.mjs, 390x844), under
// the 44 px tap floor, with the one compensating reader turned off — nine
// unreadable cards from a table edit, and until this check no validator
// crossed the two rows. Sunna's ruling: REFUSE, in validateContent, loud at
// boot — not a warning ("a warning that boots is the fourth silent state"),
// not accept-in-writing.
//
// WHAT IT CHECKS, one case per boot, each on a DISPOSABLE COPY of the tree:
//   1. control: the shipped rows (overlap offered, ms 400) boot with NO
//      validation banner, and the overlap hand actually renders — ten cards,
//      the word on <html>. The mode WITH its reader is legal and works.
//   2. refusal (the known-bad): ms 400 -> 0 in the REAL content row, overlap
//      still offered. Boot must raise the CONTENT VALIDATION banner naming
//      BOTH rows and the sliver fact — the author who made the table edit
//      must learn which two entries conflict and why.
//   3. green control (Sunna's named edge): handLayoutModes -> ['paging'] AND
//      ms -> 0. Must boot with NO banner and a working ten-card paging hand —
//      the strip needs no reader, and turning the gesture off stays a legal
//      tuning row. A refusal that also eats this edit would be the check
//      overreaching its ruling.
//
// THE DOOR (the instrument rule's same-door clause, stated here and printed
// in the run's own output): every known-bad enters as a CONTENT ROW — an edit
// to src/content/balance.js in the copied tree, the same file a designer
// edits — and is judged by a real boot: served over http, loaded in headless
// Chromium, index.html -> src/main.js -> validateContent(contentBundle) ->
// failureBanner, every stage a player's boot performs. Nothing is handed to
// validateContent() directly; a synthetic bundle would test the half that was
// never in doubt.
//
// Usage
//   node tools/overlapreader.mjs                   source tree
//   node tools/overlapreader.mjs --root DIR        another tree (the observed-red run)
//   node tools/overlapreader.mjs --browser PATH    explicit Chromium
// Exit: 0 all green · 1 a finding · 2 usage / no browser / fixture found no row / NOTHING RAN
//
// OBSERVED RED (the instrument rule), same door as the real input:
//   b277ec2 (pre-refusal)       exit 1: case 2 boots CLEAN — overlap offered,
//                               reader off, ten ~30 px slivers and no banner,
//                               which is precisely the trap. Cases 1 and 3
//                               pass there, which is what they protect.
//   this tree                   exit 0: case 2 refuses by both names, 1 and 3
//                               still boot clean.
// Re-run either side with --root against any tree.
//
// BOUNDARY. This corpus judges the BOOT REFUSAL only — sliver geometry is
// tools/handlayout.mjs, the gesture itself is tools/inspecthold.mjs. The
// fixture edits are exact-match string replacements and REFUSE (exit 2) if
// the row is not where balance.js puts it today — a mutation that silently
// matched nothing would run the control three times and call it a corpus.
// The banner assertion reads the same DOM a player sees; it does not read the
// console, so the 12-error truncation in main.js is invisible here (this
// refusal emits one error and rides well inside it).
//
// REMOVAL: deleted the day the refusal leaves validateContent, or the day
// either row (handLayoutModes, inspectHold) leaves balance.ui.

import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const TOOLS = resolve(fileURLToPath(new URL('.', import.meta.url)));
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve(argOf('--root') || resolve(TOOLS, '..'));
const { serve } = await import(join(TOOLS, 'serve.mjs'));

const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 390, H = 844, DPR = 2;

// The two content rows, as balance.js spells them today. Exact strings, not
// regexes wide enough to "find" something else — and each mutation asserts it
// matched exactly once or the whole run refuses (exit 2): an empty mutation is
// a wrong-place empty, and it means the opposite of clean (SOP 2's ⚙ clause).
const ROW_MS = 'inspectHold: {\n      ms: 400,\n    },';
const ROW_MS_OFF = 'inspectHold: {\n      ms: 0,\n    },';
const ROW_MODES = "handLayoutModes: ['paging', 'overlap'],";
const ROW_MODES_PAGING = "handLayoutModes: ['paging'],";

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'overlapreader-'));
  for (const d of ['src', 'styles', 'assets']) {
    if (existsSync(resolve(ROOT, d))) cpSync(resolve(ROOT, d), resolve(dir, d), { recursive: true });
  }
  cpSync(resolve(ROOT, 'index.html'), resolve(dir, 'index.html'));
  return dir;
}

// Apply [from, to] replacements to the copy's balance.js; refuse loudly if any
// pattern is not present exactly once.
function mutate(dir, edits) {
  const p = resolve(dir, 'src/content/balance.js');
  let src = readFileSync(p, 'utf8');
  for (const [from, to, what] of edits) {
    const first = src.indexOf(from);
    if (first < 0 || src.indexOf(from, first + 1) >= 0) {
      console.error(`overlapreader: fixture found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home for ${what} — the row moved; update ROW_* to where balance.js keeps it now`);
      process.exit(2);
    }
    src = src.slice(0, first) + to + src.slice(first + from.length);
  }
  writeFileSync(p, src, 'utf8');
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}
function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = ''; const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-300)}`)), 12000);
  });
}

const CASES = [
  {
    name: 'control',
    row: 'shipped rows untouched — overlap offered, inspectHold.ms 400',
    edits: [],
    mode: 'overlap',
    expectBanner: false,
  },
  {
    name: 'refusal',
    row: "content row edit: inspectHold.ms 400 -> 0 (handLayoutModes still offers 'overlap')",
    edits: [[ROW_MS, ROW_MS_OFF, 'balance.ui.inspectHold.ms']],
    mode: 'overlap',
    expectBanner: true,
  },
  {
    name: 'paging-only',
    row: "content row edits: handLayoutModes -> ['paging'] AND inspectHold.ms -> 0 (Sunna's green control)",
    edits: [[ROW_MS, ROW_MS_OFF, 'balance.ui.inspectHold.ms'], [ROW_MODES, ROW_MODES_PAGING, 'balance.ui.handLayoutModes']],
    mode: 'paging',
    expectBanner: false,
  },
];

async function main() {
  if (!browserPath) { console.error('overlapreader: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  console.log(`overlapreader — root ${ROOT}`);
  console.log('  door, for every case below: known-bad enters as a CONTENT ROW (src/content/balance.js in a');
  console.log('  disposable copy of this tree), then a REAL BOOT judges it — served over http, headless');
  console.log('  Chromium, index.html -> src/main.js -> validateContent(contentBundle) -> failureBanner:');
  console.log('  every stage a player\'s boot performs. Nothing is handed to validateContent() directly.');

  let fails = 0, ran = 0, port = 8291;
  const ok = (b, what) => { if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };

  for (const c of CASES) {
    ran++;
    console.log(`\n  ${c.name}: ${c.row}`);
    const dir = sandbox();
    mutate(dir, c.edits);
    const profile = mkdtempSync(join(tmpdir(), 'overlapreader-prof-'));
    const s = await serve({ root: dir, port: port++, open: false });
    const { child, wsUrl } = await launchChrome(browserPath, profile);
    const cdp = connectCdp(wsUrl); await cdp.ready;
    try {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true }, S);
      const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
      const until = async (x, w, ms = 20000) => { const t = Date.now();
        while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };

      const settings = { handLayout: c.mode, textSize: 'M' };
      const url = `http://localhost:${s.port}/?shot=combat&shotHand=10&shotSettings=${encodeURIComponent(JSON.stringify(settings))}`;
      await cdp.send('Page.navigate', { url }, S);
      // The banner (when there is one) is raised synchronously at module eval,
      // before the combat pose renders — so waiting for the hand waits past it.
      await until(`!!document.querySelector('.combat .hand .card')`, `${c.name}: combat pose`); await wait(400);

      const facts = await ev(`(() => {
        const banners = [...document.querySelectorAll('.validation-banner')].map((el) => el.textContent);
        return {
          banners,
          word: document.documentElement.dataset.handLayout || null,
          n: document.querySelectorAll('.combat .hand > .card').length,
        };
      })()`);

      const content = facts.banners.filter((t) => t.includes('CONTENT VALIDATION FAILED'));
      if (c.expectBanner) {
        ok(content.length === 1, `boot REFUSED: exactly one content-validation banner on screen (saw ${content.length} of ${facts.banners.length} banners)`);
        const text = content[0] || '';
        ok(text.includes('balance.ui.handLayoutModes') && text.includes('balance.ui.inspectHold.ms'),
          'the refusal names BOTH rows: balance.ui.handLayoutModes and balance.ui.inspectHold.ms');
        ok(/sliver/.test(text) && /44\s*px|tap floor/.test(text),
          'the refusal states the sliver fact against the tap floor — the author learns WHY, not just which');
        console.log(`    -     banner, as the author meets it: ${JSON.stringify(text.slice(0, 400))}`);
      } else {
        ok(content.length === 0, `boot is CLEAN: no content-validation banner (saw ${facts.banners.length} banners total)`);
        ok(facts.word === c.mode, `the hand renders its mode: <html data-hand-layout> = '${facts.word}' for asked '${c.mode}'`);
        ok(facts.n === 10, `the pose is real: ${facts.n} of 10 cards (a clean boot that renders nothing would be a wrong-place clean)`);
      }
    } finally {
      cdp.close(); child.kill(); s.server.close();
      // Wait for Chromium to actually exit before sweeping its profile — the
      // first run of this tool died to that race (ENOTEMPTY mid-shutdown) and
      // took case 3 with it. A janitor must not be able to fail the corpus:
      // the sweep is best-effort, the checks above are the only verdict.
      await new Promise((r) => { child.once('exit', r); setTimeout(r, 3000); });
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp, best-effort */ }
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp, best-effort */ }
    }
  }

  if (!ran) { console.error('overlapreader: NOTHING RAN'); process.exit(2); }
  console.log(fails ? `\noverlapreader: ${fails} FAIL` : '\noverlapreader: all green');
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error('overlapreader:', e.message); process.exit(2); });
