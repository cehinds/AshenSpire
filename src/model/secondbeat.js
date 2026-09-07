// src/model/secondbeat.js — WHICH ACTIONS TAKE A SECOND BEAT, and what kind.
//
// Constantine asked for press-and-hold on confirmations and finished the
// sentence with "same with ending turn." The hold shipped (#115) and End Turn
// did not, because the hold was wired AT A CALL SITE: `armHold` had exactly one
// caller in the whole tree, the event screen. A second half of a sentence
// cannot be lost by a machine that reads a set; it can only be lost by a human
// who has to remember a second call.
//
// MARINA'S RULING, and it is the whole design of this file:
//
//     WHICH ACTIONS TAKE A SECOND BEAT IS A CHARACTERISTIC ON THE ACTION,
//     NEVER A LIST OF CALL SITES.
//
// So no screen decides. A screen names the action it is wiring and hands over
// the commit. The characteristics below remain the enumerable stakes/hazard
// record; the UI applies one universal option contract: tap reviews, deliberate
// hold commits directly. Adding a reviewed action is A ROW HERE, never a new
// call-site interaction rule. (Law 0 clause 1: the entry DESCRIBES.)
//
// ---------------------------------------------------------------------------
// WHY ONE TABLE RATHER THAN A DECLARATION BESIDE EACH ACTION. The precedent is
// `model/consequence.js`, which holds SAFE_OPS — one reviewable screen of
// positive declarations, each with the reason it is there. A set scattered
// across nine screens is a set nobody can read in one sitting, and the ONE
// THING this file has to be is enumerable: the question "which actions take a
// second beat today" must have an answer a person can read and a tool can
// print. Every row names the file its action lives in, so the pointer runs
// both ways.
//
// WHAT THIS FILE STILL CANNOT SEE, said out loud because `ui/surfaces.js` says
// the same thing about the same class of hole: A DESTRUCTIVE CONTROL NOBODY
// ADDS A ROW FOR IS INVISIBLE HERE. Nothing in a source tree can see it. What
// answers it is the rendered page — every control the machinery arms marks
// itself `data-beat-action`, so `tools/holdconfirm.mjs` can enumerate what the
// game ACTUALLY DREW and hold it against this table in both directions. A row
// with no control on the page is a lie; a control with no row is a gap. Both
// print by name.
// ---------------------------------------------------------------------------

/**
 * STAKES — what a mis-press writes. Ordered, because the derivation reads the
 * weight and not the name; a new level is a row here and the rule below does
 * not change.
 */
export const STAKES = Object.freeze({
  nothing: { weight: 0, of: 'nothing the player did not already have' },
  tempo: { weight: 1, of: 'time and refillable resources — the run pays it back' },
  turn: { weight: 2, of: 'this turn: the hand, the energy, the enemy acting next' },
  run: { weight: 3, of: 'the run: a card, a charge, a shrine — gone until the next climb' },
  profile: { weight: 4, of: 'the profile: it outlives the run' },
});

/** UNDO — how the player gets it back, if they can. */
export const UNDO = Object.freeze({
  free: 'the same screen takes it back, at no cost',
  faucet: 'play refills it — a mis-press costs tempo, not state',
  none: 'nothing in the game gives it back',
});

/**
 * HAZARD — HOW THE MISTAKE HAPPENS, and this is the field that picks the FORM.
 * It is the difference between the two things Constantine asked for on the same
 * evening, and they are two answers because they are two different mistakes.
 */
export const HAZARD = Object.freeze({
  // The finger missed. The right thing and the wrong thing are one thumb-width
  // apart (the event screen's 9 px gaps), so the correction has to live INSIDE
  // the gesture: the control fills, the player reads the words that are
  // filling, and lets go. A modal here asks "are you sure" about a screen the
  // eye has already left.
  pointing: 'the wrong thing is one thumb-width from the right thing',
  // The finger landed exactly where it aimed and THE OBJECT WAS WRONG. A hold
  // is useless here — holding the wrong card still upgrades the wrong card.
  // What the player needs is to SEE WHAT IT BECOMES and then say yes.
  choosing: 'the aim was true and the object was wrong — the player must see the result first',
  // ALREADY A SECOND BEAT. The action is performed through a multi-part gesture
  // that carries its own abort (drag to a target and release off it; tap to
  // select and tap away). A beat on top of that is a THIRD beat, and charging
  // one for the game's primary verb is how a safety step teaches players to
  // rush past every safety step. A row using this MUST name the abort the
  // player already has, in `gesture`.
  deliberate: 'the action already costs a multi-part gesture that can be abandoned',
});

