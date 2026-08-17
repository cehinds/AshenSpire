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
//   node tools/handlayout.mjs --selftest           the RE-RUNNABLE known-bad (below)
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
// ...AND THAT RED WAS REF-PINNED, WHICH IS WHY --selftest EXISTS (Vira's doors
// audit, 2026-08-14: "SAME-DOOR when run; the known-bad tree is ref-pinned").
// The observation above needs a 71e3edd checkout to exist; under SOP 2's drift
// clause a red that cannot be re-run is `unknown (drifted)`, not coverage. So
// the corpus is now BUILT, not remembered:
//
//   --selftest copies this tree to a scratch dir, edits ONE REAL SOURCE LINE
//   in the copy, and re-runs THIS WHOLE TOOL at --root COPY. Every stage a
//   real regression travels — serve over http, index.html -> src/main.js ->
//   settings resolution -> combat.js's renderHand + applyHandLayout -> the
//   rendered DOM this tool measures — runs on the planted tree. Nothing is
//   handed to a function; the plant is a source edit, because a source edit is
//   how this defect class actually arrives.
//
//   P1 derivation cut   src/main.js stops writing <html data-hand-layout>.
//                       Expect: check 1 red in EVERY cell, by name.
//   P2 overlap cut      applyHandLayout stops writing the negative margin —
//                       the flattened fan is no longer pulled inside the
//                       strip's width.
//                       Expect: Law 5 travel red in the OVERLAP cells while
//                       the paging cells stay green — the mode-inertness claim
//                       and the overlap claim are separable, and this proves
//                       the tool can tell them apart.
//   C  clean control    the untouched copy must go GREEN, or the plants proved
//                       nothing but that copying a tree breaks it.
//
//   THE PLANT IS KEYED TO THE CONTRACT, NOT TO THE PATH — learned the same day
//   it was written. The renderer collapse (Viki, 2026-08-15) moved P2's line
//   from screens/combat.js to components/hand.js WITHOUT ONE BYTE CHANGING,
//   and a plant keyed to the path refused while the contract it guards was
//   alive three directories over. So each plant carries a CLOSED SET of homes
//   the contract has lived in, exactly one of which must hold it exactly once.
//   Not a search: a closed set can be audited and cannot pass silently through
//   a home nobody imagined. Two homes matching is as loud a refusal as none —
//   one contract in two places is the second copy this house exists to catch.
//   Outside the set it still REFUSES at exit 2 and asks to be re-aimed rather
//   than quietly measuring nothing.
//
// BOUNDARY. One shape (390x844) — the word only arranges the NARROW hand; the
// wide fan is one composition in both modes and inspecthold covers it at
// 1200x730. Headless Chromium hit-testing; no real finger. Sliver hittability
// is geometric (elementFromPoint), not a claim about contact patches.
//
// REMOVAL: deleted the day the hand-layout word leaves balance.ui, or a
// browser-level layout harness supersedes CDP measurement.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// ---- the re-runnable known-bad ---------------------------------------------
// Exact source strings, as the tree spells them today. Each must match exactly
// once in the copy or the whole selftest refuses at exit 2 — a plant that
// matched nothing would run the clean control three times and call it a corpus
// (SOP 2's wrong-place-empty: an empty match means the OPPOSITE of clean).
// `homes` is a CLOSED SET of files the contract has lived in — never a search.
// The line is the contract; the path is where it happens to sit this month. The
// overlap arithmetic moved from combat.js to components/hand.js in the renderer
// collapse (2026-08-15) WITHOUT ONE BYTE CHANGING, so a plant keyed to the path
// refused while the contract it guards was alive and well three directories
// over. Exactly one home must match, exactly once, or the run refuses at exit 2
// and says so: a closed set can be audited, and it cannot pass silently through
// a home nobody imagined the way a regex search would.
const PLANTS = [
  {
    name: 'P1 derivation cut',
    homes: ['src/main.js'],
    from: '  document.documentElement.dataset.handLayout = handLayout;',
    to: '  /* handlayout --selftest P1: derivation cut */',
    what: "main.js's write of <html data-hand-layout>",
    expect: 'check 1 (word) red in every cell',
    mustRed: (out) => /FAIL word:/.test(out),
    mustStay: (out) => /PASS pose:/.test(out), // the pose door is untouched
  },
  {
    name: 'P2 overlap cut',
    homes: ['src/ui/components/hand.js', 'src/ui/screens/combat.js'],
    from: "    els.forEach((el, i) => { el.style.marginLeft = i && o ? `${-o}px` : ''; });",
    to: '    /* handlayout --selftest P2: overlap arithmetic cut */',
    what: "applyHandLayout's negative-margin write (the overlap arm's whole arithmetic)",
    expect: 'Law 5 travel red in the OVERLAP cells, paging cells still green',
    mustRed: (out) => /FAIL Law 5: hand horizontal scroll travel [1-9]/.test(out),
    mustStay: (out) => /PASS word: <html data-hand-layout> derived 'paging'/.test(out),
  },
];

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'handlayout-kb-'));
  for (const d of ['src', 'styles', 'assets']) {
    if (existsSync(resolve(ROOT, d))) cpSync(resolve(ROOT, d), resolve(dir, d), { recursive: true });
  }
  cpSync(resolve(ROOT, 'index.html'), resolve(dir, 'index.html'));
  return dir;
}

