#!/usr/bin/env node
// tools/swap-row-reads.mjs — Sunna, 2026-08-15.
//
// DOES THE SWAP-PRICE COMPARISON READ ON A PHONE. Viki's MR-41 arm 1 made the
// Armoury's swap-cost row CONSULT `swapCostFor()` instead of deriving a second
// number, and then named the question she had not answered and would not:
//
//     "No pixel rendered. Two rows per candidate on a 390 px column is a
//      Law 5 question for the Player-experience seat."
//
// This is that pixel, and this is the seat. Bjorn keeps rendered proof — that a
// screen APPEARED. This asks the different question: whether a person can USE
// what appeared. The two are not the same gate and this file is not his.
//
// THE DOOR IS THE CONTENT DOOR, and it is stated because a check that reaches
// its subject by any other route is measuring a screen no author can produce.
// One row appended to `content/source/weapons.csv` — `self.swapCost=+2` —
// `node tools/content-build.mjs`, ZERO code. That is Viki's own plant (identical
// bytes but for one tag) and it is Law 0's falsifier run as an act rather than
// quoted. THE ONE DIFFERENCE, named rather than buried: her row's tags are
// `charm`, mine are `charm|basic`. `basic` is the found-gate answer
// (`balance.equipment.basicTag`) — without it a talisman with `dropWeight 0` is
// authored, compiled, and UNREACHABLE BY ANY PLAYER, so there is no picker to
// photograph. It changes no price: the category rung reads `heavy`/`flourish`
// and the charm carries neither, before or after.
//
// WHAT IT ASSERTS, and every one of these is somebody else's number, not mine:
//
//   L5  Law 5 clause 1 — horizontal travel is ZERO on every scroll container of
//       this surface, measured PER CONTAINER (the document's own reading is
//       zero by construction under a fullscreen `overflow: hidden` app and is
//       printed labelled, never counted). Boundary: 0 px. Not mine — his.
//   L4  Law 4 clause 4 — the only control on the surface (`<summary>`) clears
//       the tap floor. Both sides MEASURED, tapsize.mjs's method: a probe div
//       sized by `var(--tap-floor)` and the summary itself, in device px after
//       `body { zoom }`. Boundary: the floor. Not mine.
//   L2  Law 2 — every comparison row proven inside its own container's rendered
//       rect, AND every chip's text proven inside its own box. Not mine.
//   ONE WORD — a price and a sentence must not be printed with nothing between
//       them. Boundary: ANY positive separation, the weakest claim that can
//       still fail. Not a threshold, deliberately: "how much gap is enough"
//       would be a number of mine with no cell either side.
//   LINE BUDGET — ADDED 2026-08-15, and it is here because this file PRINTED the
//       number that would have caught a real regression and did not read it.
//       `li-lines == head-lines + note-lines`, and `head-lines == 1`. The
//       expected li-count is DERIVED from the note measured on the same run, so
//       the 3 under a declining rule and the 1 under `gear` are typed nowhere in
//       this file — Law 0 clause 1 read as a rule about instruments. Full story
//       at the check itself.
//   UNMOVED AND UNEXPLAINED — a price that did not move, on a picker promising a
//       delta, carries a note. BY PRESENCE, NEVER BY PHRASE. This was watched
//       only from inside `--selftest` until now, which is a check that cannot
//       fail on a real tree.
//   UNKNOWN IS NEVER GREEN — an ERR neighbourhood cell, an unswept width, or an
//       unmeasurable text column FAILS rather than printing a dash inside a
//       table of facts.
//
// SOME OF THESE ARE RED ON WHATEVER TREE YOU POINT THIS AT, which is why
// `--selftest` scores every plant against an UNPLANTED CONTROL and PRINTS the
// control's finding count rather than naming one here. On a tree that already
// exits 1, "the planted copy exited 1" is not evidence of anything — and a
// number typed into this header is a second copy of a count the run derives.
//
// WHAT IT REPORTS AND REFUSES TO ASSERT, and why — because I was told to, and
// because Vira sharpened my own rule this morning into the thing that binds me:
// A POPULATION WITH NO CELL EITHER SIDE OF ITS OWN BOUNDARY CANNOT TELL YOU THE
// BOUNDARY IS WRONG. Eleven declared thresholds in `tools/`, one with cells
// either side, and those synthetic. So the numbers below that WOULD be a
// threshold of my own invention — how many rows is a wall, how many wrapped
// lines is too many, how narrow a text column stops reading — are PRINTED WITH
// THEIR NEIGHBOURHOOD and asserted by nobody. A number I made up, asserted,
// with no cell either side of it, would be the twelfth.
//
//   ROWS      rows per candidate, per rule, with the shipped population beside
//             it — 0 rows (a weapon under flat), 1 row (a weapon under
//             category), 2 rows (the charm). Real cells, all three doors.
//   COLUMN    the text column's own width in CSS px after the indents.
//
// WRAP HAS MOVED OUT OF THAT LIST, 2026-08-15, and the move is the act of the
// day rather than a tidy-up. The line counts were in it — printed, asserted by
// nobody — and a regression walked straight through the gap: Viki's grid attempt
// took li-lines 3 → 4 in this very table while every assertion stayed green.
// Reported-and-unasserted was the right posture for a number I would have had to
// INVENT; it was never the right posture for a number the tree DERIVES. The
// three that remain above are still nobody's, and for the original reason: "how
// narrow a column stops reading" and "how many rows is a wall" have no cell
// either side, so a person rules on them and this exit code does not.
//
// THE VOCABULARY CENSUS is the half only this seat asks. `Flat does not charge
// gear — +2 not applied.` is TRUE. This counts, over the game's own
// player-facing prose, how many times a player could ever have met the word
// `gear` before this sentence hands it to them. A true sentence a person cannot
// parse is a different defect from a false one; the count is the evidence, the
// ruling is in my log.
//
//   node tools/swap-row-reads.mjs              photograph + measure + judge
//   node tools/swap-row-reads.mjs --selftest   plant known-bads, each RED
//   node tools/swap-row-reads.mjs --out DIR    where the photographs land
//
// BOUNDARY, printed on every run: source tree over http, one Linux box, one
// Chromium, `?shot=map` → Armoury → Talisman → set 1, comparisons OPENED. It is
// silent about the bundle (`dist/`), about any shape it was not given, about
// every other picker, and about whether the SENTENCE reads — which is a
// person's ruling and is in my log, not in this exit code.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const SELFTEST = args.includes('--selftest');
const oi = args.indexOf('--out');
const OUT = resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'tools/results/swap-row-reads');

// The row camera formerly lived in linebudget-camera.mjs. It now reads the PNG
// this tool already captures, but only after cropping the exact row geometry
// returned by PROBE. Whole-screen photographs remain presentation evidence;
// they are never line evidence.
const INK_BAND_FLOOR_PX = 8;
const INK_DELTA = 28;
const INK_MIN_PIXELS = 2;

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

function inkBands(buf) {
  const { w, h, ch, px } = decodePng(buf);
  const lum = new Uint8Array(w * h);
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * ch;
    lum[i] = ch >= 3 ? Math.round(0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]) : px[o];
  }
  const hist = new Uint32Array(256);
  for (const v of lum) hist[v]++;
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
  const kept = runs.filter(([a, b]) => b - a + 1 >= INK_BAND_FLOOR_PX);
  const tallest = kept.reduce((m, [a, b]) => Math.max(m, b - a + 1), 0);
  return { bands: kept.length, runs: kept, bg, bridged: tallest > 70 };
}

// The two Constantine looks at, plus the smaller one I was told to add. 360x640
// is not decoration: it is the narrowest shape still common, and a row that
// reads at 390 and not at 360 is a row that reads on my box.
const SHAPES = [
  { tag: '390x844', width: 390, height: 844, dsf: 2, mobile: true },
  { tag: '360x640', width: 360, height: 640, dsf: 2, mobile: true },
];
// Widths swept for the FIRST width at which something breaks. Reported, and
// the report is the point — "add the widths where it breaks if it breaks".
const SWEEP = [320, 340, 360, 375, 390, 412, 430];

const RULES = ['flat', 'gear', 'category'];

// ---------------------------------------------------------------------------
// THE CONTENT DOOR. Appended, compiled, and REVERTED on every path out — a tool
// that leaves a probe talisman in a content author's spreadsheet has shipped it.
// ---------------------------------------------------------------------------
const CSV = join(ROOT, 'content', 'source', 'weapons.csv');
// `dropWeight` is 7, not Viki's 0, and the validator is why — not my taste.
// `basic` answers the FOUND gate, and validateEquipment refuses a `basic` row
// that can never drop: with 0 it booted a red banner naming the entry
// (`equipment.startingKits: wardingCharm.dropWeight must be finite and > 0`).
// That is Law 1 clause 5 doing its job on my authored row, and the fix is the
// data, never the code. It changes no price.
const TALISMAN = 'wardingCharm,Warding Charm,talisman,,uncommon,dagger,1.00,C0B8A6,C9A227,charm|basic,,,,'
  + 'self.swapCost=+2,,"A planted probe talisman — corpus only, never shipped.",7,,0';

