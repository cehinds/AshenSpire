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

// A recipe id automatically tries assets/sfx/<encoded-id>.ogg before using its
// synth recipe. Add a row here only to override that path or format; both the
// convention and overrides pass through assetUrl() so standalone builds can
// inline them. Missing or undecodable files fall back to the recipes below.
// (Moved here from music.js so all SFX content has one home.)
export const SFX_MANIFEST = {
  // cardPlay: 'assets/sfx/card.wav',  ← optional path/format override
};

// Family rows are an explicit content characteristic. Runtime resolution and
// the content-build reachability check both consume this list; neither guesses
// that every row before an underscore is intended as a composed-id family.
export const SFX_FAMILY_IDS = Object.freeze([
  'procBurst', 'beat', 'holdTick', 'holdCommit',
]);

// Confirm arrivals share one generic fallback gesture. `beat_<phase>` and
// `holdCommit_<action>` may add exact flourishes later without copying this
// tuning or falling through to the missing-id beep today.
const CONFIRM_ARRIVAL_RECIPE = Object.freeze([
  { kind: 'tone', type: 'triangle', freq: 220, to: 330, dur: 0.14, peak: 0.3 },
  { kind: 'tone', type: 'sine', freq: 440, dur: 0.16, peak: 0.16, t0: 0.025 },
]);

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
  // (This row was promoted from the old `bleedBurst`, which lost its caller at
  // #65. RETUNED at Sunna's gate: promoting it verbatim made the family row
  // and `procBurst_bleed` the same sound — 0.5 dB apart A-weighted, measured —
  // so the FOURTH proc status would have been heard as bleed. A false
  // identity costs a tired player more than a generic one, so the family is
  // now the GESTURE WITHOUT THE MATERIAL: mid-register triangle, mid-band
  // noise, no wet low-mid. It should read "a threshold blew" and claim no
  // element. Each sibling owns a different timbre AND a different register —
  // bleed sawtooth/low, insanity squares beating, frost triangle/high.)
  procBurst: [
    { kind: 'tone', type: 'triangle', freq: 340, to: 130, dur: 0.42, peak: 0.45 },
    { kind: 'noise', dur: 0.32, peak: 0.33, hp: 700, lp: 4000 },
  ],
  // Bleed — wet and low: the family gesture with the noise band dropped and
  // widened, so it reads as fluid rather than brittle.
  procBurst_bleed: [
    { kind: 'tone', type: 'sawtooth', freq: 200, to: 60, dur: 0.55, peak: 0.5 },
    { kind: 'noise', dur: 0.45, peak: 0.38, hp: 140, lp: 1900 },
  ],
  // Frost — brittle and high: a short glassy crack over a thin high-passed
  // hiss. Same shape, opposite end of the spectrum from bleed.
  //
  // RETUNED at Sunna's gate — DISTRIBUTION ONLY, and the level half is
  // deliberately NOT closed. Her render measured frost 10 dB under its
  // siblings; my analytic meter (tools/sfx-loudness.mjs) measures it 9 dB
  // OVER them. Two instruments, opposite signs, so I changed nothing whose
  // justification depends on which is right — a level edit I cannot defend in
  // either direction is a guess wearing a decimal.
  //
  // What BOTH instruments agree on is where the energy sits, and that is what
  // moved: the sub-bass body halves (peak .28 -> .14, shorter), because it is
  // the part a laptop or phone cannot reproduce and A-weighting says the ear
  // barely counts; the hiss reaches DOWN to 1.8 kHz (from 2600) so it lands in
  // the band that survives a bed instead of above it; and the glassy tone
  // glides to 700 rather than 520 so it stays bright instead of falling into
  // the mids. Peaks are untouched. Centroid 925 -> 1216 Hz on my meter;
  // identity-band SNR over the bed +11.8 dB at 1.8-4 kHz on hers.
  procBurst_frost: [
    { kind: 'tone', type: 'triangle', freq: 1180, to: 700, dur: 0.3, peak: 0.4 },
    { kind: 'noise', dur: 0.34, peak: 0.3, hp: 1800, lp: 9000 },
    { kind: 'tone', type: 'sine', freq: 150, to: 90, dur: 0.28, peak: 0.14, t0: 0.02 },
  ],
  // Insanity — unstable: two detuned squares beating against each other, so
  // the burst sounds wrong on purpose rather than merely loud.
  procBurst_insanity: [
    { kind: 'tone', type: 'square', freq: 310, to: 118, dur: 0.5, peak: 0.34 },
    { kind: 'tone', type: 'square', freq: 296, to: 112, dur: 0.5, peak: 0.3, t0: 0.015 },
    { kind: 'noise', dur: 0.34, peak: 0.26, hp: 700, lp: 3400 },
  ],
  beat: CONFIRM_ARRIVAL_RECIPE,
  // ---- the hold family: a press-and-hold has a BEAT ------------------------
  //
  // THE SCORE, written out because this house has no ears and a sound nobody
  // can check is decoration. Four sounds make ONE PHRASE, and the phrase is
  // "approach, approach, approach, arrive":
  //
  //   tick   tick  tick      COMMIT
  //   A3     A3    A3        A3 -> E4, with A4 over it
  //   |------|-----|---|
  //   0.00   0.42  0.78  1.0        (fractions of the fill; balance.ui.holdBeat)
  //
  // Every tick is the SAME NOTE. Nothing rises in pitch — the gaps shorten, and
  // that is the whole progress signal (the reason is in balance.ui.holdBeat, one
  // home). The commit is that same A arriving UP: 220 glides to 330 (a fifth)
  // with a quiet 440 (the octave) laid over it 25 ms later. So the landing is
  // heard as the ticks resolving rather than as a fifth unrelated event, and a
  // player learns the phrase in one run without being told anything.
  //
  // WHY A3 = 220 Hz. It is an octave under `cardPlay` (520->380) and two under
  // `relic`, so a confirmation never competes with the sound of the thing being
  // confirmed. A phone speaker rolls off hard below ~500 Hz, so on the shape
  // that matters the fundamental is barely there and the TRIANGLE'S ODD
  // HARMONICS (660, 1100, 1540...) are what actually arrives — which is why the
  // tick is a triangle and not a sine. A 35 ms sine has no transient to hear.
  //
  // WHY NOT THE OTHER TIMBRES: square reads as an error tone (it is `stagger`
  // and half of `procBurst_insanity`); sawtooth is the bleed/death material;
  // noise is impact, and a confirmation is not an impact. The tick is the only
  // dry, unfiltered, single-layer row in this table on purpose.
  //
  // THE LEVELS, AND THE TRADE I TOOK. `holdTick` peak 0.10 is the QUIETEST row
  // here — under `default`'s 0.15 — and 35 ms is the shortest. It fires three
  // times per confirmation and hundreds of times a run, so it is the one sound
  // in the game whose cost is paid at hold #200 rather than hold #1. It is
  // audible because it is dry and transient against a sustained bed, NOT
  // because it is loud; buying audibility with gain would be the wrong fix and
  // the mix would be the thing at fault.
  //
  // `holdCommit` peak 0.30 sits UNDER `cardPlay`'s 0.35, deliberately and at a
  // cost: the more satisfying sound is louder. But a confirmation is not a
  // bigger event than the card it confirms, and a mix where the guard
  // out-shouts the action is lying about what mattered.
  //
  // THERE IS NO `holdAbort`, AND THE ABSENCE IS THE DECISION. Letting go is
  // nothing happening, and the honest sound for nothing happening is nothing.
  // It is also the COMMON case — releasing early IS the feature — so a cue
  // there would become the most-fired sound in the game while reporting a
  // non-event. The train stopping already says it.
  //
  // COMPOSED PER ACTION, exactly like `procBurst_<status>` above:
  //   holdCommit_endTurn -> the exact row if some future author writes one
  //                      -> else `holdCommit`, this family row
  // So the day an action becomes one that "takes a second beat", it already
  // sounds right with no engine edit and no content edit. A per-action row is
  // an OPTIONAL flourish. None is authored here on purpose: this table deleted
  // `uiClick` for being a shipped sound with no caller, and a `holdCommit_x`
  // for an x that does not hold yet would be the same lie in a new coat.
  holdTick: [
    { kind: 'tone', type: 'triangle', freq: 220, dur: 0.035, peak: 0.1 },
  ],
  holdCommit: CONFIRM_ARRIVAL_RECIPE,
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
    const fam = SFX_FAMILY_IDS.includes(family) ? own(family) : undefined;
    if (fam) return { recipe: fam, matched: family, fellBack: false };
  }
  return { recipe: SFX_RECIPES.default, matched: 'default', fellBack: true };
}
