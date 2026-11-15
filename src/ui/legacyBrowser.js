// The one door for older WebKit: iOS 15 (Safari 15.6), the newest OS an iPhone
// SE 1st gen runs. main.js imports this FIRST and calls InstallLegacyBrowser()
// before anything renders. In a browser that has every feature it does nothing
// at all: no stylesheet is read or touched. docs/qa/IOS15-COMPAT.md.
//
//   ?legacy=ios15   force the repairs on in a current browser (Chromium) so the
//                   fallback path can be looked at and tested; the page also
//                   behaves as if container queries and cq units are absent.
//   ?legacy=off     force them off.
import { AnyFlag, CollectVars, CreateContext, DetectFlags, DownlevelCss, FLAGS } from './legacyCss.js';
import { StartContainerShim } from './containerShim.js';
import { ForceCqFallback } from './cqCompat.js';
import { ForceColorMixFallback } from './colorMixCompat.js';
import { InstallPopoverPolyfill } from './popoverPolyfill.js';

// A sheet with none of these needs no rewrite (and most of the 28 stylesheets do not need all of them).
const NEEDS_REPAIR = /color-mix\(|cq(?:w|h|i|b|min|max)\b|@container|container(?:-type|-name)?\s*:|overflow(?:-[xy])?\s*:[^;}]*\bclip|user-select|backdrop-filter|:popover-open/i;

/** Which repairs apply: the URL override, else what CSS.supports says. */
export function LegacyFlags(win = globalThis.window) {
  const override = (() => { try { return new win.URLSearchParams(win.location.search).get('legacy'); } catch { return null; } })();
  if (override === 'off') return Object.fromEntries(FLAGS.map((name) => [name, false]));
  if (override === 'ios15') {
    // Popover is left native in the forced path: Chromium has it, and the polyfill is unit-tested on its own.
    return Object.fromEntries(FLAGS.map((name) => [name, name !== 'popover']));
  }
  const supports = win.CSS && typeof win.CSS.supports === 'function' ? win.CSS.supports.bind(win.CSS) : () => true;
  return DetectFlags(supports);
}

const absolutizeUrls = (css, base) => css.replace(/url\(\s*(['"]?)(?!data:|https?:|\/\/|#)([^'")]+)\1\s*\)/gi, (whole, q, ref) => {
  try { return `url("${new URL(ref, base).href}")`; } catch { return whole; }
});

async function sheetTexts(doc) {
  const nodes = [...doc.querySelectorAll('style, link[rel~="stylesheet"]')];
  return Promise.all(nodes.map(async (node) => {
    if (node.tagName === 'STYLE') return { node, css: node.textContent };
    try {
      const response = await fetch(node.href);
      return { node, css: absolutizeUrls(await response.text(), node.href) };
    } catch { return { node, css: '' }; }
  }));
}

/**
 * Repair the page for this browser. Returns null when nothing is needed, else
 * { flags, context, shim, done } where `done` resolves once every stylesheet is rewritten.
 */
export function InstallLegacyBrowser(win = globalThis.window) {
  if (!win?.document) return null;
  const flags = LegacyFlags(win);
  if (!AnyFlag(flags)) return null;
  const doc = win.document;
  if (flags.popover) InstallPopoverPolyfill(win);
  if (flags.cqUnits) ForceCqFallback(true);
  if (flags.colorMix) ForceColorMixFallback(true);
  const context = CreateContext();
  const result = { flags, context, shim: null, done: null };

  const rewrite = (sheets) => {
    if (flags.colorMix) for (const { css } of sheets) CollectVars(css, context);
    for (const { node, css } of sheets) {
      if (!css || !NEEDS_REPAIR.test(css)) continue;
      const out = DownlevelCss(css, flags, context);
      if (node.tagName === 'STYLE') node.textContent = out;
      else {
        const style = doc.createElement('style');
        style.setAttribute('data-legacy-from', node.getAttribute('href') || '');
        style.textContent = out;
        node.parentNode.insertBefore(style, node);
        node.remove();
      }
    }
    if (flags.containers && !result.shim) result.shim = StartContainerShim({ win, queries: context.queries, containers: context.containers });
  };

  const inline = [...doc.querySelectorAll('style')];
  const linked = doc.querySelectorAll('link[rel~="stylesheet"]').length;
  if (!linked) {
    rewrite(inline.map((node) => ({ node, css: node.textContent })));
    result.done = Promise.resolve(result);
  } else {
    result.done = sheetTexts(doc).then((sheets) => { rewrite(sheets); return result; });
  }
  return result;
}

/** InstallLegacyBrowser that can never stop the game booting: a failure is logged and the page runs unrepaired. */
export function InstallLegacyBrowserSafely(win = globalThis.window, log = console) {
  try { return InstallLegacyBrowser(win); } catch (error) { log.error?.('[legacy-browser] repairs failed; booting without them', error); return null; }
}
