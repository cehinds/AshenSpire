// tools/attic/redraw-audit.mjs: what the combat screen writes and repaints while
// idle, during one card play, and idle again. MEASURES ONLY; prints JSON to stdout.
// Counts DOM mutation records, no-op writes (an attribute or text set to the value it
// already had), rebuilt nodes identical to the ones they replaced, <img> insertions,
// style/layout/paint events and each paint's clip. The clip is the frame's paint
// (`#document`), not a layer's dirty rect: use CDP LayerTree to see layering.
//
//   node tools/attic/redraw-audit.mjs                          375x667@2, 4x CPU
//   node tools/attic/redraw-audit.mjs --viewport 320x568@2 --throttle 6   iPhone SE 1st gen stand-in
//   node tools/attic/redraw-audit.mjs --summary                one readable table instead of JSON
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { serve } from '../serve.mjs';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const argv = process.argv.slice(2);
const arg = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const THROTTLE = Number(arg('--throttle', 4)) || 4;
const VP = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(arg('--viewport', '375x667@2'));
if (!VP) throw new Error('--viewport wants WxH@DPR, e.g. 320x568@2 (DPR defaults to 2)');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const INIT = `(() => {
  const A = window.__audit = { on: false, raf: 0, timeouts: 0, intervals: 0, recs: [] };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { if (A.on) A.raf++; return raf(cb); };
  const st = window.setTimeout.bind(window); window.setTimeout = (f, t, ...a) => { if (A.on) A.timeouts++; return st(f, t, ...a); };
  const si = window.setInterval.bind(window); window.setInterval = (f, t, ...a) => { if (A.on) A.intervals++; return si(f, t, ...a); };
  const name = (n) => {
    if (!n || n.nodeType !== 1) n = n && n.parentElement;
    const parts = [];
    for (let e = n, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentElement, i++) {
      const c = (e.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.');
      parts.unshift(e.tagName.toLowerCase() + (c ? '.' + c : ''));
    }
    return parts.join(' > ');
  };
  new MutationObserver((list) => {
    if (!A.on) return;
    // A record's oldValue is the value before its write; the value right after it is the
    // next record's oldValue for the same target and attribute, or the live value for the
    // last one. Comparing every record against the live value miscounts A->B->A toggles.
    const after = new Array(list.length);
    const next = new Map();
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.type === 'childList') continue;
      const key = m.target;
      const slot = next.get(key) || new Map(); next.set(key, slot);
      const k = m.type === 'attributes' ? 'a:' + m.attributeName : 'text';
      after[i] = slot.has(k) ? slot.get(k) : (m.type === 'attributes' ? m.target.getAttribute(m.attributeName) : m.target.data);
      slot.set(k, m.oldValue);
    }
    // Identical rebuilds are matched across the whole batch per parent, so a clear followed
    // by one append per child (several records) still pairs removed and added nodes.
    const pools = new Map();
    for (const m of list) if (m.type === 'childList') {
      const pool = pools.get(m.target) || new Map(); pools.set(m.target, pool);
      for (const x of m.removedNodes) { const h = x.outerHTML ?? x.textContent; pool.set(h, (pool.get(h) || 0) + 1); }
    }
    list.forEach((m, i) => {
      const r = { t: m.type, at: name(m.target) };
      if (m.type === 'attributes') { r.attr = m.attributeName; r.noop = m.oldValue === after[i]; }
      else if (m.type === 'characterData') r.noop = m.oldValue === after[i];
      else {
        const pool = pools.get(m.target);
        let same = 0;
        for (const x of m.addedNodes) { const h = x.outerHTML ?? x.textContent; const k = pool.get(h); if (k) { same++; pool.set(h, k - 1); } }
        r.added = m.addedNodes.length; r.removed = m.removedNodes.length;
        r.identical = same; r.imgs = [...m.addedNodes].reduce((s, x) => s + (x.nodeType === 1 ? (x.tagName === 'IMG' ? 1 : x.querySelectorAll('img').length) : 0), 0);
      }
      A.recs.push(r);
    });
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });
})();`;

function summarize(recs) {
  const by = new Map();
  let noopAttr = 0, identicalNodes = 0, imgsInserted = 0, nodesAdded = 0;
  for (const r of recs) {
    const k = r.t === 'attributes' ? `attr ${r.attr} @ ${r.at}` : r.t === 'childList' ? `children @ ${r.at}` : `text @ ${r.at}`;
    const e = by.get(k) || { n: 0, noop: 0, added: 0, identical: 0, imgs: 0 };
    e.n++; if (r.noop) { e.noop++; noopAttr++; }
    if (r.t === 'childList') { e.added += r.added; e.identical += r.identical; e.imgs += r.imgs; identicalNodes += r.identical; imgsInserted += r.imgs; nodesAdded += r.added; }
    by.set(k, e);
  }
  const top = [...by.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25);
  return { records: recs.length, noopWrites: noopAttr, nodesAdded, identicalRebuiltNodes: identicalNodes, imgsInserted, top };
}

