// src/content/sfx.js — the SFX recipes, as data (#46; design law §3.1, Law 1).
//
// The synth engine (src/ui/audio.js) knows how to say exactly two words —
// 'tone' and 'noise' — and each recipe here is a list of layers spoken in that
// closed vocabulary. Tuning a sound (hit too loud, click too shrill) is a
// table edit here, never an engine edit: the same rule the music beds in
// music.js and the cards follow. Schema: SFX_LAYER_SCHEMAS in
// model/schemas.js; validated at boot and in tests via the content bundle
// (model/validate.js), so a malformed layer fails naming its recipe id.
//
// Layer fields (all times in seconds, frequencies in Hz, peaks are gain 0–1):
//   tone  — type (sine|square|sawtooth|triangle), freq, to? (glide target),
//           dur, peak?, t0? (delay before onset)
//   noise — dur, peak?, t0?, hp? (highpass Hz), lp? (lowpass Hz)
//
// `default` is required: it is what an id with no entry plays — a quiet,
// audible beep, so a missing recipe is heard, never silent (Law 1 clause 5).

// A real build can point these at files; missing/failed loads fall back to the
// synth recipes below. (Moved here from music.js so all SFX content has one home.)
export const SFX_MANIFEST = {
  // cardPlay: 'assets/sfx/card.ogg',  ← example: drop a file here to override
};

// One recipe per feedback hook. Kept short and characterful (dark fantasy).
export const SFX_RECIPES = {
  cardPlay: [
    { kind: 'tone', type: 'triangle', freq: 520, to: 380, dur: 0.12, peak: 0.35 },
  ],
  hit: [
    { kind: 'noise', dur: 0.16, peak: 0.5, hp: 300, lp: 4200 },
    { kind: 'tone', type: 'square', freq: 150, to: 60, dur: 0.14, peak: 0.35 },
  ],
  block: [
    { kind: 'tone', type: 'sine', freq: 320, to: 520, dur: 0.14, peak: 0.4 },
    { kind: 'noise', dur: 0.08, peak: 0.2, hp: 2000 },
  ],
  bleedBurst: [
    { kind: 'tone', type: 'sawtooth', freq: 220, to: 70, dur: 0.5, peak: 0.5 },
    { kind: 'noise', dur: 0.4, peak: 0.35, hp: 200, lp: 2600 },
  ],
  stagger: [
    { kind: 'tone', type: 'square', freq: 90, to: 40, dur: 0.35, peak: 0.5 },
    { kind: 'noise', dur: 0.22, peak: 0.4, hp: 120, lp: 1800 },
  ],
  enemyDeath: [
    { kind: 'tone', type: 'sawtooth', freq: 240, to: 30, dur: 0.6, peak: 0.45 },
  ],
  heal: [
    { kind: 'tone', type: 'sine', freq: 480, to: 720, dur: 0.4, peak: 0.35 },
    { kind: 'tone', type: 'sine', freq: 720, to: 960, dur: 0.4, peak: 0.2, t0: 0.06 },
  ],
  stance: [
    { kind: 'tone', type: 'triangle', freq: 300, to: 600, dur: 0.3, peak: 0.4 },
  ],
  relic: [
    { kind: 'tone', type: 'sine', freq: 880, to: 1320, dur: 0.25, peak: 0.3 },
  ],
  flask: [
    { kind: 'tone', type: 'sine', freq: 640, to: 400, dur: 0.18, peak: 0.3 },
  ],
  shrine: [
    { kind: 'tone', type: 'sine', freq: 392, to: 588, dur: 0.6, peak: 0.3 },
  ],
  buy: [
    { kind: 'tone', type: 'triangle', freq: 700, to: 1050, dur: 0.16, peak: 0.35 },
  ],
  nodeTravel: [
    { kind: 'tone', type: 'triangle', freq: 300, to: 460, dur: 0.14, peak: 0.3 },
  ],
  uiClick: [
    { kind: 'tone', type: 'square', freq: 420, to: 420, dur: 0.04, peak: 0.18 },
  ],
  victory: [
    // A rising G–B–D–G arpeggio, one layer per note (was a forEach in engine code).
    { kind: 'tone', type: 'triangle', freq: 392, dur: 0.5, peak: 0.32 },
    { kind: 'tone', type: 'triangle', freq: 494, dur: 0.5, peak: 0.32, t0: 0.12 },
    { kind: 'tone', type: 'triangle', freq: 587, dur: 0.5, peak: 0.32, t0: 0.24 },
    { kind: 'tone', type: 'triangle', freq: 784, dur: 0.5, peak: 0.32, t0: 0.36 },
  ],
  youDied: [
    { kind: 'tone', type: 'sawtooth', freq: 160, to: 40, dur: 1.2, peak: 0.5 },
  ],
  // The fallback for any id with no entry above — audible on purpose.
  default: [
    { kind: 'tone', type: 'sine', freq: 440, to: 440, dur: 0.05, peak: 0.15 },
  ],
};
