// src/model/rewardplan.js — the reward MENU as a derivation (E11, #256).
//
// Constantine, 2026-08-15: "the reward should start with an initial menu of
// reward types (card, potion, armament)". And his answer on the card's page:
// Continue is ALWAYS pressable and a setting decides what it means —
// auto-collect ON takes everything, picking at random where there is a choice;
// OFF gives only what was chosen, no nagging.
//
// WHY A MODEL FILE AND NOT SCREEN CODE (the levelUpPlan precedent): the screen
// draws rows and forwards taps; WHAT the rows are, which are blocked and why,
// and what Continue means under each mode is one derivation with one home, so
// the co-op renderer, the auto-collect path and any instrument all read the
// same answer. The screen decides nothing.
//
// THE ROWS ARE DERIVED FROM THE OFFER (Law 0: an entry DESCRIBES, the
// machinery DERIVES). A kind absent from the rewards object has no row. A new
// reward field on the offer is one ORDER entry and one descriptor row here —
// not a screen redesign.
//
// WHAT THIS FILE DOES NOT DO, stated: it never touches `run`, never applies a
// reward, never rolls its own randomness (the pick function — and, for the
// card reward schedule, the seeded rng — is HANDED IN so a seeded run stays
// seeded), and never invents a seen-store (possessions are handed in too).
// Application stays with the caller, one seam.

/**
 * The closed kind order — the menu's one spelling of "card, potion, armament"
 * (his three) plus the two kinds the offers already carry (cinders, relic).
 * Cinders lead because they are the certain, no-decision row; his named three
 * follow in his order (flask IS the potion seat in this game).
 */
// `sigil` (SPEC §15.4) is a dropped legendary sigil, after the relic.
export const REWARD_KIND_ORDER = Object.freeze(['cinders', 'smithingStone', 'classDraft', 'skillDraft', 'card', 'levelChoice', 'levelCard', 'flask', 'armament', 'relic', 'sigil']);

// ---- the card reward schedule (SPEC §15.1) ----------------------------------

const SCHEDULE_POOLS = Object.freeze(['normal', 'elite', 'boss']);

/**
 * cardRewardSchedule(balance) → the schedule in force, every key present.
 * `balance.rewards.cardRewards` is read key by key over the shipped defaults
 * (every pool offers, chance 100, no level card, at most one), so a bundle
 * written before the block existed — a test fixture, an old snapshot — reads
 * as the rewards before the schedule.
 */
export function cardRewardSchedule(balance) {
  const s = (balance && balance.rewards && balance.rewards.cardRewards) || {};
  const out = { afterCombat: {}, chancePct: {}, onLevelUp: s.onLevelUp === true, onLevelUpMaxPerFight: 1 };
  for (const pool of SCHEDULE_POOLS) {
    out.afterCombat[pool] = !(s.afterCombat && s.afterCombat[pool] === false);
    const pct = s.chancePct && s.chancePct[pool];
    out.chancePct[pool] = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 100;
  }
  if (Number.isInteger(s.onLevelUpMaxPerFight) && s.onLevelUpMaxPerFight >= 0) out.onLevelUpMaxPerFight = s.onLevelUpMaxPerFight;
  return out;
}

/**
 * cardRewardPlan(balance, { pool, levelsGained, draftWaiting }, rng)
 *   → { offerCard, cardMissed, levelCards }
 *
 * THE ONE DOOR the card reward schedule is read through (SPEC §15.1): solo
 * (main.js onCombatEnd, through engine/encounters.js rollCombatCardOffer),
 * co-op (tools/session.mjs) and the simulator (tools/runsim.mjs) all ask it,
 * so the three agree on which card rows a won fight earns.
 *   offerCard  — the plain card row is offered. Not when a skill or class
 *                draft is waiting (`draftWaiting`: it takes the row's seat,
 *                §13.4e/g), not when `afterCombat[pool]` is off, and not when
 *                `chancePct[pool]` misses. A chance of 100 always offers and
 *                0 never does; neither rolls. Between them ONE roll on
 *                'rewardRolls'.
 *   cardMissed — that roll missed: the menu says "No card this time." A
 *                chance of 0 never offers and never says so.
 *   levelCards — how many level-card rows: min(levelsGained,
 *                onLevelUpMaxPerFight) when `onLevelUp` is on, else 0. A
 *                waiting draft does not displace them.
 * A pool outside the schedule's three (a treasure room, a test's door) is
 * always offered and rolls nothing. The caller rolls the cards themselves.
 */
