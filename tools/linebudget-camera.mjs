#!/usr/bin/env node
// tools/linebudget-camera.mjs — Bjorn, 2026-08-15.
//
// THE GATE ON `swap-row-reads.mjs`'s LINE BUDGET, AND IT IS ONE QUESTION.
// Sunna's assertion is `li-lines == head-lines + note-lines`, with the expected
// count DERIVED from the note measured on the same run — nothing typed. Marina
// gated it on a named subject: `lines()` was found wrong twice in one day, so
// IF IT IS WRONG THE SAME WAY ON BOTH SIDES, THE EQUATION IS GREEN WHILE THE
// ROW READS BADLY. That is a question about what a person sees, so the answer
// is a camera, not another Range.
//
// WHAT THIS DOES THAT HER HARNESS CANNOT DO FOR ITSELF. Every number in the
// LINE BUDGET comes out of one primitive, `bands()`, reading `getClientRects()`.
// This file photographs each row's own painted box and counts BANDS OF INK off
// the image. Two instruments, one question, and they share no code path below
// the DOM — a defect in `bands()` cannot reach the second reading.
//
// THAT SENTENCE IS NOW OBSERVED RATHER THAN READ (Vira, `camera-independence.mjs`,
// MR-102). She broke `bands()` at its own site inside the `MEASURE` probe below
// and ran this file unmodified in every other byte: three variants moved the
// left-hand column at 12, 12 and 8 of 12 cells and moved the CAMERA column at
// 0 of 12 every time, with a positive control (`crop-half`) that moved the
// camera at 8 of 12 — so the run was reading something.
//
// AND THE BOUNDARY SHE PUT ON IT, WHICH IS HERS AND IS RIGHT: NO SHARED CODE,
// ONE SHARED INPUT. The crop rectangle is `li.getBoundingClientRect()`. This
// camera photographs THE BOX LAYOUT REPORTED, never the screen — so it is
// independent of `bands()` and it is NOT independent of layout, and only the
// first is what the agreement buys. THE FAILURE DIRECTION IS THE KIND ONE: a
// wrong box crops the wrong pixels and the two readings DISAGREE. False red,
// never false green. Said here because the sentence above generalises slightly
// ahead of the mechanism, and the gap is a boundary rather than a hole.
//
// THE STRUCTURAL ANSWER, WHICH THE CELLS BELOW ONLY CONFIRM.
// `li == head + note` is not a claim that the line count is right. It is exactly
// the claim THE HEAD'S BANDS AND THE NOTE'S BANDS DO NOT MERGE — a partition
// check. Any error in `bands()` confined to ONE SIDE moves that side and `li` by
// the same amount and the equation absorbs it silently. The only error it can
// see is an error AT THE SEAM. That is a good design for the run-on, which is a
// seam defect and is what it was written for. It is not coverage of the count.
//
// THE CELL, OBSERVED, THROUGH THE SAME DOOR (styles/ui.css, the declaration site
// the shipped fix itself lives at):
//
//   .equip-resource-change small { line-height: 0.4 }
//     bands()  li 2 = head 1 + note 1  → the equation is GREEN, exit silent
//     camera   1 band of ink — the note's two lines are PRINTED ON TOP OF EACH
//              OTHER and cannot be read at all
//
// AND IT GETS GREENER AS IT GETS WORSE, which is the part worth keeping: at
// line-height 0.75 and 0.62 the same crush goes RED, and at 0.4 it goes GREEN.
// A check whose verdict improves as the defect deepens is reporting on the seam,
// never on the row.
//
// THE SECOND BOUNDARY, and it is the one a player meets: THIS FAMILY OF
// INSTRUMENTS MEASURES GEOMETRY, AND A PERSON READS INK. `opacity: 0`,
// `visibility: hidden`, `color: <the panel's own background>`, `height: 0;
// overflow: hidden`, `position: absolute; left: -9999px` and `display: none`
// each leave the LINE BUDGET green AND the UNMOVED AND UNEXPLAINED check silent
// — that check is gated on `!hasNote`, and every one of those leaves the
// `<small>` in the DOM. Her known-bad for it deletes the element in
// `equipmentReceipts.js`; the CSS door reaches the same screen and is not
// covered. Same-door clause, turned around: the plant enters by a door the real
// regression need not use.
//
//   node tools/linebudget-camera.mjs            control only — the tree as it stands
//   node tools/linebudget-camera.mjs --plants   + the planted cells, each scored
//   node tools/linebudget-camera.mjs --out DIR  where the crops land
//
// EXIT 1 when the camera and `bands()` disagree on the UNPLANTED tree, or when a
// plant the camera calls bad leaves the assertion green. A plant that cannot be
// photographed is ERR and fails — unknown is never green.
//
// AND THAT SENTENCE WAS A LIE FOR ONE DAY (Vira, MR-102's gate; fixed here).
// The control test read `if (eq && k.ink !== k.liLines)` — the disagreement was
// only ever reported when the EQUATION WAS GREEN, while this header and the PASS
// line both claimed the unconditional thing. Reachable with no broken instrument
// at all: `headLines !== 1` turns `eq` false, which is any tree where the price
// statement WRAPS, and Viki's grid attempt did exactly that at head 2. `eq` now
// chooses only WHICH SENTENCE is printed; the comparison is unconditional.
//   THE KNOWN-BAD, OBSERVED, THROUGH styles/ui.css AND NOT THROUGH THE TOOL:
//   Viki's grid line (head wraps to 2 → `eq` false) plus the note painted in the
//   panel's own background. bands() li 4 = head 2 + note 2, camera 2 bands of
//   ink — 8 of 12 cells disagreeing. BEFORE: `PASS — the two readings agree at
//   every cell`, exit 0. AFTER: 8 findings, exit 1. Transcript and the one
//   command that reproduces it:
//   tools/results/linebudget-camera/false-green-red-before-green-dabd7d9.txt
//
// BOUNDARY, printed on every run: source tree over http, one Linux box, one
// Chromium, the Armoury → Talisman → set 1 comparison rows at two shapes, three
// shipped rules. Silent about dist/, about every other surface, and about
// whether the sentence MEANS anything — that is Sunna's ruling, not this exit
// code. The ink floor is stated in the output and is this file's one literal.
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day
// swap-row-reads.mjs counts ink itself. It exists to gate one assertion; it is
// not a second home for that assertion.
//   AND THAT DAY IS CHEAPER THAN IT SOUNDS. Sunna's harness ALREADY CALLS
//   `Page.captureScreenshot` four times — it photographs every surface it walks
//   and never looks at the picture. CAPTURE IS NOT READING. What she lacks is
//   `decodePng` + `inkBands` below, ~75 lines, already written and already
//   observed. Sizing the card off "she has no camera" would be sizing it off
//   the wrong fact. (Vira found this the hard way: her own first predicate for
//   the removal watch keyed on `captureScreenshot` and was therefore already
//   true — her selftest caught it, reading the file had not.)