// THE SECOND ROW EXISTS TO MAKE THE 1-CELL REAL. Without a HEAVY weapon a
// fresh profile already owns, the `category` rung has no candidate whose price
// moves, and the row-count neighbourhood collapses to {0, 2} with the middle
// missing — I would be reading "two rows" against a gap. `heavy` is a tag the
// rules already read (balance.equipment.swapCostByCategory), so this is one
// more CSV row and still zero code. Same door, same compile, reverted with it.
const MAUL = 'probeMaul,Probe Maul,weapon,right,common,hammer,1.00,8E8678,C9A227,blade|heavy|basic,'
  + 'bladeAttack,weaponGuard,weaponTechnique,strike.damage=+1,,'
  + '"A planted probe weapon — corpus only, never shipped.",7,,7';

function csvHasProbe() { return readFileSync(CSV, 'utf8').includes('wardingCharm'); }

// ---------------------------------------------------------------------------
// THE PAGE PROBE. Ported from tools/axisfit.mjs's SCAN deliberately rather than
// re-invented: the definition of "a scroll container" is Bjorn's and Vira's and
// belongs in one place. If that definition moves, this reading should move with
// it, and a second hand-typed copy is the thing Law 0 clause 4 forbids.
// ---------------------------------------------------------------------------
const PROBE = `(() => {
  const path = (e) => {
    const bits = [];
    for (let n = e; n && n.nodeType === 1 && bits.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { s += '#' + n.id; bits.unshift(s); break; }
      if (n.classList && n.classList.length) s += '.' + [...n.classList].slice(0, 3).join('.');
      bits.unshift(s);
    }
    return bits.join(' > ');
  };
  const de = document.documentElement;
  const zoom = parseFloat(getComputedStyle(de).getPropertyValue('--ui-zoom')) || 1;

  // Every scroll container, same filter as axisfit: real travel AND computed
  // overflow auto|scroll. A clipped box is not something a thumb can move.
  const scrollers = [];
  for (const e of document.querySelectorAll('*')) {
    const declared = e.hasAttribute('data-scroll-axis');
    const hx = e.scrollWidth - e.clientWidth, hy = e.scrollHeight - e.clientHeight;
    if (!declared) {
      if (hx <= 0 && hy <= 0) continue;
      const cs = getComputedStyle(e);
      if (!/auto|scroll/.test(cs.overflowX) && !/auto|scroll/.test(cs.overflowY)) continue;
      if (!e.getClientRects().length) continue;
    }
    scrollers.push({ path: path(e), hx, hy, axis: e.getAttribute('data-scroll-axis'), why: e.getAttribute('data-scroll-axis-why') });
  }

  // How many VISUAL lines a run of text occupies — counted off its own client
  // rects, not divided out of a height. A Range over the node's contents gives
  // one rect per line box, which is what a reader's eye actually counts.
  // VISUAL LINES, BY BAND — corrected 2026-08-15, and the correction is a defect
  // of mine, found by trying to ASSERT the number I had been printing. This
  // counted DISTINCT ROUNDED TOPS, which is not what a reader counts: a
  // \`<small>\` sitting inline beside a price has a smaller font, so its line box
  // has a different top on the SAME visual line. At 18d2976 that made this
  // function print 3 for the run-on row — where a person sees two:
  //
  //     Right Hand swap Actions 2 → 2Flat does not charge gear — +2 not
  //     applied.
  //
  // So the number my report carried this morning was not only unasserted, it was
  // WRONG, and nothing could tell me because nothing read it. Rects are now
  // grouped into bands by vertical overlap — a rect joins a band when its own
  // midpoint falls inside it — which is a line as an eye finds one.
  // TWO KINDS OF RECT COME BACK AND ONLY ONE IS A LINE. A Range that fully
  // contains a BLOCK child returns that block's own box AND the line boxes
  // inside it — measured on this very surface once the note became
  // \`display: block\`: [729,753] for the small, plus [729,741] and [741,753] for
  // the two lines it holds. The enclosing box then swallowed both bands and the
  // row read as 2 lines where a person counts 3. A rect whose vertical span
  // STRICTLY CONTAINS another rect's is a container, not a line, and is dropped.
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
  const lines = (el) => {
    if (!el) return 0;
    const r = document.createRange();
    r.selectNodeContents(el);
    return bands(r.getClientRects());
  };
  // THE ROW'S OWN STATEMENT, counted apart from its note — the same instrument,
  // stopped before the \`<small>\`. This exists because the whole-row count and
  // the note count TOGETHER cannot say where an extra line came from, and the
  // regression this file missed put its extra line HERE: the label and the
  // after-price on two lines, "Right Hand swap Actions 2 →" over "4".
  const headLines = (li, note) => {
    const r = document.createRange();
    r.selectNodeContents(li);
    if (note) r.setEndBefore(note);
    return bands(r.getClientRects());
  };

  // '.equip-resource-change.none' is the EMPTY STATE — "No resource changes." —
  // and counting it as a row is how a 0-cell reads as a 1-cell. It cost me one
  // run to notice, and the neighbourhood it faked was the neighbourhood I was
  // told to build, so it is excluded by name and counted separately.
  const empties = document.querySelectorAll('.equip-resource-change.none').length;
  const rows = [];
  for (const [rowIndex, li] of [...document.querySelectorAll('.equip-resource-change:not(.none)')].entries()) {
    const note = li.querySelector('small');
    const rect = li.getBoundingClientRect();
    const host = li.closest('.equip-candidate-comparison');
    const hostRect = host ? host.getBoundingClientRect() : null;
    // THE PRICE AS A READER SEES IT, read off the row's own text rather than
    // off the model — the head is everything before the note, and the two
    // numbers either side of the arrow are the whole claim the row makes. If
    // this does not parse, the row has stopped stating a price legibly and that
    // is a finding, never a shrug.
    const headText = (note ? li.textContent.replace(note.textContent, '') : li.textContent).replace(/\\s+/g, ' ').trim();
    const price = /(-?\\d+)\\s*→\\s*(-?\\d+)$/.exec(headText);
    rows.push({
      text: li.innerText.replace(/\\s+/g, ' ').trim(),
      noteText: note ? note.innerText.replace(/\\s+/g, ' ').trim() : null,
      headText,
      before: price ? Number(price[1]) : null,
      after: price ? Number(price[2]) : null,
      hasNote: !!note,
      liLines: lines(li),
      headLines: headLines(li, note),
      noteLines: note ? lines(note) : 0,
      rowIndex,
      // Geometry and identity travel together. The camera re-measures after
      // scrollIntoView and refuses the crop if this key moved to another row.
      rowKey: [headText, note ? note.textContent.replace(/\\s+/g, ' ').trim() : '', rowIndex].join(' | '),
      x: rect.left, y: rect.top, w: rect.width, h: rect.height,
      clipped: (() => {
        for (let n = li.parentElement; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (!/auto|scroll|hidden/.test(cs.overflowY) && !/auto|scroll|hidden/.test(cs.overflowX)) continue;
          const q = n.getBoundingClientRect();
          if (rect.top < q.top - 0.5 || rect.bottom > q.bottom + 0.5 || rect.left < q.left - 0.5 || rect.right > q.right + 0.5) return true;
        }
        return !(rect.top >= -0.5 && rect.bottom <= innerHeight + 0.5);
      })(),
      left: rect.left, right: rect.right, width: rect.width, height: rect.height,
      // Law 2: proven inside its named container's rendered rect, not assumed.
      insideHost: hostRect ? (rect.left >= hostRect.left - 0.5 && rect.right <= hostRect.right + 0.5) : null,
      insideViewport: rect.left >= -0.5 && rect.right <= innerWidth + 0.5,
    });
  }

  // LAW 4'S FLOOR, MEASURED, NEVER PARSED — tapsize.mjs's method, imported as a
  // method rather than copied as a number. A probe div sized by the same
  // \`var(--tap-floor)\` every floored rule uses, measured in DEVICE px after
  // \`body { zoom }\`, and the summary measured the same way. My first pass
  // compared a post-zoom rect against a pre-zoom calc and produced six
  // confident LAW 4 failures on a healthy tree: 44.0 rendered against a
  // "floor" of 48.9. That is the instrument talking, and it is why nothing here
  // does arithmetic on a CSS expression.
  const p = document.createElement('div');
  p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;padding:0;border:0;height:var(--tap-floor)';
  document.body.appendChild(p);
  const floorDevice = p.getBoundingClientRect().height;
  p.remove();
  const summaries = [...document.querySelectorAll('.equip-candidate-comparison summary')]
    .map((s) => ({ h: s.getBoundingClientRect().height, w: s.getBoundingClientRect().width }));

  const comps = [...document.querySelectorAll('.equip-candidate-comparison')];

  // ROWS PER CANDIDATE, the unit Viki's question is actually in. The picker
  // draws one comparison per chip, so a surface total divided by the chip count
  // is a MEAN and hides the worst candidate — which is the one a reader meets.
  const perCandidate = [...document.querySelectorAll('.equip-candidate-row')]
    .map((row) => row.querySelectorAll('.equip-resource-change:not(.none)').length);

  // THE RUN-ON. The note is an inline <small> with no separator, so the price
  // and the sentence share a line with nothing between them: "2 → 2Flat does
  // not charge gear". Measured as the horizontal gap in px between the end of
  // the last strong (the after-price) and the start of the note, ON THE SAME
  // LINE. A negative or zero gap is two sentences printed as one word.
  const runOns = [];
  for (const li of document.querySelectorAll('.equip-resource-change:not(.none)')) {
    const strong = li.querySelector('strong');
    const note = li.querySelector('small');
    if (!strong || !note) continue;
    const a = strong.getBoundingClientRect();
    const bs = [...note.getClientRects()];
    if (!bs.length) continue;
    const sameLine = bs.find((r) => Math.abs(r.top - a.top) < a.height * 0.6);
    runOns.push({
      gap: sameLine ? Math.round((sameLine.left - a.right) * 10) / 10 : null,
      sameLine: !!sameLine,
      priceEndsWith: strong.textContent.trim(),
      noteStartsWith: note.textContent.trim().slice(0, 24),
    });
  }

  // THE +2, COUNTED WHEREVER THE SURFACE SAYS IT. Under a rule that declines
  // the delta, every unqualified "+2" on this screen is a promise the engine
  // does not keep — and the qualifying sentence is smaller, greyer, and further
  // down than any of them. Counted by TEXT, over the whole picker.
  const plusTwo = { chip: 0, addedEffects: 0, qualified: 0, whereChip: [], whereAdded: [] };
  for (const el of document.querySelectorAll('.equip-chip .ec-mods')) {
    const t = el.innerText.trim();
    if (/swap cost\\s*[+-]\\d/i.test(t)) { plusTwo.chip++; plusTwo.whereChip.push(t.slice(0, 40)); }
  }
  for (const el of document.querySelectorAll('.equip-added-effect:not(.none)')) {
    const t = el.innerText.trim();
    if (/swap cost\\s*[+-]\\d/i.test(t)) { plusTwo.addedEffects++; plusTwo.whereAdded.push(t.slice(0, 40)); }
  }
  // COUNTED BY PRESENCE, NEVER BY PHRASE. This read \`/not applied/\` for one
  // run and it was wrong the moment I tried a different sentence: my own
  // proposed wording says "not charged", and the census reported ZERO
  // qualifications for a surface that had qualified every row. A sentinel that
  // re-types the words it watches is the defect it is watching for (Sten,
  // onevocab.mjs). The note EXISTING is the qualification; what it says is the
  // ruling's business, and the ruling is a person's.
  plusTwo.qualified = document.querySelectorAll('.equip-resource-change:not(.none) small').length;

  // TEXT OUTSIDE ITS OWN BOX. Law 2 is "every positioned element names its
  // container and is PROVEN INSIDE IT ON THE RENDERED RECT" — and the rect that
  // matters to a reader is the text's, not the element's. A sibling-rect
  // intersection test misses this entirely: the box can be 57 px wide and
  // perfectly non-overlapping while the words inside it run straight across the
  // badge next door. Measured with a Range over the node's own contents, the
  // same instrument the line count uses.
  //
  // WHY THIS SURFACE. equipSlots.csv says the talisman slot is "Empty until
  // talismans are authored", so the row I authored is the FIRST talisman this
  // game has ever had — and the first chip ever drawn with no sprite. The chip
  // grid is '3.6rem 1fr auto' with '.ec-art' spanning rows 1-2 of column 1; with
  // no art, auto-placement puts the NAME in the 3.6rem art column.
  const overlaps = [];
  for (const chip of document.querySelectorAll('.equip-chip')) {
    for (const kid of chip.children) {
      const box = kid.getBoundingClientRect();
      if (!box.width) continue;
      const r = document.createRange();
      r.selectNodeContents(kid);
      let worst = 0;
      for (const t of r.getClientRects()) worst = Math.max(worst, t.right - box.right, box.left - t.left);
      if (worst > 1) overlaps.push({
        chip: (chip.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 34),
        el: kid.className, over: Math.round(worst), boxW: Math.round(box.width),
      });
    }
  }

  return {
    perCandidate, runOns, plusTwo, overlaps,
    zoom, floorDevice, vw: innerWidth, vh: innerHeight,
    htmlFont: getComputedStyle(de).fontSize,
    docHx: de.scrollWidth - de.clientWidth,
    docOverflowX: getComputedStyle(de).overflowX,
    scrollers,
    rows,
    summaries,
    empties,
    candidates: document.querySelectorAll('.equip-candidate-row').length,
    opened: comps.filter((d) => d.open).length,
    // The text column the note actually gets, after margin-left + border +
    // padding-left on the comparison and padding-left on the ul.
    columnPx: comps.length ? comps[0].querySelector('ul') ? comps[0].querySelector('ul').getBoundingClientRect().width : null : null,
    banner: (() => { const b = document.querySelector('.validation-banner'); return b ? b.textContent.slice(0, 200) : null; })(),
  };
})()`;