/** The forms. `none` is a form: it is the answer "a tap is enough". */
const BEATS = Object.freeze(['none', 'hold', 'confirm']);

/**
 * THE DERIVATION — one rule, three lines, and every row below answers to it.
 *
 *   a second beat is owed when the mis-press cannot be taken back AND it costs
 *   at least a turn; the FORM is whichever mistake the player is at risk of.
 *
 * `tempo` is under the line on purpose and it is the same exception
 * consequence.js already ships for cinders: a cost the run refills is tempo,
 * and tempo is what the rest of the run is for.
 */
export function beatOf({ stakes, undo, hazard }) {
  const owed = undo === 'none' && STAKES[stakes].weight >= STAKES.turn.weight;
  if (!owed) return 'none';
  if (hazard === 'deliberate') return 'none';
  return hazard === 'choosing' ? 'confirm' : 'hold';
}

// ---------------------------------------------------------------------------
// THE ACTIONS. Each row DESCRIBES; nothing here states a form.
//
// A field may be a value or a function of the action's context. A function row
// MUST declare `edges` — every value of every context key it reads — for two
// reasons, and the second one is the Quality Gate: (1) an under-specified
// context fails BY NAME rather than resolving to a plausible default (Law 0
// clause 5), and (2) the enumeration prints EVERY CELL of the product, so
// "check both edges" is a property of the table instead of a thing a reviewer
// has to remember. Enumerate the cells, never the factors — Viki's #78.
// ---------------------------------------------------------------------------
export const ACTIONS = Object.freeze({
  // ---- wired to the shared machinery ---------------------------------------
  eventChoice: {
    of: 'taking an event choice',
    lives: 'src/ui/screens/event.js',
    surface: 'event',
    // WHETHER A CHOICE BINDS IS ITSELF DERIVED, from the entry's own ops —
    // model/consequence.js, and this row does not restate a word of it. Author
    // the twenty-first event with a curse in it and the hold is already there.
    stakes: (c) => (c.binding ? 'run' : 'nothing'),
    undo: 'none',
    hazard: 'pointing',
    edges: { binding: [true, false] },
    note: 'the 9 px gaps between three 44 px bars, where the neighbour is a permanent curse',
  },
  endTurn: {
    of: 'ending your turn',
    lives: 'src/ui/screens/combat.js',
    surface: 'combat',
    // HIS SENTENCE, AND THE HALF OF IT THAT WAS DROPPED: "same with ending
    // turn." The ruling is literal and state-independent: End Turn always
    // hands the enemy the turn, even when the current hand is spent, so the
    // same configured second beat guards every press. The pulse may still
    // report playable resources; it does not decide whether the safety step
    // exists.
    stakes: 'turn',
    undo: 'none',
    hazard: 'pointing',
    note: 'the button sits at the edge of a hand a thumb is already dragging cards out of',
  },
  useFlask: {
    of: 'drinking a flask',
    lives: 'src/ui/screens/combat.js',
    surface: 'combat',
    // A flask is a charge, and a drunk one does not come back this climb.
    // A TARGETED flask is not the same action: it enters targeting mode, so the
    // player must aim and may abandon — the second beat is already in the
    // gesture. An untargeted one fires on one tap of a 3-across icon row wedged
    // between the relics and the portrait.
    stakes: 'run',
    undo: 'none',
    hazard: (c) => (c.targeted ? 'deliberate' : 'pointing'),
    gesture: 'a targeted flask enters aim mode; releasing anywhere but an enemy abandons it',
    edges: { targeted: [true, false] },
  },
  shrineRest: {
    of: 'resting at the shrine',
    lives: 'src/ui/screens/rest.js',
    surface: 'rest',
    // Resting is not "gaining HP" — it is SPENDING THE SHRINE, and the shrine
    // is the only thing on the screen. One tap and the Smith is gone for this
    // floor. Two big adjacent panels, and the wrong one is 14 px away.
    stakes: 'run',
    undo: 'none',
    hazard: 'pointing',
    note: 'Rest and Smith are two adjacent panels; taking either closes the other',
  },
  shrineLevelUp: {
    of: 'buying a level at the shrine',
    lives: 'src/ui/screens/rest.js',
    surface: 'rest',
    // A ROW, NOT A LINE IN A SCREEN — which is the whole point of this file, and
    // it is why levelling arrived with a second beat without anyone deciding it
    // should have one. The FORM is `choosing` and not `pointing`, and the
    // difference is the same one the Smith made: the five stat buttons are far
    // enough apart that the finger is not the risk — the STAT is. A point spent
    // on Wisdom by a player who meant Constitution is gone for the run, and
    // what they need first is to read what the point actually does, which is
    // why the result line carries the derived-stat sentence rather than a
    // second copy of it (content/derivedStats.js `presentation.sense`).
    //
    // IN THE STAT CARD'S OWN HAND since the shared allocation card (Vira's
    // level panel, components/statAllocationCard.js): `+` only PENDS the point
    // — the row reads +1, the result line says what it does, Clear takes it
    // back — and "Level up" is the second beat that spends it. That is the
    // choosing form already, said in the panel instead of over it; a modal on
    // "Level up" would be a third beat on a verb the card already asks twice.
    // Named here for the same reason the two profile rows are: the census
    // (tools/holdconfirm.mjs) reads `surface` and `handledBy` together, and it
    // read this row as "not wired" for as long as the field was missing.
    // Driven in its own idiom at ?shot=rest by that instrument.
    stakes: 'run',
    undo: 'none',
    hazard: 'choosing',
    handledBy: 'rest.js drawLevelCard — the stat card pends the point on + and spends it on "Level up" (statAllocationCard.js)',
    note: 'five stat buttons on one panel; the point is permanent and the cinders are gone',
  },
  smithUpgrade: {
    of: 'smithing a card',
    lives: 'src/ui/screens/rest.js',
    surface: 'rest',
    // HIS SECOND ASK, and the reason it is a DIFFERENT form from End Turn. The
    // preview shipped (#105) — hover a candidate and see what it becomes — and
    // then one click committed it, permanently, with no confirm and no undo.
    // On a phone there is no hover, so the preview a touch player got was
    // nothing at all. Holding would not help: a held wrong card is still the
    // wrong card. The player has to SEE THE UPGRADE and then say yes.
    stakes: 'run',
    undo: 'none',
    hazard: 'choosing',
    note: 'twenty small cards in a wrapped grid; the preview only ever existed on hover',
  },
  smithExtract: {
    of: 'lifting a card out of an item at the smith',
    lives: 'src/ui/screens/rest.js',
    surface: 'rest',
    // The owner's third ruling (2026-09-03). The card becomes the run's own
    // and the mount it left shows its fallback — reversible only by seating
    // something back, which is a second transaction. Same shape as an
    // upgrade: the player has to SEE which mount and say yes.
    stakes: 'run',
    undo: 'none',
    hazard: 'choosing',
    note: 'an item, then one of its mounts; the Dodge Roll takes the mount until something is seated',
  },
  smithInstall: {
    of: 'seating a deck card in an item\'s mount at the smith',
    lives: 'src/ui/screens/rest.js',
    surface: 'rest',
    // The reverse of extract: the deck copy leaves and the card rides with
    // the item from then on. Three choices — item, mount, card — so the
    // review is where a wrong card is caught, not the deck strip later.
    stakes: 'run',
    undo: 'none',
    hazard: 'choosing',
    note: 'item, mount, then a card from the deck; the card is the item\'s until extracted again',
  },
  shopSell: {
    of: 'selling a possession back to the merchant',
    lives: 'src/ui/screens/shop.js',
    surface: 'shop',
    // THE REMOVE'S MIRROR (E2 / #247): a relic or flask gone for good, one tap
    // on a row in a wrapped shelf, cinders in return. The gain does not soften
    // the stakes — the possession is the thing that cannot come back (the
    // merchant does not restock what he buys), so the row carries shopRemove's
    // characteristics and takes whatever form the table derives from them.
    stakes: 'run',
    undo: 'none',
    hazard: 'choosing',
  },
  shopRemove: {
    of: 'paying the merchant to burn a card out of the deck',
    lives: 'src/ui/screens/shop.js',
    surface: 'shop',
    // NOBODY ASKED FOR THIS ONE AND IT IS THE SAME SHAPE AS THE SMITH: a
    // wrapped grid of small cards, one tap, the card is gone and the cinders
    // with it. It is in this table because the table is the thing that makes a
    // gap visible; it is WIRED because the machinery that answers the Smith
    // answers it for free, and leaving it unwired while editing the same
    // component would be filing a defect instead of fixing one.
    stakes: 'run',
    undo: 'none',
    hazard: 'choosing',
  },
  deleteSave: {
    of: 'deleting a saved run from the title screen',
    lives: 'src/ui/screens/title.js',
    surface: 'title',
    // THE GAME'S OLDEST SECOND BEAT, COLLAPSED (2026-08-14). It shipped as a
    // THIRD form — title.js's own two-click, self-resetting arm ("✕" →
    // "Delete?") with a hard-coded 2500 ms — deaf to `balance.ui.holdConfirm`
    // in every position: `off` still demanded two clicks, `long` lengthened
    // nothing. The exemption's honest content was only ever "nothing could
    // watch a rewrite run"; `?shot=title` (main.js) ended that, and the
    // derivation's own ruling took over. The mistake at the ✕ is POINTING —
    // it shares `.slot-actions` with CONTINUE, one thumb-width away, and the
    // slot card beside it already states everything a chooser would need to
    // see — so the hold is the right form, and the two-click's second look
    // bought nothing the fill under the finger does not.
    stakes: 'profile',
    undo: 'none',
    hazard: 'pointing',
    // THE SECOND CLAUSE OF THIS NOTE WAS TRUE UNTIL 2026-08-17 AND IS NOW THE
    // OPPOSITE. It read: "the named cost of the form: keyboard/pad activation
    // commits immediately, as on every hold (a focus cursor cannot mis-point)."
    // Constantine's S7 ruling — "if hold is toggled, then it should be the
    // same, in all instances" — makes the dial ONE SWITCH over every input, so
    // a hold is a hold on Enter and on a pad button too. Corrected rather than
    // left standing: this file is a table an instrument reads back against the
    // page, and a row carrying a stale parenthetical is the second copy of a
    // rule, disagreeing with the first.
    note: 'the ✕ sits beside CONTINUE in the same .slot-actions column; the beat is the same on '
      + 'pointer, keyboard and pad — the dial is the only switch (S7, 2026-08-17)',
  },

  // ---- a second beat this game already had, in its own screen's hand --------
  //
  // `handledBy` NAMES AN EXEMPTION FROM THE SHARED MACHINERY, NEVER FROM THE
  // BEAT. The derivation still runs and the row still says what form is owed;
  // what the field says is "this screen answers it in its own hand, here."
  // Written at the row, in the code, with its reason — the shape Law 5 clause 2
  // requires of every horizontal-scroll exemption, for the same reason: a set
  // with an unnamed hole in it is not a set.
  // ON `surface` FOR A `handledBy` ROW: it names the `?shot=` state that opens
  // the SCREEN the beat lives on, so an instrument can walk the beat in the
  // screen's own hand. It does NOT claim the shared machinery draws a
  // `data-beat-action` there — handledBy is precisely the exemption from that,
  // and the census reads the two fields together (holdconfirm.mjs). The two
  // states below pose their state by the real doors: a real profile archived
  // by replacePrimaryWith (`profile`), real torn bytes read by the real parser
  // (`crisis`). (`deleteSave` sat here from 2026-08-08 to 2026-08-14; its
  // two-click arm is gone and its row rides the machinery above.)
  profileRestore: {
    of: 'restoring a set-aside profile over the one in play',
    lives: 'src/ui/screens/profileArchive.js',
    surface: 'profile',
    stakes: 'profile',
    undo: 'none',
    hazard: 'choosing',
    handledBy: 'profileArchive.js:174 — an inline .prof-confirm box that states what happens to the current profile',
  },
  freshProfile: {
    of: 'starting a new profile over an unreadable one',
    lives: 'src/ui/screens/profileNotice.js',
    surface: 'crisis',
    stakes: 'profile',
    undo: 'none',
    hazard: 'choosing',
    handledBy: 'profileNotice.js:147 — a .confirm-fresh modal that says the old profile is set aside, not deleted',
  },

  // ---- declared to take NO beat, and WHY --------------------------------
  //
  // These rows are the point of a set. An action absent from this file is
  // invisible; an action present with `none` derived from its characteristics
  // is a decision someone can argue with.
  playCard: {
    of: 'playing a card',
    lives: 'src/ui/screens/combat.js',
    // `surface: null` DESPITE living on a screen an instrument can open, and
    // the reason is the honest one rather than the convenient one: this action
    // is NOT ROUTED THROUGH THE MACHINERY. Its commit is not a click — it is
    // `wireCardInput`'s drag-or-tap, which owns `pointerdown`, a ghost, a slop
    // radius and a target arrow. Arming it would put a second `pointerdown`
    // listener on the same element and the two would fight over the same
    // finger. So the row is a DECLARATION and not a wiring, it draws no
    // `data-beat-action`, and the census must not expect one.
    surface: null,
    stakes: 'turn',
    undo: 'none',
    hazard: 'deliberate',
    gesture: 'drag to a target and release off it, or tap to select and tap away — both abandon',
    note: 'the game\'s primary verb; a beat here is a third beat on a gesture that already has two. '
      + 'Declared, not routed: its commit is a gesture, not a click (see `surface`)',
  },
  rewardPick: {
    of: 'taking a card from the victory rewards',
    lives: 'src/ui/screens/reward.js',
    surface: null,
    stakes: 'nothing',
    undo: 'none',
    hazard: 'choosing',
    note: 'a gain, and the player reached for it — the same ruling SAFE_OPS makes about addRelic',
  },
  rewardContinue: {
    of: 'leaving the reward screen and resolving the remaining offer',
    lives: 'src/ui/screens/reward.js',
    surface: 'reward',
    // Continue closes the offer. In auto mode it also applies every pending
    // reward; in manual mode every untouched reward is left behind. Neither
    // result can be undone after navigation, and the control follows a column
    // of adjacent reward rows a thumb is already selecting from.
    stakes: 'run',
    undo: 'none',
    hazard: 'pointing',
    note: 'the irreversible exit immediately follows the reward rows; a short press must remain an abort',
  },
  draftPick: {
    of: 'drafting a card into a custom climb',
    lives: 'src/ui/screens/draft.js',
    surface: null,
    stakes: 'nothing',
    undo: 'none',
    hazard: 'choosing',
    note: 'a gain',
  },
  shopBuy: {
    of: 'buying from the merchant',
    lives: 'src/ui/screens/shop.js',
    surface: 'shop',
    stakes: 'tempo',
    undo: 'faucet',
    hazard: 'choosing',
    note: 'cinders come back — combat pays, treasure pays, events pay (consequence.js, the one cost with a faucet)',
  },
});

