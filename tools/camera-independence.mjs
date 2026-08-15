#!/usr/bin/env node
// tools/camera-independence.mjs — Vira, 2026-08-15.
//
// THE GATE ON `linebudget-camera.mjs`, AND IT IS ONE CLAIM.
// Bjorn's camera and Sunna's `bands()` agree at 12 of 12 cells on the landed
// tree. Marina's ruling (MR-102) rests the whole value of that agreement on one
// sentence in his header:
//
//     "they share no code path below the DOM — a defect in `bands()` cannot
//      reach the second reading."
//
// TWO INSTRUMENTS AGREEING IS WORTH NOTHING IF THEY AGREE BECAUSE THEY ARE THE
// SAME INSTRUMENT WEARING TWO COATS. Reading the two files says they are not.
// Reading is not observing (*The instrument rule*), so this file breaks
// `bands()` and watches what the camera does.
//
// THE DOOR. Every variant below is a one-edit change to the SOURCE TEXT OF
// `bands()` ITSELF, inside the `MEASURE` probe of `linebudget-camera.mjs` —
// the site where a real `bands()` defect lives and the site where the two that
// happened on 2026-08-15 did live. Nothing is handed to a function; his tool is
// run unmodified in every other byte, over http, through Chromium, and THE
// NUMBERS COMPARED HERE ARE THE ONES HIS OWN TABLE PRINTS. This file
// re-implements no reading of its own — a gate that re-derives what it gates is
// gating its own arithmetic.
//
// THE VERDICT IT CAN RETURN.
//   INDEPENDENT — every `bands()` variant moves the left-hand column and leaves
//     the CAMERA column bit-identical at every cell, AND the positive control
//     below moved it. Both edges.
//   COUPLED     — some `bands()` variant moved the camera. The 12-of-12 is two
//     coats on one instrument and MR-102's PASS does not stand.
//
// AND THE HALF THAT MAKES THE FIRST VERDICT MEAN ANYTHING — `crop-half`.
// "The camera did not move" and "this harness never re-measured the camera"
// print the same table. So one variant does NOT touch `bands()`: it halves the
// crop rectangle. The camera MUST move there. If it does not, this file has
// measured nothing and says so instead of reporting independence — an empty
// result is not a zero.
//
// WHAT `crop-half` ALSO SHOWS, AND IT IS A FINDING RATHER THAN A CONTROL: the
// crop comes from `li.getBoundingClientRect()`. The camera does not photograph
// the screen, it photographs THE BOX LAYOUT REPORTED. So the two oracles share
// no code and DO share one input. Independent of `bands()` is not independent
// of layout, and only the first is what the 12-of-12 buys.
//
// AND IT CARRIES THE INK CARD'S TEETH — `--watch`, and it needs no browser.
// MR-102 requires the card that DELETES `linebudget-camera.mjs` to open in the
// same act that lands it, because "an interim with a removal condition and no
// card is a permanent tool with a polite sentence on it." A card in a doc is
// decoration (SOP 3). So the removal condition is an OBSERVABLE PREDICATE here
// instead, and it goes RED when the premise dies — Freja's wake condition
// applied to an interim rather than to a refusal. The refusing half ("do not
// delete yet") is the easy half and is always green; the premise is the half
// that moves, and nothing was watching it.
//
//   node tools/camera-independence.mjs           the watch, then all variants
//   node tools/camera-independence.mjs --quick   the watch, then the two that carry the verdict
//   node tools/camera-independence.mjs --watch   the removal watch alone, no browser
//   node tools/camera-independence.mjs --selftest the watch's own red, on a planted premise-death
//
// EXIT 1 when any `bands()` variant moves the camera, when the positive control
// does NOT move it, when a variant fails to move `bands()` at all (a plant that
// did not arm proves nothing), or when a run cannot be read. `unknown` is never
// green.
//
// BOUNDARY: this gates ONE sentence about ONE pair of readings, on the control
// cells only — source tree over http, one Linux box, one Chromium, the same
// two shapes and three rules his file walks. It is silent about his plants,
// about his ink floor, about whether his crops are the right crops, and about
// every other instrument in this tree. It tests INDEPENDENCE, never accuracy:
// two readings can be independent and both wrong.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted with `linebudget-camera.mjs`
// — the day `swap-row-reads.mjs` counts ink itself there is one instrument and
// no independence to gate. It has no life of its own.

