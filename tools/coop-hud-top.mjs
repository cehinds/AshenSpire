#!/usr/bin/env node
// tools/coop-hud-top.mjs — the co-op formation HUD top, measured in Chromium.
//
// WHY THIS FILE EXISTS (#1368's open question, decided as D29 in
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
// AND THE BOTTOM BAR (owner, 2026-10-01: "What happened to my action bar at
// the bottom. It looks so bad now"). The co-op board mounts solo's own action
// row (src/ui/components/combatActionRow.js). At the same three viewports the
// tool also opens solo combat (`?shot=combat`) and judges the co-op row
// against it (judgeBar):
//   * the co-op row holds exactly solo's five controls, in solo's order —
//     Actions, Draw, End Turn, Discard/Exhaust, Potions — and no second row of
//     flask buttons exists (the flasks are behind Potions, as solo's are);
//   * it takes solo's arrangement: every control at solo's x, width and
//     height, and on solo's rows (one row wherever solo's footer is one row,
//     which is every viewport not in short-landscape rails);
//   * no two controls overlap, none leaves the viewport, the page does not
//     scroll sideways;
//   * every control clears the page's own tap floor, and Actions, End Turn
//     and Potions clear PRIMARY_TARGET_PX (D32, docs/FINISH.md).
//
// AND THE POTIONS LIST FOLLOWS ITS SEAT (#1436 review, Codex P1). Couch co-op
// puts two seats on one screen and Tab switches the active one. The Potions
// list is a body-level dialog, so a Tab pressed while it is open used to
// leave it up for the NEW seat, and a confirmed Use spent that seat's charge.
// Once, at the first viewport, through `?shot=coop&shotSeats=2`
// (seatSwitchProbe): a confirmed Use from seat 1 sends a flaskIntent as seat
// 1 (the road works), and a Tab between opening the list and confirming sends
// no flaskIntent at all.
//
//   node tools/coop-hud-top.mjs                 judge, exit 0 green / 1 red / 2 harness
//   node tools/coop-hud-top.mjs --shots <dir>   also write coop-hud-top-<w>x<h>.png
//                                               and solo-combat-<w>x<h>.png
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

// THE BOTTOM BAR. Solo's five controls, in solo's order; the role is read
// from the class each control has worn since WGC6.
export const BAR_ROLES = ['actions', 'draw', 'endTurn', 'discard', 'potions'];
// Actions, End Turn and Potions are the round and primary targets; the two
// piles keep the game's own configured target (the page's --tap-floor), which
// is what solo has always given them (D32, docs/FINISH.md).
export const PRIMARY_TARGET_PX = 48;
const PRIMARY_ROLES = new Set(['actions', 'endTurn', 'potions']);
const BAR_TOLERANCE = 1; // px: the same plan on two boards, sub-pixel rounding aside

const BAR = `(() => {
  const combat = document.querySelector('.combat[data-layout="formation"]');
  if (!combat) return { mounted: false };
  const row = combat.querySelector(':scope > .hand-area > .combat-action-row');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;height:var(--tap-floor)';
  document.body.appendChild(probe);
  const floor = probe.getBoundingClientRect().height;
  probe.remove();
  const shown = (e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const roles = [['actions', '.energy-orb'], ['draw', '.pile.draw'], ['endTurn', '.end-turn'], ['discard', '.pile.spent'], ['potions', '.combat-potions']];
  const controls = row ? [...row.children].filter((e) => !e.matches('.combat-potion-tray') && shown(e)).map((e) => {
    const r = e.getBoundingClientRect();
    const role = roles.find(([, sel]) => e.matches(sel));
    return { role: role ? role[0] : String(e.className || e.tagName), left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }) : [];
  return {
    mounted: true, coop: combat.classList.contains('coop'),
    arrangement: combat.dataset.combatArrangement || null,
    geometry: row ? row.dataset.footerGeometry || null : null,
    innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth,
    floor, row: !!row, controls,
    strayFlasks: document.querySelectorAll('.combat .coop-flasks, .combat .coop-flask, .combat [data-coop-flask-slot]').length,
  };
})()`;