// ---------------------------------------------------------------------------
// DRIVE. `?shot=map` → the map's Armoury button → the Talisman slot, set 1 →
// open every comparison. Real clicks, the player's own route; nothing is
// injected into the page and no state is written from outside.
// ---------------------------------------------------------------------------
const OPEN_ARMOURY = `(() => { const b = document.querySelector('#open-armoury'); if (!b) return 'no #open-armoury on the map'; b.click(); return true; })()`;
const PICK = (label, setIndex) => `(() => {
  const blocks = [...document.querySelectorAll('.equip-slot')];
  const box = blocks.find((b) => (b.querySelector('.es-label') || {}).textContent === ${JSON.stringify(label)});
  if (!box) return 'no ' + ${JSON.stringify(label)} + ' slot block on the Armoury — slots: ' + blocks.map((b) => (b.querySelector('.es-label')||{}).textContent).join('|');
  const cells = [...box.querySelectorAll('.es-sets > *')];
  const cell = cells[${setIndex}];
  if (!cell) return ${JSON.stringify(label)} + ' renders ' + cells.length + ' set cell(s); index ${setIndex} is not one of them';
  cell.click();
  return true;
})()`;
const OPEN_ALL = `(() => {
  const d = [...document.querySelectorAll('.equip-candidate-comparison')];
  if (!d.length) return 'no candidate comparisons in the picker';
  d.forEach((x) => { x.open = true; });
  return d.length;
})()`;
const SCROLL_TO_ROW = (i) => `(() => {
  const li = [...document.querySelectorAll('.equip-resource-change:not(.none)')][${i}];
  if (!li) return false;
  li.scrollIntoView({ block: 'center' });
  return true;
})()`;
// THE LIVE RULE ARRIVES BY THE APP'S OWN DOOR. `?shotSettings=<json>` goes
// through `saves.saveMeta()` on the ephemeral store and comes back out of
// `saves.loadMeta()` when `showArmoury()` mounts — so the rule the screen prices
// with is the app's own resolution of the setting, never this tool's copy of it.
// Vira's invariant on contrast-audit, applied here: THE PROFILE REPORTED IS THE
// PROFILE RENDERED. Reaching in and setting the rule on a mounted screen would
// measure my own mock, and it is why the rule is in the URL.
const shotUrl = (rule) => `?shot=map&shotSettings=${encodeURIComponent(JSON.stringify({ swapCostRule: rule }))}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // ---- the door, opened -----------------------------------------------------
  const csvBefore = readFileSync(CSV, 'utf8');
  const generatedBefore = snapshotGenerated();
  let restore = () => {};
  if (!csvHasProbe()) {
    writeFileSync(CSV, csvBefore.replace(/\n*$/, '\n') + TALISMAN + '\n' + MAUL + '\n');
    restore = () => { writeFileSync(CSV, csvBefore); build(); };
    process.on('exit', () => { try { writeFileSync(CSV, csvBefore); } catch {} });
    const b = build();
    if (!b.ok) { console.error(`swap-row-reads: content-build refused the authored row:\n${b.out}`); restore(); process.exit(2); }
    console.log('DOOR   content/source/weapons.csv +1 row (self.swapCost=+2) → node tools/content-build.mjs → OK. ZERO code.');
  } else {
    console.log('DOOR   the probe talisman is already authored in content/source/weapons.csv — using the tree as it stands.');
  }
  void generatedBefore;

  mkdirSync(OUT, { recursive: true });
  const { server, port } = await serve({ root: ROOT, port: 8137, open: false });
  const BASE = `http://127.0.0.1:${port}/`;

  const browser = spawn(process.env.CHROME || '/usr/bin/chromium', [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let reaped = false;
  const reap = () => { if (reaped) return; reaped = true; try { browser.kill('SIGKILL'); } catch {} try { server.close(); } catch {} };
  process.on('exit', reap);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { reap(); restore(); process.exit(130); });

  const ws = await new Promise((ok, no) => {
    let buf = '';
    const read = (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) ok(m[1]); };
    browser.stderr.on('data', read); browser.stdout.on('data', read);
    browser.on('exit', (c) => no(new Error(`chromium exited (${c}) before naming an endpoint:\n${buf.slice(-400)}`)));
    setTimeout(() => no(new Error('chromium never printed a DevTools endpoint')), 20000);
  }).catch((e) => { reap(); restore(); console.error(`swap-row-reads: ${e.message}`); process.exit(2); });

  const CDP_PORT = Number(new URL(ws.replace(/^ws:/, 'http:')).port);
  console.log(`RUN    browser pid ${browser.pid} · CDP port ${CDP_PORT} · HTTP port ${port} — this run's own.`);
  const c = await cdp(CDP_PORT);
  await c.send('Page.enable'); await c.send('Runtime.enable');

  const ev = async (e) => {
    const r = await c.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || 'eval error' };
    return r.result.value;
  };
  const waitFor = async (sel, deadline = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < deadline) {
      if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`) === true) { await sleep(200); return Date.now() - t0; }
      await sleep(60);
    }
    return null;
  };
  const waitUrl = async (q, deadline = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < deadline) {
      const at = await ev('({q: location.search, ready: document.readyState})');
      if (at && !at.__err && at.q === q && at.ready !== 'loading') return true;
      await sleep(50);
    }
    return false;
  };

  const closedShot = new Set();
  let shapeTag = 'unknown';

  // Reach the surface: the player's own route, every time, from a clean boot.
  async function reach(rule, slot = 'Talisman', setIndex = 0) {
    const q = shotUrl(rule);
    await c.send('Page.navigate', { url: BASE + q });
    if (!await waitUrl(q)) return `never landed on ${q}`;
    if (await waitFor('#open-armoury') === null) return 'the map never rendered its Armoury button';
    const a = await ev(OPEN_ARMOURY); if (a !== true) return `armoury: ${JSON.stringify(a)}`;
    if (await waitFor('.equip-slot') === null) return 'the Armoury never rendered a slot block';
    const p = await ev(PICK(slot, setIndex)); if (p !== true) return `${slot}: ${JSON.stringify(p)}`;
    if (await waitFor('.equip-candidate-row') === null) return 'the picker rendered no candidate rows';
    // THE DEFAULT STATE IS CLOSED, and that is the single biggest mercy on this
    // surface — a `<details>` with no `open` attribute. Photographed BEFORE
    // anything is expanded, once per shape, because a gate that only ever looks
    // at the opened state is reporting on a screen most players never build.
    if (!closedShot.has(`${shapeTag}`)) {
      closedShot.add(`${shapeTag}`);
      await sleep(200);
      const f = join(OUT, `default-collapsed-${shapeTag}.png`);
      const p2 = await c.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(f, Buffer.from(p2.data, 'base64'));
      shots.push({ file: f, shape: shapeTag, rule: '(any)', rows: 0, note: 'DEFAULT state — every comparison collapsed' });
    }
    const o = await ev(OPEN_ALL); if (typeof o !== 'number') return `open: ${JSON.stringify(o)}`;
    await sleep(220);
    return null;
  }

  const findings = [];
  const shots = [];
  const report = [];

  async function readRowInk(measured, shape, rule) {
    for (const original of measured.rows) {
      if (await ev(SCROLL_TO_ROW(original.rowIndex)) !== true) {
        original.inkErr = `row ${original.rowIndex} vanished before its crop`;
        continue;
      }
      await sleep(180);
      const after = await ev(PROBE);
      const row = after && !after.__err ? after.rows[original.rowIndex] : null;
      if (!row) { original.inkErr = `row ${original.rowIndex} could not be re-measured after scrolling`; continue; }
      if (row.rowKey !== original.rowKey) {
        original.inkErr = `row identity changed before crop: expected "${original.rowKey}", got "${row.rowKey}"`;
        continue;
      }
      if (row.clipped) { original.inkErr = `row ${row.rowIndex} remains clipped after scrollIntoView`; continue; }
      const png = await c.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: false,
        clip: { x: row.x, y: row.y, width: Math.max(1, row.w), height: Math.max(1, row.h), scale: 2 },
      });
      const buf = Buffer.from(png.data, 'base64');
      const file = join(OUT, `row-ink-${rule}-${shape.tag}-row${row.rowIndex}.png`);
      writeFileSync(file, buf);
      try {
        const ink = inkBands(buf);
        Object.assign(original, { inkLines: ink.bands, inkRuns: ink.runs, inkBg: ink.bg, inkBridged: ink.bridged, inkFile: file });
        shots.push({ file, shape: shape.tag, rule, rows: 1, rowKey: row.rowKey,
          crop: { x: row.x, y: row.y, w: row.w, h: row.h }, note: 'ROW CROP — the only screenshot used as line evidence' });
      } catch (e) { original.inkErr = `PNG decoder could not read row ${row.rowIndex}: ${e.message}`; }
    }
  }

  for (const shape of SHAPES) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: shape.width, height: shape.height, deviceScaleFactor: shape.dsf, mobile: shape.mobile });
    shapeTag = shape.tag;
    for (const rule of RULES) {
      const why = await reach(rule);
      if (why) { findings.push(`${shape.tag}/${rule}: COULD NOT REACH THE SURFACE — ${why}`); continue; }
      const m = await ev(PROBE);
      if (!m || m.__err) { findings.push(`${shape.tag}/${rule}: probe threw — ${m && m.__err}`); continue; }
      if (m.banner) findings.push(`${shape.tag}/${rule}: VALIDATION BANNER on screen — ${m.banner}`);

      const file = join(OUT, `armoury-talisman-${rule}-${shape.tag}.png`);
      const png = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(file, Buffer.from(png.data, 'base64'));
      shots.push({ file, shape: shape.tag, rule, rows: m.rows.length, note: 'comparisons OPENED' });

      // THE ROWS THEMSELVES, scrolled to. At 360x640 they are five blocks below
      // the fold, so the first frame photographs the surface and says nothing
      // about the rows on it — a shot that proves a screen appeared and not
      // that a person can read the thing being gated.
      await ev(`(() => { const r = document.querySelector('.equip-resource-change:not(.none)'); if (r) r.scrollIntoView({ block: 'center' }); return !!r; })()`);
      await sleep(200);
      const f2 = join(OUT, `rows-${rule}-${shape.tag}.png`);
      const png2 = await c.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(f2, Buffer.from(png2.data, 'base64'));
      shots.push({ file: f2, shape: shape.tag, rule, rows: m.rows.length, note: 'scrolled to the rows' });

      // Row crops are taken independently of both whole-screen images above.
      // Each scroll is followed by a fresh PROBE, identity match, clip check,
      // and crop from that exact row geometry.
      await readRowInk(m, shape, rule);

      // ---- L5: horizontal travel, PER CONTAINER, boundary 0 -----------------
      const bleeders = m.scrollers.filter((s) => s.hx > 0 && !s.axis);
      for (const b of bleeders) findings.push(`${shape.tag}/${rule}: LAW 5 — ${b.path} scrolls ${Math.round(b.hx)}px horizontally, undeclared. Boundary 0.`);
      // ---- L4: the tap floor, both measured the same way ---------------------
      if (!m.summaries.length) findings.push(`${shape.tag}/${rule}: no comparison summary on the surface at all — the floor is on the DENOMINATOR, so an empty set is never a pass.`);
      for (const s of m.summaries) {
        if (s.h + 0.5 < m.floorDevice) findings.push(`${shape.tag}/${rule}: LAW 4 — a comparison summary renders ${s.h.toFixed(1)}px, the measured --tap-floor is ${m.floorDevice.toFixed(1)}px (both device px after body{zoom}).`);
      }
      // ---- L2: inside its own container, and inside the viewport ------------
      for (const r of m.rows) {
        if (r.insideHost === false) findings.push(`${shape.tag}/${rule}: LAW 2 — a row escapes .equip-candidate-comparison's rect (${r.left.toFixed(1)}..${r.right.toFixed(1)}).`);
        if (!r.insideViewport) findings.push(`${shape.tag}/${rule}: LAW 2 — a row escapes the ${m.vw}px viewport (${r.left.toFixed(1)}..${r.right.toFixed(1)}).`);
      }
      // ---- L2, asked of SIBLINGS: two things drawn on top of each other -----
      for (const o of m.overlaps) {
        findings.push(`${shape.tag}/${rule}: LAW 2 (PRE-EXISTING, NOT arm 1) — in chip "${o.chip}", .${String(o.el).split(' ')[0]}'s text runs ${o.over}px outside its own ${o.boxW}px box, across what is beside it.`);
      }
      // ---- THE RUN-ON: a price and a sentence printed as one word -----------
      // NOT a threshold and deliberately not one: the boundary is ANY positive
      // separation, the weakest claim that can still fail. "How much gap is
      // enough" would be a number of mine with no cell either side, so it is
      // not asked. The neighbourhood is free and already in the run — under
      // `gear` the rows carry no note at all, so a run-on cannot occur, and
      // that cell is measured in the same sweep.
      for (const r of m.runOns) {
        if (r.sameLine && r.gap !== null && r.gap <= 0) {
          findings.push(`${shape.tag}/${rule}: READS AS ONE WORD — the price ends "${r.priceEndsWith}" and the note begins "${r.noteStartsWith}…" with ${r.gap}px between them, on the same line. Nothing separates a number from a sentence.`);
        }
      }
      // ---- LINE BUDGET: the count this file PRINTED and did not check --------
      // ADDED 2026-08-15 AFTER IT COST US ONE, and the story is the whole reason
      // it is here. Viki was told — by Marina and by me — to copy
      // `.player-poise-receipt`'s `display: grid`. She tried it, RENDERED it, and
      // it broke the row a different way: that sibling's children are all
      // elements, but this `<li>` begins with a bare text node, so grid made the
      // text an anonymous item and tore the price off its own arrow —
      // "Right Hand swap Actions 2 →" over "4".
      //
      // THE CHECK ABOVE STAYED GREEN THROUGH IT. It compares `<strong>` against
      // `<small>`, and the broken row had STOPPED PUTTING THOSE TWO ADJACENT, so
      // the adjacency test passed BY LOSING ITS SUBJECT. Meanwhile li-lines went
      // 3 → 4 in this tool's own table and nothing read the number. The house has
      // a name for that state and did not have to mint one: REPORTED, NEVER
      // ASSERTED — the sentence struck from `mobilefit.mjs`'s header the day
      // Law 5 made the design call (`laws.md` Law 5, enforcement note). A number
      // an instrument already prints and does not assert is the next regression
      // it will miss.
      //
      // THE ADJACENCY CHECK IS NOT WRONG AND DOES NOT GO. It is INSUFFICIENT,
      // and that is now measured rather than suspected: `--selftest` plants the
      // sibling's declaration and scores BOTH — this budget fires, that one is
      // silent, printed side by side so the insufficiency is in the output and
      // not only in a log.
      //
      // NOTHING HERE IS A THRESHOLD OF MINE, and the mechanism is why. The
      // expected li-count is DERIVED from the note's own measured height on the
      // SAME RUN — `head + note` — so the 3 under a declining rule and the 1
      // under `gear` are never typed anywhere in this file. Law 0 clause 1 read
      // as a rule about instruments: the entry describes, the machinery derives.
      // The one literal is the head's `1`, and it is "one statement, one line"
      // rather than a tunable — with real cells either side, both observed: 1 at
      // every shape, every shipped rule and all seven swept widths on the tree
      // as it stands, and 2 on the planted copy.
      for (const r of m.rows) {
        if (r.inkErr) {
          findings.push(`${shape.tag}/${rule}: INK LINE BUDGET UNKNOWN — ${r.inkErr}. No row crop means no line verdict.`);
        } else if (r.inkBridged) {
          findings.push(`${shape.tag}/${rule}: INK LINE BUDGET UNKNOWN — row "${r.headText}" has a >70px ink band that may bridge lines. Crop: ${r.inkFile}`);
        } else if (r.inkLines !== r.liLines) {
          findings.push(`${shape.tag}/${rule}: INK LINE BUDGET — geometry says ${r.liLines} line(s), but the correctly-associated row crop paints ${r.inkLines} ink band(s): "${r.headText}". Crop: ${r.inkFile}`);
        }
        if (r.hasNote && r.noteText && r.noteLines === 0) {
          findings.push(`${shape.tag}/${rule}: NOTE PAINTS NOTHING — the note exists in the DOM but renders zero lines, so presence-only qualification is false confidence: "${r.noteText}". Crop: ${r.inkFile || 'unavailable'}`);
        }
        if (r.headLines !== 1) {
          findings.push(`${shape.tag}/${rule}: LINE BUDGET — the row's own price statement runs onto ${r.headLines} lines before its note even starts: "${r.headText}". One price, one line; anything else has torn a number off the words that name it.`);
        }
        if (r.liLines !== r.headLines + r.noteLines) {
          findings.push(`${shape.tag}/${rule}: LINE BUDGET — the row occupies ${r.liLines} line(s) but its parts measure ${r.headLines} + ${r.noteLines} = ${r.headLines + r.noteLines}. A line is SHARED between the price and its note, which is the run-on measured in lines instead of in pixels.`);
        }
      }
      // ---- UNMOVED AND UNEXPLAINED ------------------------------------------
      // The note VANISHING was watched only from inside `--selftest`, which
      // parsed this tool's own report to notice it. A check that lives in the
      // harness's test and not in the harness cannot fail on a real tree — the
      // same shape as the one above, one layer out. It is a finding now, and the
      // plant scores it by its sentence.
      // BY PRESENCE, NEVER BY PHRASE. What the note SAYS is a person's ruling.
      for (const r of m.rows) {
        if (r.before === null) {
          findings.push(`${shape.tag}/${rule}: THE ROW STOPPED STATING A PRICE — "${r.headText}" has no "<before> → <after>" in it. Unknown is not green.`);
          continue;
        }
        // Gated on the picker actually PROMISING a delta, because that is the
        // cell I have either side of: a chip that says "Swap cost +2" over a row
        // that says 2 → 2. Where nothing is promised I have no observation, so
        // this stays silent rather than guessing.
        if (r.before === r.after && !r.hasNote && m.plusTwo.chip > 0) {
          findings.push(`${shape.tag}/${rule}: UNMOVED AND UNEXPLAINED — "${r.headText}" shows a price that did not move and carries no note, while the picker advertises a swap-cost delta on ${m.plusTwo.chip} chip(s). A player is shown a number that ignored them and no reason.`);
        }
      }
      report.push({ shape: shape.tag, rule, m });
    }
    // ---- THE SETTING REACHED THE SCREEN, proven rather than requested -------
    // Three rules must not render the same rows. If they do, `?shotSettings`
    // never landed and every row above was priced by the shipping default while
    // this tool printed three rule names — a green that is silence, which is the
    // shape this house keeps finding. Boundary is "not all identical", the
    // weakest claim that can still fail; it is not a claim about which is right.
    const mine = report.filter((r) => r.shape === shape.tag);
    const sigs = new Set(mine.map((r) => JSON.stringify(r.m.rows.map((x) => x.text))));
    if (mine.length === RULES.length && sigs.size === 1) {
      findings.push(`${shape.tag}: all ${RULES.length} shipped rules rendered IDENTICAL rows — the live rule never reached the screen, so every reading above is about the default only.`);
    }
  }

  // ---- THE ROW-COUNT NEIGHBOURHOOD -----------------------------------------
  // "Two rows per candidate" is the whole question I was handed, and a reading
  // of 2 with nothing either side of it is a number that cannot be wrong. Vira's
  // count this morning: 11 declared thresholds in tools/, ONE with cells either
  // side, and those synthetic. So the cells below are real screens, reached by
  // the same clicks, through the same content door — a candidate that produces
  // FEWER rows and one that produces the same two by a different route. If a
  // real 0-row and a real 1-row cell cannot be produced, that is printed as the
  // finding it is, not left out of the table.
  const neigh = [];
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  for (const cell of [
    // Set 1 and not set 2: the set ladder (#90) opens one cell at a time, so
    // index 1 is `next` and its picker is empty. Learned by the cell going ERR
    // rather than by reading the ladder — which is the right way round.
    { what: 'Right Hand set 1, weapon candidates', slot: 'Right Hand', setIndex: 0, rule: 'flat' },
    { what: 'Right Hand set 1, weapon candidates', slot: 'Right Hand', setIndex: 0, rule: 'category' },
    { what: 'Right Hand set 1, weapon candidates', slot: 'Right Hand', setIndex: 0, rule: 'gear' },
    { what: 'Left Hand set 1, off-hand candidates', slot: 'Left Hand', setIndex: 0, rule: 'category' },
    { what: 'Talisman set 1, the charm', slot: 'Talisman', setIndex: 0, rule: 'flat' },
  ]) {
    const why = await reach(cell.rule, cell.slot, cell.setIndex);
    if (why) { neigh.push({ ...cell, err: why }); continue; }
    const m = await ev(PROBE);
    if (!m || m.__err) { neigh.push({ ...cell, err: String(m && m.__err) }); continue; }
    // Rows PER CANDIDATE, which is the unit Viki's question is in — the picker
    // draws one comparison per chip, so the surface total divided by the chips.
    const worst = m.perCandidate && m.perCandidate.length ? Math.max(...m.perCandidate) : null;
    neigh.push({
      ...cell, candidates: m.candidates, rowsTotal: m.rows.length, worst, empties: m.empties,
      sample: m.rows.length ? m.rows[0].text : `(no swap row — ${m.empties} candidate(s) show the empty state "No resource changes.")`,
    });
    const f = join(OUT, `neighbourhood-${cell.slot.replace(/\s+/g, '')}${cell.setIndex + 1}-${cell.rule}-390x844.png`);
    const png = await c.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(f, Buffer.from(png.data, 'base64'));
    neigh[neigh.length - 1].file = f;
  }

  // ---- the width sweep: where does it break, if it breaks -------------------
  const sweep = [];
  for (const w of SWEEP) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: 844, deviceScaleFactor: 2, mobile: true });
    const why = await reach('flat');
    if (why) { sweep.push({ w, err: why }); continue; }
    const m = await ev(PROBE);
    if (!m || m.__err) { sweep.push({ w, err: String(m && m.__err) }); continue; }
    const bleed = m.scrollers.filter((s) => s.hx > 0 && !s.axis).reduce((a, s) => Math.max(a, s.hx), 0);
    const escaped = m.rows.filter((r) => !r.insideViewport).length;
    sweep.push({
      w, bleed: Math.round(bleed), escaped,
      column: m.columnPx == null ? null : Math.round(m.columnPx),
      noteLines: Math.max(0, ...m.rows.map((r) => r.noteLines)),
      liLines: Math.max(0, ...m.rows.map((r) => r.liLines)),
      headLines: Math.max(0, ...m.rows.map((r) => r.headLines)),
      rows: m.rows.length,
    });
    // The sweep is the LINE BUDGET's neighbourhood and it is asserted here too,
    // not only at the two photographed shapes. 320 is where a head would wrap if
    // any shape were going to make it wrap, and it is the cell that turns "one
    // statement, one line" from my taste into an observation.
    for (const r of m.rows) {
      if (r.headLines !== 1) findings.push(`width ${w}: LINE BUDGET — the price statement runs onto ${r.headLines} lines: "${r.headText}".`);
      if (r.liLines !== r.headLines + r.noteLines) findings.push(`width ${w}: LINE BUDGET — ${r.liLines} line(s) for parts measuring ${r.headLines} + ${r.noteLines}.`);
    }
  }

  // ---- UNKNOWN IS NEVER GREEN ----------------------------------------------
  // Both tables below can print `ERR …` or `n/a` in a cell and this file used to
  // exit 0 anyway. A dash inside a table of facts reads as a fact. The
  // neighbourhood is the SUPPORT for every number I refuse to assert — "cells
  // observed: 0 · 1 · 2" is the only reason the 2 means anything — so a
  // neighbourhood that quietly collapses to one cell takes the report's evidence
  // with it and must not do so under a green.
  for (const n of neigh) if (n.err) findings.push(`neighbourhood cell "${n.slot} set ${n.setIndex + 1} / ${n.rule}" COULD NOT BE MEASURED — ${n.err}. The row-count report leans on this cell; unknown is not green.`);
  for (const s of sweep) if (s.err) findings.push(`width ${s.w} COULD NOT BE MEASURED — ${s.err}. A width that was not swept is not a width that passed.`);
  for (const r of report) {
    if (r.m.rows.length && r.m.columnPx == null) findings.push(`${r.shape}/${r.rule}: the text column could not be measured while ${r.m.rows.length} row(s) rendered — the instrument lost its own subject.`);
  }

  reap();
  restore();

  // ---- the report -----------------------------------------------------------
  console.log(`\nREF    ${ref()}`);
  console.log('\nDOOR   content CSV + content-build, zero code. Surface reached by real clicks: ?shot=map → Armoury → Talisman → set 1 → comparisons opened.');
  console.log('\nPHOTOGRAPHS');
  for (const s of shots) console.log(`  ${s.shape.padEnd(8)} ${s.rule.padEnd(9)} ${String(s.rows).padStart(2)} row(s)  ${(s.note||'').padEnd(38)} ${s.file.replace(ROOT + '/', '')}`);

  console.log('\nASSERTED (boundaries are Laws 5, 4 and 2 — none of them mine)');
  console.log('  L5 horizontal travel per scroll container   boundary 0 px');
  console.log('  L4 summary tap target vs a MEASURED --tap-floor probe, both in device px after body{zoom}');
  console.log('  L2 every row inside its container and the viewport; every chip\'s TEXT inside its own box');
  console.log('  ONE WORD  a price and a sentence not printed with nothing between them — boundary: any positive gap');
  console.log('  LINE BUDGET  li-lines == head-lines + note-lines, AND head-lines == 1. The expected li-count is');
  console.log('               DERIVED from the note measured on the same run — the 3 and the 1 are typed nowhere.');
  console.log('  INK LINE BUDGET  every line count is checked against its own re-measured row crop; whole-screen PNGs are excluded.');
  console.log('  UNMOVED AND UNEXPLAINED  a price that did not move, under a picker promising a delta, carries a note.');
  console.log('               By PRESENCE, never by phrase. What it SAYS is a person\'s ruling and is not in this exit code.');
  console.log('  UNKNOWN IS NEVER GREEN  an ERR cell or an unmeasurable text column fails instead of printing a dash.');

  console.log('\nREPORTED, ASSERTED BY NOBODY — a threshold of mine with no cell either side would be the twelfth in tools/.');
  console.log('  Still nobody\'s: the text column\'s WIDTH, the row COUNT, and the vocabulary census. Those are the numbers');
  console.log('  where "how narrow stops reading" and "how many rows is a wall" have no cell either side, so a person rules.');
  console.log('  shape    rule       rows  li-lines  head-lines  note-lines  text column  ink-lines');
  for (const r of report) {
    const li = Math.max(0, ...r.m.rows.map((x) => x.liLines));
    const hd = Math.max(0, ...r.m.rows.map((x) => x.headLines));
    const nl = Math.max(0, ...r.m.rows.map((x) => x.noteLines));
    const ink = r.m.rows.some((x) => x.inkErr) ? 'ERR' : Math.max(0, ...r.m.rows.map((x) => x.inkLines));
    console.log(`  ${r.shape.padEnd(8)} ${r.rule.padEnd(10)} ${String(r.m.rows.length).padStart(4)}  ${String(li).padStart(8)}  ${String(hd).padStart(10)}  ${String(nl).padStart(10)}  ${(r.m.columnPx == null ? 'n/a' : Math.round(r.m.columnPx) + 'px').padEnd(11)} ${ink}`);
  }
  console.log('\n  WHAT THE ROWS SAY, verbatim, at every shape and every shipped rule:');
  for (const r of report) {
    for (const row of r.m.rows) console.log(`    ${r.shape} ${r.rule.padEnd(9)} "${row.text}"`);
    if (!r.m.rows.length) console.log(`    ${r.shape} ${r.rule.padEnd(9)} (no swap row — the price does not move and nothing is declined)`);
  }

  console.log('\n  WHAT THE SURFACE PROMISES vs WHAT IT QUALIFIES — the +2, counted wherever the screen says it:');
  console.log('    shape    rule       chip "Swap cost +2"  "Explicit added effects"  qualified by a note');
  for (const r of report) {
    const p = r.m.plusTwo;
    console.log(`    ${r.shape.padEnd(8)} ${r.rule.padEnd(10)} ${String(p.chip).padStart(17)} ${String(p.addedEffects).padStart(25)} ${String(p.qualified).padStart(20)}`);
  }
  console.log('    Under a rule that DECLINES the delta, an unqualified "+2" is a promise the engine does not keep.');
  console.log('    Counted, not judged — the judgement is in the log.');

  console.log('\n  ROW-COUNT NEIGHBOURHOOD — real cells either side, same clicks, same content door (390x844):');
  console.log('    slot / set              rule       chips  rows  ROWS PER CANDIDATE');
  for (const n of neigh) {
    if (n.err) { console.log(`    ${(n.slot + ' set ' + (n.setIndex + 1)).padEnd(23)} ${n.rule.padEnd(10)} ERR ${n.err}`); continue; }
    console.log(`    ${(n.slot + ' set ' + (n.setIndex + 1)).padEnd(23)} ${n.rule.padEnd(10)} ${String(n.candidates).padStart(5)} ${String(n.rowsTotal).padStart(5)}  ${n.worst == null ? 'n/a' : String(n.worst)}   "${n.sample}"`);
  }
  // The WORST candidate, never the mean: a mean of 0.33 over three chips hides
  // the one chip that carries a row, and the reader meets chips, not means.
  const seen = [...new Set(neigh.filter((n) => !n.err && n.worst != null).map((n) => n.worst))].sort((a, b) => a - b);
  console.log(`    cells observed: ${seen.length ? seen.join(' · ') : '(none)'} rows on the WORST candidate of the picker.`);
  if (seen.length < 2) console.log('    ONLY ONE CELL. A population with no cell either side of its own boundary cannot tell you the boundary is wrong — read the 2 below as unsampled.');

  console.log('\n  WIDTH SWEEP — where it breaks, if it breaks (rule: flat):');
  console.log('    width  h-bleed  escaped  text column  note lines  head lines  li lines');
  for (const s of sweep) {
    if (s.err) { console.log(`    ${String(s.w).padStart(5)}  ERR ${s.err}`); continue; }
    console.log(`    ${String(s.w).padStart(5)}  ${String(s.bleed).padStart(7)}  ${String(s.escaped).padStart(7)}  ${String(s.column == null ? 'n/a' : s.column + 'px').padStart(11)}  ${String(s.noteLines).padStart(10)}  ${String(s.headLines).padStart(10)}  ${String(s.liLines).padStart(8)}`);
  }

  // ---- the vocabulary census ------------------------------------------------
  console.log('\nVOCABULARY CENSUS — could a player have met this word before this sentence hands it to them?');
  for (const word of ['gear', 'flat']) console.log(`  ${vocabLine(word)}`);
  console.log('  Counted over player-facing prose only: src/ui/**.js string literals outside comments, plus content/source/*.csv blurbs.');
  console.log('  A count is not a ruling. The ruling is in gamedesign/sunna/log/2026/ and it is a person\'s.');

  console.log('\nBOUNDARY  source tree over http, one Linux box, one Chromium, two shapes photographed + 7 swept.');
  console.log('          Silent about: dist/AshenSpire.html, every other picker, every shape not listed,');
  console.log('          and whether the SENTENCE reads — that is a person\'s ruling, not this exit code.');

  if (findings.length) {
    console.log(`\nFAIL ${findings.length} finding(s):`);
    for (const f of findings) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log('\nPASS  every asserted boundary held at every shape and every shipped rule.');
  process.exit(0);
}

