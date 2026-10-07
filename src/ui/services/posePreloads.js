import { reducedMotionRequested } from '../motion.js';
import { liteRendering } from '../performance.js';
import { builtInFor } from '../highResArt.js';

// Share a small working set across remounts. The browser owns decoded-image
// caching; this only bounds the preload objects retained by the game.
const groups = new Map();
const MAX_GROUPS = 4;

export function preloadPoses(key, urls) {
  if (typeof Image === 'undefined' || reducedMotionRequested() || liteRendering()) return [];
  if (groups.has(key)) {
    const images = groups.get(key);
    groups.delete(key); groups.set(key, images);
    return images;
  }
  const images = [...new Set(urls)].map(src => {
    const image = new Image(); image.decoding = 'async';
    // A missing high-res frame retries once with the built-in art, here, so
    // the pose never plays a blank frame while the fallback loads.
    image.onerror = () => { image.onerror = null; const fallback = builtInFor(src); if (fallback) image.src = fallback; };
    image.src = src;
    return image;
  });
  groups.set(key, images);
  while (groups.size > MAX_GROUPS) groups.delete(groups.keys().next().value);
  return images;
}

export function clearPosePreloads() { groups.clear(); }
