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
 * Runtime exports cap sprites and backgrounds at 256px on the longer side.
 * Aspect ratios and smaller originals are preserved; card portraits keep their own rule.
 * Four-scene atlases share the same 256px ceiling (128px per tile).
 * Smaller originals are never enlarged. Sprite encoding
 * spends fewer bytes on figures so maps and backgrounds retain more detail.
 * Source masters remain untouched; these rules apply to delivered twins.
 */
export const POLICY = Object.freeze({
  maxEdge: 720,
  quality: 50,
  alphaQuality: 50,
  // First match wins.
  overrides: Object.freeze([
    Object.freeze({ prefixes: Object.freeze(['ashen-crown', 'cinder-reach', 'drowned-coast', 'hollow-weald', 'pale-marches'].map(id => `environments/${id}-combat.webp`)), maxEdge: 256, maxHeight: 256, quality: 78, alphaQuality: 80 }),
    Object.freeze({ prefixes: Object.freeze(['bg/', 'environments/', 'prologue/', 'player-polish/scenes/']), maxEdge: 256, maxHeight: 256, quality: 78, alphaQuality: 80 }),
    // Full portrait cards retain 720px resolution; a small compression change
    // keeps the complete roster inside the owner's 100 MB download maximum.
    Object.freeze({ prefixes: Object.freeze(['cards/extended/']), maxEdge: 720, quality: 44, alphaQuality: 50 }),
    // Every figure, frame and effect uses the same reduction, including small
    // cropped poses. Registration and playback timing remain in native units.
    Object.freeze({ prefixes: Object.freeze(SPRITE_ASSET_FAMILIES.map(family => `${family}/`)), maxEdge: 256, quality: 12, alphaQuality: 25 }),
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
 * Mobile art's share of the owner's 100 MB maximum, reserving 18.5 MB for code, CSS and alternative artwork
 * and counting base64 growth (4/3). The complete portrait library exceeds the
 * preferred 69 MB art target (80 MB including code), while retaining the
 * 720px card resolution. Delivery validation must also measure the
 * finished single file against 100 MB, including actual code and metadata.
 *
 * Counted as the bundle inlines it: each distinct image once
 * (`distinctInlinedBytes`), since the bundler aliases byte-identical files.
 */
// The complete card portrait library uses the owner's already-approved 100 MB
// maximum. Reserve 18.5 MB for code, CSS and alternative artwork and measure the finished file at delivery.
// 69 MB remains the preferred art target (80 MB including code), not the cap.
export const MOBILE_ART_INLINED_BUDGET_BYTES = 81_500_000;

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
  const scale = Math.min(1, policy.maxEdge / Math.max(width, height), policy.maxHeight ? policy.maxHeight / height : 1);
  if (scale >= 1) return { width, height };
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
