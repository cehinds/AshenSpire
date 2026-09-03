// src/ui/components/modalShell.js — THE CHROME EVERY MODAL WEARS.
//
// Measured 2026-09-02 by driving all four doors in a headless browser at
// 1440x900 and 390x844. FOUR modals, FOUR chromes, no two agreeing on the two
// things a player actually needs from a modal — how do I read it, and how do I
// get out:
//
//   Settings (title)   left title, NO close control at all, one `Done` footer
//   Settings (in-run)  tab strip left, boxed ☰ and ✕ right, a two-button
//                      footer whose "Save and Quit" is painted DANGER RED
//   Armoury            gold uppercase title, segmented tabs right, a BARE ✕
//                      glyph with no button chrome, no footer
//   Load Game          centred display title with an ornament rule, a ROUND
//                      `×` (U+00D7, a different character), BACK / CONTINUE
//
// A player who learns "the way out is the boxed ✕ on the right" learns it four
// times. And each of the four had grown its own Escape handler, its own
// veil-click test and its own focus restore — four chances for three of them to
// be subtly wrong, which is exactly what an audit finds and a player meets.
//
// WHAT THIS FILE OWNS, AND WHAT IT DELIBERATELY DOES NOT.
//   OWNS   the close control (one glyph, one label, one hit box), the footer's
//          ORDER and EMPHASIS, and dismissal (Escape, veil click, focus return).
//   DOES NOT OWN the body. Settings scrolls a category pane, the Armoury runs a
//          three-pane splitter, Load Game lists slots. A shell that also claimed
//          the body would have to be right about all three, and would be the
//          kind of "shared component" that is really four components in a
//          trench coat. The chrome is the part that is genuinely one thing.
//
// THE FOOTER ORDER IS A RULE, NOT A SUGGESTION: the way OUT is left, the way
// FORWARD is right, and the forward one wears `.primary` (base.css). Load Game
// had BACK and CONTINUE the same weight and asked a border colour to carry the
// difference; the in-run footer spent DANGER RED on an act that saves. Red is
// for loss. `tone: 'danger'` is available and is meant to be rare.

import { esc } from './tooltip.js';

/** The one glyph. U+2715; the save-slot modal used U+00D7 and now does not. */
export const MODAL_CLOSE_GLYPH = '✕';

/**
 * The close control. One markup, one accessible name, one hit box — the tap
 * floor on both axes, because it is the control a player reaches for fastest.
 */
export function modalCloseButton({ label = 'Close', onClick = null, className = '', id = '' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  if (id) button.id = id;
  button.className = `subtle modal-close${className ? ` ${className}` : ''}`;
  button.title = `${label} (Esc)`;
  button.setAttribute('aria-label', label);
  button.textContent = MODAL_CLOSE_GLYPH;
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

/**
 * modalCloseButtonHtml() — the same control for a host that builds its chrome
 * as a string. Kept beside the element form on purpose: two shapes of ONE
 * answer is the point of this file, and a caller that had to hand-write the
 * markup would be a fifth chrome by the end of the week.
 */
export function modalCloseButtonHtml({ label = 'Close', className = '', id = '' } = {}) {
  return `<button type="button"${id ? ` id="${esc(id)}"` : ''} class="subtle modal-close${className ? ` ${esc(className)}` : ''}"`
    + ` title="${esc(label)} (Esc)" aria-label="${esc(label)}">${MODAL_CLOSE_GLYPH}</button>`;
}

/**
 * modalFooter({ note, secondary, primary }) → a <footer> in the house order.
 *
 * `note` is the quiet sentence some footers carry ("Progress saves to the
 * active slot."). `secondary` is any number of ways back; `primary` is the one
 * way forward and is the only button that gets the emphasis. Passing two
 * primaries is not prevented here — nothing in a stylesheet can count buttons —
 * but it is visible in one line of a caller's diff, which is the whole gain.
 */
export function modalFooter({ note = '', secondary = [], primary = null, className = '' } = {}) {
  const footer = document.createElement('footer');
  footer.className = `modal-foot${className ? ` ${className}` : ''}`;
  if (note) {
    const span = document.createElement('span');
    span.className = 'modal-foot-note';
    span.textContent = note;
    footer.appendChild(span);
  }
  const actions = document.createElement('div');
  actions.className = 'modal-foot-actions';
  for (const button of secondary) if (button) actions.appendChild(button);
  if (primary) {
    // `className` and not `classList` — this component is mounted by tests that
    // drive it in a minimal DOM (tests/confirmation-modal.test.mjs), and a
    // shared piece of chrome must not need more of the platform than the
    // surfaces that share it.
    if (!` ${primary.className} `.includes(' primary ')) {
      primary.className = `${primary.className} primary`.trim();
    }
    actions.appendChild(primary);
  }
  footer.appendChild(actions);
  return footer;
}

/**
 * bindModalDismiss({ veil, panel, close }) → release()
 *
 * Escape, a click on the veil itself, and focus return, once. Two details that
 * were NOT the same in all four copies and are the reason this is shared:
 *
 *   TOPMOST WINS. Escape closes the modal that is on top, not every modal that
 *   is listening. The test is the LAST `[aria-modal="true"]` in the document —
 *   the same answer veil.js gives for input ownership, asked the cheap way.
 *   A copy that skipped it closed the Armoury underneath a confirmation.
 *
 *   THE CLICK MUST BE ON THE VEIL, not merely inside it. `e.target === veil`
 *   and not `!panel.contains(e.target)`: the second form closes the modal when
 *   a drag that began on a slider ends outside the panel, which is a real way
 *   to lose a settings change mid-gesture.
 */
export function bindModalDismiss({ veil, panel, close, opener = document.activeElement } = {}) {
  const onKeydown = (event) => {
    if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) return;
    const top = [...document.querySelectorAll('[aria-modal="true"]')].at(-1);
    if (top !== panel) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };
  const onClick = (event) => { if (event.target === veil) close(); };
  document.addEventListener('keydown', onKeydown, true);
  veil.addEventListener('click', onClick);
  return function release({ restoreFocus = true } = {}) {
    document.removeEventListener('keydown', onKeydown, true);
    veil.removeEventListener('click', onClick);
    if (restoreFocus && opener?.isConnected && typeof opener.focus === 'function') {
      opener.focus({ preventScroll: true });
    }
  };
}