import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'tools/results/linebudget-camera');
const PLANTS_ON = args.includes('--plants');
const CSS = join(ROOT, 'styles', 'ui.css');
const CSV = join(ROOT, 'content', 'source', 'weapons.csv');

// The content door, IDENTICAL BYTES to swap-row-reads.mjs — this gate must reach
// the same screen it is gating, and a second spelling of the probe row is the
// second copy this house exists to catch.
const TALISMAN = 'wardingCharm,Warding Charm,talisman,,uncommon,dagger,1.00,C0B8A6,C9A227,charm|basic,,,,'
  + 'self.swapCost=+2,,"A planted probe talisman — corpus only, never shipped.",7,,0';
const MAUL = 'probeMaul,Probe Maul,weapon,right,common,hammer,1.00,8E8678,C9A227,blade|heavy|basic,'
  + 'bladeAttack,weaponGuard,weaponTechnique,strike.damage=+1,,'
  + '"A planted probe weapon — corpus only, never shipped.",7,,7';

// THE ANCHOR is the shipped fix itself (77e240f, ui.css). Every plant replaces
// that one declaration and nothing else in the tree moves — the same file, the
// same selector, the same door Viki's real change travelled through.
const ANCHOR = '.equip-resource-change small { display: block; }';

const PLANTS = [
  // THE NAMED SUBJECT: `bands()` wrong the SAME WAY on both sides at once.
  { tag: 'note-crush-0.4', css: ANCHOR + '\n.equip-resource-change small { line-height: 0.4; }',
    why: "the note's own two lines merge into one band — noteLines and liLines fall by the same 1 and the equation absorbs it" },
  { tag: 'note-crush-0.62', css: ANCHOR + '\n.equip-resource-change small { line-height: 0.62; }',
    why: 'the same crush, less of it — kept so the pair shows the verdict improving as the defect deepens' },
  // GEOMETRY PRESENT, INK ABSENT — the boundary of every rect-based reading here.
  { tag: 'note-invisible-colour', css: ANCHOR + '\n.equip-resource-change small { color: #0b0906; }',
    why: 'the note is painted in the panel\'s own background — three correct line boxes, nothing to read' },
  { tag: 'note-visibility-hidden', css: ANCHOR + '\n.equip-resource-change small { visibility: hidden; }',
    why: 'the note reserves its two lines and paints none of them' },
  { tag: 'note-hidden-on-phones', css: ANCHOR + '\n@media (max-width: 480px) { .equip-resource-change small { display: none; } }',
    why: 'an ordinary mobile edit — and this harness photographs only screens the media query catches' },
  // The two that MUST go red, so the camera is not the only thing that ever fires.
  { tag: 'the-run-on-again', css: '.equip-resource-change small { display: inline; }',
    why: "the 18d2976 defect back through the CSS door — the seam breaks, and the seam is what the equation watches" },
  { tag: 'viki-grid-verbatim', css: '.equip-resource-change { display: grid; gap: 0.2rem; overflow-wrap: anywhere; }',
    why: "the sibling's declaration copied literally — the price torn off its own arrow" },
];

