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
// things ask this question — `unlockView` below and the Compendium — and each
// used to carry its own copy of "'hidden' means absent". Two copies of one rule
// in two files with nothing checking they agree is the defect this house has
// spent two days killing; the Compendium would have been the third copy.
//
// AND `unlockView` HAS NO CALLERS IN src/ — measured at 77a02b9, e79e1cd and
// 52e0bc1. It is a dead truth function, and by my own rule that is not clutter,
// it is half of a fact whose other half is somewhere worse. Its living copy was
// `gate()` in equipment.js, which #90 deleted; nothing replaced it for armour.
// Routing it through revealState is still right — one home is one home whether
// or not anyone is home — but nobody should read "two callers" as coverage.
//
// `earned` is the caller's word for "this is already yours", whatever earning
// means for that kind of thing — an unlock condition met, or a piece found.
//
// ---- TWO AXES, AND THIS FILE OWNS EXACTLY ONE OF THEM (Viki, #90 sibling) ----
//
// This branch was authored at 77a02b9 and #90 landed under it. As written,
// `pieceReveal` answered TWO questions from one ladder of ifs: *is this piece
// yours* and *how much of what is not yours may be shown*. The first now has a
// home — `ownership()` in model/loadout.js — and re-deriving it here made a
// SECOND DEFINITION OF WHAT YOU OWN, in different words (`piece.kind !== 'armor'`
// against `fromDropPool`, a caller-built `available` against the model's `found`).
// Not a copy written twice by one hand: a copy written once on each side of a
// merge, which is the direction nothing was watching.
//
// ASK WHAT THE PREDICATE'S SUBJECT IS. Possession's subject is the PROFILE —
// what does this save hold. Disclosure's subject is the CATALOGUE ROW — how much
// of this entry may someone who does not hold it see. Different subject, two
// axes, two homes; the same test that kept fog and `revealUnknown` apart on the
// map. They meet in ONE join, below, which owns no condition of its own.
//
// The divergence was already representable, not hypothetical: `ownership()`
// honours `balance.equipment.persistence`, and this file's `available` set did
// not. At `persistence: 'perRun'` the model says you own nothing off-run and the
// old Compendium said you own your whole found list. One balance value apart.
//
// AND FREJA MEASURED THE SIZE OF IT, which I had only called live: on a profile
// holding everything, at `perRun`, THE MODEL SAYS 0 OF 24 HELD WHERE THE OLD
// SCREEN DREW 24. Her words: *the conflict he named is total, not marginal.*
// Not a rounding difference between two definitions — the whole screen.
//
// The other half of her measurement is why this shape and not a boolean: the
// new `has()` against dev's ladder is **2052 comparisons, 0 disagreements** —
// the split is ADDITIVE and no existing caller's answer moves. And a boolean
// alone is not enough, by her own screen's need: the cell picks
// `LOCK_COPY[gate]`, so a bare yes/no forces it to re-derive the route, which
// is this defect renamed. `why()` is what the caller actually consumes.

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
 * pieceReveal(piece, { owned, unlockById, drops }) → { state, hint, gate }
 *
 * THE JOIN, and it decides nothing. `owned` is an `ownership()` handle from
 * model/loadout.js: it says whether the piece is yours and, when it is not,
 * which of the two routes withheld it. This function reads that verdict and
 * answers only the disclosure question — WHICH TABLE NAMES THE REVEAL MODE.
 *
 * There is no `if` on `piece.kind` and no second `found` set here, on purpose:
 * anything of that shape would be possession asked a second time. Delete the
 * two lines below that pick a table and this file has nothing left to say.
 *
 * A CONDITION unlock is something you achieve; being FOUND is something you pick
 * up. That distinction still decides which reveal mode applies — an unearned
 * piece reads its own unlock row (Law 0 clause 3: the override is data), an
 * unfound one reads `balance.equipment.drops.reveal`, one word for the whole
 * pool. What changed is that the distinction is now READ, not re-derived.
 *
 * `gate` is passed straight through so a screen can pick its own sentence. The
 * sentences are UI copy in src/ui/uiContent.js, keyed by OWNERSHIP_GATES — one
 * home, and the suite asserts every route has words.
 */
export function pieceReveal(piece, { owned, unlockById, drops = {} }) {
  const gate = owned.why(piece);
  if (!gate) return { state: 'held', hint: '', gate: null };
  const u = gate === 'unearned' ? unlockById.get(piece && piece.unlock) : null;
  const mode = gate === 'unearned' ? (u && u.reveal) : drops.reveal;
  const where = gate === 'unearned'
    ? `unlocks.csv row ${JSON.stringify(piece && piece.unlock)}`
    : 'balance.equipment.drops.reveal';
  return { state: revealState(mode, false, where), hint: (u && u.hint) || '', gate };
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
