#!/usr/bin/env node
// tools/sfx-loudness.mjs — deterministic A-weighted loudness of every SFX
// recipe, computed from the table rather than rendered (#66, Sunna's mix gate).
//
// WHY THIS EXISTS. The render-based probe that found the frost defect
// (gamedesign/sunna/log/2026/probes/sunna-proc-meter2.mjs, family repo) drives
// a real OfflineAudioContext through a headless browser — the truest signal we
// have, and the right instrument to FIND a defect. But its sting is scheduled
// inside a suspend/resume pump, and measured on one unchanged tree it returned
// -37.0, -41.2, -47.0, -49.2 and -999 dBFS for the SAME recipe across runs:
// when the schedule slips, the analysis window catches part of the sting or
// none of it. A miss can only LOSE energy, never add it, so its lows are
// artifacts — but a 12 dB spread cannot support a 0.6 dB claim, and I will not
// tune a mix against a number I cannot reproduce twice.
//
// So this tool computes the same quantity ANALYTICALLY from the recipe rows:
// no browser, no scheduler, no randomness, identical every run. It is less
// true than a render (it models the envelopes rather than observing them) and
// it is exactly reproducible, which is the trade that makes it useful for
// TUNING. Find with the render; tune against this; confirm by ear.
//
//   node tools/sfx-loudness.mjs              every recipe, loudest first
//   node tools/sfx-loudness.mjs --family procBurst   one family, with spread
//   node tools/sfx-loudness.mjs --selftest   known-bad: prove it can go red
//
// THE MODEL, stated so it can be argued with:
//   tone  — energy = peak^2 * (dur/2), A-weighted at the geometric mean of
//           freq and `to` (a glide's perceptual centre is nearer the log
//           midpoint than the arithmetic one). The /2 is the exponential
//           gain envelope's mean-square over its life.
//   noise — energy = peak^2 * (dur/3), spread across hp..lp, A-weighted by
//           integrating the curve over that band in log steps. /3 because
//           noise() sets its peak at onset and decays from there, so its
//           mean-square is lower than a tone that ramps up and back down.
// Both are approximations of the SAME shape for every row, so COMPARISONS
// between rows are the claim; absolute dBFS is not.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day the render probe is
// stable enough to tune against — one instrument beats two, and the render is
// the truer one. Until then this is the only re-runnable number a mix edit can
// be checked against.

import { SFX_RECIPES } from '../src/content/sfx.js';

// A-weighting, IEC 61672.
function aw(f) {
  const f2 = f * f, f4 = f2 * f2;
  const num = 12194 * 12194 * f4;
  const den = (f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194);
  return 20 * Math.log10(num / den) + 2.0;
}
const SAMPLE_RATE = 48000; // the engine's ctx.sampleRate; only the band FRACTION uses it
const gain = (f) => Math.pow(10, aw(f) / 10); // power gain at f

// Mean A-weighted power gain over a band, log-spaced (hearing is log).
function bandGain(lo, hi) {
  let acc = 0, n = 0;
  for (let f = lo; f <= hi; f *= 1.05) { acc += gain(f); n++; }
  return n ? acc / n : gain(Math.sqrt(lo * hi));
}

/** Per-layer A-weighted energy (linear power * seconds). */
export function layerEnergy(layer) {
  if (layer.kind === 'noise') {
    const peak = layer.peak != null ? layer.peak : 0.5;
    const lo = Math.min(layer.hp != null ? layer.hp : 400, layer.lp != null ? layer.lp : 6000);
    const hi = Math.max(layer.hp != null ? layer.hp : 400, layer.lp != null ? layer.lp : 6000);
    // THE BAND FRACTION, and my first version omitted it — which inverted the
    // answer. noise() builds a BROADBAND buffer at `peak` and then band-passes
    // it, so the filter KEEPS only the share of a flat spectrum lying between
    // hp and lp; it does not move the whole peak into the band. Without this
    // factor a thin, bright band scored as if all its energy survived, and
    // this tool called frost the LOUDEST while the render called it the
    // quietest. The render was right and my model was wrong. First order:
    // the band's share of Nyquist.
    const passed = Math.min(1, (hi - lo) / (SAMPLE_RATE / 2));
    return peak * peak * (layer.dur / 3) * bandGain(lo, hi) * passed;
  }
  const peak = layer.peak != null ? layer.peak : 0.6;
  const f0 = layer.freq;
  const f1 = layer.to != null ? layer.to : layer.freq;
  const fc = Math.sqrt(Math.max(1, f0) * Math.max(1, f1)); // log midpoint of the glide
  return peak * peak * (layer.dur / 2) * gain(fc);
}

