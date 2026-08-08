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

// ---- WHAT A THING LOOKS LIKE BEFORE IT IS YOURS -----------------------------
//
// `reveal` is a CLOSED SET OF THREE and until now only two behaviours existed:
// 'hidden' dropped out, 'teased' and 'listed' were drawn identically. The
// distinction unlocks.csv documents in its own header — *teased = silhouette,
// listed = shown greyed with the hint* — had no screen that drew it, because the
// screen it was written for did not exist. The Compendium is that screen
// (Constantine: *"the potential weapons to unlock should be in its own menu on
// the main menu that keeps most things hidden"*), and the words were already in
// the table.
//
// ONE DECIDER, and that is why it is here rather than in either screen. Two
// callers ask this question — the Armoury picker (can I choose this?) and the
// Compendium (what may I see of this?) — and before this function `unlockView`
// below and `gate()` in equipment.js each carried their own copy of "'hidden'
// means absent". Two copies of one rule in two files with nothing checking they
// agree is the defect this house has spent two days killing; the Compendium
// would have been the third copy.
//
// `earned` is the caller's word for "this is already yours", whatever earning
// means for that kind of thing — an unlock condition met, or a piece found.

/** Everything a thing can be on a screen: yours, or one of the three modes. */
export const PRESENT_STATES = Object.freeze(['held', ...REVEAL_MODES]);

/**
 * revealState(mode, earned, where) → 'held' | 'teased' | 'listed' | 'hidden'
 *
 * LAW 1 CLAUSE 5, and the degrade is chosen rather than convenient. `reveal` has
 * no schema — content-build copies the CSV column through untouched — so a typo
 * ('teasd', 'hiden') reaches here as a live value. Of the three modes, 'teased'
 * is the only safe wrong answer: 'listed' would PUBLISH a name the author may
 * have meant to keep secret, and 'hidden' would DELETE an entry in silence,
 * which is the quiet failure Law 0 clause 5 names as the dangerous one. So it
 * errors by name — including which table the bad value came from — and draws
 * the shape without the identity.
 */
export function revealState(mode, earned, where = 'a reveal') {
  if (earned) return 'held';
  if (REVEAL_MODES.includes(mode)) return mode;
  console.error(`[content] reveal ${JSON.stringify(mode)} at ${where} is not one of `
    + `${REVEAL_MODES.join(' | ')} — drawing it as 'teased' (shape, no name).`
    + ' This line is the defect, not the fallback.');
  return 'teased';
}

/**
 * pieceReveal(piece, ctx) → { state, hint, gate }
 *
 * The two gates equipment.js already had, kept exactly as they were and moved
 * to one home. A CONDITION unlock is something you achieve; being FOUND is
 * something you pick up. Armour uses the first, armaments the second, and a
 * piece could one day use both — the order below is what decides that, and it
 * is unchanged.
 *
 * `gate` names WHY it is not yours ('unearned' | 'unfound' | null) so a screen
 * can pick its own sentence without re-deriving the reason. The sentences are
 * UI copy and live in src/ui/uiContent.js — one home, both screens.
 *
 * The default for an unfound armament is `drops.reveal`, one word in
 * balance.equipment.drops. It is DATA because "how much of the unknown does the
 * player see" is a tuning decision Constantine should be able to make without
 * us (Law 0 clause 3). A piece that wants a different answer says so the way
 * every other piece does — by naming an unlock row, whose `reveal` wins here.
 */
export function pieceReveal(piece, { unlockById, unlocked, available, drops = {} }) {
  const id = piece && piece.unlock;
  if (id != null && id !== '' && !unlocked.has(id)) {
    const u = unlockById.get(id);
    return {
      state: revealState(u && u.reveal, false, `unlocks.csv row ${JSON.stringify(id)}`),
      hint: (u && u.hint) || '',
      gate: 'unearned',
    };
  }
  if (piece.kind !== 'armor' && drops.requireFound && !available.has(piece.id)) {
    return {
      state: revealState(drops.reveal, false, 'balance.equipment.drops.reveal'),
      hint: '',
      gate: 'unfound',
    };
  }
  return { state: 'held', hint: '', gate: null };
}

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
 *
 * The filter reads `revealState` rather than testing the string itself: the
 * rule "'hidden' means absent" now has ONE home and this is a caller of it, not
 * a second copy. `state` rides along so a caller can draw the teased/listed
 * distinction the modes have always described.
 */
export function unlockView(unlocks, meta) {
  const earned = new Set((meta && meta.unlocked) || []);
  return (unlocks || [])
    .map((u) => ({ u, state: revealState(u.reveal, earned.has(u.id), `unlocks.csv row ${JSON.stringify(u.id)}`) }))
    .filter(({ state }) => state !== 'hidden')
    .map(({ u, state }) => ({
      ...u,
      state,
      earned: earned.has(u.id),
      hint: earned.has(u.id) ? '' : u.hint,
    }));
}