const SHAPES = [
  { tag: '390x844', width: 390, height: 844, dsf: 2 },
  { tag: '360x640', width: 360, height: 640, dsf: 2 },
];
const RULES = ['flat', 'category', 'gear'];

// A LINE OF TEXT IS NOT FOUR PIXELS TALL. At deviceScaleFactor 2 a rendered line
// band on this surface measures 30-50 image rows; anything under this is a
// neighbour's descender bleeding over a box edge or an antialias fringe, and
// counting it is the instrument talking. THIS IS THIS FILE'S ONE LITERAL and it
// is stated in the output rather than buried, with both cells observed: the
// bands it keeps are 30-50 rows, the slivers it drops were 4-6.
const INK_BAND_FLOOR_PX = 8;
// How far from the modal background a pixel must sit to count as ink, and how
// many such pixels make a row inked. Both measured against the control, where
// the camera and `bands()` agree at every cell.
const INK_DELTA = 28;
const INK_MIN_PIXELS = 2;

// ---------------------------------------------------------------------------
// THE CAMERA'S OWN READING. A PNG decoder rather than a dependency: CDP hands
// back 8-bit non-interlaced PNG and this only ever needs luminance.
// ---------------------------------------------------------------------------
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, interlace ${interlace})`);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
  if (!ch) throw new Error(`unsupported PNG colour type ${colour}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, px: out };
}

// Bands of ink, counted off the image. The background is the crop's own modal
// luminance — measured, never typed, because this panel's colour is a token.
function inkBands(buf) {
  const { w, h, ch, px } = decodePng(buf);
  const lum = new Uint8Array(w * h);
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * ch;
    lum[i] = ch >= 3 ? Math.round(0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]) : px[o];
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < lum.length; i++) hist[lum[i]]++;
  let bg = 0;
  for (let v = 1; v < 256; v++) if (hist[v] > hist[bg]) bg = v;
  const runs = [];
  let start = -1;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (Math.abs(lum[y * w + x] - bg) > INK_DELTA) n++;
    const inked = n >= INK_MIN_PIXELS;
    if (inked && start < 0) start = y;
    if (!inked && start >= 0) { runs.push([start, y - 1]); start = -1; }
  }
  if (start >= 0) runs.push([start, h - 1]);
  const kept = runs.filter((r) => r[1] - r[0] + 1 >= INK_BAND_FLOOR_PX);
  // A GLYPH THAT BRIDGES TWO LINES BRIDGES TWO BANDS, and this reading cannot
  // tell that from one tall band. Reported, so a caller never treats a merged
  // reading as a count. (Watched: a 5rem digit joined lines 1 and 2 on a
  // synthetic plant and this camera read 2 where a person reads 3.)
  const tallest = kept.reduce((m, r) => Math.max(m, r[1] - r[0] + 1), 0);
  return { bands: kept.length, runs: kept, bg, height: h, bridged: tallest > 70 };
}

