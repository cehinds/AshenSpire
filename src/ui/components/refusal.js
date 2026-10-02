// src/ui/components/refusal.js — a control the player can SEE and cannot USE.
//
// Constantine, on his phone, 2026-08-07: "for armament, I can't select the empty
// slot to equip available weapons." The slot opened. What opened was seventeen
// armaments with sixteen locked, and A LOCKED CHIP HAD NO CLICK HANDLER AT ALL.
// He tapped a weapon he could plainly see, nothing moved, and the lock reason was
// a line of small text below the fold. A screen refusing without saying so reads
// as a dead control — which is exactly what he reported it as.
//
// THE PROPERTY: a control a player can see and cannot use must say WHY, WHERE
// THEY ARE LOOKING. Sunna's law failing at the moment it exists for.
//
// THE MECHANISM, and it is the shape of the thing rather than a fix for one
// screen: the reason is an ARGUMENT, not an afterthought. There is no way to
// mark a control as refusing without saying why, BECAUSE SAYING WHY IS HOW YOU
// MARK IT. A future screen cannot forget the explanation the way this one did,
// for the same reason a future refusal path in bundle.mjs cannot forget to leave
// the page: it never has to remember. Binding to the act, not to the caller.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not set `disabled`. A disabled
// button is unfocusable, untappable and silent — it cannot be asked. A refusing
// control stays reachable by pointer, by keyboard and by the pad focus cursor
// (input.js's FOCUS_SELECTOR takes `button:not([disabled])`), and answers all
// three: hover and focus through the shared tooltip, tap through this module.
// `aria-disabled` says the same thing to a screen reader WITHOUT removing the
// control from the tree, which is the whole difference.

import { attachTooltip, showTooltipAt, hideTooltip, esc } from './tooltip.js';

// ---- the reason as VISIBLE TEXT (docs/FINISH.md §6) -------------------------
// A tooltip and `aria-disabled` are not enough for a Next / Continue / Confirm
// that refuses: a player on a phone never hovers, and a sighted player never
// reads aria. So every refusing forward control also writes its reason as a
// line of text under it — the kit's FieldNote (kit.css `.as-fieldnote`), worn
// with `.as-reasonnote`. The line sits under the control's button row when it
// stands in one (a footer's buttons stay one row), else right after the
// control, and it is hidden whenever the control is usable, or it or its row is
// hidden.
const ROW = '.modal-btnrow, .as-choicerow';
let noteSerial = 0;

/**
 * reasonNote(el, { after }) → show(text)
 *
 * Gives `el` its visible reason line and returns the one writer for it:
 * `show('Choose a card first.')` puts the sentence up, `show(null)` (or '')
 * takes it down. `after` names the node the line follows when the default
 * seat (the enclosing button row, else the control) is not the right one.
 * The line is seated lazily, so a control built before it is mounted still
 * gets its line on the first show after (or the microtask after) it lands.
 */
export function reasonNote(el, { after = null } = {}) {
  if (!el) return () => {};
  const id = `reason-note-${++noteSerial}`;
  const note = document.createElement('p');
  note.className = 'as-fieldnote as-reasonnote';
  note.id = id;
  note.setAttribute('role', 'status');
  note.setAttribute('aria-live', 'polite');
  note.hidden = true;
  const described = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  if (!described.includes(id)) el.setAttribute('aria-describedby', [...described, id].join(' '));
  let text = '';
  let seatedAfter = null;
  const seat = () => {
    if (note.isConnected) return;
    const anchor = after || (el.closest ? el.closest(ROW) : null) || el;
    if (anchor.parentNode) { anchor.after(note); seatedAfter = anchor; }
  };
  // The line sits OUTSIDE its row, so hiding the row (character creation's
  // `.cc-primary-continue-row` before a stat mode is chosen) does not hide it.
  // It is down whenever the control, or any node from the control up to the
  // node it follows, is hidden; kit.css's `[hidden] + .as-reasonnote` rule
  // keeps that true when the row is hidden after this paint.
  const off = (n) => !!n && (!!n.hidden || (!!n.style && n.style.display === 'none'));
  const stowed = () => {
    if (off(el)) return true;
    if (!seatedAfter) return false;
    for (let n = el.parentNode; n && n !== seatedAfter.parentNode; n = n.parentNode) if (off(n)) return true;
    return off(seatedAfter);
  };
  const paint = () => {
    seat();
    note.textContent = text;
    note.hidden = !text || stowed();
  };
  queueMicrotask(paint);
  return function show(next) {
    text = String(next == null ? '' : next).trim();
    paint();
  };
}

/**
 * reasonWhenDisabled(el, reasonFn, options) → refresh()
 *
 * For a forward control the screen disables natively (`el.disabled`) or marks
 * `aria-disabled="true"`: call `refresh()` wherever the screen changes that
 * state and the visible line follows it. `reasonFn()` is read only while the
 * control refuses. It may answer null for a refusal that is only a beat long
 * (an entrance still playing, a write in flight): those clear by themselves,
 * and a line that flashes up and away reads as noise, not as a reason.
 * tools/disabled-reason.mjs is what holds every lasting refusal to a reason.
 */