import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const CAMERA = join(ROOT, 'tools', 'linebudget-camera.mjs');
const SWAPROW = join(ROOT, 'tools', 'swap-row-reads.mjs');
const QUICK = process.argv.includes('--quick');
const WATCH_ONLY = process.argv.includes('--watch');
const SELFTEST = process.argv.includes('--selftest');

// ---------------------------------------------------------------------------
// THE REMOVAL WATCH — the ink card, as a predicate instead of a sentence.
//
// THE PREMISE, NAMED AS AN OBSERVABLE: `swap-row-reads.mjs` does not read
// pixels. THE PROXY, and it is structural rather than a word-match: you cannot
// count ink without DECODING an image, so the predicate is whether that file
// pulls in a decode. A grep for the word "ink" would match a comment, and this
// house has been bitten by a grep matching a declaration instead of an
// application twice this month.
//
// MY FIRST PREDICATE WAS WRONG AND THE SELFTEST BELOW CAUGHT IT, which is the
// only reason it is not still in here. I listed `captureScreenshot` as a marker
// — and `swap-row-reads.mjs` ALREADY CALLS IT FOUR TIMES. It photographs every
// surface it measures and writes the PNG straight to disk without ever looking
// at it: `writeFileSync(f, Buffer.from(png.data, 'base64'))`, four sites. So the
// watch was RED on the day it was written, for a premise that is alive. CAPTURE
// IS NOT READING, and conflating them is the same error one level down that
// MR-103 names one level up — a claim about an artifact read as a claim about
// what somebody looked at.
//
// THAT MISS IS ALSO THE MOST USEFUL THING THIS WATCH FOUND: the ink card is
// SMALLER than it sounds. Her harness already has the photograph. What it does
// not have is `decodePng`/`inkBands` — roughly the 75 lines Bjorn already wrote
// and already marked as the copy that is meant to be absorbed.
//
// WHEN THE PREMISE DIES the two gate files are dead weight and this goes RED
// naming them. It does NOT delete anything — a tool that deletes tools on a
// grep is a worse defect than the one it cleans up.
//
// THE CEILING, STATED RATHER THAN ASSERTED AWAY: this is a proxy. A seat could
// count ink by a route that decodes nothing here — reading it out of the page
// in JS, say — and this watch would stay quiet while the premise died. It
// catches the likely spelling, never the class. That is why it prints the
// predicate it used, so a reader can see what it would have missed.
// ---------------------------------------------------------------------------
const INK_MARKERS = ['inflateSync', 'decodePng', 'inkBands', 'node:zlib'];
function removalWatch(swapRowSource) {
  const hits = INK_MARKERS.filter((m) => swapRowSource.includes(m));
  return {
    hits,
    dead: hits.length > 0,
    predicate: `tools/swap-row-reads.mjs contains none of [${INK_MARKERS.join(', ')}]`,
  };
}


// The exact bytes of `bands()`'s return, and of the crop's height field, as they
// stand in his MEASURE probe. Each variant asserts its own anchor is present
// before it edits — a find-and-replace that matched nothing is a plant that
// never armed, and that is the failure this house keeps finding.
const BANDS_RETURN = '    return out.length;\n  };';
const CROP_HEIGHT = 'x: rect.left, y: rect.top, w: rect.width, h: rect.height,';

