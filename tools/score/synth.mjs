// tools/score/synth.mjs — the offline orchestra the shipped score is rendered on.
//
// The game's recorded music is not licensed or sampled: it is written as data
// in music/score/*.mjs and rendered here, in plain JavaScript, into stereo PCM.
// Nothing in this file is heard in the browser; tools/score/render.mjs turns a
// score into music/<context>/*.mp3 and those files ship (music/README.md).
//
// Every instrument is synthesized from first principles (additive wavetables,
// filtered saws, Karplus-Strong, inharmonic partials, noise), so there are no
// samples and no soundfont to credit. Rendering is deterministic: the only
// randomness is a seeded generator, so the same score renders the same bytes.

export const SR = 48000;

// ---- small utilities --------------------------------------------------------

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function envADSR(n, i, a, d, s, r, len) {
  // len = samples of the held portion; release follows it.
  if (i < a) return i / a;
  if (i < a + d) return 1 - (1 - s) * ((i - a) / d);
  if (i < len) return s;
  const k = (i - len) / r;
  return k >= 1 ? 0 : s * (1 - k) * (1 - k);
}

// One cycle of a waveform built from harmonic amplitudes, for fast playback.
const TABLE = 4096;
const tableCache = new Map();
function table(key, amps) {
  if (tableCache.has(key)) return tableCache.get(key);
  const t = new Float32Array(TABLE + 1);
  for (let h = 0; h < amps.length; h++) {
    const a = amps[h];
    if (!a) continue;
    for (let i = 0; i <= TABLE; i++) t[i] += a * Math.sin((2 * Math.PI * (h + 1) * i) / TABLE);
  }
  let peak = 0;
  for (let i = 0; i <= TABLE; i++) peak = Math.max(peak, Math.abs(t[i]));
  for (let i = 0; i <= TABLE; i++) t[i] /= peak || 1;
  tableCache.set(key, t);
  return t;
}
// A band-limited single cycle of a basic waveform at frequency f (harmonics
// kept below 20 kHz), cached by wave and harmonic count.
function bandlimited(wave, f) {
  const nh = Math.max(1, Math.min(400, Math.floor(20000 / f)));
  const key = `bl:${wave}:${nh}`;
  if (tableCache.has(key)) return tableCache.get(key);
  const amps = [];
  for (let h = 1; h <= nh; h++) {
    if (wave === 'sine') amps.push(h === 1 ? 1 : 0);
    else if (wave === 'sawtooth') amps.push(1 / h);
    else if (wave === 'square') amps.push(h % 2 ? 1 / h : 0);
    else amps.push(h % 2 ? ((h - 1) / 2 % 2 ? -1 : 1) / (h * h) : 0); // triangle
  }
  return table(key, amps);
}
function readTable(t, phase) {
  const x = phase * TABLE;
  const i = x | 0;
  const f = x - i;
  return t[i] + (t[i + 1] - t[i]) * f;
}

// Vowel formants for the wordless choir ("ah", "oo").
const VOWELS = {
  ah: [[700, 110, 1], [1220, 120, 0.5], [2600, 160, 0.25]],
  oo: [[300, 70, 1], [870, 90, 0.35], [2240, 140, 0.1]],
  mm: [[250, 60, 1], [1100, 200, 0.12], [2500, 200, 0.05]],
};
function formantAmps(f0, vowel) {
  const amps = [];
  const nh = Math.min(48, Math.floor(9000 / f0));
  for (let h = 1; h <= nh; h++) {
    const fh = f0 * h;
    let a = 0;
    for (const [fc, bw, g] of VOWELS[vowel]) a += g * Math.exp(-(((fh - fc) / bw) ** 2) / 2);
    amps.push(a / Math.sqrt(h) + 0.002 / h);
  }
  return amps;
}

// One-pole lowpass state helper.
function lp1(cut) { return 1 - Math.exp((-2 * Math.PI * cut) / SR); }

// In-place RBJ biquad: 'lp' | 'hp' | 'peak' (db gain) at fc Hz, quality q.
function biquad(x, type, fc, q, db = 0) {
  const w = (2 * Math.PI * fc) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q), A = 10 ** (db / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
}

// ---- instruments -------------------------------------------------------------
//
// Each writes one note into (L, R) starting at sample `at`. `n` is the note:
// { midi, dur (seconds held), vel (0–1), pan (-1..1) } plus instrument options.