export function cardRewardPlan(balance, { pool, levelsGained = 0, draftWaiting = false } = {}, rng = null) {
  const schedule = cardRewardSchedule(balance);
  const known = SCHEDULE_POOLS.includes(pool);
  let offerCard = false;
  let cardMissed = false;
  if (!draftWaiting && (!known || schedule.afterCombat[pool])) {
    const pct = known ? schedule.chancePct[pool] : 100;
    // Only a REAL roll can miss "this time": 0 means never, and says nothing.
    if (pct >= 100) offerCard = true;
    else if (pct > 0) cardMissed = !(offerCard = rng.chance('rewardRolls', pct));
  }
  const levelCards = schedule.onLevelUp && Number.isInteger(levelsGained) && levelsGained > 0
    ? Math.min(levelsGained, schedule.onLevelUpMaxPerFight) : 0;
  return { offerCard, cardMissed, levelCards };
}

/**
 * A row's KEY is what its state is kept under (`states[key]`): the kind for
 * the kinds an offer carries once, and `skillDraft:<skillId>:<ordinal>` for a
 * skill draft, of which one offer may carry several — several for one track
 * when draftsPerCombat allows it, the ordinal telling them apart (plan phase
 * 4b). Every reader
 * of a state goes through the key, so the saved `states` of a pre-draft
 * offer (keyed by kind) still read.
 */
export const rowKey = (kind, row = {}) => (kind === 'skillDraft' ? `skillDraft:${row.skillId}:${row.ordinal || 0}`
  : kind === 'classDraft' ? `classDraft:${row.classId}:${row.ordinal || 0}`
  : kind === 'levelCard' || kind === 'levelChoice' ? `${kind}:${row.ordinal || 0}` : kind);

/** The kinds a player picks a CARD from — the card offer, a level card, a skill draft. */
export const CARD_CHOICE_KINDS = Object.freeze(['card', 'levelCard', 'skillDraft']);

/**
 * The one-line notes the menu prints beside its rows, as tokens: today only
 * `cardMissed`, the card reward schedule's missed chance (SPEC §15.1: "No
 * card this time."). An offer written before the schedule carries none.
 */
export const rewardNotes = (rewards = {}) => (rewards && rewards.cardMissed === true ? ['cardMissed'] : []);

/** The ids a choice row picks among: a card draft's cards, a class draft's nodes. */
export const pickIds = (row) => (Array.isArray(row.options)
  ? row.options.map((option) => `${option.kind}:${option.id}`)
  : Array.isArray(row.nodeIds) ? row.nodeIds : row.cardIds || []);

/**
 * Per-kind descriptors: how a kind reads its slice of the offer.
 * `present` — does the offer carry this kind at all;
 * `blocked` — a TOKEN reason collection can not happen, or null (the
 * levelUpPlan precedent: a label switches on a word, never on two numbers).
 */
