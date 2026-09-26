// tools/score/compose.mjs — the notation music/score/*.mjs is written in.
//
// A score is a list of timed notes for the instruments in synth.mjs. These
// helpers keep the score files readable as music: note names, chords,
// progressions held for whole bars, melodies as (note, beats) pairs, and
// repeating drum figures.

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'D3' → 50, 'F#2' → 42, 'Bb4' → 70. Numbers pass through. */
export function n(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`compose: bad note '${name}'`);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const QUALITIES = {
  m: [0, 3, 7], M: [0, 4, 7], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6],
  m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14], five: [0, 7], fifth8: [0, 7, 12],
};
/** chord('D3', 'm') → [50, 53, 57]; chord('D3', 'm', 1) is the first inversion. */
export function chord(root, quality = 'm', inversion = 0) {
  const r = n(root);
  const notes = QUALITIES[quality].map((i) => r + i);
  for (let k = 0; k < inversion; k++) notes.push(notes.shift() + 12);
  return notes;
}

export class Score {
  constructor({ bpm, meter = 4, bars, seed = 7, reverb, gain }) {
    Object.assign(this, { bpm, meter, bars, seed, reverb, gain });
    this.events = [];
  }
  get beats() { return this.bars * this.meter; }
  note(inst, beat, beats, midi, opts = {}) {
    this.events.push({ inst, beat, beats, midi: n(midi), ...opts });
    return this;
  }
  /** Hold each chord for its bars: prog = [[notes[], bars], ...], repeated to fill `bars`. */
  pad(inst, prog, opts = {}) {
    const { from = 0, to = this.bars, overlap = 0.25, spread = 0.5 } = opts;
    let bar = from;
    while (bar < to) {
      for (const [notes, len] of prog) {
        if (bar >= to) break;
        const held = Math.min(len, to - bar);
        notes.forEach((m, i) => this.note(inst, bar * this.meter, held * this.meter + overlap * this.meter, m,
          { pan: notes.length > 1 ? (i / (notes.length - 1) - 0.5) * spread : 0, ...opts.note }));
        bar += held;
      }
    }
    return this;
  }
  /** A line of [note|null, beats] pairs from `beat`; null is a rest. */
  line(inst, beat, pairs, opts = {}) {
    let b = beat;
    for (const [m, len] of pairs) {
      if (m !== null) this.note(inst, b, len * (opts.legato ?? 1), m, opts.note ?? {});
      b += len;
    }
    return b;
  }
  /** Hit `midi` on the given beats of each bar in [from, to). */
  hits(inst, midi, beatsInBar, opts = {}) {
    const { from = 0, to = this.bars, every = 1, accent = [] } = opts;
    for (let bar = from; bar < to; bar += every) {
      for (const b of beatsInBar) {
        const acc = accent.includes(b) ? 1 : 0.72;
        this.note(inst, bar * this.meter + b, 0.5, midi, { ...opts.note, vel: (opts.note?.vel ?? 0.8) * acc });
      }
    }
    return this;
  }
  /** Arpeggiate each chord of `prog` in the given rhythm (beats between notes). */
  arp(inst, prog, step, opts = {}) {
    const { from = 0, to = this.bars, pattern = [0, 1, 2, 1] } = opts;
    let bar = from;
    while (bar < to) {
      for (const [notes, len] of prog) {
        if (bar >= to) break;
        const held = Math.min(len, to - bar);
        const start = bar * this.meter;
        let k = 0;
        for (let b = 0; b < held * this.meter - 1e-9; b += step, k++) {
          const idx = pattern[k % pattern.length] % notes.length;
          this.note(inst, start + b, step, notes[idx], opts.note ?? {});
        }
        bar += held;
      }
    }
    return this;
  }
  toJSON() { return { bpm: this.bpm, meter: this.meter, bars: this.bars, seed: this.seed, reverb: this.reverb, gain: this.gain, events: this.events }; }
}