// MR-80: EVERY INSTRUMENT RESULT CARRIES THE REF IT WAS MEASURED AT, OR IT IS
// NOT A RESULT. Three of this wave's published greens turned out to be branch
// numbers printed as facts about the tree, and this file was one run away from
// being a fourth — it is normally run in a worktree at somebody else's tip. The
// probe talisman lives in `content/source/weapons.csv` for the length of a run,
// so that one path is excluded from the dirty list rather than reported as a
// modification this tool did not make.
function ref() {
  const git = (a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? (r.stdout || '').trim() : null; };
  const head = git(['rev-parse', '--short=7', 'HEAD']);
  if (!head) return 'NOT A GIT TREE — this result names no ref and is not a result (MR-80).';
  const names = (git(['rev-parse', '--abbrev-ref', 'HEAD']) || '?');
  const dirty = (git(['status', '--porcelain']) || '')
    .split('\n').map((l) => l.slice(3)).filter(Boolean)
    .filter((p) => p !== 'content/source/weapons.csv' && !p.startsWith('src/content/generated/') && !p.startsWith('tools/results/'));
  return `${head} (${names})${dirty.length ? `  DIRTY — ${dirty.length} path(s) not in that commit: ${dirty.slice(0, 6).join(', ')}${dirty.length > 6 ? ' …' : ''}. Every number below is about the WORKING TREE, not about ${head}.` : '  clean — the numbers below are about this commit.'}`;
}