// Which controls share a row: each control is keyed by the first control
// (in order) whose vertical band holds most of it.
function rowsOf(controls) {
  const anchors = [];
  return controls.map((c) => {
    const h = c.bottom - c.top;
    let at = anchors.findIndex((a) => Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) >= ROW_SHARE * Math.min(h, a.bottom - a.top) - TOLERANCE);
    if (at < 0) { anchors.push(c); at = anchors.length - 1; }
    return at;
  });
}

/** Pure judge: the co-op bottom bar against solo's, one viewport → failures. */
export function judgeBar(coop, solo, label) {
  const bad = [];
  if (!coop || !coop.mounted) return [`${label}: co-op board did not mount (bottom bar)`];
  if (!solo || !solo.mounted) return [`${label}: solo combat did not mount (bottom bar reference)`];
  if (!coop.row) return [`${label}: co-op board has no action row`];
  if (!solo.row) return [`${label}: solo combat has no action row to compare against`];
  const coopRoles = coop.controls.map((c) => c.role);
  const soloRoles = solo.controls.map((c) => c.role);
  if (soloRoles.join() !== BAR_ROLES.join()) bad.push(`${label}: solo action row is not the five WGC6 controls (${soloRoles.join(', ')})`);
  if (coopRoles.join() !== soloRoles.join()) bad.push(`${label}: co-op action row holds ${coopRoles.join(', ') || 'nothing'}, solo holds ${soloRoles.join(', ')}`);
  if (coop.strayFlasks) bad.push(`${label}: ${coop.strayFlasks} co-op flask control(s) outside the action row (a second bottom row)`);
  if (coop.arrangement !== solo.arrangement) bad.push(`${label}: co-op arrangement ${coop.arrangement} differs from solo's ${solo.arrangement}`);
  if (coop.geometry !== 'supported') bad.push(`${label}: co-op action row was not sized by the layout adapter (footer geometry ${coop.geometry})`);
  if (coop.scrollWidth > coop.innerWidth + TOLERANCE) bad.push(`${label}: co-op page scrolls sideways (${coop.scrollWidth} > ${coop.innerWidth})`);
  if (!bad.some((m) => /holds|five WGC6/.test(m))) {
    coop.controls.forEach((c, i) => {
      const s = solo.controls[i];
      const off = ['left', 'width', 'height'].filter((k) => Math.abs(c[k] - s[k]) > BAR_TOLERANCE);
      if (off.length) bad.push(`${label}: co-op ${c.role} differs from solo's in ${off.map((k) => `${k} ${c[k].toFixed(1)} vs ${s[k].toFixed(1)}`).join(', ')}`);
    });
    const coopRows = rowsOf(coop.controls).join();
    const soloRows = rowsOf(solo.controls).join();
    if (coopRows !== soloRows) bad.push(`${label}: co-op controls sit on rows [${coopRows}], solo's on [${soloRows}]`);
    if (coop.arrangement !== 'rails' && new Set(rowsOf(coop.controls)).size !== 1) bad.push(`${label}: co-op action row is not one row (${coop.controls.map((c) => `${c.role} ${c.top.toFixed(1)}..${c.bottom.toFixed(1)}`).join(', ')})`);
  }
  for (const c of coop.controls) {
    if (c.left < -TOLERANCE || c.right > coop.innerWidth + TOLERANCE || c.top < -TOLERANCE || c.bottom > coop.innerHeight + TOLERANCE) bad.push(`${label}: co-op ${c.role} leaves the viewport (${c.left.toFixed(1)},${c.top.toFixed(1)}..${c.right.toFixed(1)},${c.bottom.toFixed(1)})`);
    const least = Math.min(c.width, c.height);
    if (least < coop.floor - TOLERANCE) bad.push(`${label}: co-op ${c.role} is ${c.width.toFixed(1)}x${c.height.toFixed(1)}, under the ${coop.floor}px tap floor`);
    if (PRIMARY_ROLES.has(c.role) && least < PRIMARY_TARGET_PX - TOLERANCE) bad.push(`${label}: co-op ${c.role} is ${c.width.toFixed(1)}x${c.height.toFixed(1)}, under ${PRIMARY_TARGET_PX}px`);
  }
  for (let i = 0; i < coop.controls.length; i++) for (let j = i + 1; j < coop.controls.length; j++) {
    const a = coop.controls[i], b = coop.controls[j];
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > TOLERANCE && h > TOLERANCE) bad.push(`${label}: co-op ${a.role} overlaps ${b.role} (${w.toFixed(1)}x${h.toFixed(1)}px)`);
  }
  return bad;
}

