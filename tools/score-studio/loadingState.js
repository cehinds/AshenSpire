// tools/score-studio/loadingState.js — pure helpers for Score Studio's card & art loading indicators.
// No DOM here, so tests/score-studio.test.mjs can verify the logic directly in Node.

export const DEFAULT_ART_LOAD_TIMEOUT_MS = 15000;

/**
 * Parse an optional QA/preview shot mode from a URL query string.
 * Supports ?shot=loading (holds the initial card-pool loading state visible)
 * and ?shot=art-loading (holds the non-blocking card-art progress bar visible).
 */
export function parseLoadingShotMode(search = '') {
  try {
    const params = new URLSearchParams(String(search || ''));
    const shot = params.get('shot');
    if (shot === 'loading' || shot === 'art-loading') return shot;
  } catch { /* ignore malformed search strings */ }
  return null;
}

/**
 * Compute an integer percentage (0..100) for card-art loading progress.
 */
export function artLoadingPercent(settled, total) {
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
  if (safeTotal === 0) return 100;
  const safeSettled = Math.max(0, Math.min(safeTotal, Math.floor(Number(settled) || 0)));
  return Math.round((safeSettled / safeTotal) * 100);
}

/**
 * Format the non-blocking card-art loading strip label.
 */
export function formatArtLoadingStatus(settled, total) {
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
  if (safeTotal === 0) return 'Loading card art…';
  const safeSettled = Math.max(0, Math.min(safeTotal, Math.floor(Number(settled) || 0)));
  const noun = safeTotal === 1 ? 'card' : 'cards';
  return `Loading card art… ${safeSettled} / ${safeTotal} ${noun}`;
}

/**
 * Summarize image completion across a list of card tile descriptors:
 * each entry is `{ complete: boolean }[]` representing the images inside one tile.
 */
export function summarizeTileArtLoad(tileImageLists) {
  const list = Array.isArray(tileImageLists) ? tileImageLists : [];
  let total = 0;
  let settled = 0;
  for (const imgs of list) {
    if (!Array.isArray(imgs) || imgs.length === 0) continue;
    total++;
    if (imgs.every((img) => Boolean(img?.complete))) settled++;
  }
  const pending = Math.max(0, total - settled);
  return {
    total,
    settled,
    pending,
    percent: artLoadingPercent(settled, total),
    complete: pending === 0,
    text: formatArtLoadingStatus(settled, total),
  };
}