async function phase(page, client, label, act) {
  await page.evaluate('window.__audit.recs = []; window.__audit.raf = 0; window.__audit.timeouts = 0; window.__audit.intervals = 0; window.__audit.on = true');
  const events = [];
  const onData = (d) => { for (const e of d.value) events.push(e); };
  client.on('Tracing.dataCollected', onData);
  await client.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  const t0 = Date.now();
  await act();
  const ms = Date.now() - t0;
  const done = new Promise((r) => client.once('Tracing.tracingComplete', r));
  await client.send('Tracing.end'); await done;
  client.off('Tracing.dataCollected', onData);
  const a = await page.evaluate(`(() => { const A = window.__audit; A.on = false;
    const anims = document.getAnimations().filter((x) => x.playState === 'running').map((x) => (x.animationName || x.transitionProperty || 'waapi') + ' @ ' + (x.effect?.target?.className?.baseVal ?? x.effect?.target?.className ?? '?'));
    return { recs: A.recs, raf: A.raf, timeouts: A.timeouts, intervals: A.intervals, anims }; })()`);
  const count = (n) => events.filter((e) => e.name === n && e.ph !== 'E').length;
  const dur = (n) => Math.round(events.filter((e) => e.name === n && e.dur).reduce((s, e) => s + e.dur, 0) / 1000);
  const styleEls = events.filter((e) => e.name === 'UpdateLayoutTree' && e.args?.elementCount).reduce((s, e) => s + e.args.elementCount, 0);
  const paints = events.filter((e) => e.name === 'Paint');
  const paintArea = Math.round(paints.reduce((s, e) => { const c = e.args?.data?.clip; if (!c) return s; const w = Math.abs(c[2] - c[0]), h = Math.abs(c[5] - c[1]); return s + w * h; }, 0));
  const clips = paints.map((e) => { const c = e.args?.data?.clip; return c ? Math.round(Math.abs(c[2] - c[0])) + 'x' + Math.round(Math.abs(c[5] - c[1])) + ' ' + (e.args?.data?.nodeName || '') : '?'; });
  const decNames = {}; for (const e of events) if (/Decode/i.test(e.name) && e.ph !== 'E') decNames[e.name] = (decNames[e.name] || 0) + 1;
  const decMs = Math.round(events.filter((e) => /Decode/i.test(e.name) && e.dur).reduce((s, e) => s + e.dur, 0) / 1000);
  return { clips, decNames, decMs, label, ms, raf: a.raf, timeouts: a.timeouts, intervals: a.intervals, runningAnimations: a.anims,
    trace: { styleRecalcs: count('UpdateLayoutTree'), styledElements: styleEls, styleMs: dur('UpdateLayoutTree'), layouts: count('Layout'), layoutMs: dur('Layout'), paints: paints.length, paintPx: paintArea, paintMs: dur('Paint'), decodes: count('Decode Image') + count('ImageDecodeTask'), script: dur('FunctionCall') + dur('EvaluateScript') + dur('TimerFire') + dur('FireAnimationFrame') },
    dom: summarize(a.recs) };
}

const server = await serve({ root: ROOT, port: 0, open: false, quiet: true });
const base = `http://localhost:${server.server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(VP[1]), height: Number(VP[2]) }, deviceScaleFactor: Number(VP[3] || 2), isMobile: true, hasTouch: true });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(base + '?shot=combat&shotSeed=PERF1');
await page.waitForFunction(`!!(window.__combat && document.querySelector('.combatant.enemy') && document.querySelector('.hand .card') && document.querySelector('.end-turn') && !document.querySelector('.end-turn').disabled)`, null, { timeout: 120000 });
await wait(3000);
const client = await ctx.newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
const out = [];
out.push(await phase(page, client, 'idle 5s (no input)', () => wait(5000)));
out.push(await phase(page, client, 'one card play (tap, target, 3s settle)', async () => {
  const id = await page.evaluate(`document.querySelector('.hand .card:not(.unaffordable)')?.dataset.instanceId`);
  const sel = `.hand .card[data-instance-id="${id}"]`;
  const box = await page.evaluate((sel) => { const c = document.querySelector(sel); const l = c.querySelector('.hand-hit-lane') || c; const r = l.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  await page.touchscreen.tap(box.x, box.y); await wait(400);
  const tgt = await page.evaluate(`(() => { const p = document.querySelector('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])'); if (p) return '.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])'; return document.querySelector('.combatant.enemy.targetable, .combatant.enemy[data-targetable="true"]') ? '.combatant.enemy.targetable, .combatant.enemy[data-targetable="true"]' : null; })()`);
  if (tgt) await page.tap(tgt, { force: true }).catch(() => {}); else await page.touchscreen.tap(box.x, box.y); await wait(3000);
}));
out.push(await phase(page, client, 'idle 5s after the play', () => wait(5000)));
const handAfter = await page.evaluate('window.__combat.piles.hand.length');
const result = { viewport: VP[0], throttle: THROTTLE, handAfter, errors: errs.slice(0, 5), phases: out };
if (!argv.includes('--summary')) console.log(JSON.stringify(result, null, 1));
else for (const p of out) {
  const clips = {}; for (const c of p.clips) clips[c] = (clips[c] || 0) + 1;
  console.log(`\n== ${p.label}: ${p.dom.records} writes, ${p.dom.noopWrites} no-op, ${p.dom.nodesAdded} nodes added (${p.dom.identicalRebuiltNodes} identical), ${p.dom.imgsInserted} imgs; style ${p.trace.styleRecalcs}/${p.trace.styleMs} ms, layout ${p.trace.layouts}/${p.trace.layoutMs} ms, paints ${p.trace.paints}, rAF ${p.raf}, timers ${p.timeouts}, animations ${p.runningAnimations.length}`);
  for (const [k, n] of Object.entries(clips)) console.log(`   paint ${n}x ${k.slice(0, 90)}`);
  for (const [k, v] of p.dom.top.slice(0, 12)) console.log(`   ${v.n} (${v.noop} no-op, +${v.added} nodes, ${v.imgs} imgs) ${k.slice(0, 120)}`);
}
await browser.close(); server.server.close();
