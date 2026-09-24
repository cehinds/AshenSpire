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
// reward, never rolls its own randomness (the pick function is HANDED IN so a
// seeded run stays seeded), and never invents a seen-store (possessions are
// handed in too). Application stays with the caller, one seam.

/**
 * The closed kind order — the menu's one spelling of "card, potion, armament"
 * (his three) plus the two kinds the offers already carry (cinders, relic).
 * Cinders lead because they are the certain, no-decision row; his named three
 * follow in his order (flask IS the potion seat in this game).
 */
export const REWARD_KIND_ORDER = Object.freeze(['cinders', 'smithingStone', 'classDraft', 'skillDraft', 'card', 'flask', 'armament', 'chest', 'relic']);

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
  : kind === 'classDraft' ? `classDraft:${row.classId}:${row.ordinal || 0}` : kind);

/** The ids a choice row picks among: a card draft's cards, a class draft's nodes, a boss's relics. */
export const pickIds = (row) => (Array.isArray(row.options) ? row.options : Array.isArray(row.nodeIds) ? row.nodeIds
  : Array.isArray(row.relicIds) ? row.relicIds : row.cardIds || []);

/**
 * offeredRelicIds(offer) → the relic ids an offer lays out (SPEC §6.1): a
 * boss's `relicIds` choice, or the single `relicId` elites and treasure (and
 * pre-choice boss saves) carry. The one reading of "which relics are on the
 * table", shared by the solo menu, the co-op screen and the co-op host.
 */
export const offeredRelicIds = (offer = {}) => (offer.relicId ? [offer.relicId]
  : Array.isArray(offer.relicIds) ? offer.relicIds.filter(Boolean) : []);

/** The field a choice row's pick lands in, by kind. */
const pickField = (kind) => (kind === 'classDraft' ? 'nodeId' : kind === 'relic' ? 'relicId' : 'cardId');

/**
 * The bag slots the chest's armament piece may use: the free slots less the
 * one the door's own armament row will take, unless that row is already
 * settled (`facts.armamentRowSettled`: taken — the bag already counts it — or
 * skipped).
 */
const chestArmamentSlots = (r, facts) => (facts.armamentSlotsFree || 0) - (r.armamentId && !facts.armamentRowSettled ? 1 : 0);

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
    present: (r) => Number.isInteger(r.smithingStoneReceipt?.amount) && r.smithingStoneReceipt.amount > 0,
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
        .map((d) => ({ classId: d.classId, ordinal: (seen[d.classId] = (seen[d.classId] || 0) + 1) - 1, level: d.level, nodeIds: d.nodeIds.slice(), choice: d.nodeIds.length > 1 }));
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
        .map((d) => ({ skillId: d.skillId, ordinal: (seen[d.skillId] = (seen[d.skillId] || 0) + 1) - 1, level: d.level, cardIds: d.cardIds.slice(), choice: d.cardIds.length > 1 }));
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
  chest: {
    // The elite chest (SPEC §3.8.1): pick ONE of its options. `takeable` is
    // per option — an armament cannot land in a full bag — derived here the
    // armament row's way, so the chooser and auto-collect read one answer.
    // The door's own armament row claims a bag slot first (it is listed, and
    // auto-collected, before the chest): while that row is still pending the
    // chest's piece counts one slot fewer, so auto-collect never lands the
    // chest's pick on an armament the row has just filled the bag against.
    present: (r) => !!r.chest && Array.isArray(r.chest.options) && r.chest.options.length > 0,
    row: (r, facts) => ({
      options: r.chest.options.map((o) => ({ ...o })),
      choice: r.chest.options.length > 1,
      takeable: r.chest.options.map((o) => !(o.category === 'armament' && o.armamentId && !(chestArmamentSlots(r, facts) > 0))),
    }),
    blocked: (r, facts) => (r.chest.options.some((o) => !(o.category === 'armament' && o.armamentId)) || chestArmamentSlots(r, facts) > 0 ? null : 'storage'),
  },
  relic: {
    // A boss offers a CHOICE of distinct boss relics (`relicIds`, SPEC §6.1);
    // elites and treasure carry the single `relicId` they always did. One
    // row either way: 2+ ids is a choice, one id is a plain take.
    present: (r) => offeredRelicIds(r).length > 0,
    row: (r) => {
      const ids = offeredRelicIds(r);
      return !r.relicId && ids.length > 1 ? { relicIds: ids, choice: true } : { relicId: ids[0] };
    },
    blocked: () => null,
  },
};

/**
 * rewardPlan(rewards, facts) → { rows }
 * `facts` carries the few run-derived numbers a row needs (`flaskSlotsFree`,
 * `armamentSlotsFree`, and `armamentRowSettled` — the armament row already
 * taken or skipped); the offer stays pure data. Defaults are CONSERVATIVE
 * — an unstated fact reads as no room, so a caller that forgets to state one
 * gets a blocked row it can see, never a silent over-grant.
 */
export function rewardPlan(rewards = {}, facts = { flaskSlotsFree: 0, armamentSlotsFree: 0 }) {
  const rows = [];
  for (const kind of REWARD_KIND_ORDER) {
    const d = KINDS[kind];
    if (!d.present(rewards)) continue;
    for (const fields of d.rows ? d.rows(rewards) : [d.row(rewards, facts)]) {
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
      if (row.kind === 'chest') {
        // Only a takeable option may be picked; the seeded pick chooses among them.
        const open = row.options.map((_, i) => i).filter((i) => row.takeable[i]);
        take.push({ ...row, optionIndex: open[pick(open.length) % open.length] });
      } else if (row.kind === 'card' || row.kind === 'skillDraft' || row.kind === 'classDraft' || (row.kind === 'relic' && row.choice)) {
        const ids = pickIds(row);
        const id = row.choice ? ids[pick(ids.length) % ids.length] : ids[0];
        take.push({ ...row, [pickField(row.kind)]: id });
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
  const draftIds = (rewards.skillDrafts || []).flatMap((d) => (d && d.cardIds) || []);
  return {
    cards: [...new Set([...(rewards.cardIds || []), ...draftIds])].filter((id) => !holds(possessions.cards, id)),
    relics: [...new Set(offeredRelicIds(rewards))].filter((id) => !holds(possessions.relics, id)),
    flasks: rewards.flaskId && !holds(possessions.flasks, rewards.flaskId) ? [rewards.flaskId] : [],
    armaments: rewards.armamentId && !holds(possessions.armaments, rewards.armamentId) ? [rewards.armamentId] : [],
  };
}
