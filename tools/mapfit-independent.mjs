#!/usr/bin/env node
// bjorn-mapfit-reproduce.mjs — my own 9-of-12, rebuilt from nothing.
//
// The sweeper that produced "9 of 12 seeds hide a next step at 390x844, 0 of 12
// at 1200x730" was in a scratch directory two disk sweeps ago. Rune's mapfit.mjs
// reports 0 of 12 at his branch head and cites my number as the defect it exists
// for. Marina's charge is the honest one: CONFIRM HIS NUMBER IS MINE — which
// means measuring the same property with an instrument that is not his, on both
// trees, and saying so if they disagree.
//
// What it counts, and it is deliberately the crudest possible reading of the
// sentence: after the game has finished framing the act map, how many of the
// nodes marked `.map-node.reachable` are WHOLLY inside `.map-scroll`'s client
// box. Nothing about hit-testing, nothing about chrome — a node half off the
// edge counts as off, because half a door is not a choice.
//
// Usage: node bjorn-mapfit-reproduce.mjs <worktree> <w> <h> [seeds]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(process.argv[2] || '.');
const W = Number(process.argv[3] || 390);
const H = Number(process.argv[4] || 844);
const N = Number(process.argv[5] || 12);
const CHROME = process.env.CHROME || '/usr/bin/chromium';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function cdpConnect(url) {
  const ws = new WebSocket(url); let n = 1; const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sid) { const id = n++; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); }); }, close: () => ws.close() };
}

const READ = `(() => {
  const sc = document.querySelector('.map-scroll');
  if (!sc) return { error: 'no .map-scroll' };
  const box = sc.getBoundingClientRect();
  const all = [...document.querySelectorAll('.map-node')];
  const reach = all.filter((n) => n.classList.contains('reachable'));
  const inside = (el) => { const r = el.getBoundingClientRect();
    return r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5; };
  return {
    nodes: all.length,
    reachable: reach.length,
    reachableOnScreen: reach.filter(inside).length,
    offScreen: all.filter((n) => !inside(n)).length,
    framing: sc.dataset.framing || null,
    scrollW: sc.scrollWidth, scrollH: sc.scrollHeight,
    clientW: Math.round(box.width), clientH: Math.round(box.height),
  };
})()`;

const main = async () => {
  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')).href);
  const s = await serve({ root: ROOT, port: 8407 + (W % 7), open: false });
  const base = `http://127.0.0.1:${s.port}/index.html`;
  const dir = mkdtempSync(join(tmpdir(), 'bjmap-'));
  const { child, wsUrl } = await new Promise((res, rej) => {
    const c = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = ''; const on = (x) => { buf += x; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) res({ child: c, wsUrl: m[1] }); };
    c.stderr.on('data', on); c.stdout.on('data', on); c.on('error', rej);
    setTimeout(() => rej(new Error('no endpoint')), 20000);
  });
  const cdp = cdpConnect(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
  const ev = async (e) => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 }, sessionId);

  console.log(`\n?shotSeed sweep · ${W}x${H} · ${N} seeds · tree ${ROOT}`);
  let hiding = 0; let swept = 0; const offs = [];
  for (let i = 1; i <= N; i += 1) {
    const seed = `BJORN${i}`;
    await cdp.send('Page.navigate', { url: `${base}?shot=map&shotSeed=${seed}` }, sessionId);
    let r = null;
    for (let k = 0; k < 80; k += 1) { if (await ev(`!!document.querySelector('.map-node')`)) break; await wait(120); }
    await wait(650);                                   // the 400 ms settle, plus slack
    r = await ev(READ);
    if (!r || r.error) { console.log(`  ${seed.padEnd(9)} UNMEASURED — ${r ? r.error : 'no answer'}`); continue; }
    swept += 1;
    const hides = r.reachableOnScreen < r.reachable;
    if (hides) hiding += 1;
    offs.push(r.offScreen);
    console.log(`  ${seed.padEnd(9)} ${String(r.nodes).padStart(3)} nodes · reachable ${r.reachableOnScreen}/${r.reachable}`
      + `  ${hides ? '<-- AN OPTION IS OFF SCREEN' : '                          '} · ${String(r.offScreen).padStart(2)} off screen`
      + `${r.framing ? ` · says ${r.framing}` : ''}`);
  }
  offs.sort((a, b) => a - b);
  console.log(`\n  SEEDS WITH A REACHABLE NODE OFF SCREEN: ${hiding}/${swept} at ${W}x${H}`);
  console.log(`  nodes off screen: min ${offs[0]}, max ${offs[offs.length - 1]}, median ${offs[Math.floor(offs.length / 2)]}`);
  if (!swept) { console.error('  UNMEASURED — nothing swept. This is not a green.'); child.kill(); s.server.close(); process.exit(2); }
  child.kill(); cdp.close(); s.server.close();
  process.exit(hiding ? 1 : 0);
};
main().catch((e) => { console.error('UNMEASURED —', e.message); process.exit(2); });
