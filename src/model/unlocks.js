// src/model/unlocks.js — earning things, evaluated from durable progress.
//
// content/source/unlocks.csv says WHAT can be earned and on what condition.
// This says what those conditions mean, as a closed set — an unregistered
// condition is a test failure, not a row that silently never fires.
//
// Why a separate `meta.progress` rather than reading meta.results: the run
// history is capped at 20 entries, so "win three runs" would quietly become
// "win three runs, recently". Progress is a running tally that only ever grows,
// and `meta.unlocked` is the earned set — once earned, never re-evaluated, so
// a later content edit can't take something back off a player.
//
// Headless and pure: no document, no storage, no timers.

/**
 * The closed condition set. Each takes (unlock, progress) → bool.
 *   winAsClass  param = classId    won a run with that class
 *   beatBoss    param = enemyId    defeated that boss, in any run
 *   reachAct    param = act number reached that act in any run
 *   winRuns     param = count      won at least N runs
 */
export const UNLOCK_CONDITIONS = Object.freeze({
  winAsClass: (u, p) => (p.wonClasses || []).includes(String(u.param)),
  beatBoss: (u, p) => (p.bosses || []).includes(String(u.param)),
  reachAct: (u, p) => (p.maxAct || 0) >= Number(u.param),
  winRuns: (u, p) => (p.wins || 0) >= Number(u.param),
});

/** How an unearned unlock is allowed to present itself. */
export const REVEAL_MODES = Object.freeze(['teased', 'hidden', 'listed']);

/** A fresh, empty progress tally. */
export function emptyProgress() {
  return { runs: 0, wins: 0, maxAct: 1, bosses: [], wonClasses: [] };
}

function addOnce(list, value) {
  if (value != null && value !== '' && !list.includes(value)) list.push(value);
}

/**
 * recordProgress(progress, result) → the same object, advanced.
 *
 * `result` is the run-history record (main.js runResult) plus `bosses`, the
 * ids felled during that run. Every field only ever grows, so replaying an
 * old result can't lower anything.
 */
export function recordProgress(progress, result) {
  const p = progress && typeof progress === 'object' ? progress : emptyProgress();
  for (const [k, v] of Object.entries(emptyProgress())) if (p[k] === undefined) p[k] = v;

  p.runs += 1;
  p.maxAct = Math.max(p.maxAct, Number(result.act) || 1);
  for (const id of result.bosses || []) addOnce(p.bosses, String(id));
  if (result.victory) {
    p.wins += 1;
    addOnce(p.wonClasses, String(result.class));
  }
  return p;
}

/**
 * evaluateUnlocks(unlocks, meta) → ids newly earned by this progress.
 *
 * Already-earned ids are never returned again, so the caller can treat the
 * result as exactly "what to celebrate". Unknown conditions are skipped rather
 * than thrown on — a save should survive a content patch that adds one.
 */
export function evaluateUnlocks(unlocks, meta) {
  const progress = (meta && meta.progress) || emptyProgress();
  const earned = new Set((meta && meta.unlocked) || []);
  const fresh = [];
  for (const u of unlocks || []) {
    if (earned.has(u.id)) continue;
    const test = UNLOCK_CONDITIONS[u.condition];
    if (test && test(u, progress)) fresh.push(u.id);
  }
  return fresh;
}

/**
 * unlockView(unlocks, meta) → what the wardrobe should draw, in order.
 *
 * Earned things are shown plainly. Unearned ones obey their reveal mode:
 * 'listed' and 'teased' appear locked with their hint (something to chase),
 * 'hidden' is dropped entirely — a genuine secret should not advertise the
 * shape of its own hole.
 */
export function unlockView(unlocks, meta) {
  const earned = new Set((meta && meta.unlocked) || []);
  return (unlocks || [])
    .filter((u) => earned.has(u.id) || u.reveal !== 'hidden')
    .map((u) => ({
      ...u,
      earned: earned.has(u.id),
      hint: earned.has(u.id) ? '' : u.hint,
    }));
}
