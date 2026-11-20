// The Popover API for Safari before 17 (iOS 15's Safari 15.6 included): the
// `popover` attribute, show/hide/togglePopover(), `popovertarget` invokers,
// light dismiss, Escape, and the `toggle` event with oldState/newState.
// docs/qa/IOS15-COMPAT.md, row 7.
//
// What it is NOT: a top layer. An open popover is `position: fixed` with a large
// z-index, so an ancestor with a transform or `contain` can still trap it. The
// game's own popovers (the customize menu button, the equipment "more" tags) place
// themselves with `position: fixed` coordinates, so that is enough for them.
//
// `:popover-open` is a SyntaxError for `matches()` in such a browser, so callers
// ask `IsPopoverOpen(el)`. In CSS the rewriter (src/ui/legacyCss.js) copies each
// rule that names `:popover-open` onto `[data-popover-open]`, the marker this
// polyfill keeps on an open popover.

export const OPEN_ATTRIBUTE = 'data-popover-open';

// Closed popovers are display:none and open ones sit above the page: the UA
// stylesheet rules a native popover gets. `:where` keeps them at zero
// specificity so any author rule wins, as it does against a UA rule.
export const POPOVER_UA_CSS = `
:where([popover]:not([${OPEN_ATTRIBUTE}])) { display: none; }
:where([popover][${OPEN_ATTRIBUTE}]) { position: fixed; inset: 0; width: fit-content; height: fit-content; margin: auto; padding: 0.25em; border: solid; overflow: auto; z-index: 2147483000; background: Canvas; color: CanvasText; }
`;

/** True when a native `:popover-open` exists, or the polyfill's marker is set. */
export function IsPopoverOpen(element) {
  if (!element) return false;
  try { return element.matches(':popover-open'); } catch { return element.hasAttribute?.(OPEN_ATTRIBUTE) === true; }
}

const KINDS_THAT_LIGHT_DISMISS = new Set(['', 'auto', 'hint']);
const kindOf = (element) => String(element.getAttribute('popover') ?? '').trim().toLowerCase();

/**
 * Install the polyfill on `win` (default: the page's window) unless the browser
 * has the real API. Returns true when it installed, false when native.
 */
export function InstallPopoverPolyfill(win = globalThis.window) {
  const Element = win?.HTMLElement;
  if (!Element || typeof Element.prototype.showPopover === 'function') return false;
  const doc = win.document;
  const open = [];                                   // open popovers, oldest first

  function fire(element, oldState, newState) {
    const event = new win.Event('toggle');
    event.oldState = oldState; event.newState = newState;
    element.dispatchEvent(event);
  }
  function show(element) {
    if (!element.hasAttribute('popover') || element.hasAttribute(OPEN_ATTRIBUTE)) return;
    // An auto popover closes the other auto popovers unless it sits inside them.
    if (KINDS_THAT_LIGHT_DISMISS.has(kindOf(element))) {
      for (const other of [...open]) if (other !== element && KINDS_THAT_LIGHT_DISMISS.has(kindOf(other)) && !other.contains(element)) hide(other);
    }
    element.setAttribute(OPEN_ATTRIBUTE, '');
    open.push(element);
    fire(element, 'closed', 'open');
  }
  function hide(element) {
    if (!element.hasAttribute(OPEN_ATTRIBUTE)) return;
    element.removeAttribute(OPEN_ATTRIBUTE);
    const at = open.indexOf(element);
    if (at >= 0) open.splice(at, 1);
    fire(element, 'open', 'closed');
  }
  Object.defineProperties(Element.prototype, {
    showPopover: { configurable: true, writable: true, value() { show(this); } },
    hidePopover: { configurable: true, writable: true, value() { hide(this); } },
    togglePopover: { configurable: true, writable: true, value(force) {
      const shouldOpen = force === undefined ? !this.hasAttribute(OPEN_ATTRIBUTE) : !!force;
      if (shouldOpen) show(this); else hide(this);
      return this.hasAttribute(OPEN_ATTRIBUTE);
    } },
  });

  const invokerOf = (target) => target?.closest?.('[popovertarget]') || null;
  const popoverFor = (invoker) => (invoker ? doc.getElementById(invoker.getAttribute('popovertarget')) : null);

  // popovertarget: a click on the invoker toggles its popover. Light dismiss
  // (below) ignores the invoker, so a click closes a menu it opened rather than
  // the dismissal closing it and this click opening it again.
  doc.addEventListener('click', (event) => {
    const invoker = invokerOf(event.target);
    const popover = popoverFor(invoker);
    if (!popover || invoker.disabled) return;
    const action = invoker.getAttribute('popovertargetaction');
    if (action === 'show') show(popover); else if (action === 'hide') hide(popover); else popover.togglePopover();
  });
  // Light dismiss: a press outside the popover (and not on its invoker) closes it.
  doc.addEventListener('pointerdown', (event) => {
    const target = event.target;
    for (const popover of [...open].reverse()) {
      if (!KINDS_THAT_LIGHT_DISMISS.has(kindOf(popover))) continue;
      if (popover.contains(target)) break;
      const invoker = invokerOf(target);
      if (invoker && popoverFor(invoker) === popover) break;
      hide(popover);
    }
  }, true);
  doc.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const top = [...open].reverse().find((popover) => KINDS_THAT_LIGHT_DISMISS.has(kindOf(popover)));
    if (top) hide(top);
  });

  if (doc.head && typeof doc.createElement === 'function') {
    const style = doc.createElement('style');
    style.setAttribute('data-popover-polyfill', '');
    style.textContent = POPOVER_UA_CSS;
    doc.head.insertBefore(style, doc.head.firstChild);
  }
  return true;
}
