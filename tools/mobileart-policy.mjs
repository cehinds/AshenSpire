// tools/mobileart-policy.mjs — the one home for what "mobile art" means.
//
// The mobile edition is the same game with smaller art. Which files shrink, by
// how much, and how the result is judged are stated HERE and nowhere else, so
// the generator, the bundler (tools/bundle.mjs) and the gates cannot disagree
// about the shape of the tree they share. Since docs/EXTERNAL-ASSETS-PLAN.md
// step 13 the generator and its --check (tools/mobile-art.mjs) live in
// cehinds/AshenSpire-art, beside its own copy of this file; here the bundler
// and tools/verify-shipped.mjs still read it. This module is pure: no main, no
// writes, Node core only, so the bundler can import it without running a tool.
//
// It is listed in BUILD_IDENTITY_FILES (tools/buildversion.mjs): a change here
// changes what the mobile bundle carries, so it moves build identity.

import { createHash } from 'node:crypto';
// Shared with AshenSpire-art's released uniform light-sprite policy.
const SPRITE_ASSET_FAMILIES = Object.freeze([
  'animations', 'sprites', 'poses', 'painted-outfits', 'readiness-poses',
  'enemy-poses', 'enemy-states', 'defeated-poses', 'enemies-unity',
  'enemies-expansion', 'combat-effects', 'pose-effects', 'equipment',
]);

/** Where the shrunken twins live, mirroring assets/ path for path. */
export const MOBILE_ASSET_DIR = 'assets-mobile';

/**
 * The encoding policy. One rule for every runtime .webp under assets/:
 *   · an image whose longer side is over `maxEdge` px is resized so that side
 *     is `maxEdge` (aspect preserved — the renderers only ever use ratios of
 *     the natural size, see combatSpriteGeometry.js); smaller images keep
 *     their size;
 *   · every image is re-encoded lossy at `quality` with lossy alpha at
 *     `alphaQuality`; an unresized re-encode that is not smaller keeps the
 *     source bytes.
 * Non-webp art (svg) is copied verbatim. Authoring-only trees are excluded by
 * the same runtimeAsset() rule the full build uses.
 *
 * Raised 2026-10-04 at the owner's ask ("art quality is way too low for
 * mobile; 480 to 720p", budget up to 100 MB, preferably under 80 MB): figures,
 * frames and effects at most 480 px (the 512 animation frames were 160 px),
 * everything else — backdrops, maps, cards, prologue, interface — at most
 * 720 px. Measured on hd-assets-v11: about 51 MB raw, 68 MB inlined.
 */
export const POLICY = Object.freeze({
  maxEdge: 720,
  quality: 50,
  alphaQuality: 50,
  // First match wins.
  overrides: Object.freeze([
    // Every figure, frame and effect uses the same reduction, including small
    // cropped poses. Registration and playback timing remain in native units.
    Object.freeze({ prefixes: Object.freeze(SPRITE_ASSET_FAMILIES.map(family => `${family}/`)), maxEdge: 480, quality: 32, alphaQuality: 25 }),
  ]),
});

/**
 * The policy one twin is held to: POLICY with the first override whose prefix
 * starts `rel` (a path relative to assets/) laid over it.
 */
export function policyFor(rel, policy = POLICY) {
  const hit = (policy.overrides || []).find((row) => row.prefixes.some((prefix) => rel.startsWith(prefix)));
  if (!hit) return policy;
  const { prefixes, ...rule } = hit;
  return { ...policy, ...rule };
}

/**
 * The ceiling the light single file is held to, in bytes. Decimal, because
 * "100 MB" is what a phone's download sheet prints. The owner's numbers
 * (2026-10-04, up from 30 MB set 2026-09-24): at most 100 MB, preferably under
 * 80 MB — the art budget below is what keeps it under 80.
 */
export const MOBILE_BUNDLE_BUDGET_BYTES = 100_000_000;

/**
 * Where the mobile art itself has to land for the file to stay under the
 * owner's preferred 80 MB: that less the code (~11 MB at 0.7.1.920), counted
 * after base64 growth (4/3). A twin tree over this is caught by --check before
 * anyone builds with it.
 *
 * Counted as the bundle inlines it: each distinct image once
 * (`distinctInlinedBytes`), since the bundler aliases byte-identical files.
 */
export const MOBILE_ART_INLINED_BUDGET_BYTES = 69_000_000;

/** base64 length of `n` raw bytes — what an inlined asset costs the bundle. */
export function inlinedBytes(n) {
  return Math.ceil(n / 3) * 4;
}

/**
 * distinctAssetId(buf, ext) → the identity tools/bundle.mjs aliases on: the
 * bytes AND the file type, so two files never share a data URI of the wrong MIME.
 */
export function distinctAssetId(buf, ext = '') {
  return `${String(ext).toLowerCase()}:${createHash('sha1').update(buf).digest('hex')}`;
}

/**
 * distinctInlinedBytes(files) → what a set of files costs the bundle when each
 * distinct content is inlined once (the bundler aliases byte-identical files of
 * the same type). `files` are buffers or { buf, ext }.
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
  const edge = Math.max(width, height);
  if (!(edge > policy.maxEdge)) return { width, height };
  const scale = policy.maxEdge / edge;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
