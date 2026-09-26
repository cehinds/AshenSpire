// Boss — the climber's own marked person, half-read and still standing, making
// the offer before the fight.
//
// Lore (docs/LORE.md §4): "Every climber has one marked person somewhere on the
// ring … They are the bosses." "Every one of them will make the offer before
// the fight: my hearth-key for the Keeper's name. Let the fire have one that
// was never promised, and you can leave me standing." (LORE-CAST: "Refusing is
// the fight.")
//
// So the loop is that offer as a dialogue. The organ speaks for the fire and
// the boss: EMBER, the starving fire, making its case. The cello is the
// Forsaken: FORSAKEN, the open fifth of a blank medallion, answering — and
// refusing. They alternate, and meet only at the end. Above them the choir
// holds the boss's own name, NAMES on G, slow and always unfinished: the
// reading the fight will complete. Grand through sustain; tragic, not heroic.
//
// G minor, 92 BPM, half-time, 30 bars (≈78 s). Five six-bar spans:
//   bars  0–6   ORGAN: EMBER on G (G–Ab–D–G, stretch 2), full stop, in octaves.
//   bars  6–12  CELLO: FORSAKEN on G (G–D–F–D, stretch 2) over a bare fifth.
//               CHOIR: NAMES on G, D5–C5–Bb4–A4 (stretch 3), stops before G.
//   bars 12–18  ORGAN: EMBER on C (C–Db–G–C), the offer pressed a fourth higher.
//   bars 18–24  CELLO: FORSAKEN on D (D–A–C–A), the refusal, higher.
//               CHOIR: the boss's name again, the same unfinished NAMES on G.
//   bars 24–30  ORGAN: EMBER on G at speed 1; the CELLO's FORSAKEN on G comes
//               in over its last note — the two meet — and the loop turns over.
//   Taiko on 1 and 3 under the organ, on 1 only under the cello; a low bell
//   at every four-bar head.
import { Score, n } from '../../tools/score/compose.mjs';
import { motif } from './_motifs.mjs';

export const context = 'boss';

const s = new Score({ bpm: 92, bars: 30, seed: 67, reverb: { room: 0.92, damp: 0.4 }, gain: 0.95 });

const v = (...ns) => ns.map(n);
function hold(inst, beat, chords, { over = 0.8, spread = 0.6, ...note } = {}) {
  let b = beat;
  for (const [notes, len] of chords) {
    notes.forEach((m, i) => s.note(inst, b, len + over, m,
      { pan: notes.length > 1 ? (i / (notes.length - 1) - 0.5) * spread : 0, ...note }));
    b += len;
  }
  return b;
}

const organ = { legato: 1.02, note: { stop: 'full', vel: 0.3, rev: 0.45, a: 0.8, r: 1.8 } };
const cello = { legato: 1, note: { vel: 0.58, rev: 0.45, pan: -0.15, a: 0.5, r: 2 } };
const strings = { vel: 0.32, rev: 0.35, cut: 950, a: 1.5, r: 2.8 };
const choirPad = { over: 1, spread: 0.8, vowel: 'ah', vel: 0.15, rev: 0.6, a: 3, r: 3 };

// The organ's voice: EMBER in the pedal, doubled an octave down.
function offer(beat, root, stretch) {
  const m = motif(root, 'ember', { stretch });
  s.line('organ', beat, m, organ);
  s.line('organ', beat, m.map(([p, b]) => [p - 12, b]), { ...organ, note: { ...organ.note, vel: 0.22 } });
}

// ---- bars 0–6: the fire's offer. EMBER on G: G2 (4) Ab2 (6) D2 (6) G2 (8).
offer(0, 'G2', 2);
const offerG = [[v('D3', 'G3', 'Bb3'), 4], [v('Eb3', 'Ab3', 'C4'), 6], [v('D3', 'F3', 'Bb3'), 6], [v('D3', 'G3', 'Bb3'), 8]];
hold('strings', 0, offerG, strings);

