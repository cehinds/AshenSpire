// src/ui/components/hints.js — the contextual control strip (SPEC §7.3).
//
// A thin strip pinned to the map and combat screens carrying one chip per
// dedicated overlay/zone action. Each chip says which control reaches that
// action, and — since 2026-08-17 — IS one.
//
// ============================================================================
// IT WAS AN ADVERTISEMENT AND HE ASKED FOR A CONTROL BAR
// ============================================================================
//
// Constantine, 2026-08-17: *"all the buttons on those tool tips should also work
// and auto map to the current controls configured and the active device
// controller type."*
//
// TWO HALVES, AND ONLY ONE OF THEM WAS MISSING — measured before anything was
// written, because Marina's dispatch and my own instinct both said "the strip
// prints a hardcoded E":
//
//   THE LABELS WERE ALREADY DERIVED. `keyLabel(id)` / `padLabel(id)` off the live
//   binding maps, and `actionShort(id)` off the ACTIONS registry, since this file
//   was written. A rebind already moved the chip. There was no `E` here to
//   delete, and I am recording that rather than claiming a fix I did not make.
//
//   THE CHIPS DID NOTHING. `pointer-events: none` on `.hint-bar`, `<span>`s,
//   `role="presentation"`, `aria-hidden="true"`, no handler. On a touchscreen
//   that is a strip naming five keys the device does not have, answering to
//   nothing — which is the whole of his complaint.
//
// WHERE THE `E` ACTUALLY WAS, and it was three places, none of them here:
// `screens/combat.js` and `screens/map.js` each shipped `title="Menu (M)"`, and
// `components/tutorial.js` shipped *"(or press E)"*. All three now derive through
// `actionHint(id)`. Law 1 clause 7: a binding written by hand is a second copy,
// and the next rebind orphans it silently.
//
// ============================================================================
// WHAT A TAP ON A CHIP IS
// ============================================================================
//
// It enters `input.js` by the door the GAMEPAD POLLER enters by
// (`beginActionPress` / `endActionPress` → `doAction`), so it is one thumb
// arriving at a binding, not a fourth delivery path. Everything behind that door
// comes free and is not restated here: the current binding, the hold wherever an
// action owes a second beat (press-and-hold the End Turn chip and `.end-turn`
// fills under the words; let go early and nothing happens), the veil refusal, and
// the dial at `off` collapsing it to one press.
//
// POINTERDOWN/UP RATHER THAN `click`, for exactly that reason: a hold has a
// beginning and an end, and `click` only has an end. `pointercancel` and
// `pointerleave` end it as CANCELLED — the browser taking the gesture, or a thumb
// sliding off the chip mid-hold, must not commit.
//
// ⚠ THE STRIP IS `display: none` ON A NARROW LAYOUT, AND THAT IS THE SEAM.
// `styles/ui.css` hides `.hint-bar` under `:root[data-layout='narrow']`, with its
// reason written at the line: *"On a phone it offers 'E End Turn' to a device with
// no E."* THAT PREMISE IS THE THING THIS CHANGE RETIRES — the chips are now the
// phone's affordance rather than a keyboard's. **I have not touched that rule**:
// where the strip sits on a phone, and what the hand does with the room, is
// Sunna's layout act (moving the strip below the cards and shifting the hand up),
// and unhiding it from here would be me doing her half in her absence. So today
// the working buttons are observable on a WIDE shape and hidden on a narrow one,
// and that is measured, not assumed (1200x730: five chips, all pressable; 390x844:
// `display: none`). The day her act lands they work for free.
//
// LAW 3 CLAUSE 4 NOW HAS A SUBJECT HERE AND IT IS ANSWERED IN PART. These are
// interactive controls, so each owes a contextual tooltip that fires for the focus
// cursor too. Each carries a `title` and an `aria-label`, and Law 3 clause 4 says
// plainly that a native `title=` alone does not satisfy it. The focus cursor
// cannot reach a chip by design (`.hint-bar` is in input.js's CHROME set), so the
// cursor half of the clause has no subject; the TOUCH half is the chip's own words
// under the thumb. Named as partial rather than claimed: the game's own tooltip
// component is not wired here.

import {
  keyLabel, padLabel, hasGamepad, actionShort, actionLabel, actionHint,
  beginActionPress, endActionPress,
} from '../input.js';

// Which action chips each context shows, in reading order — ids only. The
// labels come from the ACTIONS registry (actionShort), so this can't drift from
// the actions it points at and a new action is a one-place edit. All of these
// carry a rebindable keyboard key (keyLabel returns a real key, never '—').
const CHIPS = {
  combat: ['endTurn', 'deck', 'relics', 'stats', 'menu'],
  map: ['deck', 'relics', 'stats', 'menu'],
  // While aiming a card/flask, the combat bar swaps to the two live choices.
  targeting: ['confirm', 'cancel'],
};

// Combat sets 'targeting' while a card/flask is aimed; null restores the
// default chips. The bar rebuilds in place.
let hintMode = null;
export function setHintMode(mode) {
  if (mode === hintMode) return;
  hintMode = mode;
  refreshHintBars();
}

