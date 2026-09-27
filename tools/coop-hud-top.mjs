#!/usr/bin/env node
// tools/coop-hud-top.mjs — the co-op formation HUD top, measured in Chromium.
//
// WHY THIS FILE EXISTS (#1368's open question, decided as D-coop-hud-top in
// docs/FINISH.md). The co-op board (src/ui/screens/coop.js) mounts its own
// `.topbar > .hud-top` — the active seat's resource bars, the fight label and
// the Leave button — beside the HUD quick-settings cluster. styles/combat.css
// gives that `.hud-top` a flex row in short landscape. Nothing looked at the
// result in a browser, so an overlap, a clipped Leave button or a page that
// scrolls sideways would have shipped green.
//
// WHAT IT JUDGES, at 390x844, 844x390 and 1280x800 through `?shot=coop`
// (the real co-op renderer fed the canned host snapshot):
//   * the document does not scroll horizontally;
//   * every visible part of the HUD top (resource bars, fight label, Leave,
//     quick settings) lies inside the viewport and inside the topbar band;
//   * no two of those parts overlap;
//   * every resource bar is inside the viewport and has a width.
//
//   node tools/coop-hud-top.mjs                 judge, exit 0 green / 1 red / 2 harness
//   node tools/coop-hud-top.mjs --shots <dir>   also write coop-hud-top-<w>x<h>.png
//
// It serves the SOURCE tree (no build, no LFS).

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
// `singleRow`: short landscape (styles/combat.css `@media (max-height:500px)`)
// is the compact band — resource bars and Leave share ONE row so the
// battlefield keeps its height. That is what the co-op `.hud-top` flex rule is
// for; without it Leave drops to a second line and the band grows.
export const VIEWPORTS = [
  { width: 390, height: 844, singleRow: false },
  { width: 844, height: 390, singleRow: true },
  { width: 1280, height: 800, singleRow: false },
];
const TOLERANCE = 0.5; // px: sub-pixel rounding, never a real overlap
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { done, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) fail(new Error(msg.error.message)); else done(msg.result);
  });
  return {
    ready: new Promise((done, fail) => { ws.addEventListener('open', done); ws.addEventListener('error', fail); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((done, fail) => {
        pending.set(id, { done, fail });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

// Runs in the page. Returns the geometry the judge needs; pure data.
const MEASURE = `(() => {
  const combat = document.querySelector('.combat.coop[data-layout="formation"]');
  if (!combat) return { mounted: false };
  const topbar = combat.querySelector(':scope > .topbar');
  const hudTop = topbar && topbar.querySelector('.hud-top');
  const rect = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
  const shown = (e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const parts = [];
  // An inline part that wraps (the fight label in portrait) has a bounding box
  // that is the union of its line boxes, which would swallow a neighbour on its
  // last line that it never touches. Its painted boxes are its client rects.
  const boxes = (e) => [...e.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
  const add = (name, e) => { if (e && shown(e)) parts.push({ name, ...rect(e), boxes: boxes(e) }); };
  const named = ['resbars-host', 'fight-label', 'coop-leave'];
  if (hudTop) for (const child of hudTop.children) add(named.find((n) => child.classList.contains(n)) || child.className || child.tagName, child);
  // The quick-settings cluster hangs BELOW the band by design (styles/kit.css
  // .hud-quick-settings: top: 100% + gap), so it is judged for overlap and
  // viewport clipping only, never against the band.
  const quick = topbar && topbar.querySelector(':scope > .hud-quick-settings');
  if (quick && shown(quick)) parts.push({ name: 'hud-quick-settings', floating: true, ...rect(quick), boxes: boxes(quick) });
  const bars = hudTop ? [...hudTop.querySelectorAll('.resline')].filter(shown).map((e) => ({ name: e.className, ...rect(e) })) : [];
  return {
    mounted: true,
    innerWidth, innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    topbar: topbar ? rect(topbar) : null,
    field: combat.querySelector(':scope > .field') ? rect(combat.querySelector(':scope > .field')) : null,
    hudTop: hudTop ? { ...rect(hudTop), display: getComputedStyle(hudTop).display } : null,
    parts, bars,
  };
})()`;

/** Pure judge over one viewport's measurement → list of failure strings. */
export function judge(g, label, { singleRow = false } = {}) {
  const bad = [];
  if (!g || !g.mounted) return [`${label}: co-op formation board did not mount`];
  if (!g.topbar || !g.hudTop) return [`${label}: no .topbar > .hud-top`];
  if (g.scrollWidth > g.innerWidth + TOLERANCE) bad.push(`${label}: horizontal overflow (${g.scrollWidth} > ${g.innerWidth})`);
  if (!g.parts.some((p) => p.name === 'resbars-host')) bad.push(`${label}: resource bars missing from the HUD top`);
  if (!g.parts.some((p) => p.name === 'coop-leave')) bad.push(`${label}: Leave button missing from the HUD top`);
  for (const p of g.parts) {
    if (p.left < -TOLERANCE || p.right > g.innerWidth + TOLERANCE) bad.push(`${label}: ${p.name} clipped by the viewport (${p.left.toFixed(1)}..${p.right.toFixed(1)} of ${g.innerWidth})`);
    if (!p.floating && (p.top < g.topbar.top - TOLERANCE || p.bottom > g.topbar.bottom + TOLERANCE)) bad.push(`${label}: ${p.name} spills out of the topbar band (${p.top.toFixed(1)}..${p.bottom.toFixed(1)} vs ${g.topbar.top.toFixed(1)}..${g.topbar.bottom.toFixed(1)})`);
  }
  // The band is the grid row the topbar sits in. The topbar box itself is
  // height:auto/overflow:visible in formation, so it grows with a part that
  // wraps; the battlefield below does not move. A part that reaches past the
  // field's top edge is painted over the fight.
  if (g.field) for (const p of g.parts) {
    if (!p.floating && p.bottom > g.field.top + TOLERANCE) bad.push(`${label}: ${p.name} reaches into the battlefield (bottom ${p.bottom.toFixed(1)} > field top ${g.field.top.toFixed(1)})`);
  }
  if (singleRow) {
    const inBand = g.parts.filter((p) => !p.floating);
    const rowTop = Math.max(...inBand.map((p) => p.top)), rowBottom = Math.min(...inBand.map((p) => p.bottom));
    if (inBand.length > 1 && rowBottom - rowTop <= TOLERANCE) bad.push(`${label}: compact band is not one row (${inBand.map((p) => `${p.name} ${p.top.toFixed(1)}..${p.bottom.toFixed(1)}`).join(', ')})`);
  }
  for (let i = 0; i < g.parts.length; i++) for (let j = i + 1; j < g.parts.length; j++) {
    const a = g.parts[i], b = g.parts[j];
    let worst = null;
    for (const ra of a.boxes || [a]) for (const rb of b.boxes || [b]) {
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > TOLERANCE && h > TOLERANCE && (!worst || w * h > worst.w * worst.h)) worst = { w, h };
    }
    if (worst) bad.push(`${label}: ${a.name} overlaps ${b.name} (${worst.w.toFixed(1)}x${worst.h.toFixed(1)}px)`);
  }
  for (const bar of g.bars) {
    if (bar.width < 1) bad.push(`${label}: resource bar ${bar.name} has no width`);
    if (bar.left < -TOLERANCE || bar.right > g.innerWidth + TOLERANCE) bad.push(`${label}: resource bar ${bar.name} clipped by the viewport`);
  }
  return bad;
}

export function selftest() {
  const base = { mounted: true, innerWidth: 390, innerHeight: 844, scrollWidth: 390,
    topbar: { left: 0, top: 0, right: 390, bottom: 80, width: 390, height: 80 },
    hudTop: { left: 0, top: 0, right: 390, bottom: 80, width: 390, height: 80, display: 'block' },
    parts: [
      { name: 'resbars-host', left: 8, top: 40, right: 300, bottom: 76 },
      { name: 'coop-leave', left: 310, top: 40, right: 380, bottom: 76 },
      { name: 'hud-quick-settings', floating: true, left: 346, top: 84, right: 388, bottom: 180 },
    ], bars: [{ name: 'resline hp', left: 8, top: 40, right: 300, bottom: 50, width: 292 }] };
  const cases = [
    ['clean layout', base, 0],
    ['overlap', { ...base, parts: [...base.parts.slice(0, 1), { ...base.parts[1], left: 250 }, base.parts[2]] }, 1],
    ['overflow', { ...base, scrollWidth: 420 }, 1],
    ['clipped Leave', { ...base, parts: [base.parts[0], { ...base.parts[1], left: 380, right: 450 }, base.parts[2]] }, 1],
    ['lost Leave', { ...base, parts: [base.parts[0], base.parts[2]] }, 1],
    ['wrapped inline label beside Leave is not an overlap', { ...base, parts: [...base.parts, { name: 'fight-label', left: 8, top: 10, right: 380, bottom: 38, boxes: [{ left: 8, top: 10, right: 380, bottom: 24 }, { left: 8, top: 24, right: 90, bottom: 38 }] }].map((p) => p.name === 'coop-leave' ? { ...p, top: 24, bottom: 40, left: 100 } : p) }, 0],
    ['wrapped inline label painted under Leave is an overlap', { ...base, parts: [...base.parts, { name: 'fight-label', left: 8, top: 10, right: 380, bottom: 38, boxes: [{ left: 8, top: 10, right: 380, bottom: 24 }, { left: 8, top: 24, right: 150, bottom: 38 }] }].map((p) => p.name === 'coop-leave' ? { ...p, top: 24, bottom: 40, left: 100 } : p) }, 1],
    ['wrapped Leave painted over the battlefield', { ...base, field: { left: 0, top: 60, right: 390, bottom: 500 } }, 1],
    ['parts end above the battlefield', { ...base, field: { left: 0, top: 80, right: 390, bottom: 500 } }, 0],
    ['spills out of band', { ...base, parts: [{ ...base.parts[0], bottom: 120 }, ...base.parts.slice(1)] }, 1],
  ];
  const oneRow = { ...base, parts: [
    { name: 'resbars-host', left: 8, top: 0, right: 780, bottom: 8 },
    { name: 'coop-leave', left: 788, top: 0, right: 836, bottom: 32 },
    { name: 'hud-quick-settings', floating: true, left: 796, top: 36, right: 840, bottom: 128 }], bars: [], innerWidth: 844, scrollWidth: 844,
    topbar: { left: 0, top: 0, right: 844, bottom: 33 } };
  const twoRows = { ...oneRow, parts: [oneRow.parts[0], { ...oneRow.parts[1], left: 8, right: 56, top: 8, bottom: 40 }, oneRow.parts[2]], topbar: { left: 0, top: 0, right: 844, bottom: 41 } };
  cases.push(['compact band on one row', oneRow, 0, { singleRow: true }]);
  cases.push(['compact band wrapped to two rows', twoRows, 1, { singleRow: true }]);
  cases.push(['two rows allowed off the compact band', twoRows, 0, { singleRow: false }]);
  const wrong = cases.filter(([, g, want, opts]) => (judge(g, 'st', opts).length > 0 ? 1 : 0) !== want);
  for (const [name] of wrong) console.error(`  selftest: ${name} judged wrongly`);
  console.log(`coop-hud-top selftest: ${wrong.length ? 'RED' : 'GREEN'} (${cases.length - wrong.length}/${cases.length})`);
  return wrong.length ? 1 : 0;
}

async function main(args) {
  if (args.includes('--selftest')) return selftest();
  const shotsAt = args.indexOf('--shots');
  const shotDir = shotsAt >= 0 ? resolve(args[shotsAt + 1] || '.') : null;
  if (shotDir) mkdirSync(shotDir, { recursive: true });
  const browser = resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']);
  if (!browser) { console.error('coop-hud-top HARNESS — no Chrome/Chromium (set CHROME)'); return 2; }
  const served = await serve({ root: ROOT, port: 8571, open: false });
  const launched = await launchBrowser({ prefix: 'coophud-', browser, timeoutMs: 20000 });
  const cdp = connectCdp(launched.wsUrl);
  const failures = [];
  let clean = 0;
  try {
    await cdp.ready;
    for (const vp of VIEWPORTS) {
      const label = `${vp.width}x${vp.height}`;
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.width < 600 }, sessionId);
      await cdp.send('Page.navigate', { url: `http://localhost:${served.port}/index.html?shot=coop` }, sessionId);
      let g = null;
      for (let t = 0; t < 90 && !(g && g.mounted); t++) {
        await wait(500);
        g = (await cdp.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true }, sessionId)).result?.value;
      }
      if (g && g.mounted) { await wait(1200); g = (await cdp.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true }, sessionId)).result?.value; }
      const bad = judge(g, label, vp);
      failures.push(...bad);
      if (!bad.length) clean++;
      console.log(`  ${bad.length ? '✗' : '✓'} ${label}: hud-top ${g?.hudTop?.display ?? '?'}, ${g?.parts?.length ?? 0} parts, ${g?.bars?.length ?? 0} bars${bad.length ? '' : ', no overlap/clip/overflow'}`);
      if (process.env.COOP_HUD_DEBUG) console.log(JSON.stringify(g, null, 1));
      if (shotDir) {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        writeFileSync(resolve(shotDir, `coop-hud-top-${label}.png`), Buffer.from(data, 'base64'));
      }
      await cdp.send('Target.closeTarget', { targetId });
    }
  } finally {
    cdp.close();
    await launched.close();
    served.server.close();
  }
  for (const f of failures) console.error(`  ${f}`);
  console.log(failures.length ? `  ${failures.length} failure(s)` : '  no overlap, clipping, lost part, battlefield spill or horizontal overflow');
  console.log(`coop-hud-top: ${failures.length ? 'RED' : 'GREEN'} (${clean}/${VIEWPORTS.length})`);
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`coop-hud-top HARNESS — ${e.stack || e.message}`); process.exit(2); });
}
