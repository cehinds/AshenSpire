// A card preview is exact but not cheap: the engine clones the whole fight to
// price one card. One tap asks for the same card's preview many times (every
// hand card, the End Turn pulse, the target layer, the inspect button), all on
// one unchanged fight: 27 to 30 previews per tap, measured, over a second per
// tap on a phone at 6x CPU slowdown.
//
// The fight changes only through the engine's dispatch (and the few direct
// writes the screen names with `invalidate()`), so a preview is kept until the
// next of those and then dropped. The numbers shown are always the engine's.
// A preview that throws is never kept.
export function createPreviewMemo({ combat, preview, dispatch }) {
  const kept = new Map();
  const invalidate = () => kept.clear();
  return {
    invalidate,
    // Every state change goes through here: drop before (so the engine sees no
    // stale reads) and after (a refused dispatch can still have partly run).
    dispatch(target, intent) {
      invalidate();
      try { return dispatch(target, intent); } finally { invalidate(); }
    },
    previewCard(target, instanceId, targetId, upcastRanks) {
      if (target !== combat) return preview(target, instanceId, targetId, upcastRanks);
      const key = `${instanceId}|${targetId ?? ''}|${upcastRanks === undefined ? '' : JSON.stringify(upcastRanks)}`;
      if (kept.has(key)) return kept.get(key);
      const shown = preview(target, instanceId, targetId, upcastRanks);
      kept.set(key, shown);
      return shown;
    },
    get size() { return kept.size; },
  };
}
