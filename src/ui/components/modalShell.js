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
export function modalFooter({ note = '', secondary = [], primary = null, className = '', size = 'medium' } = {}) {
  if (!BUTTON_ROW_SIZES.includes(size)) throw new Error(`Unknown footer size '${size}'`);
  const footer = document.createElement('footer');
  footer.className = `modal-foot${className ? ` ${className}` : ''}`;
  if (note) {
    // The text sits in an inner span so the note can be whole or absent (ui.css
    // .modal-foot-note's container query), never a one-letter stub.
    const span = document.createElement('span');
    span.className = 'modal-foot-note';
    const text = document.createElement('span');
    text.textContent = note;
    span.appendChild(text);
    footer.appendChild(span);
  }
  // THE FOOT IS A BUTTON ROW. Constantine, 2026-09-03: "make primary and
  // secondary buttons at the bottom uniform in size". They were not: the foot
  // carried a data-size the ladder never read, because the ladder's rules
  // are written for `.modal-btnrow` and this row was only `.modal-foot-actions`
  // — so each button hugged its own label. Wearing both classes puts every
  // foot on the same ladder as every other row: one step for all its buttons,
  // and `stretch` (ui.css) gives them one height.
  const actions = document.createElement('div');
  actions.className = 'modal-foot-actions modal-btnrow';
  actions.dataset.size = size;
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

/**
 * BUTTON WIDTHS COME OFF A LADDER, NOT OFF THE LABELS.
 *
 * Measured 2026-09-03 across the doors: a footer of three buttons produced
 * three widths and, at 390 px, wrapped onto two lines — which then made two
 * sibling doors different HEIGHTS, because a foot that grew by a line grows
 * the shell. Two rules close both halves of that:
 *
 *   THE WIDEST LABEL IN A ROW PICKS THE STEP FOR EVERY BUTTON IN IT. Four
 *   steps for the whole game (`short`, `medium`, `long`, `fill`), so siblings
 *   land on one width and rows across the game land on one of four.
 *
 *   A LABEL NEVER WRAPS. When the row runs out of room the PADDING yields
 *   (ui.css), never the line count.
 *
 * `square` is per-button and opts out of the step: an icon control is a glyph
 * in a box, it takes the ROW's height, and it stays square by `aspect-ratio`.
 * Not `vh` — the whole app is zoomed by `--ui-zoom` and viewport units ignore
 * that zoom, which ui.css records the cost of twice.
 */
export const BUTTON_ROW_SIZES = Object.freeze(['short', 'medium', 'long', 'fill']);

export function buttonRow({ size = 'medium', buttons = [], className = '' } = {}) {
  if (!BUTTON_ROW_SIZES.includes(size)) throw new Error(`Unknown button row size '${size}'`);
  const row = document.createElement('div');
  row.className = `modal-btnrow${className ? ` ${className}` : ''}`;
  row.dataset.size = size;
  for (const button of buttons) if (button) row.appendChild(button);
  return row;
}

/**
 * modalHead({ eyebrow, title, tabs, ... }) → a <header class="modal-head">
 *
 * IDENTITY LEFT, ACTIONS RIGHT, AND IDENTITY HAS EXACTLY TWO FORMS: an
 * eyebrow + title pair, or a tab strip. There is no third, and there is no
 * both — `tabs` REPLACES the pair when supplied. That is a decision and not a
 * discovery: it is what lets Settings (tabs) and the flask door (eyebrow +
 * title) be the same component rather than two. If the house later wants tabs
 * UNDER a persistent title, this is the one function that changes.
 *
 * The close control is not optional and is not the caller's. Every door keeps
 * its way out in the same corner, in the same box, wearing the same glyph.
 */
export function modalHead({
  eyebrow = '',
  title = '',
  titleId = '',
  tabs = null,
  onTab = null,
  extras = null,
  showMenuButton = null,
  onMenu = null,
  menuLabel = 'Menu',
  closeLabel = 'Close',
  onClose = null,
} = {}) {
  const tabList = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
  if (!tabList.length && !title) {
    throw new Error('modalHead requires a title, or tabs to stand in for one');
  }
  const head = document.createElement('header');
  head.className = 'modal-head';

  if (tabList.length) {
    const strip = document.createElement('div');
    strip.className = 'modal-tabs';
    strip.setAttribute('role', 'tablist');
    for (const tab of tabList) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'modal-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(!!tab.selected));
      button.dataset.modalTab = tab.id || tab.label;
      button.dataset.focusable = 'true';
      button.textContent = tab.label;
      if (onTab) button.addEventListener('click', () => onTab(tab.id || tab.label));
      strip.appendChild(button);
    }
    head.appendChild(strip);
  } else {
    const identity = document.createElement('div');
    identity.className = 'modal-head-id';
    if (eyebrow) {
      const kind = document.createElement('span');
      kind.className = 'modal-eyebrow';
      kind.textContent = eyebrow;
      identity.appendChild(kind);
    }
    const heading = document.createElement('h2');
    if (titleId) heading.id = titleId;
    heading.textContent = title;
    identity.appendChild(heading);
    head.appendChild(identity);
  }

  const actions = document.createElement('div');
  actions.className = 'modal-head-actions';
  if (extras) actions.appendChild(extras);
  // ☰ IS NOT A DEFAULT, IT IS A PROPERTY OF WHAT THE DOOR IS.
  //
  // Constantine, 2026-09-03: the menu and close buttons "should come by
  // default to all modal shells, I think, but improve on this if you think
  // otherwise". Close: yes, unconditionally, and it already did — one way out,
  // same corner, every door. ☰: no, and the reason is what it opens. The
  // hamburger opens the quick menu, which is a way to LEAVE for somewhere
  // else. On a door that asks a question — "Load slot 1?", "Quit without
  // saving?" — that is a third answer to a two-answer question, and it can
  // navigate away mid-decision. On a door that IS a place, it is the obvious
  // control and its absence is the defect.
  //
  // So the caller does not decide and does not have to remember: a TAB STRIP
  // is what marks a door as a place rather than a question (Settings, the
  // Armoury, the in-run overlay all carry one; the flask door, the confirm
  // door and the inspector do not), so ☰ follows the tabs. `showMenuButton`
  // stays overridable in both directions for the surface that is genuinely an
  // exception, but nothing has to pass it to be right.
  const wantsMenu = showMenuButton == null ? tabList.length > 0 : !!showMenuButton;
  if (wantsMenu) {
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'subtle modal-iconbtn';
    menu.dataset.size = 'square';
    menu.dataset.focusable = 'true';
    menu.title = menuLabel;
    menu.setAttribute('aria-label', menuLabel);
    menu.textContent = '☰';
    if (onMenu) menu.addEventListener('click', onMenu);
    actions.appendChild(menu);
  }
  const close = modalCloseButton({ label: closeLabel, onClick: onClose });
  close.dataset.size = 'square';
  close.dataset.focusable = 'true';
  actions.appendChild(close);
  head.appendChild(actions);
  return head;
}