function barSelftest() {
  const ctl = (role, left, width, top = 790, height = 53) => ({ role, left, width, top, height, right: left + width, bottom: top + height });
  const soloRow = [ctl('actions', 0, 53), ctl('draw', 57, 64, 794, 44), ctl('endTurn', 124, 143), ctl('discard', 270, 64, 794, 44), ctl('potions', 337, 53)];
  const base = { mounted: true, coop: false, arrangement: 'stacked', geometry: 'supported', innerWidth: 390, innerHeight: 844, scrollWidth: 390, floor: 44, row: true, controls: soloRow, strayFlasks: 0 };
  const coop = { ...base, coop: true };
  const swap = (patch) => ({ ...coop, controls: coop.controls.map((c) => (patch[c.role] ? { ...c, ...patch[c.role], right: (patch[c.role].left ?? c.left) + (patch[c.role].width ?? c.width), bottom: (patch[c.role].top ?? c.top) + (patch[c.role].height ?? c.height) } : c)) });
  // The owner's before: an Actions circle, a wide End Turn, flasks under it.
  const before = { ...coop, geometry: null, controls: [ctl('actions', 1, 48, 724, 48), ctl('endTurn', 52, 337, 724, 48)], strayFlasks: 2 };
  const railsSolo = { ...base, innerWidth: 844, innerHeight: 390, scrollWidth: 844, arrangement: 'rails', controls: [ctl('actions', 0, 53, 337), ctl('draw', 56, 64, 341, 44), ctl('endTurn', 724, 120, 280), ctl('discard', 724, 64, 341, 44), ctl('potions', 791, 53, 337)] };
  const railsCoop = { ...railsSolo, coop: true };
  const cases = [
    ['co-op row is solo row', coop, base, 0],
    ['the owner\'s before: two controls and a flask row', before, base, 1, /holds actions, endTurn/],
    ['flask buttons left beside the row', { ...coop, strayFlasks: 2 }, base, 1, /outside the action row/],
    ['co-op drops Draw', { ...coop, controls: coop.controls.filter((c) => c.role !== 'draw') }, base, 1, /holds actions, endTurn, discard/],
    ['co-op reorders Potions first', { ...coop, controls: [coop.controls[4], ...coop.controls.slice(0, 4)] }, base, 1, /holds potions/],
    ['co-op End Turn over-wide', swap({ endTurn: { width: 160 } }), base, 1, /endTurn differs from solo's in width/],
    ['co-op End Turn over Discard', swap({ endTurn: { width: 150 } }), { ...base, controls: [...soloRow.slice(0, 2), ctl('endTurn', 124, 150), ...soloRow.slice(3)] }, 1, /endTurn overlaps discard/],
    ['co-op Potions wraps to a second row', swap({ potions: { top: 850 } }), base, 1, /not one row|rows/],
    ['co-op Potions off the right edge', swap({ potions: { left: 360 } }), { ...base, controls: [...soloRow.slice(0, 4), ctl('potions', 360, 53)] }, 1, /potions leaves the viewport/],
    ['co-op page scrolls sideways', { ...coop, scrollWidth: 420 }, base, 1, /scrolls sideways/],
    ['co-op not sized by the adapter', { ...coop, geometry: null }, base, 1, /footer geometry/],
    ['co-op arrangement differs', { ...coop, arrangement: 'rails' }, base, 1, /arrangement/],
    ['co-op Actions under 48px', swap({ actions: { width: 46, height: 46 } }), { ...base, controls: [ctl('actions', 0, 46, 790, 46), ...soloRow.slice(1)] }, 1, /actions is .* under 48px/],
    ['pile under the tap floor', swap({ draw: { height: 40 } }), { ...base, controls: [soloRow[0], ctl('draw', 57, 64, 794, 40), ...soloRow.slice(2)] }, 1, /draw is .* under the 44px tap floor/],
    ['rails: same two rows as solo', railsCoop, railsSolo, 0],
    ['rails: co-op folds back to one row', { ...railsCoop, controls: railsCoop.controls.map((c) => ({ ...c, top: 337, bottom: 337 + (c.bottom - c.top) })) }, railsSolo, 1, /rows/],
    ['co-op did not mount', { mounted: false }, base, 1, /did not mount/],
    ['co-op has no row', { ...coop, row: false, controls: [] }, base, 1, /no action row/],
  ];
  const wrong = cases.filter(([, c, s, want, why]) => {
    const bad = judgeBar(c, s, 'st');
    return (bad.length > 0 ? 1 : 0) !== want || (why && !bad.some((m) => why.test(m)));
  });
  for (const [name] of wrong) console.error(`  bar selftest: ${name} judged wrongly`);
  return { total: cases.length, wrong: wrong.length };
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
  const bar = barSelftest();
  const total = cases.length + bar.total, failed = wrong.length + bar.wrong;
  console.log(`coop-hud-top selftest: ${failed ? 'RED' : 'GREEN'} (${total - failed}/${total}; bottom bar ${bar.total - bar.wrong}/${bar.total})`);
  return failed ? 1 : 0;
}

// Runs in the page, a step at a time (seatSwitchProbe drives the keys).
const SEAT_STEP = {
  // Seat 2 has not ended its turn, so it COULD drink: the bug's precondition.
  ready: `(() => { const s = structuredClone(window.__coopSnapshotForShot); s.scene.players.forEach((p) => { p.ended = false; });
    window.__receiveCoopSnapshotForShot(s); window.__coopSentForShot.length = 0; return true; })()`,
  open: `(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('.combat.coop .combat-potions').click();
    let use = null; for (let t = 0; t < 40 && !use; t++) { await sleep(100); use = document.querySelector('.combat-potion-menu .potion-fold[data-charge-kind] .potion-use'); }
    if (!use || use.disabled) return 'no usable charge in the Potions list';
    use.click();
    let yes = null; for (let t = 0; t < 40 && !yes; t++) { await sleep(100); yes = document.querySelector('.confirmation-modal .confirmation-confirm'); }
    return yes ? '' : 'Use opened no confirmation'; })()`,
  confirm: `(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const yes = document.querySelector('.confirmation-modal .confirmation-confirm'); if (yes) yes.click(); await sleep(400);
    return window.__coopSentForShot.filter((m) => m.t === 'flaskIntent').map((m) => m.as); })()`,
  activeSeat: `document.querySelector('.coop-seat-tabs [aria-selected="true"]')?.textContent || ''`,
};

async function seatSwitchProbe(cdp, sessionId, base) {
  const ev = async (expression) => (await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)).result?.value;
  const key = async (k, code, vk) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }, sessionId);
  };
  const bad = [];
  const fresh = async () => {
    await cdp.send('Page.navigate', { url: `${base}?shot=coop&shotSeats=2` }, sessionId);
    for (let t = 0; t < 90 && !(await ev(`!!document.querySelector('.combat.coop .combat-potions')`)); t++) await wait(500);
    await wait(800);
    await ev(SEAT_STEP.ready);
    await wait(300);
  };
  await fresh();
  let why = await ev(SEAT_STEP.open);
  if (why) return [`seat switch: ${why}`];
  const straight = await ev(SEAT_STEP.confirm);
  if (!(straight.length === 1 && straight[0] === 'p1')) bad.push(`seat switch: a confirmed Use from seat 1 sent ${JSON.stringify(straight)}, want one flaskIntent as p1`);
  await fresh();
  const before = await ev(SEAT_STEP.activeSeat);
  why = await ev(SEAT_STEP.open);
  if (why) return [...bad, `seat switch: ${why}`];
  await key('Tab', 'Tab', 9);
  await wait(400);
  const after = await ev(SEAT_STEP.activeSeat);
  if (before === after) bad.push(`seat switch: Tab did not switch the active seat (${before})`);
  const switched = await ev(SEAT_STEP.confirm);
  if (switched.length) bad.push(`seat switch: Tab after opening Potions, then Use, sent ${JSON.stringify(switched)}; want nothing (the list belonged to seat 1)`);
  console.log(`  ${bad.length ? '✗' : '✓'} seat switch: Use as seat 1 sends ${JSON.stringify(straight)}; after Tab (${before} -> ${after}) sends ${JSON.stringify(switched)}`);
  return bad;
}