// ---- bars 6–12: the Forsaken answers. FORSAKEN on G: G2 (6) D3 (6) F3 (4) D3 (8).
s.line('cello', 24, motif('G2', 'forsaken', { stretch: 2 }), cello);
const answerG = [[v('G1', 'D2', 'D3'), 12], [v('Bb1', 'F2', 'D3'), 4], [v('D2', 'A2', 'D3'), 8]];
hold('strings', 24, answerG, strings);

// ---- bars 12–18: the offer pressed. EMBER on C: C3 (4) Db3 (6) G2 (6) C3 (8).
offer(48, 'C3', 2);
const offerC = [[v('Eb3', 'G3', 'C4'), 4], [v('F3', 'Ab3', 'Db4'), 6], [v('D3', 'G3', 'Bb3'), 6], [v('Eb3', 'G3', 'C4'), 8]];
hold('strings', 48, offerC, strings);

// ---- bars 18–24: the refusal. FORSAKEN on D: D3 (6) A3 (6) C4 (4) A3 (8).
s.line('cello', 72, motif('D3', 'forsaken', { stretch: 2 }), { ...cello, note: { ...cello.note, vel: 0.54 } });
const answerD = [[v('D2', 'A2', 'D3'), 12], [v('C2', 'G2', 'Eb3'), 4], [v('D2', 'A2', 'D3'), 8]];
hold('strings', 72, answerD, strings);

// ---- bars 24–30: they meet. EMBER on G at speed 1: G2 (2) Ab2 (3) D2 (3) G2 (4),
// and FORSAKEN on G (G2 3, D3 3, F3 2, D3 4) enters over the organ's last G.
offer(96, 'G2', 1);
s.line('cello', 104, motif('G2', 'forsaken'), cello);
const meet = [[v('D3', 'G3', 'Bb3'), 2], [v('Eb3', 'Ab3', 'C4'), 3], [v('D3', 'F3', 'Bb3'), 3],
  [v('G1', 'D2', 'D3'), 6], [v('Bb1', 'F2', 'D3'), 4], [v('D2', 'A2', 'D3'), 6]];
hold('strings', 96, meet, strings);

// Organ pedal under the cello's spans, soft, so the floor never drops out.
s.note('organ', 24, 24.5, 'G1', { stop: 'soft', vel: 0.2, rev: 0.4, a: 2, r: 2.5 });
s.note('organ', 72, 24.5, 'D2', { stop: 'soft', vel: 0.2, rev: 0.4, a: 2, r: 2.5 });

// ---- the choir: "ah" chords over everything, an octave above the strings...
const all = [...offerG, ...answerG, ...offerC, ...answerD, ...meet];
hold('choir', 0, all.map(([c, l]) => [c.map((m) => m + 12), l]), choirPad);
// ...and the boss's own name held above them, twice, never finished.
const name = motif('G4', 'names', { stretch: 3, unfinished: true }); // D5 C5 Bb4 A4
const nameNote = { legato: 1.04, note: { vowel: 'ah', vel: 0.27, rev: 0.55, a: 1.6, r: 2, pan: 0.15 } };
s.line('choir', 24, name, nameNote);
s.line('choir', 72, name, nameNote);
s.line('choir', 72, name.map(([m, b]) => [m - 7, b]), { ...nameNote, note: { ...nameNote.note, vel: 0.16, pan: -0.15 } });

// ---- taiko: 1 and 3 while the organ speaks, 1 only while the cello answers.
for (let bar = 0; bar < s.bars; bar++) {
  const organSpeaks = bar < 6 || (bar >= 12 && bar < 18) || bar >= 24;
  s.note('taiko', bar * 4, 1, 'G1', { vel: 0.5, rev: 0.4, decay: 3.2, ring: 2, pan: -0.08 });
  if (organSpeaks) s.note('taiko', bar * 4 + 2, 1, 'D2', { vel: 0.32, rev: 0.4, decay: 4, ring: 1.6, pan: 0.1 });
}

// ---- a low bell at each four-bar head.
for (let bar = 0; bar < s.bars; bar += 4) s.note('bell', bar * 4, 1, 'G2', { vel: 0.2, rev: 0.6, pan: -0.4, ring: 8 });

export default s;