const KINDS = {
  cinders: {
    present: (r) => Number.isFinite(r.cinders) && r.cinders > 0,
    row: (r) => ({ amount: r.cinders }),
    blocked: () => null,
  },
  smithingStone: {
    // Ordinary stones, refined stones (SPEC §15.3), or both: one row, one receipt.
    present: (r) => smithingStonesPaid(r.smithingStoneReceipt),
    row: (r) => ({ ...r.smithingStoneReceipt }),
    blocked: () => null,
  },
  classDraft: {
    // A class level's pick from the class tree (plan phase 5b): one row per
    // draft, keyed by class and ordinal, a choice among tree NODES.
    present: (r) => Array.isArray(r.classDrafts) && r.classDrafts.some((d) => d && Array.isArray(d.nodeIds) && d.nodeIds.length > 0),
    rows: (r) => {
      const seen = {};
      return r.classDrafts.filter((d) => d && Array.isArray(d.nodeIds) && d.nodeIds.length > 0)
        .map((d) => ({ classId: d.classId, ordinal: (seen[d.classId] = (seen[d.classId] || 0) + 1) - 1, level: d.level, nodeIds: d.nodeIds.slice(), claimOrdinal: d.claimOrdinal || 0, choice: d.nodeIds.length > 1 }));
    },
    blocked: () => null,
  },
  skillDraft: {
    // One row per draft the offer carries; each is a CHOICE (pick 1 of N)
    // the way a card offer is, keyed by its track so two drafts never share
    // a state. `rows` is the multi-row door: the descriptor yields a list.
    present: (r) => Array.isArray(r.skillDrafts) && r.skillDrafts.some((d) => d && Array.isArray(d.cardIds) && d.cardIds.length > 0),
    rows: (r) => {
      const seen = {};
      return r.skillDrafts.filter((d) => d && Array.isArray(d.cardIds) && d.cardIds.length > 0)
        .map((d) => ({ skillId: d.skillId, ordinal: (seen[d.skillId] = (seen[d.skillId] || 0) + 1) - 1, level: d.level, cardIds: d.cardIds.slice(), claimOrdinal: d.claimOrdinal || 0, choice: d.cardIds.length > 1 }));
    },
    blocked: () => null,
  },
  card: {
    present: (r) => Array.isArray(r.cardIds) && r.cardIds.length > 0,
    // One card is a take, several are a CHOICE — the row says which, so the
    // screen knows to open a chooser and auto-collect knows to pick.
    row: (r) => ({ cardIds: r.cardIds.slice(), choice: r.cardIds.length > 1 }),
    blocked: () => null,
  },
  levelCard: {
    // A level the fight bought adds a card row (SPEC §15.1, `onLevelUp`): one
    // row per level card the offer carries, keyed by its ordinal, a choice
    // among cards exactly as the card offer is.
    present: (r) => Array.isArray(r.levelCards) && r.levelCards.some((d) => d && Array.isArray(d.cardIds) && d.cardIds.length > 0),
    rows: (r) => r.levelCards.filter((d) => d && Array.isArray(d.cardIds) && d.cardIds.length > 0)
      .map((d, i) => ({ ordinal: Number.isInteger(d.ordinal) ? d.ordinal : i, cardIds: d.cardIds.slice(), choice: d.cardIds.length > 1 })),
    blocked: () => null,
  },
  levelChoice: {
    present: (r) => Array.isArray(r.levelChoices) && r.levelChoices.some((d) => d && Array.isArray(d.options) && d.options.length > 0),
    rows: (r) => r.levelChoices.filter((d) => d && Array.isArray(d.options) && d.options.length > 0)
      .map((d, i) => ({ ordinal: Number.isInteger(d.ordinal) ? d.ordinal : i, options: d.options.map((o) => ({ kind: o.kind, id: o.id })), choice: d.options.length > 1 })),
    blocked: () => null,
  },
  flask: {
    present: (r) => !!r.flaskId,
    row: (r) => ({ flaskId: r.flaskId }),
    // A full belt is DERIVED here, not discovered at apply time: the old
    // screen dropped the flask in the mud with a note; the menu says so
    // before any tap, and auto-collect respects the same word.
    blocked: (r, facts) => (facts.flaskSlotsFree > 0 ? null : 'slots'),
  },
  armament: {
    present: (r) => !!r.armamentId,
    // The roll is PURE (main.js rollDrop): nothing is stored until the row is
    // TAKEN, through the caller's collector — which is what lets Skip and
    // manual Continue honestly leave the piece behind. This row once carried
    // `stored: true` because rollDrop persisted at roll time; that flag and
    // the defect it described died together (#290 at f29d468).
    row: (r) => ({ armamentId: r.armamentId }),
    // A full bag is DERIVED here, the flask precedent one descriptor up: the
    // menu says so before any tap, auto-collect respects the same token, and
    // Taken is unreachable at the cap. Added at the b6b7df0 review's P1 —
    // without this derivation the ninth piece against an 8-slot cap rendered
    // takeable, and a collector that ignored addToStorage's false claimed it
    // into meta.found while the bag refused it: claimed-but-not-stored, and
    // excluded from every future drop.
    blocked: (r, facts) => (facts.armamentSlotsFree > 0 ? null : 'storage'),
  },
  relic: {
    present: (r) => !!r.relicId,
    row: (r) => ({ relicId: r.relicId }),
    blocked: () => null,
  },
  // A dropped legendary sigil (SPEC §15.4): a take, carried unattuned.
  sigil: {
    present: (r) => typeof r.sigilId === 'string' && !!r.sigilId,
    row: (r) => ({ sigilId: r.sigilId }),
    blocked: () => null,
  },
};