// ---------------------------------------------------------------------------
// THE MEASUREMENT UNDER GATE — `bands()`, `lines()` and `headLines()` copied
// VERBATIM from swap-row-reads.mjs @ efc9c45. Deliberately a copy and it is
// deliberately said out loud: a gate that paraphrases the thing it is gating is
// gating its own paraphrase. Its removal condition is this file's.
// ---------------------------------------------------------------------------
const MEASURE = `(() => {
  const bands = (rects) => {
    const kept = [...rects].filter((r) => r.width > 0.5 && r.height > 0.5);
    const rs = kept
      .filter((a) => !kept.some((b) => b !== a && b.top >= a.top - 0.5 && b.bottom <= a.bottom + 0.5 && (b.bottom - b.top) < (a.bottom - a.top) - 0.5))
      .sort((a, b) => a.top - b.top);
    const out = [];
    for (const rect of rs) {
      const mid = (rect.top + rect.bottom) / 2;
      const b = out.find((x) => mid > x.top && mid < x.bottom);
      if (b) { b.top = Math.min(b.top, rect.top); b.bottom = Math.max(b.bottom, rect.bottom); }
      else out.push({ top: rect.top, bottom: rect.bottom });
    }
    return out.length;
  };
  const lines = (el) => { if (!el) return 0; const r = document.createRange(); r.selectNodeContents(el); return bands(r.getClientRects()); };
  const headLines = (li, note) => { const r = document.createRange(); r.selectNodeContents(li); if (note) r.setEndBefore(note); return bands(r.getClientRects()); };
  const rows = [];
  for (const li of document.querySelectorAll('.equip-resource-change:not(.none)')) {
    const note = li.querySelector('small');
    const rect = li.getBoundingClientRect();
    const headText = (note ? li.textContent.replace(note.textContent, '') : li.textContent).replace(/\\s+/g, ' ').trim();
    rows.push({
      headText, hasNote: !!note,
      noteText: note ? (note.textContent || '').replace(/\\s+/g, ' ').trim() : null,
      liLines: lines(li), headLines: headLines(li, note), noteLines: note ? lines(note) : 0,
      x: rect.left, y: rect.top, w: rect.width, h: rect.height,
      // A CROP OF A BOX HALF UNDER A SCROLL CLIP PHOTOGRAPHS WHAT IS BEHIND IT.
      // That is not a reading of one line, it is no reading at all — so it is
      // reported and it fails, never counted. (Watched: the second row sat
      // under the modal's clip and the camera read the page footer as text.)
      clipped: (() => {
        for (let n = li.parentElement; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (!/auto|scroll|hidden/.test(cs.overflowY) && !/auto|scroll|hidden/.test(cs.overflowX)) continue;
          const q = n.getBoundingClientRect();
          if (rect.top < q.top - 0.5 || rect.bottom > q.bottom + 0.5 || rect.left < q.left - 0.5 || rect.right > q.right + 0.5) return true;
        }
        return !(rect.top >= -0.5 && rect.bottom <= innerHeight + 0.5);
      })(),
    });
  }
  return rows;
})()`;

