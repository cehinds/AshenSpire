// tools/results/desktop-entrance-probe.mjs — the desktop entrance, measured
// for its card (claude-family commons/design/2026-08-14_the-desktop-entrance-card.md).
// A REPORTER, not a gate: it prints readings and asserts nothing — the verdict
// on the entrance belongs to tools/actends.mjs, which has been observed red.
// Enters by the same door as actends: tools/serve.mjs + ?shot=map, headless
// Chromium via CDP, Emulation.setDeviceMetricsOverride (dpr 1, mobile false —
// plain --window-size in headless=new reserves ~88 px of virtual toolbar and
// silently shrinks the viewport; that cost this probe its first run).
// Measures: --ui-zoom, the .map-scroll port (device + local px), the act span,
// the camera's own confession (data-entrance-miss), the chrome inventory
// (every vertical px of the screen named), the node's delivered diameter, and
// the same set again after each zoom-out step to the ladder floor.
// Usage: node tools/results/desktop-entrance-probe.mjs   (writes ./probe-out/)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(HERE, '..', '..');
const OUT = resolve(HERE, 'probe-out');
mkdirSync(OUT, { recursive: true });

const { serve } = await import(`${ROOT}/tools/serve.mjs`);
const served = await serve({ root: ROOT, port: 8321, open: false });
const base = `http://localhost:${served.port}/index.html`;

const BROWSER = process.env.CHROME || '/usr/bin/chromium';
const SHAPES = [
  { w: 1200, h: 730, label: '1200x730' },
  { w: 1366, h: 768, label: '1366x768' },
];
const SEED = process.env.SEED || 'SHOWCASE';

const PROBE = `(() => {
  const px = (n) => Math.round(n * 100) / 100;
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x0: px(r.left), y0: px(r.top), x1: px(r.right), y1: px(r.bottom), w: px(r.width), h: px(r.height) }; };
  const sc = document.querySelector('.map-scroll');
  if (!sc) return { error: 'no .map-scroll' };
  const svg = sc.querySelector('svg');
  const uiZoom = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const svgW = Number(svg.getAttribute('width')), svgH = Number(svg.getAttribute('height'));
  const svgR = R(svg);
  const nodes = [...document.querySelectorAll('#map-nodes > .map-node')];
  const circ = (el) => { const c = el.querySelector('circle:not(.node-halo)'); return R(c || el); };
  const boss = nodes.find((n) => n.classList.contains('boss'));
  const door = nodes.find((n) => n.classList.contains('reachable'));
  const title = document.querySelector('.map-act-title');
  // chrome inventory: every child of .mapscreen plus the screen's own box
  const screen = document.querySelector('.mapscreen');
  const inv = [];
  const name = (el) => (el.className && String(el.className.baseVal ?? el.className).trim().split(/\\s+/).slice(0,2).join('.')) || el.tagName;
  for (const el of screen.children) {
    const cs = getComputedStyle(el);
    inv.push({ el: name(el), rect: R(el), hidden: el.hidden || cs.display === 'none',
      mt: cs.marginTop, mb: cs.marginBottom, pt: cs.paddingTop, pb: cs.paddingBottom });
  }
  const frame = document.querySelector('.map-frame');
  const orient = document.querySelector('.map-entrance-orientation');
  const csScreen = getComputedStyle(screen);
  return {
    uiZoom, layout: document.documentElement.getAttribute('data-layout'),
    viewport: { w: innerWidth, h: innerHeight },
    screen: { rect: R(screen), pt: csScreen.paddingTop, pb: csScreen.paddingBottom, gap: csScreen.rowGap || csScreen.gap },
    app: R(document.getElementById('app')),
    scroll: { rect: R(sc), clientW: sc.clientWidth, clientH: sc.clientHeight,
      scrollW: sc.scrollWidth, scrollH: sc.scrollHeight, left: px(sc.scrollLeft), top: px(sc.scrollTop),
      ds: { mode: sc.dataset.mapMode, framing: sc.dataset.framing, framingMiss: sc.dataset.framingMiss,
            entranceEnds: sc.dataset.entranceEnds, entranceMiss: sc.dataset.entranceMiss } },
    svg: { unitsW: svgW, unitsH: svgH, rect: svgR, renderScale: px(svgR.w / svgW) },
    drawn: nodes.length,
    boss: boss ? { rect: circ(boss), node: boss.dataset.node } : null,
    door: door ? { rect: circ(door), node: door.dataset.node } : null,
    title: R(title),
    orientation: orient ? { rect: R(orient), display: getComputedStyle(orient).display } : null,
    frame: R(frame),
    inv,
  };
})()`;

async function drive(shape) {
  const q = new URLSearchParams({ shot: 'map', shotSeed: SEED });
  const url = `${base}?${q}`;
  const dp = 9500 + Math.floor(Math.random() * 300);
  const child = spawn(BROWSER, ['--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${dp}`, `--window-size=${shape.w},${shape.h}`, 'about:blank'], { stdio: 'ignore' });
  const dbg = `http://127.0.0.1:${dp}`;
  let ws = null;
  for (let i = 0; i < 120 && !ws; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { const l = await (await fetch(`${dbg}/json/list`)).json();
      const t = l.find((x) => x.type === 'page'); if (t) ws = t.webSocketDebuggerUrl; } catch {}
  }
  if (!ws) { child.kill(); throw new Error('no CDP'); }
  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0; const pend = new Map();
  sock.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res.result?.result?.value;
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: shape.w, height: shape.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const ok = await evaluate(`!!document.querySelector('.map-scroll')`);
    if (ok) break;
  }
  await new Promise((r) => setTimeout(r, 800));
  const entrance = await evaluate(PROBE);
  const shot = async (tag) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(OUT, `${shape.label}-${tag}.png`), Buffer.from(s.result.data, 'base64'));
  };
  await shot('entrance-Fit');
  // walk the ladder down to its floor, reading after each step
  const steps = [];
  for (let i = 0; i < 6; i++) {
    const had = await evaluate(`(() => { const b = document.getElementById('zoom-out'); if (!b) return false; b.click(); return true; })()`);
    if (!had) break;
    await new Promise((r) => setTimeout(r, 350));
    const r = await evaluate(PROBE);
    steps.push(r);
    if (i === 5 || (steps.length > 1 && steps.at(-1).svg.renderScale === steps.at(-2).svg.renderScale)) break;
  }
  await shot('entrance-zoom100');
  sock.close(); child.kill();
  return { shape: shape.label, entrance, steps };
}

const all = [];
for (const s of SHAPES) {
  const r = await drive(s);
  all.push(r);
  console.log(`\n=== ${s.label} (seed ${SEED}) ===`);
  console.log(JSON.stringify(r.entrance, null, 1));
  console.log(`--- ladder walk: ${r.steps.length} zoom-out steps ---`);
  for (const st of r.steps) {
    console.log(` scale ${st.svg.renderScale}  node ${st.door ? st.door.rect.w : '?'}px  boss ${st.boss ? st.boss.rect.w : '?'}px  miss ${st.scroll.ds.entranceMiss}  scrollH ${st.scroll.scrollH}  clientH ${st.scroll.clientH}`);
  }
}
writeFileSync(resolve(OUT, 'readings.json'), JSON.stringify(all, null, 2));
console.log(`\nwrote ${OUT}/readings.json`);
served.close?.();
process.exit(0);