/**
 * rewardPlan(rewards, facts) → { rows }
 * `facts` carries the few run-derived numbers a row needs (`flaskSlotsFree`,
 * `armamentSlotsFree`); the offer stays pure data. Defaults are CONSERVATIVE
 * — an unstated fact reads as no room, so a caller that forgets to state one
 * gets a blocked row it can see, never a silent over-grant.
 */
/**
 * smithingStoneNote(receipt, t) → the one-line spoils note a co-op door shows for
 * a Smithing Stone receipt: ordinary and refined stones (SPEC §15.3), each
 * named when paid; '' when nothing was. `t` is the UI string lookup, handed in.
 */
export function smithingStoneNote(receipt, t) {
  if (!receipt) return '';
  return [
    receipt.amount > 0 ? t('reward.stone.note', { amount: receipt.amount, total: receipt.stoneBalanceAfter }) : '',
    receipt.refined > 0 ? t('reward.stone.refinedNote', { amount: receipt.refined, plural: receipt.refined === 1 ? '' : 's', total: receipt.refinedBalanceAfter }) : '',
  ].filter(Boolean).join(' · ');
}

/**
 * smithingStoneRowCopy(row, t) → { title, body } for the spoils screen's
 * Smithing Stone row. The ordinary and refined parts of each are built only
 * for the purse that was paid, so a refined-only door never reads "0 total".
 * `t` is the UI string lookup, handed in so this file stays headless.
 */
export function smithingStoneRowCopy(row, t) {
  const ordinary = row.amount > 0 ? row.amount : 0;
  const refined = row.refined > 0 ? row.refined : 0;
  const plural = (n) => (n === 1 ? '' : 's');
  const title = [];
  const body = [];
  if (ordinary) {
    title.push(t('reward.stone.title', { amount: ordinary, plural: plural(ordinary) }));
    body.push(t('reward.stone.body', { total: row.stoneBalanceAfter }));
  }
  if (refined) {
    title.push(t('reward.stone.refinedTitle', { amount: refined, plural: plural(refined) }));
    body.push(t('reward.stone.refinedBody', { total: row.refinedBalanceAfter }));
  }
  return { title: title.join(' · '), body: body.join(' · ') };
}

/** Whether a Smithing Stone receipt paid anything, ordinary or refined. */
export function smithingStonesPaid(receipt) {
  const paid = (value) => Number.isInteger(value) && value > 0;
  return !!receipt && (paid(receipt.amount) || paid(receipt.refined));
}

export function rewardPlan(rewards = {}, facts = { flaskSlotsFree: 0, armamentSlotsFree: 0 }) {
  const rows = [];
  for (const kind of REWARD_KIND_ORDER) {
    const d = KINDS[kind];
    if (!d.present(rewards)) continue;
    for (const fields of d.rows ? d.rows(rewards) : [d.row(rewards)]) {
      rows.push({ kind, key: rowKey(kind, fields), blockedBy: d.blocked(rewards, facts), ...fields });
    }
  }
  return { rows };
}

