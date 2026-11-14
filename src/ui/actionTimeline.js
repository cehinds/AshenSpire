// Presentation scheduler. Engine state is already committed; hooks consume
// receipts only. One timer drives a queue of events, and every exit finishes once.
//
// Each actor beat is a set of events (cardPlayed, cost, actionWord, stance, swing, contact, result, reaction, numbers, bars, end)
// that start where the combat timeline puts them (timing.timeline, ui/combatTimeline.js). Events that share a start fire
// in list order within one task. The swing's impact time is only known once its clip is made, so the starts that depend
// on it are armed then. The next beat starts after `end` has fired, every other event of the beat has fired, and the
// actor's own recovery (the clip's remainder and any hit-stop) is over; the defender's reaction pose is never waited for.
import { computeBeatSchedule, SWING_SCALE } from './combatTimeline.js';
import { defaultTimeline, sanitizeTimeline } from '../model/combatTimelinePolicy.js';

const TELEGRAPH_EVENTS = new Set(['cardPlayed', 'cost', 'actionWord', 'stance', 'swing', 'contact']);
const scaleSpeed = (speed, factor) => speed && Object.fromEntries(Object.entries(speed).map(([key, value]) => [key, typeof value === 'number' ? value * factor : value]));

export function runActionTimeline(beats, hooks, timingIn, {
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  const createdAt = now();
  // Waits a caller leaves out are zero, so a partial timing object still runs.
  const timing = { stepMs: 0, bannerMs: 0, ...timingIn };
  const timeline = sanitizeTimeline(timing.timeline ?? defaultTimeline());
  let timer = null, watchdog = null, watchdogDeadline = 0, finished = false, actor = null, index = 0, sequence = 0;
  let queue = [];
  const safe = fn => { try { return fn?.(); } catch (error) { hooks.onError?.(error); } };
  const stage = (name, beat, fn) => { safe(() => hooks.onStage?.(name, beat)); return safe(fn); };
  const enqueue = (at, run, defer = false) => { queue.push({ at, run, defer, sequence: sequence++ }); };
  const onTimer = () => {
    timer = null;
    if (finished) return;
    // Timers can run late after a long main-thread task. Their original
    // deadline still wins; a delayed phase must not renew the watchdog.
    if (now() >= watchdogDeadline) { finish(true, true); return; }
    pump();
  };
  const pump = () => {
    clearTimer(timer); timer = null;
    while (!finished && queue.length) {
      queue.sort((a, b) => a.at - b.at || a.sequence - b.sequence);
      const head = queue[0], wait = head.at - now();
      if (wait > 0) { timer = setTimer(onTimer, wait); return; }
      if (now() >= watchdogDeadline) { finish(true, true); return; }
      // A deferred entry yields one task first, so one beat's paint lands before the next beat begins.
      if (head.defer) { head.defer = false; timer = setTimer(onTimer, 0); return; }
      queue.shift();
      safe(head.run);
    }
  };
  const cancelActor = () => { safe(() => actor?.cancel?.()); actor = null; };
  const finish = (flush = false, watchdogExpired = false) => {
    if (finished) return;
    finished = true;
    queue = [];
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
  // A recovery that runs past the budget (a long hit-stop) moves the deadline out to cover it.
  const extendWatchdog = to => {
    if (now() < watchdogDeadline && to > watchdogDeadline) { watchdogDeadline = to; armWatchdog(); }
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
      enqueue(now() + (beat.banner ? timing.bannerMs : timing.stepMs), next);
      return;
    }
    runBeat(beat);
  };

  const runBeat = beat => {
    const beatStart = now();
    const groups = safe(() => hooks.reactionGroups?.(beat)) || [beat];
    const telegraph = !!beat.telegraph;
    // Events that do not apply to this beat take no time: no card played, or no stance change (a card that repeats the stance).
    const skip = new Set();
    if (!beat.events?.some(event => event.type === 'cardPlayed')) skip.add('cardPlayed');
    if (hooks.stanceChanges && !safe(() => hooks.stanceChanges(beat))) skip.add('stance');
    const armed = new Set();
    let pending = 0, spriteStart = 0, recoveryDeadline = 0, impact = 0;
    let swingFired = false, contactFired = false, endFired = false, handedOff = false, teleDone = false;
    const handOff = () => {
      if (telegraph || handedOff || !endFired || pending > 0) return;
      handedOff = true;
      // The actor's own recovery (clip remainder, hit-stop) is the only thing the next beat waits for.
      enqueue(Math.max(now(), recoveryDeadline), () => { cancelActor(); next(); }, true);
    };
    const telegraphCheck = () => {
      if (!telegraph || teleDone || !swingFired || !contactFired) return;
      teleDone = true;
      // A telegraph beat (the strike that pauses for the reaction prompt) plays its clip to the end, never cut short, then
      // waits telegraphHoldMs (default 0) before the prompt. No result, number or bar shows before the prompt.
      const remaining = Math.max(0, recoveryDeadline - now());
      const holdMs = remaining + (Number.isFinite(timing.telegraphHoldMs) ? Math.max(0, timing.telegraphHoldMs) : 0);
      enqueue(now() + holdMs, () => {
        cancelActor();
        stage('resolution', beat, () => hooks.onResolution?.(beat));
        enqueue(now() + (Number.isFinite(timing.telegraphResetMs) ? Math.max(0, timing.telegraphResetMs) : timing.stepMs), next, true);
      });
    };
    const fireSwing = () => {
      const speed = timing.spriteSpeed;
      actor = stage('sprite', beat, () => hooks.onSprite?.(beat, speed));
      spriteStart = now(); swingFired = true;
      impact = Math.max(0, Number(actor?.impactMs) || 0);
      const schedule = computeBeatSchedule(timeline, { impactMs: impact, groups: groups.length, skip });
      // Contact moved off the clip's own impact frame: play this beat's clip faster or slower so the frame lands on it
      // (only the acting clip, only this beat; outside the clamp the clip keeps its speed and contact still fires on time).
      if (schedule.swingScale !== 1 && actor && speed && schedule.swingScale >= SWING_SCALE.min && schedule.swingScale <= SWING_SCALE.max) {
        cancelActor();
        actor = safe(() => hooks.onSprite?.(beat, scaleSpeed(speed, schedule.swingScale)));
      }
      const total = Math.max(impact, Number(actor?.totalMs) || 0);
      // Authored handles are the final timing authority. A longer real clip may extend the original deadline only by
      // the part not already reserved by maxSpriteMs.
      creditWatchdog(Math.max(0, total - reservedSpriteMs));
      arm(schedule);
      telegraphCheck();
    };
    const fireContact = () => {
      // Not a reported stage: the stage order is a contract (tools/click-impact-probe.mjs). The hook runs just before contact.
      safe(() => hooks.onEngagement?.(beat));
      const contactHold = stage('contact', beat, () => { actor?.contact?.(); return hooks.onContact?.(beat, actor); });
      contactFired = true;
      if (swingFired) {
        // Some sprite services extend their recovery after contact (hit-stop).
        const total = Math.max(impact, Number(actor?.totalMs) || 0);
        const reported = Number(safe(() => actor?.remainingMs?.()));
        const remaining = Math.max(0, total + (Number(contactHold) || 0) - (now() - spriteStart), Number.isFinite(reported) ? reported : 0);
        recoveryDeadline = now() + remaining;
        extendWatchdog(recoveryDeadline + 1000);
      }
      telegraphCheck();
    };
    let reactionFreeAt = 0, draining = false;
    const reactionQueue = [];
    const scheduleDrain = () => {
      if (draining) return;
      draining = true;
      extendWatchdog(reactionFreeAt + 1000);
      enqueue(Math.max(now(), reactionFreeAt), () => {
        draining = false; pending--;
        react(reactionQueue.shift());
        if (reactionQueue.length) scheduleDrain();
        handOff();
      });
    };
    const react = group => { reactionFreeAt = now() + (Number(stage('reaction', group, () => hooks.onReaction?.(group))) || 0); };
    const fire = ({ id, group: groupIndex }) => {
      const group = groups[Math.min(groupIndex, groups.length - 1)];
      switch (id) {
        case 'cardPlayed': safe(() => hooks.onCardPlayed?.(beat)); break;
        case 'cost': stage('intent', beat, () => hooks.onIntent?.(beat)); break;
        case 'actionWord': safe(() => hooks.onActionWord?.(beat)); break;
        case 'stance': stage('action', beat, () => hooks.onAction?.(beat)); break;
        case 'swing': fireSwing(); break;
        case 'contact': fireContact(); break;
        case 'result': stage('result', group, () => hooks.onResult?.(group)); break;
        case 'reaction': {
          // A later group's pose waits for the one still playing, so it never replaces an unfinished clip; the numbers,
          // the bars and the beat's end do not wait for it (the beat just cannot hand off before this pose has started).
          if (reactionFreeAt > now() || reactionQueue.length) { reactionQueue.push(group); pending++; scheduleDrain(); break; }
          react(group); break;
        }
        case 'numbers': stage('damage', group, () => hooks.onNumbers?.(group)); break;
        case 'bars': stage('hud', group, () => hooks.onApply?.(group)); break;
        case 'end': stage('resolution', beat, () => hooks.onResolution?.(beat)); endFired = true; break;
        default: break;
      }
    };
    const arm = schedule => {
      for (const entry of schedule.entries) {
        const key = `${entry.id}:${entry.group}`;
        if (armed.has(key) || (telegraph && !TELEGRAPH_EVENTS.has(entry.id))) continue;
        armed.add(key); pending++;
        enqueue(beatStart + entry.at, () => { pending--; fire(entry); handOff(); });
      }
    };
    arm(computeBeatSchedule(timeline, { impactMs: null, groups: groups.length, skip }));
  };

  // Budget derives from the computed schedule and the caller's real authored clip upper bound (a clip may be retimed
  // up to 4x); long clips never trigger the legacy short watchdog.
  const reservedSpriteMs = Math.max(0, Number(safe(() => hooks.maxSpriteMs?.(timing.spriteSpeed))) || 0);
  const span = groups => Math.max(0, ...computeBeatSchedule(timeline, { impactMs: reservedSpriteMs, groups }).entries.map(entry => entry.at));
  const budget = 2000 + beats.reduce((sum, beat) => {
    if (beat.banner || !beat.actorId || beat.kind === 'reveal') return sum + timing.bannerMs + timing.stepMs + 100;
    const groups = safe(() => hooks.reactionGroups?.(beat))?.length || 1;
    return sum + span(groups) + reservedSpriteMs * SWING_SCALE.max + (Number(timing.telegraphHoldMs) || 0) + (Number(timing.telegraphResetMs) || 0)
      + timing.stepMs + 1000;
  }, 0);
  watchdogDeadline = createdAt + budget;
  armWatchdog();
  next();
  pump();
  return { pauseForSkip: () => { clearTimer(timer); timer = null; cancelActor(); }, cancel: () => finish(true), skip: () => finish(true), get finished() { return finished; } };
}