// ---------------------------------------------------------------------------
function build() {
  const r = spawnSync('node', [join(ROOT, 'tools', 'content-build.mjs')], { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

function snapshotGenerated() {
  const d = join(ROOT, 'src', 'content', 'generated');
  return existsSync(d) ? readdirSync(d).length : 0;
}

// The census reads the tree, never a list typed here — a sentinel that re-types
// the vocabulary it watches IS the defect (Sten's rule, onevocab.mjs).
function vocabLine(word) {
  const hits = [];
  const re = new RegExp(`\\b${word}\\b`, 'i');
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) { walk(p); continue; }
      if (!/\.(js|csv)$/.test(name.name)) continue;
      const text = readFileSync(p, 'utf8');
      text.split('\n').forEach((line, i) => {
        const code = line.replace(/^\s*\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        if (!code.trim()) return;
        // Only prose a player can see: a quoted string in a UI module, or a
        // CSV blurb column. Identifiers (`gearIgnored`) are not prose.
        const strings = [...code.matchAll(/'([^']{4,})'|"([^"]{4,})"|`([^`]{4,})`/g)].map((mm) => mm[1] || mm[2] || mm[3]);
        const csvProse = /\.csv$/.test(p) ? [...code.matchAll(/"([^"]{6,})"/g)].map((mm) => mm[1]) : [];
        for (const s of [...strings, ...csvProse]) {
          if (re.test(s) && /\s/.test(s)) hits.push(`${p.replace(ROOT + '/', '')}:${i + 1}  "${s.slice(0, 96)}"`);
        }
      });
    }
  };
  walk(join(ROOT, 'src', 'ui'));
  walk(join(ROOT, 'content', 'source'));
  const uniq = [...new Set(hits)];
  return `"${word}" — ${uniq.length} occurrence(s) in player-facing prose:\n` + (uniq.length ? uniq.map((h) => `      ${h}`).join('\n') : '      (none)');
}

// ---------------------------------------------------------------------------
async function cdp(p) {
  let l;
  for (let i = 0; i < 100; i++) {
    try { l = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json(); if (l.length) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
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

// ---------------------------------------------------------------------------
// THE KNOWN-BADS. Each is planted as BYTES in a copy of the real tree, and each
// copy carries the CSV talisman AND the defect, with the real content-build run
// in between — the same discipline Viki's own corpus uses, because a plant that
// skips the compile is a plant that never went through the door.
//
// A corpus nobody has watched go red is unknown, not green (the instrument
// rule, development.md). These were each observed red before this file printed
// a single green.
// ---------------------------------------------------------------------------
const PLANTS = [
  {
    name: 'bands() returns zero — geometry moves while the row camera stays on painted ink',
    file: 'tools/swap-row-reads.mjs',
    find: '    return out.length;',
    replace: '    return 0;',
    expect: /INK LINE BUDGET/,
  },
  {
    name: 'the row crop is reduced to one pixel — positive control proving the camera reading moves',
    file: 'tools/swap-row-reads.mjs',
    find: 'width: Math.max(1, row.w), height: Math.max(1, row.h), scale: 2',
    replace: 'width: 1, height: Math.max(1, row.h), scale: 2',
    expect: /INK LINE BUDGET/,
  },
  {
    name: 'the note keeps geometry but paints in the panel background',
    file: 'styles/ui.css',
    find: '.equip-resource-change small { display: block; }',
    replace: '.equip-resource-change small { display: block; color: #0b0906; }',
    expect: /INK LINE BUDGET/,
  },
  {
    name: 'the note keeps line boxes but visibility suppresses all painted ink',
    file: 'styles/ui.css',
    find: '.equip-resource-change small { display: block; }',
    replace: '.equip-resource-change small { display: block; visibility: hidden; }',
    expect: /INK LINE BUDGET/,
  },
  {
    name: 'the note remains in the DOM but display:none paints and measures nothing',
    file: 'styles/ui.css',
    find: '.equip-resource-change small { display: block; }',
    replace: '.equip-resource-change small { display: none; }',
    expect: /NOTE PAINTS NOTHING/,
  },
  {
    name: 'the comparison stops wrapping — one long note bleeds the column sideways (LAW 5)',
    file: 'styles/ui.css',
    find: '.equip-candidate-comparison { margin-left: 4.5rem; border-left: 2px solid var(--line-soft); padding: 0.25rem 0 0.5rem 0.8rem; overflow-wrap: anywhere; }',
    replace: '.equip-candidate-comparison { margin-left: 4.5rem; border-left: 2px solid var(--line-soft); padding: 0.25rem 0 0.5rem 0.8rem; overflow-wrap: normal; white-space: nowrap; overflow-x: auto; }',
    expect: /LAW 5/,
  },
  {
    name: 'the summary loses its tap floor (LAW 4)',
    file: 'styles/ui.css',
    find: '.equip-candidate-comparison summary { min-height: var(--tap-floor);',
    replace: '.equip-candidate-comparison summary { min-height: 0;',
    expect: /LAW 4/,
  },
  {
    // NOT A LAW BREACH — the note VANISHING. Under `flat` the charm would read a
    // bare `2 → 2` and look broken, which is the exact defect Viki's consult
    // exists to prevent and the one a green must not survive. The tool reports
    // note-lines on every run; this plant drives that column to 0 while rows
    // remain, and the check is that the report SAYS SO. An instrument that
    // cannot see its own subject disappear reports on nothing.
    name: 'the note stops being rendered at all — the declined +2 goes silent again',
    file: 'src/ui/components/equipmentReceipts.js',
    find: '${row.note ? `<small>${esc(row.note)}</small>` : \'\'}',
    replace: '',
    expect: /UNMOVED AND UNEXPLAINED/,
    silentNote: true,
  },
  {
    // THE ONE THIS FILE ALREADY MISSED, and it is not synthetic — it is the
    // change Viki actually wrote, on the instruction Marina and I actually gave:
    // copy `.player-poise-receipt`'s `display: grid`. Its declaration is
    // reproduced here verbatim (ui.css:1844) rather than paraphrased, because
    // the whole lesson is that the DEVICE travelled and the DECLARATION did not:
    // the sibling's children are all elements, this `<li>` starts with a bare
    // text node, and a single-column grid tears "2 →" off "4".
    //
    // IT IS SCORED TWICE ON PURPOSE. The new budget must fire, AND the older
    // adjacency check must be shown SILENT on the same run — because "the
    // adjacency test is insufficient" was a suspicion until a plant printed both
    // answers side by side. A known-bad that only proves the new check works
    // would leave the reason for the new check unmeasured.
    name: "the sibling's declaration copied literally — grid tears the price off its own arrow",
    file: 'styles/ui.css',
    find: '.equip-resource-change small { display: block; }',
    replace: '.equip-resource-change { display: grid; gap: 0.2rem; overflow-wrap: anywhere; }',
    expect: /LINE BUDGET/,
    alsoSilent: { name: 'READS AS ONE WORD (the adjacency check)', re: /READS AS ONE WORD/ },
    site: "This plant's site ARRIVES WITH viki/the-rung-has-no-surface (77e240f). On a tree without that fix "
      + 'there is no `display: block` to replace and the run-on is the tree\'s own state, so this plant has '
      + 'nothing to undo — DRIFT here is the base, not a defect. Scored at 77e240f; see the run beside this file.',
  },
  {
    // THE ROW-COUNT QUESTION ITSELF. If `swapPriceChanges` stops filtering to
    // `swap === 'combat'`, every slot prices — the Armour and Talisman rows come
    // back and "two rows per candidate" becomes four. The reading I am gating is
    // a reading of TWO, so a check blind to the count is a check that would have
    // passed the wall.
    name: 'every slot prices, not only the combat-swappable ones — two rows becomes four',
    file: 'src/model/equipmentPresentation.js',
    find: "    if (slot.swap !== 'combat') continue;",
    replace: '',
    rowsBecome: 4,
  },
];

// THE TREE IS ALREADY RED, AND THAT CHANGES WHAT A PLANT HAS TO PROVE.
// `exit 1` is the state of the UNPLANTED tree today — the run-on and the chip
// overflow both fire on it — so "the planted copy exited 1" proves nothing at
// all. Every plant is therefore scored against a CONTROL: an unplanted copy of
// the same tree, with the same two CSV rows, compiled the same way. A plant
// counts as CAUGHT only when its own sentence appears in the planted run AND is
// ABSENT from the control. Without the control this file would have printed
// three confident greens for three checks that never ran.
function copyTree(dir) {
  cpSync(ROOT, dir, {
    recursive: true,
    // assets/ and music/ are KEPT: a copy with no art boots a different screen,
    // and a plant scored against a different screen is scored against nothing.
    filter: (src) => !/(^|\/)(\.git|node_modules|dist|build)(\/|$)/.test(src.replace(ROOT, ''))
      && !src.replace(ROOT, '').startsWith('/tools/results'),
  });
  const csv = join(dir, 'content', 'source', 'weapons.csv');
  writeFileSync(csv, readFileSync(csv, 'utf8').replace(/\n*$/, '\n') + TALISMAN + '\n' + MAUL + '\n');
  const b = spawnSync('node', [join(dir, 'tools', 'content-build.mjs')], { cwd: dir, encoding: 'utf8' });
  return b.status === 0 ? null : `${b.stdout}${b.stderr}`;
}

function runIn(dir) {
  const r = spawnSync('node', [join(dir, 'tools', 'swap-row-reads.mjs'), '--out', join(dir, 'shots')], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, CHROME: process.env.CHROME || '/usr/bin/chromium' }, timeout: 600000,
  });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// The `flat` row of the REPORTED table: rows, li-lines, head-lines, note-lines.
// FOUR NUMBERS NOW, NOT THREE — and a parser that quietly matched the first
// three of four would have read `head` as `note` and scored every plant against
// the wrong column. It asserts its own arity rather than trusting the shape.
// SCORED AGAINST THE FINDINGS, NEVER AGAINST THE WHOLE PAGE. This matched all of
// stdout until 2026-08-15, and it broke the instant the checks got NAMES: the
// `ASSERTED` legend now PRINTS the words "LINE BUDGET" and "UNMOVED AND
// UNEXPLAINED" on every run, so both new plants scored MISSED with
// `control: ALREADY THERE` — the control's own legend, read as a finding. That
// is the prose-in-the-machine's-eye family again (MR-86), and this instance is
// the tool reading ITS OWN OUTPUT as evidence. Only the `  · ` lines are claims.
const findingsOf = (out) => (out.match(/^  · .*/gm) || []).join('\n');

const flatRow = (out) => {
  const m = /390x844\s+flat\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(out);
  return m ? { rows: +m[1], li: +m[2], head: +m[3], note: +m[4] } : null;
};

async function selftest() {
  console.log('swap-row-reads --selftest — each known-bad planted as BYTES in a copy of the REAL tree,');
  console.log('the two CSV rows authored into the same copy, and the real content-build run in between.');
  console.log('Scored against an UNPLANTED CONTROL, because this tree is already red and exit 1 is free.\n');
  const tmp = mkdtempSync(join(tmpdir(), 'swaprow-'));
  let caught = 0, controlFindings = 0;
  try {
    const cdir = join(tmp, 'control');
    const cerr = copyTree(cdir);
    if (cerr) { console.error(`  the CONTROL copy would not compile:\n${cerr}`); process.exit(2); }
    const control = runIn(cdir);
    const cFlat = flatRow(control.out);
    console.log(`  CONTROL  exit ${control.status} · 390x844/flat reports ${cFlat ? `${cFlat.rows} rows, li ${cFlat.li} = head ${cFlat.head} + note ${cFlat.note}` : 'NO PARSEABLE ROW — the control did not reach the surface, so nothing below is scored'}`);
    if (!cFlat) { console.error('  Refusing to score plants against a control that never measured. Treat as RED.'); process.exit(2); }
    controlFindings = findingsOf(control.out).split('\n').filter(Boolean).length;
    console.log(`  CONTROL findings already present: ${controlFindings}\n`);

    for (const plant of PLANTS) {
      const dir = join(tmp, plant.file.replace(/\W+/g, '_'));
      const err = copyTree(dir);
      if (err) { console.log(`  content-build refused the copy for '${plant.name}':\n${err}`); continue; }
      const p = join(dir, plant.file);
      const before = readFileSync(p, 'utf8');
      if (!before.includes(plant.find)) {
        console.log(`  PLANT SITE DRIFTED  ${plant.name}`);
        console.log(`      '${plant.find.slice(0, 66)}…' is not in ${plant.file}. This plant proves nothing; treat as RED.`);
        if (plant.site) console.log(`      ${plant.site}`);
        continue;
      }
      writeFileSync(p, before.replace(plant.find, plant.replace));
      const r = runIn(dir);
      let red = false, why = '';
      if (plant.expect) {
        const inPlanted = plant.expect.test(findingsOf(r.out));
        const inControl = plant.expect.test(findingsOf(control.out));
        red = inPlanted && !inControl;
        why = `planted:${inPlanted ? 'yes' : 'NO'} control:${inControl ? 'ALREADY THERE' : 'clean'} exit ${r.status}`;
        const f = flatRow(r.out);
        if (f) why += ` · table rows ${f.rows}, li ${f.li} = head ${f.head} + note ${f.note} (control li ${cFlat.li} = head ${cFlat.head} + note ${cFlat.note})`;
        // THE OTHER CHECK'S ANSWER, ON THE SAME RUN. Printed whether it helps me
        // or not: this is the only place the insufficiency of the adjacency test
        // is a measurement rather than a claim in a commit message.
        if (plant.alsoSilent) {
          const heard = plant.alsoSilent.re.test(findingsOf(r.out));
          why += `\n      ALSO ON THIS RUN: ${plant.alsoSilent.name} is ${heard ? 'ALSO RED — it can see this one after all' : 'SILENT — it cannot see this defect, which is why the check above exists'}.`;
        }
      } else if (plant.silentNote) {
        const f = flatRow(r.out);
        red = !!f && f.rows > 0 && f.note === 0 && cFlat.note > 0;
        why = f ? `rows ${f.rows}, note-lines ${f.note} (control ${cFlat.note})` : 'no report row parsed';
      } else if (plant.rowsBecome) {
        const f = flatRow(r.out);
        red = !!f && f.rows === plant.rowsBecome && cFlat.rows !== plant.rowsBecome;
        why = f ? `rows ${f.rows} (control ${cFlat.rows}, expected ${plant.rowsBecome})` : 'no report row parsed';
      }
      console.log(`  ${red ? 'CAUGHT ' : 'MISSED '} ${plant.name}\n      ${why}`);
      if (red) caught++;
    }
  } finally { try { rmSync(tmp, { recursive: true, force: true }); } catch {} }
  console.log(`\n  ${caught}/${PLANTS.length} CAUGHT.`);
  // COUNTED, NOT TYPED. This line said "four defects" and "the two findings the
  // control already carries" while the file held five plants and the control
  // carried six — a boundary statement that had quietly stopped describing its
  // own run. A hand-typed count beside a machine-counted one is Law 1 clause 2
  // inside an instrument's own boundary.
  console.log(`  BOUNDARY: ${PLANTS.length} defect(s) on one surface, each scored against an unplanted control,`);
  console.log(`  and each scored on the FINDINGS only — never on this tool's own legend, which now names its checks.`);
  console.log(`  Silent about every defect nobody thought to plant, and about the ${controlFindings} finding(s) the`);
  console.log('  control already carries — those are OBSERVED on the real tree and need no plant.');
  process.exit(caught === PLANTS.length ? 0 : 1);
}

if (SELFTEST) await selftest(); else await main();