export function reasonWhenDisabled(el, reasonFn, options = {}) {
  if (!el) return () => {};
  const show = reasonNote(el, options);
  return function refresh() {
    const refusing = !!el.disabled || el.getAttribute('aria-disabled') === 'true';
    const why = refusing ? String(reasonFn() ?? '').trim() : '';
    show(why);
    return why;
  };
}

/** How long a tapped reason stays up before it gets out of the way (ms). */
const TAP_MS = 4000;
let tapTimer = null;

/**
 * refuses(el, reason) → el
 *
 *   reason   a string, or a function returning one (read at show time, so a
 *            reason that depends on live numbers stays true)
 *
 * Marks `el` as refusing and gives it its voice. Returns the element so it can
 * be written inline where the control is built.
 *
 * An EMPTY reason is a defect, not a quiet default: this function is the only
 * thing in the tree that may mark a control refusing, so a silent refusal can
 * only be born here, and it says so on the console naming the control. It still
 * marks the element — failing loud beats failing closed when the alternative is
 * a control that looks usable and is not.
 */
export function refuses(el, reason) {
  if (!el) return el;
  const why = typeof reason === 'function' ? reason : () => reason;
  const now = String(why() == null ? '' : why()).trim();
  if (!now) {
    console.error(
      'refuses(): a control was marked refusing with no reason —',
      el.className || el.tagName, '/', (el.textContent || '').trim().slice(0, 40)
    );
  }
  el.setAttribute('aria-disabled', 'true');
  // The marker the audit reads (tools/refusal-audit.mjs). It carries the reason
  // itself rather than a flag, so "is it marked" and "does it have a reason" are
  // ONE fact with one home and cannot drift apart.
  el.dataset.refusal = now;
  attachTooltip(el, () => esc(String(why() == null ? '' : why())));
  el.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    say(el, ev, why);
  });
  return el;
}

/** Put the reason where the finger landed, and take it away again. */
function say(el, ev, why) {
  const text = String(why() == null ? '' : why()).trim();
  // A tap event carries no useful pointer position on some touch paths, so fall
  // back to the control's own box — the reason must appear AT the control, and
  // "we could not read the pointer" is not a licence to show nothing.
  const r = el.getBoundingClientRect();
  const x = ev && ev.clientX ? ev.clientX : r.left + r.width / 2;
  const y = ev && ev.clientY ? ev.clientY : r.top + r.height / 2;
  showTooltipAt(x, y, esc(text) || esc('This is not available yet.'));
  clearTimeout(tapTimer);
  tapTimer = setTimeout(hideTooltip, TAP_MS);
}

/**
 * refusesWhen(el, reasonFn, otherwise) → refresh()
 *
 * The same property as refuses(), for a control that refuses SOMETIMES: BEGIN
 * THE CLIMB with an unusable seed typed into the field beside it. `reasonFn` is
 * read at every refresh and at every click.
 *
 *   reasonFn()  a string → the control refuses and this is why
 *               null/undefined → the control is usable; nothing is marked
 *   otherwise   the tooltip while it is usable (a function or a string).
 *               Required in spirit: this control has a tooltip either way, and
 *               attachTooltip may only be called once per element, so the two
 *               texts have to arrive together.
 *
 * WHY THIS IS A SIBLING AND NOT A REWRITE OF refuses(). The two disagree about
 * what "no reason" means, and the disagreement is real, not cosmetic. For
 * refuses() an empty reason is a DEFECT — the control refuses regardless and
 * says so on the console, which is what makes a silent refusal impossible to
 * write. For refusesWhen() an absent reason is the ordinary case: it means the
 * control works. Folding them would make one of those two meanings unsayable.
 *
 * It does NOT block the click on its own. It says why, and the screen's own
 * handler asks reasonFn the same question — one home for the condition, and no
 * dependence on which listener happens to be registered first.
 */
export function refusesWhen(el, reasonFn, otherwise, noteOptions = {}) {
  if (!el) return () => {};
  const show = reasonNote(el, noteOptions);
  const why = () => {
    const r = reasonFn();
    return r == null ? null : String(r);
  };
  const other = typeof otherwise === 'function' ? otherwise : () => String(otherwise == null ? '' : otherwise);

  function refresh() {
    const now = why();
    if (now) {
      el.setAttribute('aria-disabled', 'true');
      el.dataset.refusal = now;
    } else {
      el.removeAttribute('aria-disabled');
      delete el.dataset.refusal;
    }
    // The same sentence, as text the player can read without asking.
    show(now);
  }

  attachTooltip(el, () => {
    const now = why();
    return now ? esc(now) : other();
  });
  el.addEventListener('click', (ev) => {
    const now = why();
    if (!now) return; // usable — the screen's own handler runs
    ev.preventDefault();
    ev.stopPropagation();
    say(el, ev, () => now);
  });
  refresh();
  return refresh;
}

/**
 * refusalOf(el) → the reason string, or null when the control does not refuse.
 * One reader for anything that wants to ask (tests, the audit, a future screen).
 */
export function refusalOf(el) {
  if (!el || el.getAttribute('aria-disabled') !== 'true') return null;
  return el.dataset ? (el.dataset.refusal || '') : '';
}