// Show controller glyphs when a gamepad is connected, keyboard keys otherwise.
//
// `actionLabel(id)` IS THAT CHOICE AND IT USED TO LIVE INLINE HERE. It moved into
// input.js beside the binding maps it reads, because two other surfaces now ask
// the same question and three copies of `pad ? padLabel : keyLabel` is three
// chances to answer it differently. Its boundary — connected, not last-used — is
// stated at that function.
function chipsHtml(context, pad) {
  const set = context === 'combat' && hintMode === 'targeting' ? CHIPS.targeting : CHIPS[context];
  return (set || [])
    .map((id) => {
      const key = pad ? padLabel(id) || keyLabel(id) : keyLabel(id);
      // `type="button"` because these live inside no form and a default submit
      // button in a game screen is a page reload waiting for a keyboard.
      // `data-action` is the id, read back at PRESS TIME rather than closed over,
      // so the strip can be rebuilt under a live press without stranding it.
      // A kit Button carrying a Keycap — the same box as every other control.
      return `<button type="button" class="as-btn hint" data-action="${id}" data-action-hint="${id}"`
        + ` title="${actionHint(id)}" aria-label="${actionHint(id)}"><kbd class="as-keycap">${key}</kbd>${actionShort(id)}</button>`;
    })
    .join('');
}

/** HTML for the hint bar in a given context ('combat' | 'map'). */
export function hintBarHtml(context) {
  const chips = CHIPS[context] || [];
  if (!chips.length) return '';
  const pad = hasGamepad();
  // `role="presentation"` and `aria-hidden="true"` are GONE, and their removal is
  // the accessibility half of his ask: a bar of five real buttons announced as
  // decoration is five controls a screen reader cannot find. `role="toolbar"`
  // says what it is — a set of sibling controls, not a list and not a tab strip
  // (Law 3: a tab set is a different thing and takes the bumpers).
  // A kit ButtonRow on the `medium` step: every chip the same width, the row no
  // wider than its chips need, and the step is the one that holds the longest
  // label these chips carry ("Armoury") without truncating it.
  return `<div class="hint-bar hint-${context}${pad ? ' hint-pad' : ''} as-btnrow" data-size="medium" role="toolbar" aria-label="Controls">${chipsHtml(context, pad)}</div>`;
}

// ---- the press, delegated once at the document -------------------------------
//
// ONE LISTENER FOR EVERY CHIP THAT WILL EVER EXIST, rather than a pair per chip
// per rebuild. `chipsHtml` runs on every pad connect, every targeting change and
// every combat re-render; per-chip listeners on a bar that is thrown away and
// rebuilt is the leak this file would otherwise grow, and the id is read off the
// element at press time so a rebuild mid-press cannot strand a stale closure.
//
// THE RELEASE IS BOUND AT THE DOCUMENT, NOT THE CHIP, on purpose: a press that
// begins on a chip and ends anywhere at all must still END. A pointerup that
// never arrives at the element is exactly how the pre-S7 shape left a control
// filling forever.
if (typeof document !== 'undefined') {
  let pressing = false;
  const chipOf = (ev) => (ev.target && ev.target.closest ? ev.target.closest('.hint-bar .hint[data-action]') : null);
  document.addEventListener('pointerdown', (ev) => {
    const chip = chipOf(ev);
    if (!chip) return;
    // The default would focus the button and, on touch, may synthesise a click
    // later — both of which arrive after the press door has already answered.
    ev.preventDefault();
    pressing = true;
    beginActionPress(chip.dataset.action);
  });
  document.addEventListener('pointerup', () => {
    if (!pressing) return;
    pressing = false;
    endActionPress(false);
  });
  document.addEventListener('pointercancel', () => {
    if (!pressing) return;
    pressing = false;
    endActionPress(true);
  });
  // Sliding off the chip mid-hold is a cancel, matching every other hold in the
  // tree: the gesture must be able to be taken back by moving away from it.
  document.addEventListener('pointerout', (ev) => {
    if (!pressing || chipOf(ev)) return;
    pressing = false;
    endActionPress(true);
  });
}

/** Rebuild any visible hint bars in place — called when a pad (dis)connects. */
export function refreshHintBars() {
  const pad = hasGamepad();
  // Keyboard-only affordances (card quick-play badges) hide while a pad drives.
  document.body.classList.toggle('pad-mode', pad);
  document.querySelectorAll('.hint-bar').forEach((bar) => {
    const context = bar.classList.contains('hint-combat') ? 'combat' : bar.classList.contains('hint-map') ? 'map' : null;
    if (!context) return;
    bar.classList.toggle('hint-pad', pad);
    bar.innerHTML = chipsHtml(context, pad);
  });
  // The End Turn button carries its own key chip — keep it in sync too.
  const etKey = document.querySelector('.end-turn .et-key');
  if (etKey) etKey.textContent = pad ? padLabel('endTurn') || keyLabel('endTurn') : keyLabel('endTurn');
  // EVERY DERIVED CONTROL PROMPT IN THE TREE, wherever it was rendered. A screen
  // that painted `title="Menu (M)"` an hour ago is not going to re-render because
  // a pad was plugged in, so the attribute is re-derived in place from the id the
  // element carries. One loop, no list of screens — a new prompt joins it by
  // writing `data-action-hint`, which is Law 0 clause 1 on a tooltip.
  document.querySelectorAll('[data-action-hint]').forEach((el) => {
    const hint = actionHint(el.dataset.actionHint);
    el.setAttribute('title', hint);
    if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', hint);
  });
  // Prose that names a control (the tutorial's "or press E") re-derives the same
  // way: the element says which action it is quoting and gets the live symbol.
  document.querySelectorAll('[data-action-key]').forEach((el) => {
    el.textContent = actionLabel(el.dataset.actionKey);
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('gamepadconnected', refreshHintBars);
  window.addEventListener('gamepaddisconnected', refreshHintBars);
}
