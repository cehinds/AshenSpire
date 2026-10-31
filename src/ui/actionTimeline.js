// Presentation scheduler. Engine state is already committed; hooks consume
// receipts only. A single timer owns each stage and every exit finishes once.
export function runActionTimeline(beats, hooks, timingIn, {
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  const createdAt = now();
  // Waits a caller leaves out are zero, so a partial timing object still runs.
  const timing = { intentMs: 0, wordMs: 0, afterSpriteMs: 0, resultMs: 0, reactionMs: 0, damageMs: 0, resetMs: 0, stepMs: 0, bannerMs: 0, ...timingIn };
  let timer = null, watchdog = null, watchdogDeadline = 0, finished = false, actor = null, index = 0;
  const safe = fn => { try { return fn?.(); } catch (error) { hooks.onError?.(error); } };
  const stage = (name, beat, fn) => { safe(() => hooks.onStage?.(name, beat)); return safe(fn); };
  const schedule = (fn, ms = 0) => {
    clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      if (finished) return;
      // Timers can run late after a long main-thread task. Their original
      // deadline still wins; a delayed phase must not renew the watchdog.
      if (now() >= watchdogDeadline) { finish(true, true); return; }
      fn();
    }, Math.max(0, Number(ms) || 0));
  };
  const cancelActor = () => { safe(() => actor?.cancel?.()); actor = null; };
  const finish = (flush = false, watchdogExpired = false) => {
    if (finished) return;
    finished = true;
    clearTimer(timer); clearTimer(watchdog); cancelActor();
    if (watchdogExpired) safe(() => hooks.onWatchdog?.());
    if (flush) safe(() => hooks.onFlush?.());
    safe(() => hooks.onDone?.());
  };
  const armWatchdog = () => {
    clearTimer(watchdog);
    watchdog = setTimer(() => finish(true, true), Math.max(0, watchdogDeadline - now()));
  };
  const creditWatchdog = ms => {
    if (ms > 0 && now() < watchdogDeadline) {
      watchdogDeadline += ms;
      armWatchdog();
    }
  };
  const next = () => {
    if (now() >= watchdogDeadline) { finish(true, true); return; }
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
    // The action word belongs to the same stage as the intent: no gap when intentMs is 0.
    const act = fn => timing.intentMs > 0 ? schedule(fn, timing.intentMs) : fn();
    act(() => {
      stage('action', beat, () => hooks.onAction?.(beat));
      schedule(() => {
        actor = stage('sprite', beat, () => hooks.onSprite?.(beat, timing.spriteSpeed));
        const spriteStart = now();
        const impact = Math.max(0, Number(actor?.impactMs) || 0);
        const total = Math.max(impact, Number(actor?.totalMs) || 0);
        // Authored handles are the final timing authority. A longer real clip
        // may extend the original deadline only by the part not already
        // reserved by maxSpriteMs. Re-adding the full duration here made each
        // actor's clip extra slack on top of the per-beat reservation.
        const spriteExcess = Math.max(0, total - reservedSpriteMs);
        creditWatchdog(spriteExcess);
        schedule(() => {
          const contactHold = stage('contact', beat, () => { actor?.contact?.(); return hooks.onContact?.(beat, actor); });
          // Some sprite services extend their recovery after contact (hit-stop).
          const reportedRemaining = Number(safe(() => actor?.remainingMs?.()));
          const remaining = Math.max(0, total + (Number(contactHold) || 0) - (now() - spriteStart),
            Number.isFinite(reportedRemaining) ? reportedRemaining : 0);
          // The actor reservation already includes its authored total. Only
          // a longer actual post-contact hold contributes new wait time.
          creditWatchdog(Math.max(0, impact + remaining - Math.max(reservedSpriteMs, total)));
          schedule(() => {
            cancelActor();
            if (beat.telegraph) {
              stage('resolution', beat, () => hooks.onResolution?.(beat));
              schedule(next, Math.max(timing.resetMs, timing.stepMs));
              return;
            }
            schedule(() => {
              const groups = safe(() => hooks.reactionGroups?.(beat)) || [beat];
              let groupIndex = 0;
              // D11 order, one gap at every boundary: result word, sprite
              // reaction, damage numbers and bars, reset, then the next item.
              const react = () => {
                const group = groups[groupIndex++];
                stage('result', group, () => hooks.onResult?.(group));
                schedule(() => {
                  const reactionLife = Number(stage('reaction', group, () => hooks.onReaction?.(group))) || 0;
                  // Nominal reaction and damage waits were reserved per group.
                  creditWatchdog(Math.max(0, reactionLife - timing.reactionMs - timing.damageMs));
                  schedule(() => {
                    stage('damage', group, () => hooks.onNumbers?.(group));
                    // Yield a task so numbers paint before replacement of the HUD.
                    schedule(() => {
                      stage('hud', group, () => hooks.onApply?.(group));
                      const rest = Math.max(timing.damageMs, reactionLife - timing.reactionMs);
                      if (groupIndex < groups.length) { schedule(react, rest); return; }
                      schedule(() => {
                        stage('resolution', beat, () => hooks.onResolution?.(beat));
                        schedule(next, Math.max(timing.resetMs, timing.stepMs));
                      }, rest);
                    });
                  }, timing.reactionMs);
                }, timing.resultMs);
              };
              react();
            }, timing.afterSpriteMs);
          }, remaining);
        }, impact);
      }, beat.prepared ? 0 : timing.wordMs);
    });
  };
  // Budget derives from every added wait and the caller's real authored clip
  // upper bound; long clips never trigger the legacy short watchdog.
  const reservedSpriteMs = Math.max(0, Number(safe(() => hooks.maxSpriteMs?.(timing.spriteSpeed))) || 0);
  const perAction = timing.intentMs + timing.wordMs + timing.afterSpriteMs + timing.resultMs + timing.reactionMs
    + timing.damageMs + timing.resetMs + timing.stepMs + 1000
    + reservedSpriteMs;
  const budget = 2000 + beats.reduce((budget, beat) => budget + Math.max(perAction + Math.max(0, (safe(() => hooks.reactionGroups?.(beat))?.length || 1) - 1) * (timing.resultMs + timing.reactionMs + timing.damageMs + timing.stepMs), timing.bannerMs + timing.stepMs), 0);
  watchdogDeadline = createdAt + budget;
  armWatchdog();
  next();
  return { pauseForSkip: () => { clearTimer(timer); cancelActor(); }, cancel: () => finish(true), skip: () => finish(true), get finished() { return finished; } };
}