// ---------------------------------------------------------------------------

const FIELDS = ['stakes', 'undo', 'hazard'];
const LEGAL = { stakes: STAKES, undo: UNDO, hazard: HAZARD };

/**
 * A CONTEXT KEY A ROW READS AND THE CALLER DID NOT SUPPLY IS A THROW, BY NAME.
 * Law 0 clause 5: a missing field that fails loud is cheap; a generated thing
 * that is wrong but reasonable is invisible. The invisible version of this bug
 * is a hold that quietly stops holding.
 */
function readField(id, row, field, ctx) {
  const v = row[field];
  if (typeof v !== 'function') return v;
  for (const key of Object.keys(row.edges || {})) {
    if (!Object.hasOwn(ctx || {}, key)) {
      throw new Error(
        `secondbeat: '${id}'.${field} reads context '${key}' and the caller did not supply it. `
        + `Pass { ${Object.keys(row.edges).join(', ')} } — ${row.lives} declares them in \`edges\`.`
      );
    }
  }
  return v(ctx);
}

/**
 * beatFor(id, ctx) -> { id, form, stakes, undo, hazard, why, handledBy }
 *
 * The one question every caller asks. `form` is one of BEATS. `why` is for a
 * log and an instrument, never rendered raw at a player.
 */
export function beatFor(id, ctx = {}) {
  const row = Object.hasOwn(ACTIONS, id) ? ACTIONS[id] : null;
  if (!row) {
    throw new Error(
      `secondbeat: no action named '${id}'. Which actions take a second beat is a `
      + `characteristic on the action — add a row to ACTIONS in src/model/secondbeat.js. `
      + `Declared today: ${Object.keys(ACTIONS).join(', ')}.`
    );
  }
  const c = {};
  for (const f of FIELDS) {
    c[f] = readField(id, row, f, ctx);
    if (!Object.hasOwn(LEGAL[f], c[f])) {
      throw new Error(`secondbeat: '${id}'.${f} resolved to ${JSON.stringify(c[f])}, which is not one of `
        + `${Object.keys(LEGAL[f]).join(' | ')}.`);
    }
  }
  const form = beatOf(c);
  return {
    id,
    form,
    ...c,
    handledBy: row.handledBy || null,
    of: row.of,
    lives: row.lives,
    surface: row.surface || null,
    why: form === 'none'
      ? (c.hazard === 'deliberate'
        ? `no beat: ${HAZARD.deliberate} (${row.gesture || 'gesture unnamed'})`
        : `no beat: stakes '${c.stakes}' (${STAKES[c.stakes].of}), undo '${c.undo}'`)
      : `${form}: stakes '${c.stakes}' (${STAKES[c.stakes].of}) and ${UNDO[c.undo]}; ${HAZARD[c.hazard]}`,
  };
}

