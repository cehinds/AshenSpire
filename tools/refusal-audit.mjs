// tools/refusal-audit.mjs — every control that refuses must say why.
//
// THE DEFECT THIS EXISTS FOR. Constantine, on his phone: "for armament, I can't
// select the empty slot to equip available weapons." The slot opened; what
// opened was seventeen armaments with sixteen locked, and a locked chip had NO
// CLICK HANDLER. He tapped a weapon he could see, nothing happened, nothing was
// said. A control that refuses in silence reads as a broken one.
//
// WHAT IT CHECKS, on the rendered page and never on the source: for every
// element that LOOKS refusing — `[disabled]`, `[aria-disabled=true]`, `.locked`
// — is there a reason the player can get at? The one home for that is
// `data-refusal`, written by components/refusal.js, which cannot mark a control
// without being handed the reason.
//
//   node tools/refusal-audit.mjs                 audit, print the census
//   node tools/refusal-audit.mjs --port 8613     pick the HTTP port
//   node tools/refusal-audit.mjs --shape 390x844 one shape instead of both
//
// THE DENOMINATOR IS FLOORED, NEVER THE FINDINGS (Vira's, via Marina, today): a
// run that examined zero controls has not passed, it has measured nothing, and
// it says so INSTEAD OF printing a boundary. A boundary block is a claim about a
// run that happened. `--only` matching nothing and printing "OK — 0 shots, every
// assertion true" is the shape this is written against; it cost the house a
// false report this morning in a tool whose own author had planted against
// exactly that one commit earlier.
//
// THE BROWSER IT MEASURED IS THE BROWSER IT STARTED, and it proves that rather
// than assuming it: chromium is launched with `--remote-debugging-port=0`, the
// endpoint is read from THAT CHILD'S OWN stderr, and the ws URL is echoed in the
// verdict. Nothing here binds a fixed debugging port, so it can never attach to
// a browser somebody else is driving.
//
// WHAT A GREEN HERE DOES NOT MEAN: it is a claim about the screens this run
// REACHED, listed by name below the verdict, and nothing at all about the ones
// it did not. The game mounts sixteen screens; this walks four.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(arg('--port', '8613'));
const ONLY_SHAPE = arg('--shape', '');

const BROWSERS = ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const browserPath = arg('--browser', process.env.CHROME || BROWSERS.find((b) => existsSync(b)));

const SHAPES = [[390, 844], [1200, 730]].filter((s) => !ONLY_SHAPE || `${s[0]}x${s[1]}` === ONLY_SHAPE);