// THE STANCE CHOOSER OWNS THE COUCH KEYBOARD (#1449 review, Codex P1).
// Warrior's Vow opens a body-level dialog before its play intent. Tab inside
// it must move between the stance buttons, not switch the couch seat (which
// used to drop the pick silently), and the board's 1-9/Q and E keys must not
// act behind it. A seat switch that does happen (a pad press, a seat tab)
// closes the chooser, so nothing is chosen for a seat that did not open it.
// Through `?shot=coop&shotSeats=2` (vowChoiceProbe): seat 1 holds the Vow in
// slot 1 and stands in Gorefire; key 1 opens the chooser with Gorefire disabled; Tab keeps seat 1 and focus in the dialog;
// E sends no endTurn; the pick sends one playCard as p1 with that stance; and
// a seat-tab switch with the chooser open closes it and sends nothing; and a
// snapshot that leaves combat (another player ends the fight) closes it too.
const VOW_STEP = {
  ready: `(() => { const s = structuredClone(window.__coopSnapshotForShot); s.scene.players.forEach((p) => { p.ended = false; });
    s.scene.players[0].hand = [{ instanceId: 'vow1', cardId: 'warriorsVow', upgraded: false }, ...s.scene.players[0].hand];
    s.scene.players[0].stanceId = 'gorefire';
    window.__receiveCoopSnapshotForShot(s); window.__coopSentForShot.length = 0; return true; })()`,
  state: `(() => { const d = document.querySelector('.card-choice'); return {
    open: !!d, inDialog: !!(d && d.contains(document.activeElement)), options: document.querySelectorAll('.card-choice .card-choice-option').length,
    disabled: [...document.querySelectorAll('.card-choice .card-choice-option[disabled]')].map((b) => b.dataset.choice),
    seat: document.querySelector('.coop-seat-tabs [aria-selected="true"]')?.textContent || '',
    sent: window.__coopSentForShot.map((m) => ({ t: m.t, as: m.as, choice: m.choice })) }; })()`,
  pick: `(async () => { const b = document.querySelector('.card-choice .card-choice-option:not([disabled])'); const id = b?.dataset.choice || ''; if (b) b.click();
    await new Promise((r) => setTimeout(r, 400)); return id; })()`,
  leaveCombat: `(async () => { const s = structuredClone(window.__coopSnapshot); s.scene = { kind: 'complete', victory: true };
    window.__receiveCoopSnapshotForShot(s); await new Promise((r) => setTimeout(r, 400)); return true; })()`,
  switchSeat: `(async () => { document.querySelector('.coop-seat-tabs [data-seat-i="1"]')?.click(); await new Promise((r) => setTimeout(r, 400)); return true; })()`,
};