function place(L, R, at, sig, pan, gain) {
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  const end = Math.min(L.length, at + sig.length);
  for (let i = Math.max(0, at), j = i - at; i < end; i++, j++) { L[i] += sig[j] * gl; R[i] += sig[j] * gr; }
}

function sawVoices(n, rand, { detune = 0.12, voices = 3, cut = 1800, a = 1.2, d = 0.5, s = 0.85, r = 2.2, vib = 0 }) {
  const held = Math.round(n.dur * SR);
  const len = held + Math.round(r * SR);
  const out = new Float32Array(len);
  const f = mtof(n.midi);
  let s1 = 0, s2 = 0;
  const k = lp1(cut);
  const phases = Array.from({ length: voices }, () => rand());
  const ratios = Array.from({ length: voices }, (_, v) => 2 ** (((v - (voices - 1) / 2) * detune) / 12));
  const A = Math.round(a * SR), D = Math.round(d * SR), Rr = Math.round(r * SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const vibr = vib ? 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t / 0.6) : 1;
    let x = 0;
    for (let v = 0; v < voices; v++) {
      phases[v] += (f * ratios[v] * vibr) / SR;
      phases[v] -= Math.floor(phases[v]);
      x += 2 * phases[v] - 1;
    }
    x /= voices;
    s1 += k * (x - s1); s2 += k * (s1 - s2);
    out[i] = s2 * envADSR(0, i, A, D, s, Rr, held);
  }
  return out;
}

function tableVoice(n, rand, t, { a = 0.8, d = 0.3, s = 0.9, r = 1.6, chorus = 3, spread = 0.08, vib = 0.003 }) {
  const held = Math.round(n.dur * SR);
  const len = held + Math.round(r * SR);
  const out = new Float32Array(len);
  const f = mtof(n.midi);
  const A = Math.round(a * SR), D = Math.round(d * SR), Rr = Math.round(r * SR);
  const ph = Array.from({ length: chorus }, () => rand());
  const rt = Array.from({ length: chorus }, (_, v) => 2 ** (((v - (chorus - 1) / 2) * spread) / 12));
  const vr = Array.from({ length: chorus }, () => 4.5 + rand() * 1.5);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let x = 0;
    for (let v = 0; v < chorus; v++) {
      ph[v] += (f * rt[v] * (1 + vib * Math.sin(2 * Math.PI * vr[v] * tt + v))) / SR;
      ph[v] -= Math.floor(ph[v]);
      x += readTable(t, ph[v]);
    }
    out[i] = (x / chorus) * envADSR(0, i, A, D, s, Rr, held);
  }
  return out;
}

