// Pure catalog: the caller owns assetUrl and asynchronous browser loading.
import { RECIPIENT_EFFECT_SETTINGS } from './recipientEffectSettings.js';

export const RECIPIENT_EFFECT_ATLAS = RECIPIENT_EFFECT_SETTINGS.behavior.atlas;

export function recipientEffectAtlasEntry(shape) {
  const entry = Object.hasOwn(RECIPIENT_EFFECT_ATLAS, shape) ? RECIPIENT_EFFECT_ATLAS[shape] : null;
  return entry ? { ...entry, path: entry.asset } : null;
}

/** A resolved inline, pack or high-res URL proves bundled art is available.
 * A bare path does not prove a local file exists; renderers may explicitly
 * preload it in source/art-authoring mode and use the static fallback on error.
 */
export function recipientEffectArtAvailable(shape, resolveAsset) {
  const entry = recipientEffectAtlasEntry(shape);
  if (!entry || typeof resolveAsset !== 'function') return false;
  const resolved = resolveAsset(entry.asset);
  return typeof resolved === 'string' && resolved.length > 0 && resolved !== entry.asset;
}
