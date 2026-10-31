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
//
// PRE-WARM. After a dispatch the fight is final for the whole playback, and the
// finish render asks for a fixed set of quotes. `prewarm(jobs)` fills them in
// idle time, jobs run only while the idle slot is long enough
// for a whole preview, so a pre-warm never lands inside a frame. Any
// invalidate (dispatch, direct write, teardown) drops the pending jobs: a
// stale quote is never kept. With no requestIdleCallback (Safari) it does
// nothing and the finish render pays as before.
export const PREWARM_MIN_IDLE_MS = 24;
const PREWARM_MAX_SKIPS = 40;
const globalIdle = () => (typeof globalThis.requestIdleCallback === 'function'
  ? { request: cb => globalThis.requestIdleCallback(cb), cancel: h => globalThis.cancelIdleCallback?.(h) } : null);

/** The jobs a finished play's render will ask for, through the screen's own wrappers so the keys are the same. */
export function fightPrewarmJobs({ combat, previewCard, projectIntent, upcastRanks }) {
  if (!combat || combat.result) return [];
  return [
    ...combat.piles.hand.map(inst => { const id = inst.instanceId, ranks = upcastRanks(id); return () => previewCard(combat, id, undefined, ranks); }),
    ...combat.enemies.filter(enemy => enemy.alive).map(enemy => () => projectIntent(combat, enemy.id)),
  ];
}

export function createPreviewMemo({ combat, preview, dispatch, idle }) {
  const kept = new Map();
  let queue = [], handle = null, generation = 0, skips = 0;
  const cancelPrewarm = () => {
    queue = []; skips = 0; generation += 1;
    if (handle !== null) { try { (idle || globalIdle())?.cancel(handle); } catch { /* nothing to cancel */ } handle = null; }
  };
  // The player's-eye clone of the fight (engine previewCard builds it when enemy
  // knowledge is on) is shared by every card priced on one unchanged fight.
  let view = {};
  const invalidate = () => { cancelPrewarm(); kept.clear(); view = {}; };
  const schedule = (api) => {
    const mine = generation;
    handle = api.request((deadline) => {
      handle = null;
      if (mine !== generation || !queue.length) return;
      if (deadline.timeRemaining() < PREWARM_MIN_IDLE_MS) { // a frame is near: keep the job, retry next idle
        if (++skips <= PREWARM_MAX_SKIPS) schedule(api); else queue = [];
        return;
      }
      skips = 0;
      // Another job only while the slot still holds a whole preview: idle slots are rare during playback
      // and a 50 ms one fits two.
      do {
        const job = queue.shift();
        try { job(); } catch { /* a preview that throws is not kept; the render handles it */ }
      } while (queue.length && mine === generation && deadline.timeRemaining() >= PREWARM_MIN_IDLE_MS);
      if (queue.length) schedule(api);
    });
  };
  return {
    invalidate,
    // Returns whether anything was scheduled (false without idle callbacks).
    prewarm(jobs) {
      cancelPrewarm();
      const api = idle || globalIdle();
      if (!api || !jobs?.length) return false;
      queue = [...jobs];
      schedule(api);
      return true;
    },
    get pendingPrewarm() { return queue.length; },
    // Any other pure read of the unchanged fight (an enemy's intent, its plan),
    // kept under the same lifetime as a preview. `compute` must not mutate it.
    memo(key, compute) {
      const name = 'memo:' + key;
      if (kept.has(name)) return kept.get(name);
      const value = compute();
      kept.set(name, value);
      return value;
    },
    // Every state change goes through here: drop before (so the engine sees no
    // stale reads) and after (a refused dispatch can still have partly run).
    dispatch(target, intent) {
      invalidate();
      try { return dispatch(target, intent); } finally { invalidate(); }
    },
    previewCard(target, instanceId, targetId, upcastRanks, options) {
      if (target !== combat) return preview(target, instanceId, targetId, upcastRanks, options);
      const key = JSON.stringify([instanceId, targetId, upcastRanks, options?.rangeRoute ?? 'advance', target.rangeState]);
      if (kept.has(key)) return kept.get(key);
      const shown = preview(target, instanceId, targetId, upcastRanks, { ...options, knowledgeView: view });
      kept.set(key, shown);
      return shown;
    },
    get size() { return [...kept.keys()].filter(k => typeof k !== 'string' || !k.startsWith('memo:')).length; },
  };
}