const INSTRUMENTS = {
  // Low string section: detuned saws through a soft lowpass, slow bow.
  strings(n, rand, o) { return sawVoices(n, rand, { detune: 0.14, voices: 4, cut: o.cut ?? 1400, a: o.a ?? 1.4, r: o.r ?? 2.4, vib: 1 }); },
  // Solo cello: one bright saw, singing vibrato, faster bow.
  cello(n, rand, o) { return sawVoices(n, rand, { detune: 0.03, voices: 2, cut: o.cut ?? 1100, a: o.a ?? 0.35, d: 0.3, s: 0.8, r: o.r ?? 1.2, vib: 1 }); },
  // Wordless choir: formant-shaped additive voices, several singers per part.
  choir(n, rand, o) {
    const f0 = mtof(n.midi);
    const vowel = o.vowel ?? 'ah';
    const t = table(`choir:${vowel}:${Math.round(f0)}`, formantAmps(f0, vowel));
    return tableVoice(n, rand, t, { a: o.a ?? 1.6, r: o.r ?? 2.5, chorus: 4, spread: 0.1, vib: 0.004 });
  },
  // Church organ: drawbar additive, slow wind, no vibrato.
  organ(n, rand, o) {
    const t = table(`organ:${o.stop ?? 'soft'}`, o.stop === 'full' ? [1, 0.8, 0.6, 0.5, 0, 0.35, 0, 0.3] : [1, 0.45, 0.2, 0.12, 0, 0.05]);
    return tableVoice(n, rand, t, { a: o.a ?? 0.6, r: o.r ?? 1.2, chorus: 2, spread: 0.04, vib: 0 });
  },
  // Harp: Karplus-Strong plucked string.
  harp(n, rand, o) {
    const f = mtof(n.midi);
    const period = Math.max(2, Math.round(SR / f));
    const len = Math.round((o.ring ?? 3.5) * SR);
    const out = new Float32Array(len);
    const buf = new Float32Array(period);
    for (let i = 0; i < period; i++) buf[i] = rand() * 2 - 1;
    let prev = 0;
    const damp = o.damp ?? 0.996;
    for (let i = 0; i < len; i++) {
      const j = i % period;
      const cur = buf[j];
      buf[j] = damp * 0.5 * (cur + prev);
      prev = cur;
      out[i] = cur * Math.min(1, i / 40);
    }
    let s = 0; const k = lp1(3500);
    for (let i = 0; i < len; i++) { s += k * (out[i] - s); out[i] = s; }
    return out;
  },
  // Bell: inharmonic partials with long, staggered decays.
  bell(n, rand, o) {
    const f = mtof(n.midi);
    const parts = [[0.5, 1, 6], [1, 0.8, 4.5], [1.19, 0.5, 3], [1.56, 0.4, 2.4], [2, 0.35, 2], [2.51, 0.25, 1.6], [2.66, 0.2, 1.3], [3.01, 0.15, 1.1], [4.1, 0.1, 0.8]];
    const len = Math.round((o.ring ?? 7) * SR);
    const out = new Float32Array(len);
    for (const [ratio, amp, dec] of parts) {
      const w = (2 * Math.PI * f * ratio) / SR;
      const ph = rand() * 6.28;
      const kd = 1 / (dec * (o.ring ?? 7) / 6 * SR);
      for (let i = 0; i < len; i++) out[i] += amp * Math.sin(w * i + ph) * Math.exp(-i * kd * 3);
    }
    for (let i = 0; i < Math.min(len, 96); i++) out[i] *= i / 96;
    return out;
  },
  // Bowed metal: inharmonic cluster that swells and fades, like a bowed plate.
  metal(n, rand, o) {
    const f = mtof(n.midi);
    const held = Math.round(n.dur * SR);
    const len = held + Math.round(3 * SR);
    const out = new Float32Array(len);
    const ratios = [1, 1.414, 2.23, 2.76, 3.9, 5.1];
    for (const r0 of ratios) {
      const w = (2 * Math.PI * f * r0 * (1 + (rand() - 0.5) * 0.004)) / SR;
      const amp = 1 / r0;
      const ph = rand() * 6.28;
      const wob = 0.2 + rand() * 0.6;
      for (let i = 0; i < len; i++) out[i] += amp * Math.sin(w * i + ph) * (0.7 + 0.3 * Math.sin((2 * Math.PI * wob * i) / SR));
    }
    const A = Math.round((o.a ?? 2.5) * SR), Rr = Math.round(3 * SR);
    for (let i = 0; i < len; i++) out[i] *= envADSR(0, i, A, 1, 1, Rr, held) * 0.4;
    return out;
  },
  // Low drone: sine plus a filtered saw an octave up, very slow.
  drone(n, rand, o) {
    const s = sawVoices(n, rand, { detune: 0.05, voices: 2, cut: o.cut ?? 380, a: o.a ?? 3, s: 1, r: o.r ?? 4 });
    const f = mtof(n.midi);
    for (let i = 0; i < s.length; i++) s[i] = 0.6 * s[i] + 0.5 * Math.sin((2 * Math.PI * f * i) / SR) * Math.min(1, i / (3 * SR)) * Math.min(1, (s.length - i) / (4 * SR));
    return s;
  },
  // Taiko: pitch-dropping body plus a noise skin. `midi` sets the body pitch.
  taiko(n, rand, o) {
    const f0 = mtof(n.midi);
    const len = Math.round((o.ring ?? 1.2) * SR);
    const out = new Float32Array(len);
    let ph = 0, nz = 0;
    const kn = lp1(o.skin ?? 900);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const f = f0 * (1 + 1.6 * Math.exp(-t * 28));
      ph += (2 * Math.PI * f) / SR;
      nz += kn * ((rand() * 2 - 1) - nz);
      out[i] = (Math.sin(ph) * Math.exp(-t * (o.decay ?? 5)) + nz * 1.5 * Math.exp(-t * 30)) * Math.min(1, i / 24);
    }
    return out;
  },
  // Piano: the voice of the in-game score. The current build's procedural
  // music plays one soft struck note per cadence (src/ui/audio.js
  // playProcedural); this is that note as a piano — a hammered, slightly
  // inharmonic string pair with a fast attack and a partial-by-partial decay.
  piano(n, rand, o) {
    const f = mtof(n.midi);
    const held = Math.round(n.dur * SR);
    const ring = Math.round((o.ring ?? 3.2) * SR);
    const len = Math.max(held, 1) + ring;
    const out = new Float32Array(len);
    const B = 0.00035; // string stiffness → stretched partials
    const nh = Math.min(14, Math.floor(10000 / f));
    const bright = o.bright ?? 1;
    for (let k = 1; k <= nh; k++) {
      const fk = f * k * Math.sqrt(1 + B * k * k);
      const amp = (1 / Math.pow(k, 1.25)) * (k <= 3 ? 1 : bright * 0.8);
      const dec = 0.9 + 0.45 * k; // higher partials die faster
      for (const det of [-0.6, 0.6]) {
        const w = (2 * Math.PI * (fk + det)) / SR;
        const ph = rand() * 6.28;
        for (let i = 0; i < len; i++) {
          const t = i / SR;
          // damper: after the key is released the note fades in ~0.35 s
          const damp = i < held ? 1 : Math.exp(-(i - held) / (0.35 * SR));
          out[i] += amp * 0.5 * Math.sin(w * i + ph) * Math.exp(-t * dec) * damp;
        }
      }
    }
    for (let i = 0; i < Math.min(len, 144); i++) out[i] *= i / 144; // ~3 ms hammer
    let s1 = 0; const k = lp1(o.cut ?? 5200);
    for (let i = 0; i < len; i++) { s1 += k * (out[i] - s1); out[i] = s1 * 0.6; }
    return out;
  },
  // ---- the current build's own voices (src/ui/audio.js playProcedural) ----
  // Rendered faithfully so the recorded score can stand ON the game's music:
  // same waveforms (band-limited, as WebAudio's are), same envelopes, same
  // drone and thump. `midi` may be fractional; these take exact Hz from it.
  //
  // gamenote: one melody note — 0.08 s exponential rise, exponential fall to
  // silence at 1.8 s, stopped at 1.9 s. `wave`: sine|triangle|square|sawtooth.
  gamenote(n, rand, o) {
    const f = mtof(n.midi);
    const len = Math.round(1.9 * SR);
    const out = new Float32Array(len);
    const t = bandlimited(o.wave ?? 'triangle', f);
    let ph = rand();
    const rise = Math.round(0.08 * SR), fall = Math.round(1.8 * SR);
    for (let i = 0; i < len; i++) {
      ph += f / SR; ph -= Math.floor(ph);
      let e;
      if (i < rise) e = 0.0001 * Math.pow(1 / 0.0001, i / rise);
      else if (i < fall) e = Math.pow(0.0001, (i - rise) / (fall - rise));
      else e = 0.0001;
      out[i] = readTable(t, ph) * e;
    }
    return out;
  },
  // gamedrone: two sawtooths a hair apart through a 700 Hz lowpass swept
  // ±260 Hz by a 0.07 Hz LFO, faded in over 1.5 s; held for the note length.
  gamedrone(n, rand) {
    const f = mtof(n.midi);
    const held = Math.round(n.dur * SR);
    const len = held + Math.round(1.5 * SR);
    const out = new Float32Array(len);
    const t1 = bandlimited('sawtooth', f), t2 = bandlimited('sawtooth', f * 1.005);
    let p1 = rand(), p2 = rand(), y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      p1 += f / SR; p1 -= Math.floor(p1);
      p2 += (f * 1.005) / SR; p2 -= Math.floor(p2);
      const x = 0.5 * (readTable(t1, p1) + readTable(t2, p2));
      const cut = 700 + 260 * Math.sin(2 * Math.PI * 0.07 * (i / SR));
      const k = lp1(Math.max(60, cut));
      y1 += k * (x - y1); y2 += k * (y1 - y2);
      const up = Math.min(1, i / (1.5 * SR));
      const down = i < held ? 1 : Math.max(0, 1 - (i - held) / (1.5 * SR));
      out[i] = y2 * up * down;
    }
    return out;
  },
  // gamethump: the battle heartbeat — a sine falling from f to 2f/3 in 0.18 s,
  // 0.02 s exponential rise, gone by 0.32 s.
  gamethump(n) {
    const f0 = mtof(n.midi);
    const len = Math.round(0.36 * SR);
    const out = new Float32Array(len);
    let ph = 0;
    const rise = Math.round(0.02 * SR), fall = Math.round(0.32 * SR);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const f = t < 0.18 ? f0 * Math.pow(2 / 3, t / 0.18) : (f0 * 2) / 3;
      ph += (2 * Math.PI * f) / SR;
      let e;
      if (i < rise) e = 0.0001 * Math.pow(1 / 0.0001, i / rise);
      else if (i < fall) e = Math.pow(0.0001, (i - rise) / (fall - rise));
      else e = 0;
      out[i] = Math.sin(ph) * e;
    }
    return out;
  },
  // Double bass, arco: a band-limited bowed-string wave (stick-slip noise
  // riding each period, a small pitch scoop into the note, late slow vibrato)
  // through a wooden body — air and top-plate resonances, a nasal dip, and a
  // gentle lowpass so it reads as a played instrument, not an oscillator.
  bass(n, rand, o) {
    const f = mtof(n.midi);
    const held = Math.round(n.dur * SR);
    const r = o.r ?? 0.8;
    const len = held + Math.round(Math.max(0.03, r) * SR);
    const out = new Float32Array(len);
    const t = bandlimited('sawtooth', f);
    const A = Math.round(Math.min(o.a ?? 0.1, 0.15) * SR);
    const Rn = Math.max(1, Math.round(r * SR));
    let ph = rand(), nz = 0, drift = 0;
    const kn = lp1(1800), vr = 4.4 + rand() * 0.5;
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      drift += (rand() - 0.5) * 2e-6; drift *= 0.9995;
      const scoop = 1 - 0.006 * Math.exp(-tt / 0.05);
      const vib = 1 + 0.0022 * Math.sin(2 * Math.PI * vr * tt) * Math.min(1, Math.max(0, (tt - 0.35) / 0.5));
      ph += (f * scoop * vib * (1 + drift)) / SR; ph -= Math.floor(ph);
      nz += kn * (rand() * 2 - 1 - nz);
      const x = readTable(t, ph) + nz * (0.12 * (1 - ph) + 0.9 * Math.exp(-tt / 0.03));
      let e;
      if (i < A) e = Math.sin((Math.PI / 2) * (i / A));
      else if (i < held) e = 0.84 + 0.16 * Math.exp(-(i - A) / (0.25 * SR));
      else { const k = (i - held) / Rn; e = k >= 1 ? 0 : 0.84 * (1 - k) * (1 - k); }
      out[i] = x * e;
    }
    for (const [type, fc, q, db] of [['hp', 32, 0.7, 0], ['peak', 98, 2, 6], ['peak', 215, 3, 4], ['peak', 430, 2.5, 2], ['peak', 820, 1, -4], ['lp', 1700, 0.7, 0], ['lp', 3200, 0.7, 0]]) {
      biquad(out, type, fc, q, db);
    }
    for (let i = 0; i < len; i++) out[i] *= 0.55;
    return out;
  },
  // Heartbeat: the game's battle thump made a two-beat heart — "lub" (a sine
  // falling f → 0.6f with a soft felt click for definition, plus a quiet
  // octave so small speakers hear it) and a lighter, higher "dub" `gap` s later.
  heart(n, rand, o) {
    const f0 = mtof(n.midi);
    const gap = o.gap ?? 0.24;
    const len = Math.round((gap + 0.4) * SR);
    const out = new Float32Array(len);
    const beat = (at, fr, amp) => {
      let ph = 0, nz = 0; const kc = lp1(900);
      for (let i = 0; i < Math.round(0.34 * SR) && at + i < len; i++) {
        const tt = i / SR;
        const f = fr * (0.6 + 0.4 * Math.exp(-tt / 0.045));
        ph += (2 * Math.PI * f) / SR;
        const e = Math.min(1, i / (0.004 * SR)) * Math.exp(-tt / 0.075);
        nz += kc * (rand() * 2 - 1 - nz);
        out[at + i] += amp * e * (Math.sin(ph) + 0.35 * Math.sin(2 * ph)) + amp * 1.6 * nz * Math.exp(-tt / 0.008);
      }
    };
    beat(0, f0, 1);
    beat(Math.round(gap * SR), f0 * 1.12, 0.62);
    return out;
  },
  // Frame drum: higher, drier hand drum.
  frame(n, rand, o) { return INSTRUMENTS.taiko(n, rand, { ring: 0.5, skin: 2400, decay: 11, ...o }); },
};