/**
 * openModal(spec) → { veil, panel, head, body, foot, close }
 *
 * THE ONE DOOR-OPENER. Before this, every surface assembled its own veil,
 * panel, head and dismissal, and the audit found what that always finds: of
 * the surfaces carrying their own chrome, `piles.js` had NO Escape handler and
 * NO close control at all — the pile viewer could only be dismissed by
 * clicking the veil, which is not reachable from a keyboard or a pad. That is
 * not a styling divergence, it is a surface a player can get stuck in.
 *
 * What the caller supplies is CONTENT and INTENT. What it never supplies again
 * is chrome: the head (above), the footer's order and emphasis (modalFooter),
 * and Escape / veil-click / focus-return (bindModalDismiss) all come from
 * here, once.
 *
 * `body` is an element or a function that receives the body element — the
 * second form so a caller can fill a scroll container it does not have to
 * create. The body remains entirely the surface's own, for the reason at the
 * top of this file: a shell that also claimed the body would be five
 * components in a trench coat.
 */
/**
 * FOUR MODAL WIDTHS, AND A BODY PICKS THE SMALLEST THAT HOLDS IT.
 *
 * Every door used to type its own width (`44rem` here, `96rem` there, `76rem`
 * on the overlay), so "how wide is a modal" had as many answers as there were
 * modals — and the detail door's answer was too small: measured 2026-09-03, it
 * broke "Defend Block +2. Weight 7." across two lines and its flavour across
 * two more, beside an ArtWell that had taken a third of the width. Nothing was
 * CLIPPED, so no overflow rule fired; cramped is the same defect one step
 * earlier, and the fix is a wider box, not a smaller font.
 *
 *   sm  one short question, two answers            a confirmation
 *   md  one thing described, art beside prose      the flask/armament door
 *   lg  a rail and a pane, or two panes            settings, the armoury
 *   xl  a chooser beside an inspector              the shrine's upgrade door
 *
 * The rung is a NAME, so a body that cramps takes the next one and a body that
 * rattles takes the one below — and neither edits a length. `max-width` in the
 * stylesheet keeps the phone case working without a second declaration here.
 */
