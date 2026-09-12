// src/ui/components/cardSelection.js — which card is lit, and how many of its
// beats are spent.
//
// WHY THIS IS A FILE AND NOT TWO `let`s. It was two `let`s, at module scope in
// cardInspection.js:
//
//     let touchedIdentity = null;
//     let touchTaps = 0;
//
// shared by every card on the page, with `.inspection-selected` in the DOM as
// the second copy of the same fact and `document.querySelectorAll` sweeping the
// whole document to reconcile them. Three shipped changes in three days broke
// the tap accounting (#980, #987, #998), and this is why: the state had no
// name, no test, and no way to be asked a question. Every fix was a guess about
// what two globals were holding at the moment a finger landed.
//
// WHAT CHANGES FOR A PLAYER: nothing. Selection is still page-wide — lighting a
// card anywhere unlights the one before it, which is what the document sweep
// did and what every screen was built against. This gives that behaviour a
// name and an owner; it does not change it. Scoping selection per grid is a
// real question, and a separate one.
//
// THE TWO FACTS, KEPT APART ON PURPOSE:
//
//   WHICH CARD IS LIT — one per page, by logical identity (an instance id, an
//   item id, a card id, or a title) so it survives a host re-render. A screen
//   that repaints its grid every frame must not lose the player's selection.
//
//   HOW MANY BEATS ARE SPENT on that card. A card owes two: the first tap
//   selects, the second acts. Reading the card's information through the `i`
//   or the chevron SPENDS the first beat rather than resetting the count —
//   reading is something you do TO a lit card.
//
// Registration is how a card is unlit without a document sweep: a card hands
// over a `douse` callback when it lights, and the store calls the previous
// holder's. No selector, no traversal, and a card removed from the DOM takes
// its registration with it when the caller disposes.

const NO_SELECTION = Object.freeze({ id: null, beats: 0 });

let current = NO_SELECTION;
let douseCurrent = null;
const watchers = new Set();

const notify = () => {
  for (const watcher of [...watchers]) {
    try { watcher(current.id); } catch { /* a watcher's failure is never the store's */ }
  }
};

/** The logical identity of the lit card, or null. */
export function litCard() { return current.id; }

/** How many beats `id` has spent. 0 when it is not the lit card. */
export function beatsSpent(id) { return current.id === id ? current.beats : 0; }

/**
 * Light `id`, dousing whatever was lit before.
 *
 * `douse` is how the previous card puts itself out — the store never reaches
 * into the DOM. Re-lighting the card that is already lit keeps its beats:
 * that is the whole point of the count.
 */
export function lightCard(id, douse = null) {
  if (current.id === id) { douseCurrent = douse || douseCurrent; return current.beats; }
  const previous = douseCurrent;
  current = Object.freeze({ id, beats: 0 });
  douseCurrent = douse;
  if (typeof previous === 'function') previous();
  notify();
  return 0;
}

/**
 * Count one beat against `id` and return the new total. A beat on a card that
 * is not lit lights it first, so a tap is never lost between the two facts.
 */
export function countBeat(id, douse = null) {
  if (current.id !== id) { lightCard(id, douse); }
  current = Object.freeze({ id: current.id, beats: current.beats + 1 });
  return current.beats;
}

/**
 * Mark the selecting beat spent WITHOUT counting a new one — what reading a
 * card's information does. Before this existed both doors zeroed the count,
 * so a player who read a lit card and then tapped it had that tap swallowed as
 * a fresh selection: the card was already lit and the tap did nothing visible.
 */
export function spendSelectingBeat(id, douse = null) {
  if (current.id !== id) lightCard(id, douse);
  if (current.beats < 1) current = Object.freeze({ id: current.id, beats: 1 });
  return current.beats;
}

/** Put out whatever is lit. The card's own `douse` runs, as on any change. */
export function clearSelection() {
  if (current.id === null) return;
  const previous = douseCurrent;
  current = NO_SELECTION;
  douseCurrent = null;
  if (typeof previous === 'function') previous();
  notify();
}

/** Watch which card is lit. Returns its own unsubscribe. */
export function onSelectionChange(watcher) {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}

/**
 * Tests and screen teardown only: forget everything without running a douse.
 * A screen that has already torn down its DOM has nothing left to put out, and
 * a test needs to start from a known state rather than from the last one.
 */
export function resetSelection() {
  current = NO_SELECTION;
  douseCurrent = null;
  watchers.clear();
}