// ---- reverb (Freeverb) ------------------------------------------------------

function freeverb(input, { room = 0.86, damp = 0.35, spreadSamples = 0 } = {}) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((l) => Math.round(((l + spreadSamples) * SR) / 44100));
  const alls = [556, 441, 341, 225].map((l) => Math.round(((l + spreadSamples) * SR) / 44100));
  const out = new Float32Array(input.length);
  const cb = combs.map((l) => ({ b: new Float32Array(l), i: 0, s: 0 }));
  const ab = alls.map((l) => ({ b: new Float32Array(l), i: 0 }));
  for (let n = 0; n < input.length; n++) {
    const x = input[n] * 0.015;
    let y = 0;
    for (const c of cb) {
      const o = c.b[c.i];
      c.s = o * (1 - damp) + c.s * damp;
      c.b[c.i] = x + c.s * room;
      c.i = (c.i + 1) % c.b.length;
      y += o;
    }
    for (const a of ab) {
      const o = a.b[a.i];
      a.b[a.i] = y + o * 0.5;
      a.i = (a.i + 1) % a.b.length;
      y = o - y;
    }
    out[n] = y;
  }
  return out;
}

// ---- rendering a score ------------------------------------------------------

/**
 * render(score) → { left, right, seconds }
 * score: { bpm, bars, meter, seed, events: [{ inst, beat, beats, midi, vel, pan, rev, ...opts }],
 *          reverb: { room, damp }, gain }
 * The piece is rendered with a tail and the tail is folded back onto the start,
 * so the returned buffer loops seamlessly: whatever rings past the last bar is
 * heard over the first.
 */