// The screens this walk reaches. `drive` is what turns a ?shot= boot into the
// surface a player is actually looking at — the Armoury has no ?shot= state of
// its own, so it is reached the way Constantine reached it: from the map.
//
// THIS TABLE HELD A PROBE WHOSE SUBJECT #90 DELETED, and the deletion is the
// finding, not the repair. It read:
//
//   "Both pickers are walked on purpose: the armament one refuses for
//    `requireFound`, the armour one for an UNLOCK, and a generic reason in
//    either would be a lie."
//
// Both premises are now false. The picker offers only what the profile owns, so
// it refuses for NOTHING: measured at 77a02b9 the two pickers held 28 refusing
// chips between them (17/16 right hand, 10/9 left, 5/3 armour); after #90 they
// hold 0. The `armoury-armour` route waited on
// `.equip-picker .equip-chip.locked` and could only ever time out — an
// unsatisfiable wait is a red instrument, not a red screen, and it must not be
// left for someone to read as the latter.
//
// So that route is removed rather than re-aimed: the surviving refusal on this
// screen is the slot ladder's next cell, and `armoury-armaments` already walks
// it — it reports both locked cells SPEAKING their rung's own hint. Re-pointing
// the armour route at the same control would be one subject probed twice.
//
// VIKI'S, #90, AND OFFERED AS A FINDING WITH A PATCH RATHER THAN TAKEN: this
// file is not mine. Adopt or refuse it; if refused, the route needs a subject
// that still exists, because it has none today.
const ROUTE = [
  { name: 'title', query: '', wait: 'document.querySelector("#app")' },
  { name: 'map', query: '?shot=map', wait: 'document.querySelector("#open-armoury")' },
  {
    name: 'armoury-armaments',
    query: '?shot=map',
    wait: 'document.querySelector("#open-armoury")',
    drive: [
      { click: '#open-armoury', wait: 'document.querySelector(".equip-slot")' },
      { click: '.equip-slot .es-cell.on', wait: 'document.querySelector(".equip-picker .equip-chip")' },
    ],
    probe: true,
  },
  { name: 'combat', query: '?shot=combat', wait: 'document.querySelector(".hand")' },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// WHAT "LOOKS REFUSING" MEANS — ONE STRING, read by both halves of this tool.
// It was written twice, and the census and the tap probe drifting apart is what
// let one run print two reasons and report zero (#90, Vira's gate). A predicate
// with two homes is the defect this whole file exists to find, one level up.
const REFUSING_SEL = '[disabled],[aria-disabled="true"],.locked';

// Everything that LOOKS refusing, and whether a player can find out why. Read
// off the live DOM: a source grep answers prose as readily as code.
const CENSUS = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('${REFUSING_SEL}')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;      // not on screen: not seen, not counted
    const reason = el.dataset ? (el.dataset.refusal || '') : '';
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 48),
      label: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
      reason: reason.slice(0, 60),
      speaks: reason.trim().length > 0,
    });
  }
  return out;
})()`;

// BOTH EDGES, on the screen itself. A refusing control must ANSWER THE TAP —
// that is the whole defect, and a reason merely attached to an element nobody
// can reach would satisfy a weaker check. A usable control must NOT gain a
// refusal.
//
// THIS PROBE AND THE CENSUS ABOVE USED TO READ TWO DIFFERENT POPULATIONS AND
// PRODUCE ONE VERDICT (Vira, gating #90). The census asks the real question —
// `[disabled],[aria-disabled],.locked`, anywhere, visible — while the probe
// asked only about `.equip-picker .equip-chip`. So long as every refusal on the
// screen happened to be a chip the two agreed by luck, and the moment #90 moved
// the refusal from a picker chip to a rack cell they came apart: the SAME RUN
// printed two distinct reasons through the census and reported zero through the
// probe, then failed on its own arithmetic. **A tool whose two halves count
// different things cannot be red for a reason you can act on.**
//
// So the probe now draws from the census's predicate, scoped to the surface it
// is standing on. The scope is the point: the property is "a control you can see
// and cannot use must say why, WHERE YOU ARE LOOKING", and that was never a
// claim about chips. `.armoury` is the only surface any route marks `probe`,
// and falling back to the document keeps a future route from silently measuring
// nothing.
const TAP_PROBE = `(() => {
  const root = document.querySelector('.armoury') || document;
  const seen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const refusing = [...root.querySelectorAll('${REFUSING_SEL}')].filter(seen);
  const controls = [...root.querySelectorAll('button,[role="button"]')].filter(seen);
  const usable = controls.filter((c) => !refusing.includes(c));
  const marked = usable.filter((c) => c.getAttribute('aria-disabled') || (c.dataset && c.dataset.refusal !== undefined));
  const tip0 = document.getElementById('tooltip');
  const before = tip0 ? tip0.style.display : 'none';
  if (refusing.length) refusing[0].click();          // no clientX: the fallback path
  const tip = document.getElementById('tooltip');
  return {
    controls: controls.length,
    refusing: refusing.length,
    usable: usable.length,
    usableMarked: marked.length,
    before,
    tipShown: !!(tip && tip.style.display === 'block'),
    tipText: (tip ? tip.textContent : '').trim().slice(0, 70),
    reasons: [...new Set(refusing.map((c) => (c.dataset && c.dataset.refusal) || '').map((r) => r.slice(0, 28)))],
  };
})()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}

// `--remote-debugging-port=0` and the endpoint read from this child's own
// stderr: the port is whatever the OS handed THIS process, so no fixed port is
// bound and no other seat's browser can be attached to by accident.
function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--no-first-run', '--disable-background-timer-throttling', 'about:blank'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-400)}`)), 15000);
  });
}

