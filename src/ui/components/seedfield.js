// src/ui/components/seedfield.js — the seed field, and the one place that knows
// what a seed is allowed to be.
//
// THE DEFECT THIS EXISTS FOR. `customize.js` printed, on the seed field itself:
// "The same seed gives the same map, the same shops and the same cards." Type a
// hyphen into that field and `seedFromString` threw, `main.js` CAUGHT the throw
// and substituted `Math.random()`, and one URL booted six times gave six
// different maps — measured, `MY-SEED` · `MY SEED` · `A_B` · `café` · `ELDEN!` ·
// `2026/08/08` · `ÅSA` all silently rerolled. The screen made a promise in
// writing and the catch broke it in silence. Constantine asked for repeatable
// short runs; a seed with a hyphen in it was never one.
//
// THREE FIELDS, ONE VOCABULARY. There are three player-facing seed fields —
// `#seed-input` (customize), `#cr-seed` (Custom Climb), `#lb-seed` (the co-op
// lobby) — and before this each one re-stated the seed's rules in its own
// markup: `maxlength="10"` typed three times, the alphabet typed zero times,
// and the promise typed once on one of the three. A character set retyped in
// the UI is the second copy this seat exists to refuse. Everything below is
// READ from `engine/rng.js`: the length, the vocabulary, the sentence.
//
// WHY IT REFUSES AND DOES NOT WIDEN OR NORMALISE — the three options, and the
// two that were rejected on evidence rather than on taste:
//
//   WIDEN the alphabet so a hyphen is legal. `seedFromString` is a positional
//   base-35 number and THE ALPHABET IS THE RADIX. Add one character and every
//   seed string ever written down, saved, or printed on a death screen names a
//   different map. It would break "the same seed gives the same map" for every
//   seed that works, to rescue the ones that never did.
//
//   NORMALISE — strip what does not fit, so `MY-SEED` becomes `MYSEED`. That is
//   the same silence one notch quieter: `café`, `cafe` and `caf` would all be
//   one map and the player is told nothing where the mistake is made. Law 0
//   clause 5 — a generated thing that is wrong but reasonable is invisible.
//   (The narrow folding that DOES happen — trim, upper-case, O→0 — stays, and
//   is a different act: those are homoglyphs, two spellings of one character,
//   and they lose nothing. rng.js's SEED_HOMOGLYPHS names them.)
//
//   REFUSE — Law 1 clause 5, bad data fails loud and names the entry. The
//   character is named, at the field, the moment it lands, and BEGIN THE CLIMB
//   will not start a run the seed cannot reproduce.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not swallow the keystroke. A field
// that silently eats what you typed is normalising by the back door — and a
// paste of `MY-SEED` would land as `MYSEED` with nothing said. The character
// STAYS VISIBLE so the player can see the one being complained about. Whether
// the character should be refused earlier than that is a legibility call and
// belongs to the Player-experience seat, not to this module.

import { SEED_MAX_LEN, seedProblem } from '../../engine/rng.js';
import { attachTooltip, esc } from './tooltip.js';
import { el } from '../kit/index.js';

/**
 * The promise, once. It used to live as prose on one of the three fields; the
 * other two said nothing at all. Now all three make the same promise, and it
 * is a promise the field keeps.
 */
export const SEED_PROMISE = 'The seed the whole climb is generated from.'
  + '<br>The same seed gives the same map, the same shops and the same cards. Change it for a different run.';

/**
 * attachSeedField(input) → { problem, refresh, onChange }
 *
 *   problem()    null, or the one sentence naming why this value is not a seed
 *   refresh()    re-read the field and re-render the refusal (call after
 *                setting `.value` from code — e.g. a seed arriving on the wire)
 *   onChange(fn) fn(problem) after every edit, so the screen's START button can
 *                refuse from the SAME sentence rather than a second copy of it
 *
 * The note element is created here, not in the screens' markup, for the same
 * reason the reason is an argument in components/refusal.js: a screen that has
 * to remember to add the error line is a screen that will forget.
 */
export function attachSeedField(input, { promise = SEED_PROMISE } = {}) {
  if (!input) return { problem: () => null, refresh: () => {}, onChange: () => {} };

  // The length bound, read from its home instead of typed into the markup.
  input.maxLength = SEED_MAX_LEN;
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('autocomplete', 'off');
  // input.js's FOCUS_SELECTOR matches `input[type="text"]` BY ATTRIBUTE, so a
  // field without it is unreachable by the pad and keyboard focus cursor —
  // #cr-seed and #lb-seed both shipped without one (#29's finding, one screen
  // over). Set here so a fourth seed field cannot repeat it.
  if (!input.getAttribute('type')) input.setAttribute('type', 'text');

  // The kit's FieldNote — the sentence under a field that refuses. It lands
  // in the field's own Row·setting (`.seed-line` is the hook every screen's
  // seed row wears), so it drops under the field on the row's own wrap.
  const note = el('span', { class: 'as-fieldnote seed-problem', role: 'alert' });
  note.hidden = true;
  (input.closest('.seed-line') || input.closest('.as-row') || input.parentElement || input).appendChild(note);

  let listener = null;

  const problem = () => seedProblem(input.value);

  function refresh() {
    const why = problem();
    note.textContent = why || '';
    note.hidden = !why;
    if (why) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    if (listener) listener(why);
  }

  // Hover AND the pad/keyboard focus cursor (Law 3 clause 4) — and when the
  // value is bad the tooltip says the same sentence the note does, because
  // there is one sentence.
  attachTooltip(input, () => {
    const why = problem();
    return why ? esc(why) : promise;
  });

  input.addEventListener('input', refresh);
  input.addEventListener('change', refresh);
  refresh();

  return {
    problem,
    refresh,
    onChange(fn) { listener = fn; if (fn) fn(problem()); },
  };
}