function plantInto(dir, p) {
  // Every home in the closed set is checked, so "two homes carry this line" is
  // as loud a refusal as "no home does" — a contract living in two places is
  // the second copy this house exists to catch, and planting into one of them
  // would leave the other quietly holding the hand.
  const hits = [];
  for (const home of p.homes) {
    const path = resolve(dir, home);
    if (!existsSync(path)) continue;
    const src = readFileSync(path, 'utf8');
    const first = src.indexOf(p.from);
    if (first < 0) continue;
    if (src.indexOf(p.from, first + 1) >= 0) {
      console.error(`handlayout --selftest: ${p.name} found MORE THAN ONE copy of its line in ${home}`);
      process.exit(2);
    }
    hits.push({ home, path, src, first });
  }
  if (hits.length !== 1) {
    console.error(`handlayout --selftest: ${p.name} found ${hits.length} homes for its line`);
    console.error(`  searched (closed set): ${p.homes.join(', ')}`);
    if (hits.length > 1) console.error(`  matched: ${hits.map((h) => h.home).join(', ')} — one contract, two homes, which is its own defect`);
    console.error('  The contract moved outside the set. RE-AIM THIS PLANT by adding the surviving');
    console.error('  home to `homes`; do not delete it, and do not widen it to a search — a closed');
    console.error('  set can be audited, a search passes silently through what nobody imagined.');
    console.error('  A corpus that stops matching in silence is the eleven-instruments shape.');
    process.exit(2);
  }
  const { home, path, src, first } = hits[0];
  console.log(`    home: ${home} (of ${p.homes.length} in the closed set)`);
  writeFileSync(path, src.slice(0, first) + p.to + src.slice(first + p.from.length), 'utf8');
}

// Re-run THIS tool against a tree, in a child process, and hand back its output.
function runSelfAt(root) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', root],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(browserPath ? { CHROME: browserPath } : {}) } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => res({ code, out }));
  });
}

async function selftest() {
  console.log('handlayout --selftest — the re-runnable known-bad');
  console.log('  DOOR: every known-bad below is a SOURCE EDIT to a disposable copy of this tree');
  console.log(`  (root ${ROOT}), and is judged by re-running this whole tool at --root COPY: served`);
  console.log('  over http, index.html -> src/main.js -> settings resolution -> combat.js renderHand');
  console.log('  + applyHandLayout -> the rendered DOM, every stage a real regression travels.');
  console.log('  Nothing is handed to a function; a source edit is how this defect class arrives.\n');

  let fails = 0;
  const ok = (b, what) => { if (b) console.log(`  PASS ${what}`); else { fails++; console.log(`  FAIL ${what}`); } };

  // The clean control FIRST: if a copied tree cannot go green, no red below
  // means anything — it would only prove that copying breaks the app.
  const cleanDir = sandbox();
  console.log('  control: untouched copy of this tree (no plant)');
  const clean = await runSelfAt(cleanDir);
  ok(clean.code === 0, `control: the copied tree is GREEN (exit ${clean.code}) — the plants below are the only difference`);
  try { rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }

  for (const p of PLANTS) {
    console.log(`\n  ${p.name}: ${p.what}`);
    console.log(`    plant: expect ${p.expect}`);
    const dir = sandbox();
    plantInto(dir, p);
    const r = await runSelfAt(dir);
    ok(r.code === 1, `${p.name}: the planted tree goes RED (exit ${r.code}, want 1)`);
    ok(p.mustRed(r.out), `${p.name}: red BY NAME — ${p.expect}`);
    ok(p.mustStay(r.out), `${p.name}: and the untouched claims stay green (the plant is narrow, not a smoking crater)`);
    // The red itself, quoted. A verdict that will not show its evidence is the
    // shape my own README once wore — printed, and never graded.
    for (const line of r.out.split('\n').filter((l) => /\s+FAIL /.test(l))) {
      console.log(`    red |${line.replace(/^\s+/, ' ')}`);
    }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  }

  console.log(fails
    ? `\nhandlayout --selftest: ${fails} FAIL — this instrument's red is NOT re-observed; treat its greens as unknown`
    : '\nhandlayout --selftest: held — clean copy green, both plants red by name, through the whole-app door');
  console.log('  BOUNDARY of this selftest: it proves the tool can SEE these two defects arriving by');
  console.log('  the real door. It does not prove the tool sees every hand-layout defect, and the');
  console.log('  sliver-hittability and pose checks carry no plant of their own here.');
  process.exit(fails ? 1 : 0);
}

async function main() {
  if (!browserPath) { console.error('handlayout: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  if (args.includes('--selftest')) return selftest();
  const s = await serve({ root: ROOT, port: 8281, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`handlayout — ${base} (root ${ROOT})`);
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'handlayout-', browser: browserPath,
    timeoutMs: 12000,
  });
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

  cdp.close(); await dropBrowser(); s.server.close();
  if (!ran) { console.error('handlayout: NOTHING RAN'); process.exit(2); }
  console.log(fails ? `\nhandlayout: ${fails} FAIL` : '\nhandlayout: all green');
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error('handlayout:', e.message); process.exit(2); });