export function render(score) {
  const beat = 60 / score.bpm;
  const loopSec = score.bars * score.meter * beat;
  const loopN = Math.round(loopSec * SR);
  const tailN = Math.round(8 * SR);
  const N = loopN + tailN;
  const dryL = new Float32Array(N), dryR = new Float32Array(N);
  const wetL = new Float32Array(N), wetR = new Float32Array(N);
  const rand = rng(score.seed ?? 7);
  for (const e of score.events) {
    const fn = INSTRUMENTS[e.inst];
    if (!fn) throw new Error(`score: no instrument '${e.inst}'`);
    const at = Math.round((e.beat * beat + (e.nudge ?? 0)) * SR);
    const sig = fn({ midi: e.midi, dur: (e.beats ?? 1) * beat, vel: e.vel ?? 0.7 }, rand, e);
    const g = (e.vel ?? 0.7) * (e.gain ?? 1);
    const pan = e.pan ?? 0;
    const rev = e.rev ?? 0.35;
    place(dryL, dryR, at, sig, pan, g * (1 - rev * 0.5));
    place(wetL, wetR, at, sig, pan, g * rev);
  }
  const rv = score.reverb ?? {};
  const rl = freeverb(wetL, rv), rr = freeverb(wetR, { ...rv, spreadSamples: 23 });
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) { L[i] = dryL[i] + rl[i]; R[i] = dryR[i] + rr[i]; }
  // Fold the tail onto the head: the loop point becomes inaudible.
  const left = L.slice(0, loopN), right = R.slice(0, loopN);
  for (let i = 0; i < tailN && i < loopN; i++) { left[i] += L[loopN + i]; right[i] += R[loopN + i]; }
  master(left, right, score.gain ?? 1);
  return { left, right, seconds: loopSec };
}

// Level every track to the same loudness with a soft ceiling, so a shrine and
// a boss arrive at comparable levels and the game's per-context gain (BEDS)
// decides the difference, as it does for the synth.
function master(L, R, gain) {
  let sum = 0;
  for (let i = 0; i < L.length; i++) sum += L[i] * L[i] + R[i] * R[i];
  const rms = Math.sqrt(sum / (2 * L.length)) || 1;
  const target = 0.1 * gain; // ≈ -20 dBFS RMS before the soft clip
  const g = target / rms;
  for (let i = 0; i < L.length; i++) {
    L[i] = Math.tanh(L[i] * g * 1.1) / 1.1;
    R[i] = Math.tanh(R[i] * g * 1.1) / 1.1;
  }
}

/** Interleaved 16-bit PCM WAV bytes. */
export function wav(left, right) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767))), 46 + i * 4);
  }
  return buf;
}
