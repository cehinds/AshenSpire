// src/ui/artFallback.js — art that failed to load, and how it comes back
// (docs/EXTERNAL-ASSETS-PLAN.md step 5, review of #1471).
//
// A missing image falls back to what each screen already draws without it:
// a glyph, a placeholder recipe (src/ui/assets.js), or nothing. Re-pointing
// (highResArt.js refreshMountedArt) cannot bring such art back once the <img>
// is gone or swapped, so EVERY place that does that marks the node standing in
// for the art with `data-art-placeholder` and a way to put the art back.
// restoreArtPlaceholders() runs every one of them, whatever screen it is on:
// main.js calls it once the built-in art arrives after a failed load (a Retry)
// and nothing is open over the screen. The helpers below are the shapes the
// screens use; a site with its own builder marks its node itself.

import { currentArtUrl } from './highResArt.js';

export const ART_PLACEHOLDER_ATTR = 'data-art-placeholder';

/** Mark `node` as standing in for art that failed; `restore()` puts the art back. */
export function markArtPlaceholder(node, restore) {
  if (!node || typeof node.setAttribute !== 'function' || typeof restore !== 'function') return node;
  node.setAttribute(ART_PLACEHOLDER_ATTR, '');
  node.ashenRestoreArt = restore;
  return node;
}

/** The failed <img>, asked for again at the URL its id resolves to now. */
function reload(img) {
  const src = img.getAttribute('src');
  const now = src ? currentArtUrl(src) : src;
  // Only when the url changes: setting the same src again on a loaded image
  // need not fire another load.
  if (now && now !== src) img.setAttribute('src', now);
}

/**
 * swapOnError(img, makePlaceholder) — when `img` fails, it is replaced by the
 * node makePlaceholder() returns (a glyph), marked so a restore swaps the same
 * <img> back and asks for its art again.
 */
export function swapOnError(img, makePlaceholder) {
  if (!img || typeof img.addEventListener !== 'function') return img;
  // Marked whether or not the image is in the page yet: a well built ahead
  // and inserted later gets its glyph, and its art back, all the same.
  img.addEventListener('error', () => {
    const stand = makePlaceholder();
    markArtPlaceholder(stand, () => { stand.replaceWith(img); reload(img); });
    img.replaceWith(stand);
  });
  return img;
}

/**
 * hideOnError(img) — when `img` fails it is hidden (the art "dies quietly"),
 * and marked so a restore shows it again and asks for its art again.
 */
export function hideOnError(img) {
  if (!img || typeof img.addEventListener !== 'function') return img;
  img.addEventListener('error', () => {
    img.hidden = true;
    markArtPlaceholder(img, () => {
      // Re-pointing (refreshMountedArt) may already have loaded it on its new
      // url before this restore runs, with nobody listening: shown at once
      // then; otherwise shown when it loads (review of #1471).
      reload(img);
      if (img.complete && img.naturalWidth > 0) img.hidden = false;
      else img.addEventListener('load', () => { img.hidden = false; }, { once: true });
    });
  });
  return img;
}

/** Put back every marked art placeholder under `root`. Returns how many. */
export function restoreArtPlaceholders(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  let restored = 0;
  for (const node of [...root.querySelectorAll(`[${ART_PLACEHOLDER_ATTR}]`)]) {
    const restore = node.ashenRestoreArt;
    node.removeAttribute(ART_PLACEHOLDER_ATTR);
    delete node.ashenRestoreArt;
    if (typeof restore !== 'function') continue;
    try { restore(); restored += 1; } catch { /* a restore must not stop the others */ }
  }
  return restored;
}
