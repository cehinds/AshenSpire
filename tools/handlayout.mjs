// tools/handlayout.mjs — the hand-layout word (C2), measured: overlap FITS,
// paging is UNTOUCHED, and every claim is a number from a rendered tree.
//
// WHAT IT CHECKS, per cell (mode x text size, at 390x844, ten-card hand — the
// largest dealable hand, balance.handMax, posed through ?shotHand which draws
// by the engine's own door):
//   1. the word derived onto <html data-hand-layout> is the mode asked for —
//      through ?shotSettings, the app's own settings resolution, so a tree
//      without the word fails HERE first, by name
//   2. the hand holds exactly ten cards (the pose reached the edge it claims)
//   3. OVERLAP ONLY — Law 5 clause 1, per scroll container: the hand's
//      horizontal scroll travel is ZERO, and vertical too (the flattened fan
//      must not buy width with a hidden vertical scroller). PAGING: travel is
//      REPORTED, never asserted — the strip is the mode's composition, C2's
//      closed exemption, named here at the container's own check.
//   4. every card is HITTABLE at the centre of its exposed strip:
//      elementFromPoint resolves into that card — drawn width is not the
//      claim, the tappable sliver is (Law 4's spirit: measure the rendered
//      rect a finger meets, not the box the CSS declares)
//   5. sliver widths reported, min named, in local px and on-glass px — the
//      compensating reader for a cramped sliver is the inspect hold
//      (tools/inspecthold.mjs owns that corpus, in both modes)
// Plus one edge cell: overlap x M at a ONE-card hand (the other edge of the
// derivation — no neighbour, no margin, travel still zero).
// In paging cells the tool also prints sha256 of .hand-area's outerHTML so two
// trees can be compared for byte-identity from outside (the C2 ruling that the
// shipped strip keeps its seat is a diffable claim, not a mood).
//
// Usage
//   node tools/handlayout.mjs                      source tree via serve.mjs
//   node tools/handlayout.mjs --root DIR           another tree (the known-bad run)
//   node tools/handlayout.mjs --shots DIR          also write one 390x844 png per cell
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// OBSERVED RED (the instrument rule), same door as the real input — the mode
// enters by ?shotSettings into the app's own store and derivation:
//   dev 71e3edd (pre-word)      exit 1: check 1 red in every cell by name
//                               (data-hand-layout never appears), check 2 red
//                               (no ?shotHand on that tree — five cards), and
//                               the overlap travel check red on the shipped
//                               scroller. The run is in the branch report;
//                               re-run with --root against any tree.
//   this tree                   exit 0, all cells.
//
// BOUNDARY. One shape (390x844) — the word only arranges the NARROW hand; the
// wide fan is one composition in both modes and inspecthold covers it at
// 1200x730. Headless Chromium hit-testing; no real finger. Sliver hittability
// is geometric (elementFromPoint), not a claim about contact patches.
//
// REMOVAL: deleted the day the hand-layout word leaves balance.ui, or a
// browser-level layout harness supersedes CDP measurement.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TOOLS = resolve(fileURLToPath(new URL('.', import.meta.url)));
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve(argOf('--root') || resolve(TOOLS, '..'));
const { serve } = await import(join(TOOLS, 'serve.mjs'));

const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const shotsDir = argOf('--shots');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 390, H = 844, DPR = 2;

// mode x textSize x handSize. Ten is balance.handMax — read there, posed here;
// if handMax ever moves, ?shotHand refuses loudly and this list is one edit.
const CELLS = [
  { mode: 'paging', text: 'M', hand: 10 },
  { mode: 'paging', text: 'XL', hand: 10 },
  { mode: 'overlap', text: 'M', hand: 10 },
  { mode: 'overlap', text: 'XL', hand: 10 },
  { mode: 'overlap', text: 'M', hand: 1 }, // the other edge: one card, no neighbour
];

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