async function vowChoiceProbe(cdp, sessionId, base) {
  const ev = async (expression) => (await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)).result?.value;
  const key = async (k, code, vk) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(k.length === 1 ? { text: k } : {}) }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }, sessionId);
    await wait(300);
  };
  const fresh = async () => {
    await cdp.send('Page.navigate', { url: `${base}?shot=coop&shotSeats=2` }, sessionId);
    for (let t = 0; t < 90 && !(await ev(`!!document.querySelector('.combat.coop .combat-potions')`)); t++) await wait(500);
    await wait(800);
    await ev(VOW_STEP.ready);
    await wait(300);
  };
  const bad = [];
  await fresh();
  const before = await ev(VOW_STEP.state);
  await key('1', 'Digit1', 49);
  const opened = await ev(VOW_STEP.state);
  if (!opened.open || opened.options < 2) return [`vow chooser: key 1 on Warrior's Vow opened ${opened.open ? opened.options + ' option(s)' : 'no chooser'}; want a stance chooser`];
  // The seat stands in Gorefire: that option is shown but disabled (#1449 review, Codex P2).
  if (JSON.stringify(opened.disabled) !== '["gorefire"]') bad.push(`vow chooser: in Gorefire the disabled options are ${JSON.stringify(opened.disabled)}; want ["gorefire"]`);
  await key('Tab', 'Tab', 9);
  const tabbed = await ev(VOW_STEP.state);
  if (tabbed.seat !== before.seat) bad.push(`vow chooser: Tab with the chooser open switched the seat (${before.seat} -> ${tabbed.seat}); want the chooser to keep Tab`);
  if (!tabbed.open || !tabbed.inDialog) bad.push(`vow chooser: after Tab the chooser is ${tabbed.open ? 'open but focus left it' : 'closed'}; want focus inside it`);
  await key('e', 'KeyE', 69);
  const ended = await ev(VOW_STEP.state);
  if (ended.sent.some((m) => m.t === 'endTurn')) bad.push('vow chooser: E behind the open chooser sent endTurn; want nothing');
  await key('2', 'Digit2', 50);
  const pressed = await ev(VOW_STEP.state);
  if (pressed.sent.some((m) => m.t === 'playCard')) bad.push(`vow chooser: key 2 behind the open chooser sent ${JSON.stringify(pressed.sent)}; want nothing`);
  const choice = await ev(VOW_STEP.pick);
  const played = await ev(VOW_STEP.state);
  const plays = played.sent.filter((m) => m.t === 'playCard');
  if (!(plays.length === 1 && plays[0].as === 'p1' && plays[0].choice === choice && choice && choice !== 'gorefire')) bad.push(`vow chooser: picking ${choice} sent ${JSON.stringify(played.sent)}; want one playCard as p1 with choice ${choice}`);
  await fresh();
  await key('1', 'Digit1', 49);
  await ev(VOW_STEP.switchSeat);
  const moved = await ev(VOW_STEP.state);
  if (moved.open) bad.push(`vow chooser: a seat switch (${moved.seat}) left the chooser open over the new seat; want it closed`);
  if (moved.sent.length) bad.push(`vow chooser: a seat switch with the chooser open sent ${JSON.stringify(moved.sent)}; want nothing`);
  await fresh();
  await key('1', 'Digit1', 49);
  const reopened = await ev(VOW_STEP.state);
  await ev(VOW_STEP.leaveCombat);
  const left = await ev(VOW_STEP.state);
  if (!reopened.open) bad.push('vow chooser: key 1 did not reopen the chooser before the leave-combat check');
  if (left.open) bad.push('vow chooser: a snapshot that left combat kept the chooser open over the next scene; want it closed');
  if (left.sent.length) bad.push(`vow chooser: leaving combat with the chooser open sent ${JSON.stringify(left.sent)}; want nothing`);
  console.log(`  ${bad.length ? '✗' : '✓'} vow chooser: disabled ${JSON.stringify(opened.disabled)}; Tab keeps ${tabbed.seat} (focus in dialog ${tabbed.inDialog}); pick ${choice} sends ${JSON.stringify(plays)}; seat switch closes it (${!moved.open}); leaving combat closes it (${!left.open})`);
  return bad;
}