/**
 * enumerateBeats() -> row[] — THE ANSWER TO "WHICH ACTIONS TAKE A SECOND BEAT",
 * every cell of every state-dependent row expanded. This is what makes the set
 * a set: a person or a tool can print it, and a row that resolves two ways
 * prints twice rather than once with a footnote.
 */
export function enumerateBeats() {
  const out = [];
  for (const [id, row] of Object.entries(ACTIONS)) {
    const keys = Object.keys(row.edges || {});
    // The full product of the declared edges. One row with no edges is one cell.
    let cells = [{}];
    for (const k of keys) {
      const next = [];
      for (const cell of cells) for (const v of row.edges[k]) next.push({ ...cell, [k]: v });
      cells = next;
    }
    for (const ctx of cells) out.push({ ...beatFor(id, ctx), ctx });
  }
  return out;
}

/**
 * beatsOwed() -> the ids that owe a beat, in declaration order. The short
 * answer to Marina's question, for a log line or a header.
 */
export function beatsOwed() {
  return [...new Set(enumerateBeats().filter((b) => b.form !== 'none').map((b) => b.id))];
}

/**
 * assertTableSane() -> string[] of complaints, empty when the table is well
 * formed. Called at boot by validate.js so a malformed row fails LOUD and by
 * name rather than resolving to a plausible 'none' (Law 1 clause 5). A row that
 * silently stopped owing a beat is the one defect on this whole branch that
 * looks exactly like working software.
 */
