// src/ui/imageHints.js — the one place that decides how an <img> is handed to
// the browser.
//
// There are sixteen places in this codebase that make an image, and before this
// file every one of them made the same implicit decision by saying nothing:
// decode synchronously, on the main thread, in the frame the element mounts.
// That is free on a desktop and it is not free on a phone. The shipped build
// carries its art inlined as data: URIs, so a 350x490 WebP is already in memory
// and the only work left is the decode — which lands on the main thread at
// exactly the moment a screen is being built, which is the moment there is no
// budget for it.
//
// So the policy lives here, stated once, and the render sites ask for it.
//
// TWO HINTS, AND THEY ARE NOT THE SAME KIND OF THING:
//
//   `decoding="async"` is a decode hint. It says the browser may decode off the
//   main thread and paint the image a frame or two later than its parent. It
//   cannot cause an image not to appear. It is applied to everything.
//
//   `loading="lazy"` is a FETCH hint, and it has a failure mode: an image that
//   is display:none, translated off-screen, or inside a zero-size ancestor is
//   never "near the viewport", so the browser may never load it. Every combat
//   effect overlay in this codebase is exactly that shape — absolutely
//   positioned, often starting at opacity 0 behind a transform. Blanket-lazying
//   them would trade a decode stall for invisible hit sparks.
//
//   So lazy is OPT-IN, per call site, with one test: does this image live in a
//   scrollable list where starting below the fold is the ordinary case? The
//   inventory grid, the atlas landmark rail and the smith's stock list pass it.
//   Nothing that animates does.
import { balance } from '../content/balance.js';

const hints = () => balance.ui.imageHints;

/**
 * The hints an image should carry, as a plain object.
 * `offscreen: true` marks an image that legitimately starts below the fold in a
 * scrolling list — see the note above for why that is not the default.
 */
export function imageHints({ offscreen = false } = {}) {
  const { decoding, lazy } = hints();
  const out = {};
  if (decoding) out.decoding = decoding;
  if (offscreen && lazy) out.loading = 'lazy';
  return out;
}

/** Apply the hints to a live element and return it, so it can wrap a create. */
export function hintImage(img, opts) {
  for (const [name, value] of Object.entries(imageHints(opts))) img.setAttribute(name, value);
  return img;
}

/**
 * The same hints as an attribute fragment, for the render sites that build
 * their markup as a template string. Always emits a leading space so it can be
 * dropped straight after a tag name or another attribute.
 */
export function imageHintAttrs(opts) {
  const attrs = Object.entries(imageHints(opts)).map(([name, value]) => `${name}="${value}"`);
  return attrs.length ? ` ${attrs.join(' ')}` : '';
}