// A flask key pressed twice (or held into keydown repeats) leaves ONE
// Potions list, and Escape clears the board (#1436 review, Codex P2). Before
// the fix each press stacked another modal and Escape closed only the newest.
const REPEAT_STEP = {
  press: `(() => { for (let i = 0; i < 3; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true, repeat: i > 0 }));
    return document.querySelectorAll('.combat-potion-menu').length; })()`,
  lists: `document.querySelectorAll('.combat-potion-menu').length`,
  // The Actions and Discard/Exhaust labels follow the painted values (#1436 review).
  labels: `(() => { const orb = document.querySelector('.combat.coop .energy-orb'); const spent = document.querySelector('.combat.coop .pile.spent');
    return { orb: orb?.getAttribute('aria-label') || '', value: orb?.querySelector('.sp-v')?.textContent || '', spent: spent?.getAttribute('aria-label') || '' }; })()`,
};

async function repeatOpenProbe(cdp, sessionId, base) {
  const ev = async (expression) => (await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)).result?.value;
  await cdp.send('Page.navigate', { url: `${base}?shot=coop` }, sessionId);
  for (let t = 0; t < 90 && !(await ev(`!!document.querySelector('.combat.coop .combat-potions')`)); t++) await wait(500);
  await wait(800);
  await ev(SEAT_STEP.ready);
  await wait(300);
  const labels = await ev(REPEAT_STEP.labels);
  const [have, max] = String(labels?.value || '').split('/');
  const labelBad = [];
  if (!have || labels.orb !== `Actions ${have} of ${max}`) labelBad.push(`labels: Actions reads "${labels?.orb}" while it shows ${labels?.value}; want "Actions ${have} of ${max}"`);
  if (/Open piles/.test(labels?.spent || '')) labelBad.push(`labels: co-op Discard/Exhaust promises "Open piles" (${labels.spent}); co-op has no pile viewer`);
  await ev(REPEAT_STEP.press);
  await wait(400);
  const open = await ev(REPEAT_STEP.lists);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
  await wait(500);
  const left = await ev(REPEAT_STEP.lists);
  const bad = [...labelBad];
  if (open !== 1) bad.push(`repeat open: three flask-key presses left ${open} Potions lists; want 1`);
  if (left !== 0) bad.push(`repeat open: Escape left ${left} Potions lists over the board; want 0`);
  console.log(`  ${bad.length ? '✗' : '✓'} repeat open: three flask presses -> ${open} list(s); Escape -> ${left}; labels "${labels?.orb}" / "${labels?.spent}"`);
  return bad;
}