export function assertTableSane() {
  const bad = [];
  for (const [id, row] of Object.entries(ACTIONS)) {
    if (!row.of || !row.lives) bad.push(`${id}: every row states \`of\` (what the player is doing) and \`lives\` (its file)`);
    for (const f of FIELDS) {
      if (row[f] == null) bad.push(`${id}: missing characteristic '${f}'`);
      else if (typeof row[f] === 'function' && !Object.keys(row.edges || {}).length) {
        bad.push(`${id}.${f} is a function of context but the row declares no \`edges\`; `
          + `nothing could enumerate its cells and a missing key could not fail by name`);
      }
    }
    for (const [k, vals] of Object.entries(row.edges || {})) {
      if (!Array.isArray(vals) || vals.length < 2) bad.push(`${id}.edges.${k} must list at least two values — one edge is not both edges`);
    }
    // A `deliberate` row must name the abort the player already has, or the
    // value is a way to opt out of the table by writing one word.
    try {
      for (const cell of enumerateBeats().filter((b) => b.id === id)) {
        if (cell.hazard === 'deliberate' && !row.gesture) {
          bad.push(`${id}: hazard 'deliberate' must name the abort the player already has, in \`gesture\``);
        }
      }
    } catch (e) { bad.push(`${id}: ${e.message}`); }
  }
  return bad;
}
