// Container query units in a style a script writes, for a browser without them
// (Safari before 16). The stylesheets are repaired by src/ui/legacyCss.js and
// inline `style="..."` text by the container shim's attribute scan, but a value
// a script assigns through the CSSOM (`el.style.fontSize = '7.8cqw'`,
// `Object.assign(el.style, { ... })`, `style.cssText = ...`) is thrown away by
// such a browser the moment it is assigned, so it is rewritten first:
// `Cq('7.8cqw')` is `calc(7.8 * var(--cqw, 1%))` there and the same string
// everywhere else. docs/qa/IOS15-COMPAT.md row 4.
import { ReplaceCqUnits } from './legacyCss.js';

let supported;
/** True when the browser has cq units (and so needs no rewriting). */
export function CqSupported() {
  if (supported === undefined) supported = typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || CSS.supports('width', '1cqw');
  return supported;
}
/** Force the no-cq-units path (true) or return to detection (false), for tests and the forced browser check. */
export function ForceCqFallback(on) { supported = on ? false : undefined; }

const HAS_CQ = /Cq(?:w|h|i|b|min|max)\b/i;
/** A CSS value, or a `property:value;` declaration list, with cq units made valid where the browser lacks them. */
export function Cq(value) {
  return CqSupported() || typeof value !== 'string' || !HAS_CQ.test(value) ? value : ReplaceCqUnits(value);
}
/** A style object ({ fontSize: '7.8cqw', ... }) with every value passed through Cq(). */
export function CqStyle(style) {
  if (CqSupported() || !style) return style;
  return Object.fromEntries(Object.entries(style).map(([key, value]) => [key, Cq(value)]));
}