// A host response that lands under an open Potions list (#1436 review,
// Codex P1 and P2). STALE: seat 1 carries Blight Coating in slot 0, opens
// Use on it, then a snapshot shifts Flask of Stone into slot 0; the confirm
// must send nothing (before the fix it threw slot 0, the wrong potion).
// SCENE: the fight ends under the open list; the list must close.
const LIVE_STEP = {
  carry: `(() => { const s = structuredClone(window.__coopSnapshotForShot); s.scene.players.forEach((p) => { p.ended = false; });
    s.scene.players[0].flasks = [{ flaskId: 'blightCoating' }, { flaskId: 'flaskOfStone' }];
    window.__receiveCoopSnapshotForShot(s); window.__coopSentForShot.length = 0; return true; })()`,
  openSlot0: `(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('.combat.coop .combat-potions').click();
    let use = null; for (let t = 0; t < 40 && !use; t++) { await sleep(100); use = document.querySelector('.combat-potion-menu .potion-fold[data-potion-slot="0"] .potion-use'); }
    if (!use || use.disabled) return 'no usable carried potion in slot 0';
    use.click();
    let yes = null; for (let t = 0; t < 40 && !yes; t++) { await sleep(100); yes = document.querySelector('.confirmation-modal .confirmation-confirm'); }
    return yes ? '' : 'Use opened no confirmation'; })()`,
  shift: `(() => { const s = structuredClone(window.__coopSnapshotForShot); s.scene.players.forEach((p) => { p.ended = false; });
    s.scene.players[0].flasks = [{ flaskId: 'flaskOfStone' }];
    window.__receiveCoopSnapshotForShot(s); return true; })()`,
  openList: `(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('.combat.coop .combat-potions').click();
    for (let t = 0; t < 40 && !document.querySelector('.combat-potion-menu'); t++) await sleep(100);
    return document.querySelectorAll('.combat-potion-menu').length; })()`,
  leave: `(() => { const s = structuredClone(window.__coopSnapshotForShot); s.scene = { kind: 'interlude' };
    window.__receiveCoopSnapshotForShot(s); return true; })()`,
};