async function main() {
  if (!browserPath) { console.error('handlayout: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'handlayout-'));
  const s = await serve({ root: ROOT, port: 8281, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`handlayout — ${base} (root ${ROOT})`);
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true }, S);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
  const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
  const until = async (x, w, ms = 20000) => { const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };

  let fails = 0, ran = 0;
  const ok = (b, what) => { if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };

  for (const cell of CELLS) {
    ran++;
    const name = `${cell.mode}-${cell.text}-hand${cell.hand}`;
    const settings = { handLayout: cell.mode, textSize: cell.text };
    const url = `${base}?shot=combat&shotHand=${cell.hand}&shotSettings=${encodeURIComponent(JSON.stringify(settings))}`;
    await cdp.send('Page.navigate', { url }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, name); await wait(600);
    console.log(`\n  ${name} @ ${W}x${H}`);

    const facts = await ev(`(() => {
      const hand = document.querySelector('.hand');
      const cards = [...hand.querySelectorAll(':scope > .card')];
      const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
      const scrolls = hand.scrollWidth > hand.clientWidth;
      const slivers = cards.map((c, i) => {
        // A scroller's cards are hittable AFTER the scroll that reaches them —
        // that scroll is paging's own contract, so the instrument performs it
        // rather than declaring an off-strip card unreachable. In overlap
        // nothing scrolls and this line is a no-op, so the overlap claim stays
        // the strong one: hittable where they stand.
        if (scrolls) c.scrollIntoView({ inline: 'center', block: 'nearest' });
        const r = c.getBoundingClientRect();
        const sib = c.nextElementSibling;
        const sr = sib ? sib.getBoundingClientRect() : null;
        const right = sr && sr.left < r.right && sr.left > r.left ? sr.left : r.right;
        const x = (r.left + right) / 2, y = r.top + r.height / 2;
        let el = document.elementFromPoint(x, y);
        let hit = false; for (let e = el; e; e = e.parentElement) if (e === c) { hit = true; break; }
        return { i, w: right - r.left, hit, at: [Math.round(x), Math.round(y)], hitTag: el ? el.className || el.tagName : 'nothing' };
      });
      if (scrolls) hand.scrollLeft = 0; // leave the pose as it booted for the screenshot
      return {
        word: document.documentElement.dataset.handLayout || null,
        layout: document.documentElement.getAttribute('data-layout'),
        zoom,
        n: cards.length,
        travelX: hand.scrollWidth - hand.clientWidth,
        travelY: hand.scrollHeight - hand.clientHeight,
        cardW: cards.length ? cards[0].getBoundingClientRect().width : 0,
        slivers,
        handArea: (document.querySelector('.hand-area') || { outerHTML: '' }).outerHTML,
      };
    })()`);

    ok(facts.word === cell.mode, `word: <html data-hand-layout> derived '${facts.word}' for asked '${cell.mode}'`);
    ok(facts.n === cell.hand, `pose: hand holds ${facts.n} of the ${cell.hand} asked (handMax edge posed through the engine's own draw)`);
    if (cell.mode === 'overlap') {
      ok(facts.travelX === 0, `Law 5: hand horizontal scroll travel ${facts.travelX} local px (must be 0 in overlap)`);
      ok(facts.travelY === 0, `Law 5: hand vertical scroll travel ${facts.travelY} local px (a flattened fan must not scroll down instead)`);
    } else {
      console.log(`    -     paging travel: ${facts.travelX} local px horizontal / ${facts.travelY} vertical — REPORTED, not asserted: the strip IS this mode's composition (C2), the clause-2 exemption named here at its container`);
    }
    const unhit = facts.slivers.filter((sv) => !sv.hit);
    ok(unhit.length === 0, `slivers: every card hittable at its exposed centre${unhit.length ? ` — MISSED ${unhit.map((sv) => `#${sv.i}(hit ${sv.hitTag} at ${sv.at})`).join(', ')}` : ''}`);
    // getBoundingClientRect is the zoomed VIEWPORT ruler: viewport CSS px is
    // what a finger meets on a 390-wide glass; local px divides the zoom back
    // out; device px multiplies the dpr in. Three rulers, printed as three.
    const widths = facts.slivers.map((sv) => sv.w);
    const minW = Math.min(...widths);
    console.log(`    -     slivers: min ${minW.toFixed(1)} viewport px (${(minW / facts.zoom).toFixed(1)} local at zoom ${facts.zoom}, ${(minW * DPR).toFixed(0)} device at dpr ${DPR}); top card ${widths[widths.length - 1].toFixed(1)} viewport px`);
    if (cell.mode === 'paging') {
      const hash = createHash('sha256').update(facts.handArea).digest('hex').slice(0, 16);
      console.log(`    -     .hand-area DOM sha256/16 ${hash} (byte-identity handle for cross-tree diff)`);
    }
    if (shotsDir) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, S);
      writeFileSync(join(shotsDir, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`    shot ${name}.png`);
    }
  }

  cdp.close(); child.kill(); s.server.close();
  if (!ran) { console.error('handlayout: NOTHING RAN'); process.exit(2); }
  console.log(fails ? `\nhandlayout: ${fails} FAIL` : '\nhandlayout: all green');
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error('handlayout:', e.message); process.exit(2); });