export const MODAL_SIZES = Object.freeze(['sm', 'md', 'lg', 'xl']);

export function openModal({
  size = 'md',
  className = '',
  eyebrow = '',
  title = '',
  tabs = null,
  onTab = null,
  headExtras = null,
  showMenuButton = null,
  onMenu = null,
  closeLabel = '',
  body = null,
  bodyClassName = '',
  note = '',
  secondary = [],
  primary = null,
  footSize = 'medium',
  onClose = null,
  opener = document.activeElement,
  host = document.body,
  role = 'dialog',
} = {}) {
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;
  const veil = document.createElement('div');
  veil.className = 'modal-veil';

  if (!MODAL_SIZES.includes(size)) throw new Error(`Unknown modal size '${size}'`);
  const panel = document.createElement('section');
  panel.className = `modal${className ? ` ${className}` : ''}`;
  panel.dataset.size = size;
  panel.setAttribute('role', role);
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', titleId);
  panel.tabIndex = -1;

  let release = null;
  const close = () => {
    if (!veil.isConnected) return;
    release?.();
    release = null;
    veil.remove();
    onClose?.();
  };

  const head = modalHead({
    eyebrow,
    title,
    titleId,
    tabs,
    onTab,
    extras: headExtras,
    showMenuButton,
    onMenu,
    closeLabel: closeLabel || (title ? `Close ${title}` : 'Close'),
    onClose: close,
  });
  // A tab strip carries no <h2>, so the label the dialog is named by has to be
  // the strip itself — otherwise `aria-labelledby` points at nothing and the
  // door announces as an unnamed dialog.
  if (!head.querySelector(`#${titleId}`)) head.querySelector('.modal-tabs')?.setAttribute('id', titleId);

  const bodyEl = document.createElement('div');
  bodyEl.className = `modal-body${bodyClassName ? ` ${bodyClassName}` : ''}`;
  if (typeof body === 'function') body(bodyEl);
  else if (body) bodyEl.appendChild(body);

  panel.append(head, bodyEl);

  const ways = Array.isArray(secondary) ? secondary.filter(Boolean) : [secondary].filter(Boolean);
  let foot = null;
  if (note || ways.length || primary) {
    foot = modalFooter({ note, secondary: ways, primary, size: footSize });
    // The ladder owns the actions row, so no caller can produce a ragged foot.
    foot.querySelector('.modal-foot-actions')?.classList.add('modal-btnrow');
    panel.appendChild(foot);
  }

  veil.appendChild(panel);
  host.appendChild(veil);
  release = bindModalDismiss({ veil, panel, close, opener });

  // Focus the way FORWARD when there is one, else the way out. Never the veil.
  const first = panel.querySelector('.modal-foot-actions .primary')
    || panel.querySelector('[data-focusable="true"]')
    || panel.querySelector('.modal-close');
  first?.focus?.({ preventScroll: true });

  return Object.freeze({ veil, panel, head, body: bodyEl, foot, close });
}