const VARIANTS = [
  {
    tag: 'bands-drop-one',
    touches: 'bands()',
    find: BANDS_RETURN,
    with: '    return out.length <= 1 ? out.length : out.length - 1;\n  };',
    why: "THE NAMED SHAPE, PUT IN THE PRIMITIVE INSTEAD OF IN THE CSS. `bands()` loses one band whenever it "
      + 'finds more than one, so the note falls 2 -> 1 and the row falls 3 -> 2 while the head stays 1. '
      + 'li 2 = head 1 + note 1 — THE EQUATION IS GREEN AND THE COUNT IS WRONG. This is Bjorn\'s line-height '
      + '0.4 cell with the defect moved into the function he says the camera cannot see.',
    quick: true,
  },
  {
    tag: 'bands-plus-one',
    touches: 'bands()',
    find: BANDS_RETURN,
    with: '    return out.length + 1;\n  };',
    why: 'the crudest possible defect — every count off by one, on both sides at once.',
  },
  {
    tag: 'bands-zero',
    touches: 'bands()',
    find: BANDS_RETURN,
    with: '    return 0;\n  };',
    why: 'the primitive stops reading entirely. If the camera can follow `bands()` anywhere, it follows it here.',
  },
  {
    tag: 'crop-half',
    touches: 'the crop rectangle',
    find: CROP_HEIGHT,
    with: 'x: rect.left, y: rect.top, w: rect.width, h: rect.height / 2,',
    why: 'POSITIVE CONTROL — `bands()` untouched, the PHOTOGRAPH halved. The camera must move here or this '
      + 'file has watched nothing. It is also the finding: the crop is a layout read, so the two oracles '
      + 'share no code and do share the element box.',
    mustMove: true,
    quick: true,
  },
];

function refLine() {
  const g = (a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const dirty = g(['status', '--porcelain']).split('\n').map((s) => s.slice(3)).filter(Boolean)
    .filter((f) => !f.startsWith('tools/results/'));
  return `REF    ${g(['rev-parse', '--short', 'HEAD'])} (${g(['rev-parse', '--abbrev-ref', 'HEAD'])})`
    + (dirty.length ? `  DIRTY — ${dirty.length} path(s): ${dirty.slice(0, 4).join(', ')}. Numbers are about the WORKING TREE.`
      : '  clean — the numbers below are about this commit.');
}

// His table, read back as data. One line per cell:
//   390x844  flat      0   3   1     2     green     3       "Right Hand …"
const ROW = /^ {2}(\S+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(green|RED)\s+(\d+)\s+"/;
function readControl(stdout) {
  const cells = new Map();
  let inTable = false;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('CONTROL')) { inTable = true; continue; }
    if (inTable && line.startsWith('  ink floor')) break;
    if (!inTable) continue;
    if (/\bERR\b/.test(line)) return { err: `a control cell came back ERR — no count is reported:\n    ${line.trim()}` };
    const m = ROW.exec(line);
    if (m) cells.set(`${m[1]}/${m[2]}/row${m[3]}`, { li: +m[4], head: +m[5], note: +m[6], eq: m[7], ink: +m[8] });
  }
  if (!cells.size) return { err: 'his control table parsed to zero cells — an empty read is not an agreement' };
  return { cells };
}

