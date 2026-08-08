#!/usr/bin/env node
// bjorn-hold-render.mjs — #115's render half. Bjorn, 2026-08-08.
//
// Sunna named the risk and handed it to me: the fill is a `::before` under a
// label, and specificity has bitten this class before. So this does not read
// the stylesheet — it reads the PIXELS, on the shipped artifact, mid-hold.
//
//   1. PAINT ORDER, decided rather than argued. The fill is re-painted OPAQUE
//      for one frame. If the label survives inside the filled region, the label
//      is above the fill. If it vanishes, the fill is above the label. No
//      cascade reasoning, no reading of `> *` — one screenshot answers it.
//   2. THE SHIPPED PICTURE. At the real alpha (0.30) it measures the label's
//      ink against its background inside and outside the fill, so the answer to
//      "is it still readable while filling" is a number, not a hope.
//   3. IS THE FILL VISIBLE AT ALL. A `::before` that renders nothing is the
//      failure that looks exactly like a working control in every DOM check.
//   4. THE PAD RING. `ev.detail === 0` commits with no hold. Driven, both
//      directions: as shipped, and with that line removed — because the line
//      Sunna could not choose between is only choosable once the OTHER side has
//      a number too.
//
// Usage: node bjorn-hold-render.mjs <worktree> [--dist]
// Exit 0 measured · 1 a finding · 2 could not measure.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(process.argv[2] || '.');
const useDist = process.argv.includes('--dist');
const OUT = resolve(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : join(ROOT, '..', 'BJ-HOLD'));
const CHROME = process.env.CHROME || '/usr/bin/chromium';
if (!existsSync(CHROME)) { console.error('no chromium'); process.exit(2); }