/**
 * resolveContinue(plan, states, mode, pick) → { take, leave }
 *
 * `states` — per-kind 'taken' | 'skipped' | (absent = pending). Taken rows
 * were applied at tap time and are NEVER re-taken here.
 * `mode` — 'auto' | 'manual' (balance.ui.rewardCollect's closed set).
 * `pick` — (n) → index in [0, n): the SEEDED chooser for a card row auto
 * takes. Handed in so this file owns no randomness.
 *
 *   auto:   take every pending, un-blocked row; an explicit skip is respected
 *           (his deck-discipline affordance survives the setting); a choice
 *           row resolves through `pick`.
 *   manual: take nothing — Continue means "done", and what was never chosen
 *           is LEFT, listed with its reason so a caller can say so.
 */
export function resolveContinue(plan, states = {}, mode = 'auto', pick = () => 0) {
  const take = [];
  const leave = [];
  for (const row of plan.rows) {
    const state = states[row.key];
    if (state === 'taken') continue; // applied at tap time; nothing left to do
    if (row.blockedBy) { leave.push(row); continue; }
    if (mode === 'auto' && state !== 'skipped') {
      if (CARD_CHOICE_KINDS.includes(row.kind) || row.kind === 'classDraft' || row.kind === 'levelChoice') {
        const ids = pickIds(row);
        const id = row.choice ? ids[pick(ids.length) % ids.length] : ids[0];
        take.push({ ...row, ...(row.kind === 'classDraft' ? { nodeId: id }
          : row.kind === 'levelChoice' ? { choiceId: id } : { cardId: id }) });
      } else {
        take.push(row);
      }
    } else {
      leave.push(row);
    }
  }
  return { take, leave };
}

/**
 * rewardClaimStatus(plan, states) → the W1t claim summary.
 *
 * Per-kind state (taken | skipped | blocked | available), the counts the
 * header status prints, and the one choice still waiting, if any. Derived
 * here with the menu itself, so the screen, co-op and any instrument read
 * the same answer.
 */
export function rewardClaimStatus(plan, states = {}) {
  const rows = plan.rows.map((row) => Object.freeze({
    kind: row.kind,
    key: row.key,
    state: states[row.key] || (row.blockedBy ? 'blocked' : 'available'),
  }));
  const count = (state) => rows.filter((row) => row.state === state).length;
  // The first choice still waiting, in row order: a skill draft before the
  // card offer, as the menu lists them.
  const choice = plan.rows.find((row) => row.choice && !states[row.key]);
  return Object.freeze({
    total: rows.length,
    claimed: count('taken'),
    skipped: count('skipped'),
    blocked: count('blocked'),
    available: count('available'),
    requiredChoice: choice ? Object.freeze({ kind: choice.kind, key: choice.key, count: pickIds(choice).length }) : null,
    rows: Object.freeze(rows),
  });
}

/**
 * unseenIds(rewards, possessions) → { cards, relics, flasks, armaments }
 * The 'new' marker's derivation: an id is new iff the handed-in possession
 * sets have never held it. The caller decides what "held" means (run
 * inventory ∪ the profile's record); this file never reads a store.
 */
export function unseenIds(rewards = {}, possessions = {}) {
  const holds = (set, id) => !!(set && set.has(id));
  const draftIds = [...(rewards.skillDrafts || []), ...(Array.isArray(rewards.levelCards) ? rewards.levelCards : [])].flatMap((d) => (d && d.cardIds) || []);
  return {
    cards: [...new Set([...(rewards.cardIds || []), ...draftIds])].filter((id) => !holds(possessions.cards, id)),
    relics: rewards.relicId && !holds(possessions.relics, rewards.relicId) ? [rewards.relicId] : [],
    flasks: rewards.flaskId && !holds(possessions.flasks, rewards.flaskId) ? [rewards.flaskId] : [],
    armaments: rewards.armamentId && !holds(possessions.armaments, rewards.armamentId) ? [rewards.armamentId] : [],
  };
}