function runCamera(source, tag) {
  const tmp = join(ROOT, 'tools', `.independence-${tag}.mjs`);
  writeFileSync(tmp, source);
  try {
    const out = execFileSync('node', [tmp], { cwd: ROOT, encoding: 'utf8', timeout: 600000, stdio: ['ignore', 'pipe', 'pipe'] });
    return { out };
  } catch (e) {
    // exit 1 is a legitimate outcome for his tool; only a crash is unreadable.
    if (e.stdout && /CONTROL/.test(e.stdout)) return { out: e.stdout };
    return { err: `the camera would not run under ${tag}: ${(e.stderr || e.message || '').slice(0, 400)}` };
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

console.log(`\n${refLine()}`);

// ---- THE REMOVAL WATCH, first, because it is the cheap half -----------------
{
  const w = removalWatch(readFileSync(SWAPROW, 'utf8'));
  console.log(`WATCH  the ink card (MR-102). Premise: ${w.predicate}`);
  if (w.dead) {
    console.log('       PREMISE DEAD — swap-row-reads.mjs now reads pixels '
      + `(found: ${w.hits.join(', ')}).`);
    console.log('       tools/linebudget-camera.mjs and tools/camera-independence.mjs have both reached');
    console.log('       their stated removal condition and are to be DELETED, not maintained.');
    if (!SELFTEST) process.exit(1);
  } else {
    console.log('       premise alive — the interim is still doing work no other instrument does.');
    console.log('       Proxy, not proof: a route that counts ink without decoding here would not trip this.');
  }
  if (WATCH_ONLY) process.exit(w.dead ? 1 : 0);
}

// ---- THE WATCH'S OWN RED, through the door the real death enters by ---------
// Freja's clause 3: a wake red counts only once it has been watched red on a
// PLANTED premise-death, same door. The real death is an edit to
// swap-row-reads.mjs that starts decoding pixels, so that is what is planted —
// in memory, on a copy, because a gate that edits the file it watches is a
// worse instrument than no gate.
if (SELFTEST) {
  const live = removalWatch(readFileSync(SWAPROW, 'utf8'));
  const planted = removalWatch(
    readFileSync(SWAPROW, 'utf8').replace(
      "import { spawn", "import { inflateSync } from 'node:zlib';\nimport { spawn",
    ),
  );
  console.log('\nSELFTEST  the watch, on the real file and on a planted premise-death.');
  console.log(`  as it stands        → ${live.dead ? 'RED' : 'green'}  (expected green — the premise is alive)`);
  console.log(`  + a PNG decode      → ${planted.dead ? 'RED' : 'green'}  (expected RED — the premise died)`);
  const ok = !live.dead && planted.dead;
  console.log(ok
    ? '\nPASS — the watch has been observed BOTH ways. Its green means something.'
    : '\nFAIL — the watch did not move. An unwatched wake condition is decoration.');
  process.exit(ok ? 0 : 1);
}

// HIS FILE IS HIS LANE AND IS NOT CARRIED ON THIS BRANCH. This gate is useless
// without it and says so rather than throwing a stack trace at a reader.
if (!existsSync(CAMERA)) {
  console.error(`\ncamera-independence: tools/linebudget-camera.mjs is not in this tree.\n`
    + `  It lands on bjorn/gate-line-budget (1d07dfc) as its own lane — this gate does not carry\n`
    + `  another seat's file. Put it here and re-run:\n\n`
    + `    git checkout bjorn/gate-line-budget -- tools/linebudget-camera.mjs\n\n`
    + `  Unknown, not green: nothing has been gated.`);
  process.exit(2);
}
const base = readFileSync(CAMERA, 'utf8');
// The tmp copy must not photograph into his committed results directory.
const redirect = (s) => s.replace(
  "args[oi + 1] ? args[oi + 1] : 'tools/results/linebudget-camera'",
  "args[oi + 1] ? args[oi + 1] : 'tools/results/camera-independence'",
);

console.log('GATE   the claim under test: a defect in `bands()` cannot reach the camera reading.');
console.log('DOOR   every variant edits the source text of the primitive inside linebudget-camera.mjs\'s own');
console.log('       MEASURE probe, then runs HIS tool unmodified. The numbers are the ones his table prints.\n');

const findings = [];
const control = readControl((runCamera(redirect(base), 'control').out) || '');
if (control.err) {
  console.error(`camera-independence: the CONTROL run is unreadable — ${control.err}`);
  process.exit(2);
}
console.log(`CONTROL  ${control.cells.size} cells at this ref. bands() and camera agree at `
  + `${[...control.cells.values()].filter((c) => c.li === c.ink).length} of ${control.cells.size}.`);
console.log(`         distinct (li, ink) readings across those cells: `
  + `${[...new Set([...control.cells.values()].map((c) => `${c.li}/${c.ink}`))].join(', ')}`
  + '  ← the agreement is replicated, not varied. Sample size is the number of DISTINCT readings.\n');

for (const v of VARIANTS) {
  if (QUICK && !v.quick) continue;
  if (!base.includes(v.find)) {
    findings.push(`${v.tag}: THE PLANT DID NOT ARM — its anchor is not in ${CAMERA}. A find-and-replace that `
      + 'matched nothing proves nothing, and his file has moved under this gate.');
    console.log(`  ${v.tag.padEnd(16)} → PLANT DID NOT ARM (anchor absent)`);
    continue;
  }
  const r = runCamera(redirect(base.replace(v.find, v.with)), v.tag);
  if (r.err) { findings.push(`${v.tag}: ${r.err}`); console.log(`  ${v.tag.padEnd(16)} → ERR`); continue; }
  const got = readControl(r.out);
  if (got.err) { findings.push(`${v.tag}: ${got.err}`); console.log(`  ${v.tag.padEnd(16)} → ERR ${got.err}`); continue; }

  const movedBands = [], movedInk = [], missing = [];
  for (const [k, c] of control.cells) {
    const g = got.cells.get(k);
    if (!g) { missing.push(k); continue; }
    if (g.li !== c.li || g.head !== c.head || g.note !== c.note) movedBands.push(`${k} li ${c.li}→${g.li} head ${c.head}→${g.head} note ${c.note}→${g.note}`);
    if (g.ink !== c.ink) movedInk.push(`${k} ink ${c.ink}→${g.ink}`);
  }
  const verdict = missing.length ? 'ERR — cells vanished'
    : v.mustMove ? (movedInk.length ? 'CONTROL LIVE — the camera moved' : 'CONTROL DEAD — the camera did not move')
      : movedInk.length ? 'COUPLED — the camera followed bands()'
        : movedBands.length ? 'INDEPENDENT — bands() moved, the camera did not'
          : 'INERT — bands() did not move either';

  console.log(`  ${v.tag.padEnd(16)} → ${verdict}`);
  console.log(`    touches ${v.touches}. ${v.why}`);
  console.log(`    bands() moved at ${movedBands.length}/${control.cells.size} cells · camera moved at ${movedInk.length}/${control.cells.size}`);
  for (const s of movedBands.slice(0, 2)) console.log(`      ${s}`);
  if (movedInk.length) for (const s of movedInk.slice(0, 2)) console.log(`      ${s}`);
  // The one that matters most: green equation, wrong count, camera still right.
  const hidden = [...got.cells].filter(([k, g]) => g.eq === 'green' && g.ink !== g.li);
  if (hidden.length && v.touches === 'bands()') {
    console.log(`    AND THE EQUATION STAYED GREEN AT ${hidden.length} OF THEM while the camera disagreed — `
      + `e.g. ${hidden[0][0]}: li ${hidden[0][1].li} = head ${hidden[0][1].head} + note ${hidden[0][1].note}, camera ${hidden[0][1].ink}.`);
  }

  if (missing.length) findings.push(`${v.tag}: ${missing.length} cell(s) present in the control did not come back — unknown, not green.`);
  else if (v.mustMove && !movedInk.length) {
    findings.push(`${v.tag}: THE POSITIVE CONTROL IS DEAD. The crop was halved and the camera reported the same `
      + 'ink at every cell. This gate cannot observe the camera moving, so its "INDEPENDENT" verdicts on the '
      + 'other variants measured nothing.');
  } else if (!v.mustMove && movedInk.length) {
    findings.push(`${v.tag}: COUPLED — a defect confined to \`bands()\` moved the camera at ${movedInk.length} cell(s): `
      + `${movedInk.slice(0, 3).join('; ')}. The oracles are not independent and the 12-of-12 is one instrument twice.`);
  } else if (!v.mustMove && !movedBands.length) {
    findings.push(`${v.tag}: INERT — the edit landed and \`bands()\` did not move at any cell. The plant did not `
      + 'arm in the sense that matters, so its silence is not evidence of independence.');
  }
}

console.log('\nBOUNDARY  the CONTROL cells only, source tree over http, one Linux box, one Chromium, his two shapes');
console.log('          and three rules. Silent about his plants, his ink floor, his crop choice, and every other');
console.log('          instrument here. It tests INDEPENDENCE, never accuracy — two readings can be independent');
console.log('          and both wrong. It says nothing about doors the real defect uses and neither oracle sees.');

if (findings.length) {
  console.log(`\nFAIL ${findings.length} finding(s):`);
  for (const f of findings) console.log(`  · ${f}`);
  process.exit(1);
}
console.log('\nPASS — every `bands()` variant moved the left-hand reading and left the camera bit-identical,');
console.log('       and the positive control moved the camera. The independence claim is observed, not read.');
process.exit(0);
