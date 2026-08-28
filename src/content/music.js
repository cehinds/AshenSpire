// src/content/music.js — the procedural score, as data (SPEC §3.1(4)).
//
// The synth engine (src/ui/audio.js) knows how to PLAY a bed; what the beds
// are is content. Adding a mood or a new screen's music is a data edit here,
// with no change to the engine — same rule the cards and enemies follow.
//
// Sample manifests sit here too: naming a file for an id makes the engine play
// that sample instead of synthesizing, and a missing/failed load falls back to
// the synth, so this stays safe to point at art that doesn't exist yet.

// A real build can point these at files; missing/failed loads fall back to synth.
export const SFX_MANIFEST = {
  // cardPlay: 'assets/sfx/card.ogg',  ← example: drop a file here to override
};
export const MUSIC_MANIFEST = {
  // combat: 'assets/music/combat.ogg',
};

// Minor / phrygian-ish scales (semitone offsets from the root) per mood.
export const SCALES = {
  calm: [0, 3, 5, 7, 10, 12, 15],
  tense: [0, 1, 5, 6, 7, 10, 12],
  dread: [0, 2, 3, 7, 8, 10, 12],
  hymn: [0, 2, 4, 7, 9, 12, 16], // warmer major-pentatonic-ish (shop/rest/victory)
  veiled: [0, 3, 5, 6, 10, 12, 15], // dorian-flavored, wistful
  wrath: [0, 1, 4, 5, 8, 11, 12], // jagged, aggressive (elite/boss)
};

// Music beds per context. Each context has a `gain`, a `drone` flag, and a set
// of procedural VARIANTS (root frequency, scale, note cadence in ms) — one is
// picked at random each time the context starts, so the score varies between a
// handful of "tracks" even with zero audio files. Shop and Rest have their own
// calmer sets; Boss/Elite their own darker ones.
// Each variant may also set `wave` (oscillator timbre) and `lift` (melodic
// stride through the scale) so variants differ in colour and contour, not just
// key/tempo — more perceived variety from the same synth.
export const BEDS = {
  title: { drone: true, gain: 0.5, variants: [
    { root: 146.83, scale: 'calm', cadence: 2600, wave: 'triangle', lift: 3 },
    { root: 130.81, scale: 'dread', cadence: 3000, wave: 'sine', lift: 2 },
    { root: 164.81, scale: 'calm', cadence: 2400, wave: 'triangle', lift: 4 },
    { root: 155.56, scale: 'veiled', cadence: 2800, wave: 'sine', lift: 3 },
  ] },
  map: { drone: true, gain: 0.42, variants: [
    { root: 164.81, scale: 'calm', cadence: 2200, wave: 'triangle', lift: 3 },
    { root: 155.56, scale: 'calm', cadence: 2500, wave: 'sine', lift: 4 },
    { root: 174.61, scale: 'dread', cadence: 2000, wave: 'triangle', lift: 2 },
    { root: 146.83, scale: 'veiled', cadence: 2350, wave: 'sine', lift: 3 },
  ] },
  combat: { drone: true, gain: 0.5, pulse: true, variants: [
    { root: 130.81, scale: 'tense', cadence: 1500, wave: 'triangle', lift: 3 },
    { root: 123.47, scale: 'dread', cadence: 1300, wave: 'square', lift: 2 },
    { root: 146.83, scale: 'tense', cadence: 1400, wave: 'triangle', lift: 4 },
    { root: 138.59, scale: 'tense', cadence: 1250, wave: 'sawtooth', lift: 3 },
    { root: 130.81, scale: 'veiled', cadence: 1350, wave: 'triangle', lift: 5 },
    { root: 155.56, scale: 'dread', cadence: 1200, wave: 'square', lift: 2 },
  ] },
  elite: { drone: true, gain: 0.55, pulse: true, variants: [
    { root: 110.0, scale: 'tense', cadence: 1150, wave: 'sawtooth', lift: 3 },
    { root: 103.83, scale: 'dread', cadence: 1050, wave: 'square', lift: 2 },
    { root: 116.54, scale: 'wrath', cadence: 1100, wave: 'sawtooth', lift: 4 },
    { root: 98.0, scale: 'wrath', cadence: 1000, wave: 'square', lift: 3 },
  ] },
  boss: { drone: true, gain: 0.6, pulse: true, variants: [
    { root: 98.0, scale: 'dread', cadence: 1000, wave: 'sawtooth', lift: 2 },
    { root: 92.5, scale: 'wrath', cadence: 900, wave: 'square', lift: 3 },
    { root: 87.31, scale: 'wrath', cadence: 950, wave: 'sawtooth', lift: 4 },
    { root: 82.41, scale: 'dread', cadence: 860, wave: 'square', lift: 2 },
    { root: 103.83, scale: 'wrath', cadence: 920, wave: 'sawtooth', lift: 3 },
  ] },
  shop: { drone: true, gain: 0.4, variants: [
    { root: 196.0, scale: 'hymn', cadence: 2200, wave: 'triangle', lift: 3 },
    { root: 174.61, scale: 'calm', cadence: 2000, wave: 'sine', lift: 4 },
    { root: 220.0, scale: 'hymn', cadence: 2400, wave: 'triangle', lift: 2 },
  ] },
  rest: { drone: true, gain: 0.34, variants: [
    { root: 130.81, scale: 'calm', cadence: 3200, wave: 'sine', lift: 3 },
    { root: 146.83, scale: 'hymn', cadence: 3000, wave: 'sine', lift: 2 },
    { root: 123.47, scale: 'veiled', cadence: 3400, wave: 'triangle', lift: 3 },
  ] },
  victory: { drone: false, gain: 0.5, variants: [
    { root: 196.0, scale: 'hymn', cadence: 1400, wave: 'triangle', lift: 3 },
    { root: 220.0, scale: 'hymn', cadence: 1200, wave: 'triangle', lift: 4 },
    { root: 246.94, scale: 'calm', cadence: 1300, wave: 'sine', lift: 2 },
  ] },
};
