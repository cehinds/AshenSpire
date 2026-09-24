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
 *
 * quality 50 → 47 on 2026-09-24, for every file alike: the eight prologue path
 * paintings (#1285) took the q50 tree to 40,295,512 inlined bytes, over the
 * re-derived art budget below (39,538,400). q49 measured 40,087,288 and q48
 * (sampled, 1 file in 10) ~39.73 MB — both over — so 47 is the highest that
 * fits: the full q47 tree inlines to 39,352,412. Scale and alpha are unchanged.
 */
export const POLICY = Object.freeze({
  scaleFrom: 384,
  scale: 0.5,
  quality: 47,
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
 * The safety margin the built mobile file keeps under its ceiling, in bytes.
 * Code and data grow build to build without touching art; this is the room
 * they have before a phone's download crosses the owner's number.
 */
export const MOBILE_BUNDLE_MARGIN_BYTES = 1_000_000;

/**
 * The measured size of everything in the mobile single file that is NOT the
 * inlined twin tree: code, styles, content data, the data: URI prefixes and
 * the few art payloads the CSS carries a second copy of. Measured 2026-09-24
 * at 0.7.1.455: a `bundle.mjs --mobile` build of 49,757,112 bytes whose twin
 * tree inlines to 40,295,512 — 9,461,600 bytes. (The earlier "~8.3 MB code"
 * estimate predates 0.7.1.4xx and was ~1.2 MB low.) Re-measure when the code
 * share moves: bundle bytes minus the sum of inlinedBytes() over assets-mobile/.
 */
export const MOBILE_MEASURED_NON_ART_BYTES = 9_461_600;

/**
 * Where the mobile art itself has to land for the bundle to fit: the ceiling,
 * less the margin, less the measured non-art share — 50,000,000 − 1,000,000 −
 * 9,461,600. A twin tree over this is caught by --check before anyone builds
 * with it; the bundle's own bytes are still bundle.mjs's and
 * verify-shipped.mjs's to hold under the ceiling.
 */
export const MOBILE_ART_INLINED_BUDGET_BYTES =
  MOBILE_BUNDLE_BUDGET_BYTES - MOBILE_BUNDLE_MARGIN_BYTES - MOBILE_MEASURED_NON_ART_BYTES;

/** base64 length of `n` raw bytes — what an inlined asset costs the bundle. */
export function inlinedBytes(n) {
  return Math.ceil(n / 3) * 4;
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