async function liveSnapshotProbe(cdp, sessionId, base) {
  const ev = async (expression) => (await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)).result?.value;
  const fresh = async () => {
    await cdp.send('Page.navigate', { url: `${base}?shot=coop` }, sessionId);
    for (let t = 0; t < 90 && !(await ev(`!!document.querySelector('.combat.coop .combat-potions')`)); t++) await wait(500);
    await wait(800);
  };
  const bad = [];
  // Control: with no snapshot under it, the same carried Use is sent.
  await fresh();
  await ev(LIVE_STEP.carry);
  await wait(300);
  const ctlWhy = await ev(LIVE_STEP.openSlot0);
  const control = ctlWhy ? null : await ev(SEAT_STEP.confirm);
  if (ctlWhy) bad.push(`stale slot control: ${ctlWhy}`);
  else if (!(control.length === 1 && control[0] === 'p1')) bad.push(`stale slot control: an unshifted Blight Coating Use sent ${JSON.stringify(control)}; want one flaskIntent as p1`);
  await fresh();
  await ev(LIVE_STEP.carry);
  await wait(300);
  const why = await ev(LIVE_STEP.openSlot0);
  let stale = null;
  if (why) bad.push(`stale slot: ${why}`);
  else {
    await ev(LIVE_STEP.shift);
    await wait(300);
    stale = await ev(SEAT_STEP.confirm);
    if (stale.length) bad.push(`stale slot: a snapshot moved Flask of Stone into slot 0 under the list, then the Blight Coating Use sent ${JSON.stringify(stale)}; want nothing`);
  }
  await fresh();
  const opened = await ev(LIVE_STEP.openList);
  await ev(LIVE_STEP.leave);
  await wait(500);
  const left = await ev(REPEAT_STEP.lists);
  if (opened !== 1) bad.push(`scene change: Potions opened ${opened} list(s); want 1`);
  if (left !== 0) bad.push(`scene change: the fight ended under the Potions list and ${left} list(s) stayed over the next scene; want 0`);
  console.log(`  ${bad.length ? '✗' : '✓'} live snapshot: carried Use sends ${JSON.stringify(control)}, after a slot shift ${JSON.stringify(stale)}; fight ends under the list -> ${left} list(s)`);
  return bad;
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
      const coopBar = (await cdp.send('Runtime.evaluate', { expression: BAR, returnByValue: true }, sessionId)).result?.value;
      if (shotDir) {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        writeFileSync(resolve(shotDir, `coop-hud-top-${label}.png`), Buffer.from(data, 'base64'));
      }
      // The reference: solo combat at the same viewport, the same door.
      await cdp.send('Page.navigate', { url: `http://localhost:${served.port}/index.html?shot=combat` }, sessionId);
      let soloBar = null;
      for (let t = 0; t < 90 && !(soloBar && soloBar.mounted && soloBar.row && soloBar.geometry); t++) {
        await wait(500);
        soloBar = (await cdp.send('Runtime.evaluate', { expression: BAR, returnByValue: true }, sessionId)).result?.value;
      }
      if (soloBar && soloBar.mounted) { await wait(1200); soloBar = (await cdp.send('Runtime.evaluate', { expression: BAR, returnByValue: true }, sessionId)).result?.value; }
      if (shotDir) {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        writeFileSync(resolve(shotDir, `solo-combat-${label}.png`), Buffer.from(data, 'base64'));
      }
      const bad = [...judge(g, label, vp), ...judgeBar(coopBar, soloBar, label)];
      failures.push(...bad);
      if (!bad.length) clean++;
      console.log(`  ${bad.length ? '✗' : '✓'} ${label}: hud-top ${g?.hudTop?.display ?? '?'}, ${g?.parts?.length ?? 0} parts, ${g?.bars?.length ?? 0} bars; `
        + `bottom bar ${(coopBar?.controls || []).map((c) => c.role).join('/') || 'none'} (${coopBar?.arrangement ?? '?'})${bad.length ? '' : ', matches solo, no overlap/clip/overflow'}`);
      if (process.env.COOP_HUD_DEBUG) console.log(JSON.stringify({ g, coopBar, soloBar }, null, 1));
      if (vp === VIEWPORTS[0]) {
        const seatBad = [...await seatSwitchProbe(cdp, sessionId, `http://localhost:${served.port}/index.html`),
          ...await repeatOpenProbe(cdp, sessionId, `http://localhost:${served.port}/index.html`),
          ...await liveSnapshotProbe(cdp, sessionId, `http://localhost:${served.port}/index.html`),
          ...await vowChoiceProbe(cdp, sessionId, `http://localhost:${served.port}/index.html`)];
        failures.push(...seatBad);
        if (seatBad.length && !bad.length) clean--;
      }
      await cdp.send('Target.closeTarget', { targetId });
    }
  } finally {
    cdp.close();
    await launched.close();
    served.server.close();
  }
  for (const f of failures) console.error(`  ${f}`);
  console.log(failures.length ? `  ${failures.length} failure(s)` : '  no overlap, clipping, lost part, two-row compact band, battlefield spill or horizontal overflow; the bottom bar is solo\'s');
  console.log(`coop-hud-top: ${failures.length ? 'RED' : 'GREEN'} (${clean}/${VIEWPORTS.length})`);
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`coop-hud-top HARNESS — ${e.stack || e.message}`); process.exit(2); });
}