/** Recipe → { dbA, layers, centroid } — centroid is the A-weighted energy centre. */
export function recipeLoudness(recipe) {
  let e = 0, wf = 0;
  for (const l of recipe) {
    const le = layerEnergy(l);
    e += le;
    const f = l.kind === 'noise'
      ? Math.sqrt(Math.max(1, l.hp != null ? l.hp : 400) * Math.max(1, l.lp != null ? l.lp : 6000))
      : Math.sqrt(Math.max(1, l.freq) * Math.max(1, l.to != null ? l.to : l.freq));
    wf += le * Math.log(f);
  }
  return {
    dbA: e > 0 ? 10 * Math.log10(e) : -999,
    layers: recipe.length,
    centroid: e > 0 ? Math.round(Math.exp(wf / e)) : 0,
  };
}

const r1 = (v) => Math.round(v * 10) / 10;

if (process.argv.includes('--selftest')) {
  // The instrument must go red on a known-bad: a recipe made 20 dB quieter
  // MUST measure quieter, and a sub-bass-only sting MUST measure below a
  // bright one of the same raw amplitude — the exact failure (raw energy level,
  // heard level collapsed) this tool exists to see.
  const loud = recipeLoudness([{ kind: 'tone', freq: 1000, dur: 0.3, peak: 0.5 }]);
  const quiet = recipeLoudness([{ kind: 'tone', freq: 1000, dur: 0.3, peak: 0.05 }]);
  const bright = recipeLoudness([{ kind: 'tone', freq: 3000, dur: 0.3, peak: 0.4 }]);
  const subby = recipeLoudness([{ kind: 'tone', freq: 90, dur: 0.3, peak: 0.4 }]);
  const checks = [
    [quiet.dbA < loud.dbA - 15, `a 20 dB amplitude cut must read quieter (${r1(quiet.dbA)} vs ${r1(loud.dbA)})`],
    [subby.dbA < bright.dbA - 10, `same amplitude at 90 Hz must read far quieter than at 3 kHz (${r1(subby.dbA)} vs ${r1(bright.dbA)}) — the A-weighting is doing its job`],
    [recipeLoudness([{ kind: 'noise', dur: 0.3, peak: 0.4, hp: 2600, lp: 9000 }]).dbA
      > recipeLoudness([{ kind: 'noise', dur: 0.3, peak: 0.4, hp: 60, lp: 150 }]).dbA + 10, 'high-band noise must read louder than sub-bass noise at equal peak'],
  ];
  let bad = 0;
  for (const [ok, msg] of checks) { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) bad++; }
  console.log(bad ? `\nRESULT: sfx-loudness selftest FAILED (${bad}) — the instrument cannot be trusted either way.`
    : '\nRESULT: sfx-loudness selftest held — amplitude, register and band all move the number in the right direction.');
  process.exit(bad ? 1 : 0);
}

const famArg = process.argv.indexOf('--family');
const family = famArg > -1 ? process.argv[famArg + 1] : null;
const ids = Object.keys(SFX_RECIPES).filter((id) => !family || id === family || id.startsWith(`${family}_`));
const rows = ids.map((id) => ({ id, ...recipeLoudness(SFX_RECIPES[id]) })).sort((a, b) => b.dbA - a.dbA);

console.log('id                        dBA   centroid  layers');
for (const r of rows) {
  console.log(`  ${r.id.padEnd(22)} ${String(r1(r.dbA)).padStart(6)}  ${String(r.centroid).padStart(7)} Hz ${String(r.layers).padStart(5)}`);
}
if (family && rows.length > 1) {
  const spread = rows[0].dbA - rows[rows.length - 1].dbA;
  console.log(`\nRESULT: family '${family}' — ${rows.length} rows, spread ${r1(spread)} dBA ` +
    `(${rows[0].id} loudest, ${rows[rows.length - 1].id} quietest), centroids ` +
    `${rows.map((r) => r.centroid).join('/')} Hz. ` +
    `A sibling more than ~6 dBA off its family reads as the quiet one or the loud one before it reads as itself.`);
} else {
  console.log(`\nRESULT: ${rows.length} recipes measured (analytic A-weighted; comparisons are the claim, absolute dBFS is not).`);
}
