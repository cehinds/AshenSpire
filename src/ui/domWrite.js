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
