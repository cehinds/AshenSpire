#!/usr/bin/env node
// tools/dialogue-hud-fit.mjs — THE W4c HUD IS READABLE, ON EVERY SCREEN.
//
// THE DEFECT THIS EXISTS FOR, and it shipped: on a 411x783 phone the band's
// two rows were folded onto one line, so "CLASS Reaver" was drawn on top of
// "CINDERS 0" and the act name ran through "FLOOR 0". Every number said the
// band was fine — the rows fitted its height, nothing overflowed — because
// nothing asked the only question a player asks: can I read it. Overlap is
// that question, in geometry: two pieces of text whose boxes intersect.
//
// It drives the GAME'S OWN ROUTE (?shot=event), not a mounted screen: the HUD
// exists only in a run, so a harness that mounts the dialogue alone (as
// tools/dialogue-context-fit.mjs does, deliberately) cannot see this at all.
//
// Usage
//   node tools/dialogue-hud-fit.mjs           the five hosts
//   node tools/dialogue-hud-fit.mjs --out DIR also a PNG per host
//
// Exit 0 green, 1 a finding, 2 the harness could not run.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = oi >= 0 ? resolve(args[oi + 1]) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The four the owner named, plus the phone he actually read it on.
const HOSTS = [[1280, 800], [844, 390], [740, 372], [411, 783], [390, 844]];

const MEASURE = `(() => {
  const root = document.querySelector('.dialogue-screen');
  if (!root) return { mounted: false };
  const rect = root.getBoundingClientRect();
  const k = root.clientHeight / rect.height;           // painted px -> frame px
  const hud = root.querySelector(':scope > .topbar');
  if (!hud) return { mounted: true, hud: false };
  const band = parseFloat(getComputedStyle(root).getPropertyValue('--w4-band-hud'));
  const top = hud.querySelector('.hud-top');
  // Every leaf that carries text, in frame px. A leaf is what a player reads;
  // its ancestors are boxes and may legitimately contain one another.
  const texts = [...hud.querySelectorAll('*')]
    .filter((el) => !el.children.length && (el.textContent || '').trim() && el.getClientRects().length)
    .map((el) => {
      const b = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').trim().slice(0, 18),
        left: (b.left - rect.left) * k, right: (b.right - rect.left) * k,
        top: (b.top - rect.top) * k, bottom: (b.bottom - rect.top) * k,
      };
    })
    .filter((b) => b.right > b.left && b.bottom > b.top);
  const overlaps = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      // A READING IS COVERED, not merely touched. Two boxes that brush by a
      // pixel — a label's line box and the icon hanging beneath it — are not
      // what a player calls unreadable; the defect this exists for was words
      // drawn across words, ten pixels and more of it. The threshold is named
      // here rather than left at "any intersection", which would have made
      // every host red for something nobody can see.
      if (x > 2 && y > 2) overlaps.push({ a: a.text, b: b.text, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
  }
  return {
    mounted: true, hud: true,
    band: Math.round(band * 10) / 10,
    rowsBottom: top ? Math.round((top.getBoundingClientRect().bottom - rect.top) * k * 10) / 10 : null,
    compact: root.dataset.hudCompact,
    reads: texts.length,
    overlaps: overlaps.slice(0, 6),
    overlapCount: overlaps.length,
  };
})()`;

const { server, port } = await serve({ root: ROOT, port: 8325, open: false });
const { wsUrl, close } = await launchBrowser({ prefix: 'hud-fit-', browser: process.env.CHROME || undefined, headless: '--headless=new', timeoutMs: 30000 });
let exitCode = 0;
try {
  const cdpPort = Number(new URL(wsUrl.replace(/^ws:/, 'http:')).port);
  let list;
  for (let i = 0; i < 100 && !list?.length; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json(); } catch { /* retry */ }
    if (!list?.length) await sleep(100);
  }
  const sock = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { sock.onopen = ok; sock.onerror = no; });
  let id = 0; const waiting = new Map();
  sock.onmessage = (m) => { const g = JSON.parse(m.data); if (g.id != null && waiting.has(g.id)) { const { ok, no } = waiting.get(g.id); waiting.delete(g.id); g.error ? no(new Error(g.error.message)) : ok(g.result); } };
  const send = (method, params = {}) => { const n = ++id; sock.send(JSON.stringify({ id: n, method, params })); return new Promise((ok, no) => waiting.set(n, { ok, no })); };
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  if (OUT) mkdirSync(OUT, { recursive: true });

  const findings = [];
  for (const [width, height] of HOSTS) {
    const tag = `${width}x${height}`;
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/AshenSpire.html?shot=event&final=${width}` });
    let facts = null;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      facts = await ev(MEASURE).catch(() => null);
      if (facts?.hud) break;
    }
    if (!facts?.mounted) { findings.push(`${tag}: the dialogue never mounted`); console.log(`  FAIL  ${tag} · never mounted`); continue; }
    if (!facts.hud) { findings.push(`${tag}: the band is not drawn`); console.log(`  FAIL  ${tag} · no HUD band`); continue; }
    const problems = [];
    if (facts.overlapCount) problems.push(`${facts.overlapCount} overlapping text pair(s): ${facts.overlaps.map((o) => `${o.a}×${o.b}`).join(', ')}`);
    // The shared HUD shell rounds its own rows a hair past the band — 75.9 in
    // 74.8 at 1280x800, the same figure combat draws on dev, so it is the
    // shell's arithmetic and not this screen's. Anything beyond that is real.
    if (facts.rowsBottom > facts.band + 1.5) problems.push(`rows reach ${facts.rowsBottom}px in a ${facts.band}px band`);
    const verdict = problems.length ? 'FAIL' : 'PASS';
    console.log(`  ${verdict}  ${tag} · ${facts.reads} readings · compact ${facts.compact} · rows ${facts.rowsBottom}/${facts.band}px${problems.length ? ` — ${problems.join('; ')}` : ''}`);
    if (problems.length) findings.push(`${tag}: ${problems.join('; ')}`);
    if (OUT) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(resolve(OUT, `w4c-hud-${tag}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  if (findings.length) {
    console.log(`dialogue-hud-fit: FAIL — ${findings.length} host(s)`);
    exitCode = 1;
  } else {
    console.log(`dialogue-hud-fit: OK — ${HOSTS.length} hosts, no two readings overlap and every band holds its rows`);
  }
  sock.close();
} catch (error) {
  console.error(`dialogue-hud-fit: the harness could not run — ${error.message}`);
  exitCode = 2;
} finally {
  await close?.();
  server.close?.();
}
process.exit(exitCode);
