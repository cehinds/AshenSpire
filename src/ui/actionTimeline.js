// Presentation scheduler. Engine state is already committed; hooks consume
// receipts only. A single timer owns each stage and every exit finishes once.
export function runActionTimeline(beats, hooks, timing, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null, watchdog = null, finished = false, actor = null, index = 0;
  const safe = fn => { try { return fn?.(); } catch (error) { hooks.onError?.(error); } };
  const stage = (name, beat, fn) => { safe(() => hooks.onStage?.(name, beat)); return safe(fn); };
  const schedule = (fn, ms = 0) => { clearTimer(timer); timer = setTimer(() => { timer = null; if (!finished) fn(); }, Math.max(0, Number(ms) || 0)); };
  const cancelActor = () => { safe(() => actor?.cancel?.()); actor = null; };
  const finish = (flush = false) => {
    if (finished) return;
    finished = true;
    clearTimer(timer); clearTimer(watchdog); cancelActor();
    if (flush) safe(() => hooks.onFlush?.());
    safe(() => hooks.onDone?.());
  };
  const next = () => {
    if (index >= beats.length) { finish(); return; }
    const beat = beats[index++];
    if (beat.banner || !beat.actorId || beat.kind === 'reveal') {
      stage('intent', beat, () => hooks.onIntent?.(beat));
      stage('damage', beat, () => hooks.onNumbers?.(beat));
      stage('hud', beat, () => hooks.onApply?.(beat));
      stage('resolution', beat, () => hooks.onResolution?.(beat));
      schedule(next, beat.banner ? timing.bannerMs : timing.stepMs);
      return;
    }
    stage('intent', beat, () => hooks.onIntent?.(beat));
    schedule(() => {
      stage('action', beat, () => hooks.onAction?.(beat));
      schedule(() => {
        actor = stage('sprite', beat, () => hooks.onSprite?.(beat, timing.spriteSpeed));
        const impact = Math.max(0, Number(actor?.impactMs) || 0);
        const total = Math.max(impact, Number(actor?.totalMs) || 0);
        // Authored handles are the final timing authority. A longer real clip
        // must extend the budget even when the caller underestimated its cap.
        clearTimer(watchdog); watchdog = setTimer(() => finish(true), budget + total);
        schedule(() => {
          const contactHold = stage('contact', beat, () => { actor?.contact?.(); return hooks.onContact?.(beat, actor); });
          // Some sprite services extend their recovery after contact (hit-stop).
          const remaining = Math.max(total - impact + (Number(contactHold) || 0), Number(safe(() => actor?.remainingMs?.())) || 0);
          schedule(() => {
            cancelActor();
            schedule(() => {
              const groups = safe(() => hooks.reactionGroups?.(beat)) || [beat];
              let groupIndex = 0;
              const react = () => {
                if (groupIndex >= groups.length) {
                  stage('resolution', beat, () => hooks.onResolution?.(beat));
                  schedule(next, timing.stepMs); return;
                }
                const group = groups[groupIndex++];
                const reactionLife = Number(stage('reaction', group, () => hooks.onReaction?.(group))) || 0;
                schedule(() => {
                  stage('damage', group, () => hooks.onNumbers?.(group));
                  // Yield a task so numbers paint before replacement of the HUD.
                  schedule(() => {
                    stage('hud', group, () => hooks.onApply?.(group));
                    if (groupIndex >= groups.length) {
                      stage('resolution', beat, () => hooks.onResolution?.(beat));
                      schedule(next, Math.max(timing.stepMs, reactionLife - timing.reactionMs));
                    } else schedule(react, Math.max(timing.stepMs, reactionLife - timing.reactionMs));
                  });
                }, timing.reactionMs);
              };
              react();
            }, timing.afterSpriteMs);
          }, remaining);
        }, impact);
      }, timing.wordMs);
    }, timing.intentMs);
  };
  // Budget derives from every added wait and the caller's real authored clip
  // upper bound; long clips never trigger the legacy short watchdog.
  const perAction = timing.intentMs + timing.wordMs + timing.afterSpriteMs + timing.reactionMs + timing.stepMs
    + Math.max(0, Number(safe(() => hooks.maxSpriteMs?.(timing.spriteSpeed))) || 0);
  const budget = 2000 + beats.reduce((budget, beat) => budget + Math.max(perAction + Math.max(0, (safe(() => hooks.reactionGroups?.(beat))?.length || 1) - 1) * (timing.reactionMs + timing.stepMs), timing.bannerMs + timing.stepMs), 0);
  watchdog = setTimer(() => finish(true), budget);
  next();
  return { pauseForSkip: () => { clearTimer(timer); clearTimer(watchdog); cancelActor(); }, cancel: () => finish(true), skip: () => finish(true), get finished() { return finished; } };
}
