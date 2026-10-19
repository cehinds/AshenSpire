// Page-wide layout constants, read from computed style once and kept until the
// page's scale can have changed (docs/ai perf pass, 2026-10-19).
//
// The body's zoom, the root font size and the CSS custom properties the combat
// layout passes read (`--card-w-inspect`, the HUD tokens) are computed-style
// reads. Each one flushes any pending style change, and the layout passes that
// asked for them did so after every write they made, so a card play paid for
// dozens of style recalcs it did not need. None of them moves between two
// layout passes: main.js applyUiScale / applyDisplaySettings / applyCardSizeSettings
// write them as inline style or data attributes on <html> (after a debounced
// resize), and a Text size change rewrites <html style>. So a MutationObserver
// on <html> and <body> (no page-level listener) is the invalidation. The window
// size is deliberately not a key: window.innerWidth flushes style and layout.
//
// `takeRecords()` is checked at every read: a write made earlier in the same
// task has not been delivered to the observer yet, and must not be served stale.
let cache = null;
let observer = null;
const vars = new Map();

function watch() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(() => invalidateLayoutMetrics());
  const options = { attributes: true };
  observer.observe(document.documentElement, options);
  if (document.body) observer.observe(document.body, options);
}

/** Drop every cached constant (the next read measures again). */
export function invalidateLayoutMetrics() { cache = null; vars.clear(); }

function fresh() {
  watch();
  // A queued, undelivered attribute change on <html>/<body> means the cache is stale.
  if (observer && observer.takeRecords().length) invalidateLayoutMetrics();
}

/**
 * { zoom, rem, fontSize }: the body's CSS zoom, the reference rem (at least 16
 * physical px, as in the hand, footer and tray plans) and the root font-size
 * string. Identical to reading getComputedStyle each time.
 */
export function layoutMetrics() {
  fresh();
  if (cache) return cache;
  const fontSize = getComputedStyle(document.documentElement).fontSize;
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const rem = Math.max(16 / zoom, parseFloat(fontSize) || 16);
  cache = { zoom, rem, fontSize };
  return cache;
}

/** A custom property of <html>, trimmed, as getComputedStyle(root).getPropertyValue(name).trim(). */
export function rootCssVar(name) {
  fresh();
  if (vars.has(name)) return vars.get(name);
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  vars.set(name, value);
  return value;
}
