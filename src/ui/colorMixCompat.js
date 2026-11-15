// color-mix() in a style a script writes, for a browser without it (Safari
// before 16.2). The stylesheets are repaired by src/ui/legacyCss.js, but a
// value assigned through `el.style.x = ...` is thrown away by such a browser
// when it is assigned. `colorMix(value)` returns `value` untouched where
// color-mix works, and otherwise the same value with each `color-mix(in srgb,
// ...)` computed to a static rgba(), reading `var(--token)` from the root's
// computed style. docs/qa/IOS15-COMPAT.md row 5.
import { replaceColorMix } from './legacyCss.js';

let supported;
export function colorMixSupported() {
  if (supported === undefined) supported = typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || CSS.supports('color', 'color-mix(in srgb, red 50%, blue)');
  return supported;
}
/** Force the unsupported path (true) or return to detection (false), for tests and the forced browser check. */
export function forceColorMixFallback(on) { supported = on ? false : undefined; }

/** `value` with color-mix() computed away when the browser lacks it; unresolvable mixes leave the value as it was. */
export function colorMix(value, root = globalThis.document?.documentElement) {
  if (colorMixSupported() || typeof value !== 'string' || !/color-mix\(/i.test(value)) return value;
  const style = root && globalThis.getComputedStyle ? globalThis.getComputedStyle(root) : null;
  const context = { vars: { get: (name) => style?.getPropertyValue(name).trim() || undefined }, loose: new Map(), approximatedColorMix: [] };
  return replaceColorMix(value, context) ?? value;
}