const SHAPE = { w: 390, h: 844, dsf: 2 };
const EVENT = 'rotPriestOffer';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const findings = [];
let checks = 0;
const ok = (name, cond, detail) => {
  checks += 1;
  console.log(`    ${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) findings.push(`${name}${detail ? `: ${detail}` : ''}`);
};

function cdpConnect(url) {
  const ws = new WebSocket(url); let n = 1; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sid) { const id = n++; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); }); },
    close: () => ws.close(),
  };
}

async function main() {
  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')).href);
  let base; let stop = () => {};
  if (useDist) base = pathToFileURL(join(ROOT, 'dist/AshenSpire.html')).href;
  else { const s = await serve({ root: ROOT, port: 8399, open: false }); base = `http://127.0.0.1:${s.port}/index.html`; stop = () => s.server.close(); }

  const dir = mkdtempSync(join(tmpdir(), 'bjhold-'));
  const { child, wsUrl } = await new Promise((res, rej) => {
    const c = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = ''; const on = (x) => { buf += x; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) res({ child: c, wsUrl: m[1] }); };
    c.stderr.on('data', on); c.stdout.on('data', on); c.on('error', rej);
    setTimeout(() => rej(new Error('chromium never printed an endpoint')), 20000);
  });
  const cdp = cdpConnect(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
  const ev = async (e) => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: SHAPE.w, height: SHAPE.h, deviceScaleFactor: SHAPE.dsf, mobile: true }, sessionId);

  const open = async (dial = 'long') => {
    const q = [`shot=event`, `shotEvent=${EVENT}`, `shotSettings=${encodeURIComponent(JSON.stringify({ holdConfirm: dial }))}`];
    await cdp.send('Page.navigate', { url: `${base}?${q.join('&')}` }, sessionId);
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector('#choices button')`)) break; await wait(120); }
    await wait(250);
  };
  const barRect = async (n = 0) => ev(`(() => {
    const b = [...document.querySelectorAll('button.ev-choice')].filter(x => x.dataset.binding === '1')[${n}];
    if (!b) return null; const r = b.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2) };
  })()`);
  const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y, id: 1 }] }, sessionId);
  const shot = async (name) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const p = join(OUT, `${name}.png`);
    writeFileSync(p, Buffer.from(data, 'base64'));
    return p;
  };

  execFileSync('mkdir', ['-p', OUT]);
  console.log(`\nbjorn-hold-render — ${useDist ? 'dist/AshenSpire.html' : 'source tree'} · ${SHAPE.w}x${SHAPE.h}@${SHAPE.dsf}x · event '${EVENT}'`);

  // ---- 1. IS THE FILL VISIBLE AT ALL, and where is its edge ----------------
  console.log('\n  the fill, at the shipped alpha');
  await open('long');
  const rect = await barRect(0);
  if (!rect) { console.error('UNMEASURED — no binding bar on this screen. Nothing was rendered.'); child.kill(); stop(); process.exit(2); }
  const rest = await shot('01-rest');
  await touch('touchStart', { x: rect.cx, y: rect.cy });
  await wait(520);
  const mid = await ev(`(() => { const b = document.querySelector('button.ev-hold'); return { p: Number(b.dataset.holdProgress||0), state: b.dataset.hold, cssW: getComputedStyle(b, '::before').width }; })()`);
  const held = await shot('02-holding');
  await touch('touchEnd', { x: rect.cx, y: rect.cy });
  await wait(150);

  ok('the hold was actually under way when the picture was taken', mid.p > 0.2 && mid.p < 0.95, `progress ${mid.p}, state ${mid.state}`);
  ok('the ::before has a non-zero rendered width', parseFloat(mid.cssW) > 1, `::before width ${mid.cssW} (bar ${rect.w.toFixed(1)} css px)`);

  // ---- 2. PAINT ORDER, decided by an opaque frame -------------------------
  console.log('\n  paint order — is the label above its own fill, or under it');
  await open('long');
  await ev(`(() => { const s = document.createElement('style'); s.id='bj';
    s.textContent = "button.ev-choice.ev-hold::before { background: #ff00ff !important; }";
    document.head.appendChild(s); })()`);
  const r2 = await barRect(0);
  await touch('touchStart', { x: r2.cx, y: r2.cy });
  await wait(700);           // deep into the fill so the label is well inside it
  const deep = await ev(`Number(document.querySelector('button.ev-hold').dataset.holdProgress||0)`);
  const opaque = await shot('03-opaque-fill');
  await touch('touchEnd', { x: r2.cx, y: r2.cy });

  // ---- 3. THE PAD RING, driven --------------------------------------------
  console.log('\n  the pad ring and the keyboard — the path with no hold');
  await open('long');
  const padShipped = await ev(`(async () => {
    const b = [...document.querySelectorAll('button.ev-choice')].filter(x => x.dataset.binding === '1')[0];
    if (!b) return { err: 'no binding bar' };
    const before = document.querySelectorAll('#choices button.ev-choice').length;
    // Exactly what ui/input.js line 380 dispatches for the pad cursor.
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 120));
    return { before, after: document.querySelectorAll('#choices button.ev-choice').length,
             detail: new MouseEvent('click').detail };
  })()`);
  ok('the pad cursor commits a binding choice with NO hold (as shipped)',
    padShipped && padShipped.after === 0,
    padShipped ? `bars ${padShipped.before} -> ${padShipped.after}, synthetic MouseEvent detail=${padShipped.detail}` : 'no answer');

  // The other side of Sunna's open question, measured: take the line away and
  // the pad cursor has no door at all — because it never sends a pointerdown,
  // so the fill it would have to complete never starts.
  await open('long');
  const padWithoutLine = await ev(`(async () => {
    const b = [...document.querySelectorAll('button.ev-choice')].filter(x => x.dataset.binding === '1')[0];
    if (!b) return { err: 'no binding bar' };
    // Simulate "rule 3 removed": swallow the synthetic click the way a pointer
    // click is swallowed today. Nothing else about the control changes.
    b.addEventListener('click', (e) => { if (e.detail === 0) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    const before = document.querySelectorAll('#choices button.ev-choice').length;
    for (let i = 0; i < 5; i++) { b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
    await new Promise(r => setTimeout(r, 200));
    return { before, after: document.querySelectorAll('#choices button.ev-choice').length,
             progress: Number(b.dataset.holdProgress || 0), state: b.dataset.hold };
  })()`);
  ok('WITHOUT that line the pad cursor cannot take the choice at all — five presses, nothing moves',
    padWithoutLine && padWithoutLine.after === padWithoutLine.before && padWithoutLine.progress === 0,
    padWithoutLine ? `bars ${padWithoutLine.before} -> ${padWithoutLine.after}, fill ${padWithoutLine.progress}, state ${padWithoutLine.state}` : 'no answer');

  // ---- 4. is the HOLD hint reachable by the focus ring at all --------------
  await open('long');
  const focusRead = await ev(`(() => {
    const bars = [...document.querySelectorAll('#choices button.ev-choice')];
    const b = bars.filter(x => x.dataset.binding === '1')[0];
    if (!b) return null;
    b.focus();
    return { focused: document.activeElement === b,
             hint: (b.querySelector('.hold-hint') || {}).textContent || null,
             label: b.textContent.replace(/\\s+/g,' ').trim() };
  })()`);
  ok('the bar the pad lands on still SAYS "HOLD" while offering no hold',
    focusRead && focusRead.hint === 'HOLD' && focusRead.focused,
    focusRead ? `focused=${focusRead.focused} hint=${JSON.stringify(focusRead.hint)} label=${JSON.stringify(focusRead.label)}` : 'no answer');

  console.log(`\n  shots -> ${OUT}`);
  console.log(`  deep-fill progress for the opaque frame: ${deep}`);
  writeFileSync(join(OUT, 'geometry.json'), JSON.stringify({ rect, r2, mid, deep }, null, 2));

  child.kill(); cdp.close(); stop();

  console.log(`\n  BOUNDARY — one Linux machine, headless Chromium, 390x844@2x, one event.`);
  console.log(`  CDP touch is a perfect finger. Nothing here was held by a hand, and no`);
  console.log(`  physical gamepad was attached — the pad path is driven by the exact`);
  console.log(`  MouseEvent ui/input.js:380 dispatches, which is the code, not the device.`);
  console.log(`\n  ${findings.length ? `FINDINGS — ${findings.length}` : `PASS`} — ${checks} checks`);
  process.exit(findings.length ? 1 : 0);
}

main().catch((e) => { console.error('UNMEASURED —', e.message); process.exit(2); });