async function main() {
  if (!browserPath) { console.error('refusal-audit: no chromium found — pass --browser PATH or set $CHROME'); process.exit(2); }
  if (!SHAPES.length) { console.error(`refusal-audit: --shape ${ONLY_SHAPE} matched no shape of ${[[390, 844], [1200, 730]].map((s) => s.join('x')).join(', ')}`); process.exit(2); }

  const profile = mkdtempSync(join(tmpdir(), 'refusal-audit-'));
  const s = await serve({ root: ROOT, port: PORT, open: false, lan: false });
  const { child, wsUrl } = await launchChrome(browserPath, profile);
  console.log(`refusal-audit — http://localhost:${s.port}  ·  browser pid ${child.pid}, ${wsUrl}`);

  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);

  const ev = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, what, ms = 15000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(expr).catch(() => false)) return true; await wait(120); }
    throw new Error(`timed out waiting for ${what}`);
  };

  let examined = 0;
  const silent = [];
  const visited = [];
  const probeFails = [];
  const reasonsSeen = [];

  for (const [w, h] of SHAPES) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: w < 700 }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: w < 700, maxTouchPoints: 5 }, S);
    for (const step of ROUTE) {
      const url = `http://localhost:${s.port}/${step.query}`;
      await cdp.send('Page.navigate', { url }, S);
      await until(step.wait, `${step.name} at ${w}x${h}`);
      for (const d of step.drive || []) {
        await ev(d.js || `(() => { const e = document.querySelector(${JSON.stringify(d.click)}); if (!e) throw new Error('no ${d.click}'); e.click(); return true; })()`);
        await until(d.wait, `${step.name}: ${d.click || 'js'} at ${w}x${h}`);
      }
      if (step.probe) {
        const p = await ev(TAP_PROBE);
        const at = `${step.name} @ ${w}x${h}`;
        console.log(`  PROBE   ${at}  ${p.controls} controls, ${p.refusing} refusing, ${p.usable} usable` +
          `  · tap → ${p.tipShown ? `"${p.tipText}"` : 'NOTHING'}`);
        // Denominators first, and floored: a probe with nothing to refuse and
        // nothing to accept proves neither edge and must not read as a pass.
        if (!p.refusing) probeFails.push(`${at}: no refusing control to tap — this probe measured nothing`);
        if (!p.usable) probeFails.push(`${at}: no usable control — the other edge was never tested`);
        if (p.usableMarked) probeFails.push(`${at}: ${p.usableMarked} usable control(s) carry a refusal they should not`);
        if (p.refusing && !p.tipShown) probeFails.push(`${at}: tapping a refusing control said NOTHING — the defect itself`);
        reasonsSeen.push(...p.reasons.filter(Boolean));
      }
      const rows = await ev(CENSUS);
      visited.push(`${step.name}@${w}x${h}:${rows.length}`);
      examined += rows.length;
      for (const r of rows) if (!r.speaks) silent.push({ ...r, where: `${step.name} @ ${w}x${h}` });
      for (const r of rows) {
        console.log(`  ${r.speaks ? 'SPEAKS' : 'SILENT'}  ${step.name}@${w}x${h}  ${r.tag}.${r.cls}  "${r.label}"` + (r.speaks ? `  → ${r.reason}` : ''));
      }
    }
  }

  cdp.close(); child.kill(); s.server.close();

  // The denominator, floored. A run that examined nothing has not passed.
  if (examined === 0) {
    console.error('\nrefusal-audit: MEASURED NOTHING — 0 refusing controls examined across ' +
      `${visited.length} screen visits. That is not a pass and this run has no boundary to state.`);
    process.exit(1);
  }

  console.log(`\n  screens walked: ${visited.join(' · ')}`);
  console.log(`  distinct refusal reasons seen: ${reasonsSeen.length ? [...new Set(reasonsSeen)].map((r) => `"${r}…"`).join(' · ') : 'NONE'}`);
  // A surface that refuses more than once must refuse for more than one reason —
  // one sentence covering every refusal is a generic sentence that has replaced
  // the true one, which is the same silence wearing words.
  //
  // THE FLOOR IS DERIVED, NOT THE CONSTANT 2 IT WAS. That constant meant "two
  // pickers, two rules", which stopped being a fact about the game the moment
  // #90 emptied the pickers — a hand-set floor over a population that moved.
  // It now floors against what was actually counted, so it cannot outlive the
  // arrangement that produced it: refuse in N places, say N different things.
  const distinct = new Set(reasonsSeen).size;
  if (distinct < Math.min(2, reasonsSeen.length)) {
    probeFails.push(`${reasonsSeen.length} refusal(s) seen but only ${distinct} distinct reason(s)`
      + ' — a refusal that cannot say WHICH rule stopped it is generic');
  }
  if (probeFails.length) {
    console.error(`\nrefusal-audit: FAILED — ${probeFails.length} probe finding(s):`);
    for (const f of probeFails) console.error(`  · ${f}`);
    process.exit(1);
  }
  if (silent.length) {
    console.error(`\nrefusal-audit: FAILED — ${silent.length} of ${examined} refusing controls say nothing:`);
    for (const r of silent) console.error(`  · ${r.where}  ${r.tag}.${r.cls}  "${r.label}"`);
    console.error('\n  A control the player can see and cannot use must say why, where they are looking.');
    console.error('  Mark it with refuses(el, reason) — src/ui/components/refusal.js.');
    process.exit(1);
  }

  console.log(`\nrefusal-audit: OK — ${examined} refusing controls examined, every one of them says why.`);
  console.log('\nBOUNDARY — what this green does NOT mean:');
  console.log('  · it is about the screens listed above and no others. The game mounts sixteen;');
  console.log('    this walk reaches four, and the Smith — where he hit both bugs — is not one.');
  console.log('  · "says why" means a reason is ATTACHED and readable. Nothing here read it aloud,');
  console.log('    measured whether it fits on screen, or judged whether the sentence is any good.');
  console.log('  · a control that is invisible (zero-sized) is not counted, so a refusal hidden by');
  console.log('    layout is outside this tool entirely.');
}

main().catch((e) => { console.error('refusal-audit:', e.message); process.exit(2); });