const OPEN_ARMOURY = `(() => { const b = document.querySelector('#open-armoury'); if (!b) return 'no #open-armoury on the map'; b.click(); return true; })()`;
const PICK = `(() => {
  const blocks = [...document.querySelectorAll('.equip-slot')];
  const box = blocks.find((b) => (b.querySelector('.es-label') || {}).textContent === 'Talisman');
  if (!box) return 'no Talisman slot block on the Armoury';
  const cell = [...box.querySelectorAll('.es-sets > *')][0];
  if (!cell) return 'Talisman renders no set cell';
  cell.click(); return true;
})()`;
const OPEN_ALL = `(() => { const d = [...document.querySelectorAll('.equip-candidate-comparison')]; if (!d.length) return 'no candidate comparisons'; d.forEach((x) => { x.open = true; }); return d.length; })()`;
const SCROLL_TO = (i) => `(() => {
  const li = [...document.querySelectorAll('.equip-resource-change:not(.none)')][${i}];
  if (!li) return 'no row ${i}';
  li.scrollIntoView({ block: 'center' });
  return true;
})()`;
const shotUrl = (rule) => `?shot=map&shotSettings=${encodeURIComponent(JSON.stringify({ swapCostRule: rule }))}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MR-80: every number carries the ref it was measured at, and says so when the
// tree is not that ref. This file is normally run in a worktree at somebody
// else's tip, which is exactly how a branch number becomes a fact about a tree.
function refLine() {
  const g = (a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const sha = g(['rev-parse', '--short', 'HEAD']);
  const br = g(['rev-parse', '--abbrev-ref', 'HEAD']);
  const dirty = g(['status', '--porcelain'])
    .split('\n').map((s) => s.slice(3)).filter(Boolean)
    .filter((f) => !f.startsWith('tools/results/'));
  return dirty.length
    ? `REF    ${sha} (${br})  DIRTY — ${dirty.length} path(s) not in that commit: ${dirty.slice(0, 4).join(', ')}. Every number below is about the WORKING TREE.`
    : `REF    ${sha} (${br})  clean — the numbers below are about this commit.`;
}

async function cdp(p) {
  let l;
  for (let i = 0; i < 100; i++) {
    try { l = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json(); if (l.length) break; } catch {}
    await sleep(100);
  }
  const ws = new WebSocket(l.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const w = new Map();
  ws.onmessage = (m) => {
    const g = JSON.parse(m.data);
    if (g.id != null && w.has(g.id)) { const { ok, no } = w.get(g.id); w.delete(g.id); g.error ? no(new Error(g.error.message)) : ok(g.result); }
  };
  return { send: (m2, p2 = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method: m2, params: p2 })); return new Promise((ok, no) => w.set(n, { ok, no })); } };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cssBefore = readFileSync(CSS, 'utf8');
  const csvBefore = readFileSync(CSV, 'utf8');
  if (!cssBefore.includes(ANCHOR)) {
    console.error(`linebudget-camera: the anchor declaration is not in ${CSS}.\n`
      + `  This gate is pointed at a tree WITHOUT viki/the-rung-has-no-surface's fix, so every plant\n`
      + `  would have nothing to replace and would score against a different screen. Unknown, not green.`);
    process.exit(2);
  }
  const authored = !csvBefore.includes('wardingCharm');
  const restore = () => {
    try {
      writeFileSync(CSS, cssBefore);
      if (authored) { writeFileSync(CSV, csvBefore); spawnSync('node', [join(ROOT, 'tools', 'content-build.mjs')], { cwd: ROOT }); }
    } catch {}
  };
  process.on('exit', restore);

  console.log(`\n${refLine()}\n`);
  if (authored) {
    writeFileSync(CSV, csvBefore.replace(/\n*$/, '\n') + TALISMAN + '\n' + MAUL + '\n');
    const b = spawnSync('node', [join(ROOT, 'tools', 'content-build.mjs')], { cwd: ROOT, encoding: 'utf8' });
    if (b.status !== 0) { console.error(`linebudget-camera: content-build refused the authored row:\n${b.stdout}${b.stderr}`); restore(); process.exit(2); }
    console.log('DOOR   content/source/weapons.csv +2 rows → node tools/content-build.mjs → OK. Plants land in styles/ui.css BY BYTES, at the shipped fix\'s own declaration.');
  } else {
    console.log('DOOR   the probe talisman is already authored — using the tree as it stands. Plants land in styles/ui.css by bytes.');
  }

  const { server, port } = await serve({ root: ROOT, port: 8151, open: false });
  const browser = spawn(process.env.CHROME || '/usr/bin/chromium',
    ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0', 'about:blank'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let reaped = false;
  const reap = () => { if (reaped) return; reaped = true; try { browser.kill('SIGKILL'); } catch {} try { server.close(); } catch {} };
  process.on('exit', reap);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { reap(); restore(); process.exit(130); });

  const ws = await new Promise((ok, no) => {
    let buf = '';
    const read = (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) ok(m[1]); };
    browser.stderr.on('data', read); browser.stdout.on('data', read);
    browser.on('exit', (c) => no(new Error(`chromium exited (${c}) before naming an endpoint`)));
    setTimeout(() => no(new Error('chromium never printed a DevTools endpoint')), 20000);
  }).catch((e) => { reap(); restore(); console.error(`linebudget-camera: ${e.message}`); process.exit(2); });

  const c = await cdp(Number(new URL(ws.replace(/^ws:/, 'http:')).port));
  await c.send('Page.enable'); await c.send('Runtime.enable');
  const BASE = `http://127.0.0.1:${port}/`;
  console.log(`RUN    browser pid ${browser.pid} · HTTP port ${port} — this run's own.\n`);

  const ev = async (e) => {
    const r = await c.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || 'eval error' };
    return r.result.value;
  };
  const waitFor = async (sel, deadline = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < deadline) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`) === true) { await sleep(220); return true; } await sleep(60); }
    return false;
  };

  // One cell = one row, at one shape, under one rule, in one CSS state.
  async function readCells(tag) {
    const cells = [];
    for (const shape of SHAPES) {
      await c.send('Emulation.setDeviceMetricsOverride', { width: shape.width, height: shape.height, deviceScaleFactor: shape.dsf, mobile: true });
      for (const rule of RULES) {
        const base = { tag, shape: shape.tag, rule };
        await c.send('Page.navigate', { url: `${BASE}${shotUrl(rule)}&cb=${Date.now()}` });
        if (!await waitFor('#open-armoury')) { cells.push({ ...base, err: 'the map never rendered its Armoury button' }); continue; }
        if (await ev(OPEN_ARMOURY) !== true) { cells.push({ ...base, err: 'the Armoury never opened' }); continue; }
        if (!await waitFor('.equip-slot')) { cells.push({ ...base, err: 'no slot block' }); continue; }
        const p = await ev(PICK); if (p !== true) { cells.push({ ...base, err: `Talisman: ${JSON.stringify(p)}` }); continue; }
        if (!await waitFor('.equip-candidate-row')) { cells.push({ ...base, err: 'the picker rendered no candidate rows' }); continue; }
        if (typeof await ev(OPEN_ALL) !== 'number') { cells.push({ ...base, err: 'no comparison opened' }); continue; }
        await sleep(260);
        const first = await ev(MEASURE);
        if (!Array.isArray(first)) { cells.push({ ...base, err: `probe threw — ${first && first.__err}` }); continue; }
        if (!first.length) { cells.push({ ...base, err: 'no resource-change rows on the surface at all — an empty set is never a pass' }); continue; }
        for (let i = 0; i < first.length; i++) {
          await ev(SCROLL_TO(i)); await sleep(180);
          const rows = await ev(MEASURE);
          const r = Array.isArray(rows) ? rows[i] : null;
          if (!r) { cells.push({ ...base, row: i, err: 'the row vanished between measure and photograph' }); continue; }
          if (r.clipped) { cells.push({ ...base, row: i, ...r, err: 'STILL CLIPPED after scrollIntoView — no photograph is possible, so no count is reported' }); continue; }
          const png = await c.send('Page.captureScreenshot', {
            format: 'png',
            clip: { x: r.x, y: r.y, width: Math.max(1, r.w), height: Math.max(1, r.h), scale: 2 },
          });
          const buf = Buffer.from(png.data, 'base64');
          const file = join(OUT, `${tag}-${shape.tag}-${rule}-row${i}.png`);
          writeFileSync(file, buf);
          let ink;
          try { ink = inkBands(buf); } catch (e) { cells.push({ ...base, row: i, ...r, err: `the camera could not read its own crop — ${e.message}` }); continue; }
          // THE NOTE IS IN THE DOM AND PAINTS NOTHING. `UNMOVED AND UNEXPLAINED`
          // is gated on `!hasNote`, so a `<small>` that still exists but renders
          // no box leaves it silent AND leaves the budget green at 1 = 1 + 0 —
          // both readings agree on the count and the player is shown a price
          // that did not move with no reason beside it. Flagged here because the
          // camera agreeing is exactly why nothing else would.
          const mute = r.hasNote && !!r.noteText && r.noteLines === 0;
          cells.push({ ...base, row: i, ...r, ink: ink.bands, bridged: ink.bridged, mute, file });
        }
      }
    }
    return cells;
  }

  const findings = [];
  const say = (s) => console.log(s);

  // ---- THE CONTROL: the tree as it stands, and the two readings must agree ----
  const control = await readCells('control');
  say('CONTROL — the tree as it stands. `bands()` on the left, INK counted off the photograph on the right.');
  say(`  shape    rule      row  li  head  note  equation  CAMERA  what the row says`);
  for (const k of control) {
    if (k.err) { findings.push(`control ${k.shape}/${k.rule} row ${k.row ?? '-'}: ${k.err}`); say(`  ${k.shape.padEnd(8)} ${k.rule.padEnd(9)} ${String(k.row ?? '-').padEnd(3)} ERR  ${k.err}`); continue; }
    const eq = k.liLines === k.headLines + k.noteLines && k.headLines === 1;
    say(`  ${k.shape.padEnd(8)} ${k.rule.padEnd(9)} ${String(k.row).padEnd(4)}${String(k.liLines).padEnd(4)}${String(k.headLines).padEnd(6)}${String(k.noteLines).padEnd(6)}${(eq ? 'green' : 'RED').padEnd(10)}${String(k.ink).padEnd(8)}"${k.headText.slice(0, 34)}"`);
    if (k.ink !== k.liLines) {
      findings.push(`control ${k.shape}/${k.rule} row ${k.row}: THE TWO READINGS DISAGREE, AND THE ASSERTION IS ${eq ? 'GREEN' : 'RED'} — bands() reads ${k.liLines} line(s), ${k.ink} band(s) of ink are painted. ${k.bridged ? '(a tall glyph may be bridging two bands in the photograph — read the crop)' : ''}`);
    }
    // ON THE REAL TREE TOO, not only inside the plant scoring. A check that can
    // fire only against a plant cannot fail on a tree — the defect Sunna found
    // in her own harness this morning, and I am not going to reproduce it in the
    // file that gates it.
    if (k.mute) {
      findings.push(`control ${k.shape}/${k.rule} row ${k.row}: THE NOTE IS IN THE DOM AND PAINTS NOTHING — "${k.noteText.slice(0, 40)}…" renders 0 line(s). The budget is green at ${k.liLines} = ${k.headLines} + 0 and UNMOVED AND UNEXPLAINED is silent because hasNote is still true.`);
    }
  }
  say(`  ink floor ${INK_BAND_FLOOR_PX}px at 2x (this file's one literal — kept bands measured 30-50 rows, dropped slivers 4-6),`
    + ` ink threshold ${INK_DELTA}/255 from the crop's own modal background, ${INK_MIN_PIXELS}+ pixels to ink a row.`);
  // HOW MUCH THE CONTROL'S AGREEMENT IS WORTH, COUNTED RATHER THAN CLAIMED
  // (Vira, MR-102). N cells is not N trials: the shapes and rules that produce
  // the same four numbers are replicates of one reading. Derived from this run.
  const read = control.filter((k) => !k.err);
  const distinct = new Set(read.map((k) => `${k.liLines}/${k.headLines}/${k.noteLines}/${k.ink}`));
  say(`  ${read.length} control cell(s) carrying ${distinct.size} DISTINCT reading(s) — the rest are replicates, not independent trials.`);
  say(`  So the control shows the two instruments do not disagree WHERE THE ROW IS FINE; the weight is in the plants, which make them differ.`);

  // ---- THE PLANTS: each is one declaration, at the shipped fix's own site -----
  if (PLANTS_ON) {
    say('\nPLANTED CELLS — one CSS declaration each, at the fix\'s own declaration, reverted after every one.');
    for (const plant of PLANTS) {
      writeFileSync(CSS, cssBefore.replace(ANCHOR, plant.css));
      const cells = (await readCells(plant.tag)).filter((k) => k.rule !== 'gear');
      const bad = cells.filter((k) => !k.err && k.ink !== k.liLines);
      const green = cells.filter((k) => !k.err && k.liLines === k.headLines + k.noteLines && k.headLines === 1);
      const errs = cells.filter((k) => k.err);
      const hidden = green.filter((k) => bad.includes(k));
      const muted = green.filter((k) => k.mute);
      const verdict = errs.length ? 'ERR'
        : hidden.length ? 'CELL FOUND — GREEN AND WRONG'
        : muted.length ? 'CELL FOUND — GREEN, BOTH READINGS AGREE, AND THE NOTE IS GONE'
        : green.length === cells.length ? 'green, camera agrees' : 'RED (the assertion fires)';
      say(`\n  ${plant.tag}  →  ${verdict}`);
      say(`    ${plant.why}`);
      for (const k of cells) {
        if (k.err) { say(`    ${k.shape}/${k.rule} row ${k.row ?? '-'}: ERR ${k.err}`); continue; }
        const eq = k.liLines === k.headLines + k.noteLines && k.headLines === 1;
        say(`    ${k.shape}/${k.rule} row ${k.row}: bands() li ${k.liLines} = head ${k.headLines} + note ${k.noteLines} → ${eq ? 'green' : 'RED'} · camera ${k.ink} band(s) of ink`);
      }
      for (const k of hidden) {
        findings.push(`${plant.tag} ${k.shape}/${k.rule} row ${k.row}: THE EQUATION IS GREEN AND THE ROW READS DIFFERENTLY — bands() says ${k.liLines} line(s), the photograph carries ${k.ink} band(s) of ink. ${plant.why}. Crop: ${k.file}`);
      }
      for (const k of muted) {
        if (hidden.includes(k)) continue;
        findings.push(`${plant.tag} ${k.shape}/${k.rule} row ${k.row}: THE NOTE IS IN THE DOM AND PAINTS NOTHING — "${k.noteText.slice(0, 40)}…" renders 0 line(s), so the budget is green at ${k.liLines} = ${k.headLines} + 0 and UNMOVED AND UNEXPLAINED stays silent because hasNote is still true. Its known-bad deletes the element in equipmentReceipts.js; this door does not. Crop: ${k.file}`);
      }
      for (const k of errs) findings.push(`${plant.tag} ${k.shape}/${k.rule}: ${k.err}`);
    }
    writeFileSync(CSS, cssBefore);
  } else {
    say('\nPLANTS NOT RUN — pass --plants. Without them this run has watched nothing fail, which is `unknown`, not green.');
  }

  say('\nBOUNDARY  source tree over http, one Linux box, one Chromium, Armoury → Talisman → set 1, two shapes, three shipped rules.');
  say('          This camera reads INK, and it cannot tell a tall glyph bridging two lines from one tall band — that case is flagged, never counted.');
  say('          Silent about dist/, every other surface, and about whether the sentence MEANS anything — that is Sunna\'s ruling, not this exit code.');
  say('          It gates ONE assertion in swap-row-reads.mjs. It is silent on every other check in that file.');
  say('          A PASS here means the two readings AGREE, never that the equation is green: a control row can read RED');
  say('          in the table above with both instruments agreeing, and that verdict belongs to swap-row-reads.mjs.');

  restore(); reap();
  if (findings.length) {
    console.log(`\nFAIL ${findings.length} finding(s):`);
    for (const f of findings) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log('\nPASS — on the unplanted tree the two readings agree at every cell, and every planted cell was scored.');
  process.exit(0);
}

main();
