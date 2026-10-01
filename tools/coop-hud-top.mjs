#!/usr/bin/env node
// tools/coop-hud-top.mjs — the co-op formation HUD top, measured in Chromium.
//
// WHY THIS FILE EXISTS (#1368's open question, decided as D22 in
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
//   * no part is lost: the resource bars, Leave and the quick-settings cluster
//     are always there, the fight label is there off the compact band (the
//     compact band hides it by design), and exactly EXPECTED_RESOURCE_ROWS
//     resource rows (HP, Mana, Stamina) are shown;
//   * every visible part of the HUD top lies inside the viewport on all four
//     sides, and every part but the floating quick-settings cluster inside the
//     topbar band;
//   * no two of those parts overlap;
//   * in the compact band, every part sits mostly on the row of the tallest;
//   * every resource bar is inside the viewport and has a width.
//
//   node tools/coop-hud-top.mjs                 judge, exit 0 green / 1 red / 2 harness
//   node tools/coop-hud-top.mjs --shots <dir>   also write coop-hud-top-<w>x<h>.png
//   COOP_HUD_PORT=<n>                           serve on another port (default 8571)
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
// The canned co-op host snapshot's seat shows HP, Mana and Stamina, one
// `.resline` each. A row that goes missing is a lost part.
export const EXPECTED_RESOURCE_ROWS = 3;
// Compact band: a part must share at least this share of its own height with
// the tallest part's row, so one sitting mostly on a second line is caught.
const ROW_SHARE = 0.5;
const PORT = Number(process.env.COOP_HUD_PORT) || 8571;
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
  if (!g.parts.some((p) => p.name === 'hud-quick-settings')) bad.push(`${label}: quick-settings cluster missing from the topbar`);
  if (!singleRow && !g.parts.some((p) => p.name === 'fight-label')) bad.push(`${label}: fight label missing from the HUD top`);
  if ((g.bars || []).length !== EXPECTED_RESOURCE_ROWS) bad.push(`${label}: ${(g.bars || []).length} resource rows shown, want ${EXPECTED_RESOURCE_ROWS} (HP, Mana, Stamina)`);
  const measured = [...g.parts, ...(g.bars || [])];
  // Resource rows are children of the host: check each row against the band
  // and its peers without counting its overlap with its own parent.
  const peers = measured.filter((p) => p.name !== 'resbars-host');
  for (const p of measured) {
    if (p.left < -TOLERANCE || p.right > g.innerWidth + TOLERANCE) bad.push(`${label}: ${p.name} clipped by the viewport (${p.left.toFixed(1)}..${p.right.toFixed(1)} of ${g.innerWidth})`);
    if (p.top < -TOLERANCE || p.bottom > g.innerHeight + TOLERANCE) bad.push(`${label}: ${p.name} clipped by the viewport (${p.top.toFixed(1)}..${p.bottom.toFixed(1)} of ${g.innerHeight} tall)`);
    if (!p.floating && (p.top < g.topbar.top - TOLERANCE || p.bottom > g.topbar.bottom + TOLERANCE)) bad.push(`${label}: ${p.name} spills out of the topbar band (${p.top.toFixed(1)}..${p.bottom.toFixed(1)} vs ${g.topbar.top.toFixed(1)}..${g.topbar.bottom.toFixed(1)})`);
  }
  // The band is the grid row the topbar sits in. The topbar box itself is
  // height:auto/overflow:visible in formation, so it grows with a part that
  // wraps; the battlefield below does not move. A part that reaches past the
  // field's top edge is painted over the fight.
  if (g.field) for (const p of measured) {
    if (!p.floating && p.bottom > g.field.top + TOLERANCE) bad.push(`${label}: ${p.name} reaches into the battlefield (bottom ${p.bottom.toFixed(1)} > field top ${g.field.top.toFixed(1)})`);
  }
  if (singleRow) {
    const inBand = peers.filter((p) => !p.floating);
    const tall = inBand.reduce((a, p) => (!a || p.bottom - p.top > a.bottom - a.top ? p : a), null);
    const offRow = inBand.filter((p) => p !== tall && Math.min(p.bottom, tall.bottom) - Math.max(p.top, tall.top) < ROW_SHARE * (p.bottom - p.top) - TOLERANCE);
    if (offRow.length) bad.push(`${label}: compact band is not one row (${inBand.map((p) => `${p.name} ${p.top.toFixed(1)}..${p.bottom.toFixed(1)}`).join(', ')})`);
  }
  for (let i = 0; i < peers.length; i++) for (let j = i + 1; j < peers.length; j++) {
    const a = peers[i], b = peers[j];
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
      { name: 'fight-label', left: 8, top: 4, right: 300, bottom: 36 },
      { name: 'hud-quick-settings', floating: true, left: 346, top: 84, right: 388, bottom: 180 },
    ], bars: [40, 52, 64].map((top) => ({ name: 'resline', left: 8, top, right: 300, bottom: top + 10, width: 292 })) };
  const without = (name) => ({ ...base, parts: base.parts.filter((p) => p.name !== name) });
  const cases = [
    ['clean layout', base, 0],
    ['overlap', { ...base, parts: base.parts.map((p) => p.name === 'coop-leave' ? { ...p, left: 250 } : p) }, 1],
    ['overflow', { ...base, scrollWidth: 420 }, 1],
    ['clipped Leave', { ...base, parts: base.parts.map((p) => p.name === 'coop-leave' ? { ...p, left: 380, right: 450 } : p) }, 1],
    ['lost Leave', without('coop-leave'), 1],
    ['lost resource bars', without('resbars-host'), 1, {}, /resource bars missing/],
    ['lost fight label off the compact band', without('fight-label'), 1, {}, /fight label missing/],
    ['lost quick settings', without('hud-quick-settings'), 1, {}, /quick-settings cluster missing/],
    ['lost resource row', { ...base, bars: base.bars.slice(0, 2) }, 1, {}, /2 resource rows shown/],
    ['extra resource row', { ...base, bars: [...base.bars, { ...base.bars[0] }] }, 1, {}, /4 resource rows shown/],
    ['quick settings run past the bottom of the screen', { ...base, parts: base.parts.map((p) => p.name === 'hud-quick-settings' ? { ...p, top: 780, bottom: 900 } : p) }, 1, {}, /hud-quick-settings clipped by the viewport .* tall/],
    ['part pushed above the top of the screen', { ...base, topbar: { ...base.topbar, top: -40 }, parts: base.parts.map((p) => p.name === 'fight-label' ? { ...p, top: -30, bottom: -2 } : p) }, 1, {}, /fight-label clipped by the viewport .* tall/],
    ['wrapped inline label beside Leave is not an overlap', { ...base, parts: [...without('fight-label').parts, { name: 'fight-label', left: 8, top: 10, right: 380, bottom: 38, boxes: [{ left: 8, top: 10, right: 380, bottom: 24 }, { left: 8, top: 24, right: 90, bottom: 38 }] }].map((p) => p.name === 'coop-leave' ? { ...p, top: 24, bottom: 40, left: 100 } : p) }, 0],
    ['wrapped inline label painted under Leave is an overlap', { ...base, parts: [...without('fight-label').parts, { name: 'fight-label', left: 8, top: 10, right: 380, bottom: 38, boxes: [{ left: 8, top: 10, right: 380, bottom: 24 }, { left: 8, top: 24, right: 150, bottom: 38 }] }].map((p) => p.name === 'coop-leave' ? { ...p, top: 24, bottom: 40, left: 100 } : p) }, 1],
    ['wrapped Leave painted over the battlefield', { ...base, field: { left: 0, top: 60, right: 390, bottom: 500 } }, 1],
    ['parts end above the battlefield', { ...base, field: { left: 0, top: 80, right: 390, bottom: 500 } }, 0],
    ['spills out of band', { ...base, parts: [{ ...base.parts[0], bottom: 120 }, ...base.parts.slice(1)] }, 1],
  ];
  const oneRow = { ...base, parts: [
    { name: 'resbars-host', left: 8, top: 0, right: 780, bottom: 8 },
    { name: 'coop-leave', left: 788, top: 0, right: 836, bottom: 32 },
    { name: 'hud-quick-settings', floating: true, left: 796, top: 36, right: 840, bottom: 128 }], innerWidth: 844, innerHeight: 390, scrollWidth: 844,
    bars: [8, 270, 530].map((left) => ({ name: 'resline', left, top: 12, right: left + 250, bottom: 20, width: 250 })),
    topbar: { left: 0, top: 0, right: 844, bottom: 33 } };
  const twoRows = { ...oneRow, bars: oneRow.bars.map((bar) => ({ ...bar, top: 0, bottom: 8 })), parts: [oneRow.parts[0], { ...oneRow.parts[1], left: 8, right: 56, top: 8, bottom: 40 }, oneRow.parts[2]], topbar: { left: 0, top: 0, right: 844, bottom: 41 } };
  cases.push(['compact band on one row', oneRow, 0, { singleRow: true }]);
  cases.push(['compact band wrapped to two rows', twoRows, 1, { singleRow: true }]);
  // The bars share 2px with Leave's row but sit mostly below it: still two
  // rows, though every pair of parts shares some vertical band.
  const mostlyBelow = { ...oneRow, parts: [{ ...oneRow.parts[0], top: 30, bottom: 38 }, oneRow.parts[1], { ...oneRow.parts[2], top: 42, bottom: 134 }],
    bars: oneRow.bars.map((b) => ({ ...b, top: 30, bottom: 38 })), topbar: { left: 0, top: 0, right: 844, bottom: 39 } };
  cases.push(['compact band part mostly below the row', mostlyBelow, 1, { singleRow: true }, /not one row/]);
  cases.push(['compact band hides the fight label by design', oneRow, 0, { singleRow: true }]);
  cases.push(['two rows allowed off the compact band', { ...twoRows, parts: [...twoRows.parts, { name: 'fight-label', left: 100, top: 12, right: 500, bottom: 30 }] }, 0, { singleRow: false }]);
  const moveFirstBar = (patch) => ({ ...base, bars: base.bars.map((bar, index) => index ? bar : { ...bar, ...patch }) });
  cases.push(['resource row above viewport', moveFirstBar({ top: -12, bottom: -2 }), 1, {}, /resline clipped by the viewport .* tall/]);
  cases.push(['resource row below viewport', moveFirstBar({ top: 840, bottom: 850 }), 1, {}, /resline clipped by the viewport .* tall/]);
  cases.push(['resource row outside topbar', moveFirstBar({ top: 82, bottom: 92 }), 1, {}, /resline spills out of the topbar/]);
  cases.push(['resource row over Leave', moveFirstBar({ left: 320, right: 380 }), 1, {}, /coop-leave overlaps resline/]);
  cases.push(['resource rows overlap', moveFirstBar({ top: 52, bottom: 62 }), 1, {}, /resline overlaps resline/]);
  cases.push(['resource row over battlefield', { ...moveFirstBar({ top: 72, bottom: 82 }), field: { top: 80 } }, 1, {}, /resline reaches into the battlefield/]);
  // An optional fifth field names the failure the case must be caught BY, so a
  // case cannot pass on some other, accidental failure.
  const wrong = cases.filter(([, g, want, opts, why]) => {
    const bad = judge(g, 'st', opts);
    return (bad.length > 0 ? 1 : 0) !== want || (why && !bad.some((m) => why.test(m)));
  });
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
  const served = await serve({ root: ROOT, port: PORT, open: false });
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
  console.log(failures.length ? `  ${failures.length} failure(s)` : '  no overlap, clipping, lost part, two-row compact band, battlefield spill or horizontal overflow');
  console.log(`coop-hud-top: ${failures.length ? 'RED' : 'GREEN'} (${clean}/${VIEWPORTS.length})`);
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`coop-hud-top HARNESS — ${e.stack || e.message}`); process.exit(2); });
}
