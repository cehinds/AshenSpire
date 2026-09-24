// tools/mobileart-policy.mjs — the one home for what "mobile art" means.
//
// The mobile edition is the same game with smaller art. Which files shrink, by
// how much, and how the result is judged are stated HERE and nowhere else, so
// the generator (tools/mobile-art.mjs), the bundler (tools/bundle.mjs) and the
// gate (tools/mobile-art.mjs --check, tools/verify-shipped.mjs) cannot disagree
// about the shape of the tree they share. This module is pure: no main, no
// writes, Node core only, so the bundler can import it without running a tool.
//
// It is listed in BUILD_IDENTITY_FILES (tools/buildversion.mjs): a change here
// changes what the mobile bundle carries, so it moves build identity.

import { createHash } from 'node:crypto';

/** Where the shrunken twins live, mirroring assets/ path for path. */
export const MOBILE_ASSET_DIR = 'assets-mobile';

/**
 * The encoding policy. One rule for every runtime .webp under assets/:
 *   · an image whose longer side is at least `scaleFrom` px is resized to
 *     `scale` of its size on each axis (aspect preserved — the renderers only
 *     ever use ratios of the natural size, see combatSpriteGeometry.js);
 *   · every image is re-encoded lossy at `quality` with lossy alpha at
 *     `alphaQuality`; a re-encode that is not smaller keeps the source bytes.
 * Non-webp art (svg) is copied verbatim. Authoring-only trees are excluded by
 * the same runtimeAsset() rule the full build uses.
 *
 * Measured 2026-09-20 on the 0.7.1 tree: 179 MB of runtime art → ~29 MB, the
 * 3,071 512×512 animation frames (122 MB) going to 256×256 at ~5 KB each.
 */
export const POLICY = Object.freeze({
  scaleFrom: 384,
  scale: 0.5,
  quality: 50,
  alphaQuality: 60,
});

/**
 * The ceiling the mobile single file is held to, in bytes. Decimal, because
 * "50 MB" is what a phone's download sheet prints. The owner's number
 * (2026-09-20): under 50 MB. verify-shipped.mjs fails a mobile artifact above
 * it, and bundle.mjs refuses to write one.
 */
export const MOBILE_BUNDLE_BUDGET_BYTES = 50_000_000;

/**
 * Where the mobile art itself has to land for the bundle to fit: the budget
 * less everything else in the file (~9.5 MB of code, CSS and fonts at
 * 0.7.1.475) and base64 growth (4/3). A twin tree over this is caught by
 * --check before anyone builds with it.
 *
 * Counted as the bundle inlines it: each DISTINCT image once
 * (see `distinctInlinedBytes`), because the bundler maps byte-identical files
 * to one data URI.
 *
 * Raised 40 → 40.4 MB on the owner's call (2026-09-24), when #1285's
 * prologue steps took the tree 0.3 MB over. Not higher: with ~9.5 MB of
 * non-art in the file, art past ~40.49 MB would pass --check and still be
 * refused at 50 MB by the bundler. The mobile file keeps its own 50 MB ceiling
 * above (MOBILE_BUNDLE_BUDGET_BYTES), which verify-shipped still enforces.
 */
export const MOBILE_ART_INLINED_BUDGET_BYTES = 40_400_000;

/** base64 length of `n` raw bytes — what an inlined asset costs the bundle. */
export function inlinedBytes(n) {
  return Math.ceil(n / 3) * 4;
}

/**
 * distinctAssetId(buf, ext) → the identity the bundler aliases on: the bytes
 * AND the file type, so two files can never share a data URI of the wrong MIME.
 */
export function distinctAssetId(buf, ext = '') {
  return `${String(ext).toLowerCase()}:${createHash('sha1').update(buf).digest('hex')}`;
}

/**
 * distinctInlinedBytes(files) → what a set of files costs the bundle when
 * each distinct content is inlined once (tools/bundle.mjs aliases duplicates).
 * Content is compared byte for byte, keyed by a SHA-1 of the bytes.
 */
export function distinctInlinedBytes(files, hash = distinctAssetId) {
  const seen = new Set();
  let total = 0;
  for (const file of files) {
    const buf = Buffer.isBuffer(file) ? file : file.buf;
    const id = hash(buf, Buffer.isBuffer(file) ? '' : file.ext);
    if (seen.has(id)) continue;
    seen.add(id);
    total += inlinedBytes(buf.length);
  }
  return total;
}

/**
 * Parse the canvas size out of a WebP header. Returns null for anything that is
 * not a WebP (or an unknown chunk), never throws.
 */
export function webpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), kind: 'VP8X' };
  }
  if (chunk === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, kind: 'VP8' };
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff), kind: 'VP8L' };
  }
  return null;
}

/**
 * The size the policy gives a twin of a `width`×`height` source. Rounded, not
 * floored, so a 641-wide source and a 640-wide one land where cwebp -resize
 * would put them.
 */
export function twinDimensions({ width, height }, policy = POLICY) {
  if (Math.max(width, height) < policy.scaleFrom) return { width, height };
  return { width: Math.round(width * policy.scale), height: Math.round(height * policy.scale) };
}
