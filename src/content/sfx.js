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
//
// THE ID SCHEME — composed ids, and why this table has a family row (#66/D16).
// A call site may compose an id from data: `procBurst_${status}` (ui/fx.js).
// Resolution is generic-then-specific, in resolveRecipe() below:
//
//     procBurst_frost  →  the exact row if authored
//                      →  else `procBurst`, the FAMILY row (before the '_')
//                      →  else `default`
//
// So a per-status row is an OPTIONAL flourish, never a requirement: the day
// content authors a fourth proc status, its burst already sounds like a burst
// instead of degrading to the 440 Hz blip. That is Law 1 clause 3 — new
// combinations of existing vocabulary must just work, with no engine edit.
// Authoring a new family = one row named for the id before the underscore.
//
// Found by Sunna at #66: #65 started composing `procBurst_<status>` and no row
// answered, so bleed, frost AND insanity all played the fallback while the
// settings screen named sounds the build did not make.

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
  // ---- the proc-burst family (#66/D16) -------------------------------------
  // `procBurst` is the FAMILY row: any status that procs and has no row of its
  // own sounds like a burst, not like a missing sound. The three per-status
  // rows below are the flourish — same gesture, different material, so a
  // player learns which threshold blew without reading the banner.
  // (This family row IS the old `bleedBurst`, kept whole: that id had no
  // caller left after #65 renamed the event, and a table entry nothing fires
  // is the second copy this house kills. Promoted rather than deleted.)
  procBurst: [
    { kind: 'tone', type: 'sawtooth', freq: 220, to: 70, dur: 0.5, peak: 0.5 },
    { kind: 'noise', dur: 0.4, peak: 0.35, hp: 200, lp: 2600 },
  ],
  // Bleed — wet and low: the family gesture with the noise band dropped and
  // widened, so it reads as fluid rather than brittle.
  procBurst_bleed: [
    { kind: 'tone', type: 'sawtooth', freq: 200, to: 60, dur: 0.55, peak: 0.5 },
    { kind: 'noise', dur: 0.45, peak: 0.38, hp: 140, lp: 1900 },
  ],
  // Frost — brittle and high: a short glassy crack over a thin high-passed
  // hiss. Same shape, opposite end of the spectrum from bleed.
  procBurst_frost: [
    { kind: 'tone', type: 'triangle', freq: 1180, to: 520, dur: 0.35, peak: 0.4 },
    { kind: 'noise', dur: 0.3, peak: 0.3, hp: 2600, lp: 9000 },
    { kind: 'tone', type: 'sine', freq: 160, to: 80, dur: 0.4, peak: 0.28, t0: 0.02 },
  ],
  // Insanity — unstable: two detuned squares beating against each other, so
  // the burst sounds wrong on purpose rather than merely loud.
  procBurst_insanity: [
    { kind: 'tone', type: 'square', freq: 310, to: 118, dur: 0.5, peak: 0.34 },
    { kind: 'tone', type: 'square', freq: 296, to: 112, dur: 0.5, peak: 0.3, t0: 0.015 },
    { kind: 'noise', dur: 0.34, peak: 0.26, hp: 700, lp: 3400 },
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
  // `uiClick` WAS HERE and is gone — no call site in the tree ever fired it
  // (D10: tuned, validated, shipped, played by nothing). A shipped sound with
  // no caller makes the settings screen promise a sound the build never makes,
  // which is the same lie as a caller with no recipe. Restoring it is one
  // line, the day a caller exists — the row was, verbatim:
  //   uiClick: [{ kind: 'tone', type: 'square', freq: 420, to: 420, dur: 0.04, peak: 0.18 }],
  // Wiring buttons to it is a UI-domain call, not mine, and rides the D10/D16
  // follow-up card (nothing checks ids-played == ids-in-table, both ways).
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

/**
 * resolveRecipe(id) → { recipe, matched, fellBack }
 *
 * The id scheme documented at the top of this file, as one pure function so
 * the engine and the tests decide identically — a resolution rule with two
 * homes is a rule that drifts (the engine had none at all before #66/D16,
 * which is how three composed ids reached the 440 Hz fallback unnoticed).
 *
 * `matched` is the row that actually answered; `fellBack` is true only when
 * NOTHING answered and `default` had to. Own-property reads throughout: an
 * inherited key ('toString') is a missing entry, never a function.
 *
 * No WebAudio, no DOM — headless by construction, so a test can ask what a
 * composed id resolves to without opening an AudioContext.
 */
export function resolveRecipe(id) {
  const own = (key) =>
    (typeof key === 'string' && Object.prototype.hasOwnProperty.call(SFX_RECIPES, key)
      ? SFX_RECIPES[key]
      : undefined);
  const exact = own(id);
  if (exact) return { recipe: exact, matched: id, fellBack: false };
  const cut = typeof id === 'string' ? id.indexOf('_') : -1;
  if (cut > 0) {
    const family = id.slice(0, cut);
    const fam = own(family);
    if (fam) return { recipe: fam, matched: family, fellBack: false };
  }
  return { recipe: SFX_RECIPES.default, matched: 'default', fellBack: true };
}
