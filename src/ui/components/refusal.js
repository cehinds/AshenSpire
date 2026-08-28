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
export function refusesWhen(el, reasonFn, otherwise) {
  if (!el) return () => {};
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
