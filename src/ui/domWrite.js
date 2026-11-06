// Write-only-on-change DOM helpers. Setting an attribute, dataset key or inline style to the value it
// already holds still queues a MutationObserver record and a style recalculation, so a screen that
// re-applies its state on every render repaints what did not change. Each helper reads first and
// writes only when the value differs; they return true when they wrote.

/** setData(el, key, value): el.dataset[key] = String(value) unless it already holds that text. */
export function setData(el, key, value) {
  const text = String(value);
  if (el.dataset[key] === text) return false;
  el.dataset[key] = text;
  return true;
}

/** setAttr(el, name, value): el.setAttribute(name, String(value)) unless it already holds that text. */
export function setAttr(el, name, value) {
  const text = String(value);
  if (el.getAttribute(name) === text) return false;
  el.setAttribute(name, text);
  return true;
}

/** setStyle(el, prop, value): el.style[prop] = value unless the inline style already reads that value. */
export function setStyle(el, prop, value) {
  const text = String(value);
  if (el.style[prop] === text) return false;
  el.style[prop] = text;
  return true;
}

/** setVar(el, name, value): el.style.setProperty(name, value) unless the custom property already reads that value. */
export function setVar(el, name, value) {
  const text = String(value);
  if (el.style.getPropertyValue(name) === text) return false;
  el.style.setProperty(name, text);
  return true;
}

// ---- In-place reconciliation -------------------------------------------------------------------------------
// A HUD that rebuilds its nodes on every state change makes the browser re-create, re-style and repaint what
// did not change (owner, 2026-11-06: the HUDs must not redraw once combat starts). `morph(live, fresh)` writes a
// freshly built node's text, attributes, classes and inline style into the node already on screen and keeps the
// live node, so only the values that differ reach the DOM. A child that cannot be paired (a different tag, or an
// interactive element of another kind) is replaced, and the caller is told by the returned count.

const built = new WeakMap(); // live element -> what its builder last wrote: { attrs, classes, style }
const tokens = text => String(text || '').split(/\s+/).filter(Boolean);
const declarations = text => {
  const map = new Map();
  for (const part of String(text || '').split(';')) {
    const at = part.indexOf(':');
    if (at > 0) map.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return map;
};
const attrNames = el => [...el.attributes].map(attr => attr.name);

/** hooks(el): the per-node bag a builder fills with live behaviour (`tip`: the tooltip's content function). */
export function hooks(el) { return el.__hooks || (el.__hooks = {}); }

/** onLive(el, type, handler, options): addEventListener once, through a hook that `morph` replaces from a rebuild,
 *  so a kept node answers with the newest closure and never a stale one. */
export function onLive(el, type, handler, options) {
  const bag = hooks(el), key = `on:${type}${options === true || options?.capture ? ':capture' : ''}`;
  const first = !bag[key];
  bag[key] = handler;
  if (first) el.addEventListener(type, event => el.__hooks[key]?.(event), options);
}

/** Records what a builder wrote on `el` so a later `morph` knows which attributes it owns. */
export function markBuilt(el) {
  if (el.nodeType !== 1) return el;
  built.set(el, { attrs: new Set(attrNames(el).filter(name => name !== 'class' && name !== 'style')), classes: new Set(tokens(el.getAttribute('class'))),
    style: new Set(declarations(el.getAttribute('style')).keys()) });
  for (const child of [...el.childNodes]) markBuilt(child);
  return el;
}

function syncAttributes(live, fresh) {
  const before = built.get(live) || { attrs: new Set(), classes: new Set(), style: new Set() };
  const next = { attrs: new Set(), classes: new Set(tokens(fresh.getAttribute('class'))), style: new Set() };
  for (const name of attrNames(fresh)) {
    if (name === 'class' || name === 'style') continue;
    next.attrs.add(name);
    setAttr(live, name, fresh.getAttribute(name));
  }
  for (const name of before.attrs) if (!next.attrs.has(name) && live.hasAttribute(name)) live.removeAttribute(name);
  // Classes the builder owns follow it; a class another module added (visible, leaving, selected) stays.
  const classes = new Set(tokens(live.getAttribute('class')));
  for (const name of before.classes) if (!next.classes.has(name)) classes.delete(name);
  for (const name of next.classes) classes.add(name);
  if (classes.size || live.hasAttribute('class')) setAttr(live, 'class', [...classes].join(' '));
  // The same for inline declarations: layout writes (left, width, custom properties) outside the builder survive.
  const wanted = declarations(fresh.getAttribute('style'));
  for (const [name, value] of wanted) { next.style.add(name); setVar(live, name, value); }
  for (const name of before.style) if (!next.style.has(name)) live.style.removeProperty(name);
  built.set(live, next);
}

// Two elements pair only when morphing one into the other keeps its meaning: the same tag, and for a control (a
// button, link, field, or anything focusable or carrying hooks) the same builder class set too.
const interactive = el => /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/i.test(el.tagName) || el.hasAttribute('tabindex') || !!el.__hooks;
function pairs(live, fresh) {
  if (live.nodeType !== fresh.nodeType) return false;
  if (live.nodeType !== 1) return true;
  if (live.tagName !== fresh.tagName || live.namespaceURI !== fresh.namespaceURI) return false;
  if (!interactive(live) && !interactive(fresh)) return true;
  const was = built.get(live)?.classes || new Set(tokens(live.getAttribute('class')));
  const now = new Set(tokens(fresh.getAttribute('class')));
  return was.size === now.size && [...now].every(name => was.has(name));
}

/** morph(live, fresh): make `live` read as `fresh` by writing only differences; returns how many nodes it had
 *  to add, remove or replace (0 when the structure matched). `fresh` and its children are consumed. */
export function morph(live, fresh) {
  let swaps = 0;
  syncAttributes(live, fresh);
  if (fresh.__hooks) live.__hooks = { ...live.__hooks, ...fresh.__hooks };
  const have = [...live.childNodes], want = [...fresh.childNodes];
  want.forEach((next, index) => {
    const current = have[index];
    if (!current) { markBuilt(next); live.appendChild(next); swaps++; return; }
    if (!pairs(current, next)) { markBuilt(next); live.replaceChild(next, current); swaps++; return; }
    if (next.nodeType === 1) swaps += morph(current, next);
    else if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
  });
  for (const extra of have.slice(want.length)) { live.removeChild(extra); swaps++; }
  return swaps;
}
