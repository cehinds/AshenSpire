// src/model/consequence.js — DOES THIS CHOICE LEAVE A MARK THE RUN CANNOT TAKE
// BACK? One home for that question, and it is asked of the entry's own
// characteristics, never of a list of event ids.
//
// WHY IT IS NOT A LIST. The obvious build for "hold to confirm the dangerous
// ones" is a set of event ids somewhere in the UI. That set is wrong the day
// someone authors the twenty-first event: the new curse ships with no hold and
// nothing goes red, because a hand-kept list cannot know what it was not told.
// Law 0 clause 1 says the entry DESCRIBES and the machinery DERIVES, and this
// is that sentence applied to danger: a choice is binding because of the ops it
// runs and the cards those ops name — both of which the author already wrote.
//
// THE FALSIFIER, and it is the same one Law 0 ships everywhere: author one
// fictional event whose only interesting property is `addCardToDeck` of a card
// whose `type` is `curse`, in content, with ZERO code commits. It gets the
// hold. `node tools/holdconfirm.mjs --new-entry` runs exactly that.
//
// WHOSE THIS IS. The *characteristic* — what makes a consequence heavy, and
// whether "binding" is even the right axis — was dispatched to VIKI (collapsing
// two concepts so a duplicate cannot be born). This module is the stand-in the
// hold needed tonight, written conservatively so that being wrong is being
// CAUTIOUS: it can ask for a hold nobody needed, and the cost of that is one
// held thumb. It cannot silently skip one, because the three ops below are the
// only ops in RUN_OPCODES that write something the run has no way to undo.
// Viki may replace the body and keep the name; every caller reads this function
// and nothing re-derives it.
//
// Readers (Law 0 clause 4, one home, three consumers):
//   ui/screens/event.js      arms the hold on a binding choice, and only there
//   tools/holdconfirm.mjs    sweeps the shipped content and the shipped screen
//   (Viki)                   the characteristic, when it lands

/**
 * The run ops that write something this run can never take back.
 *
 * NOT `addRelic`, `addFlask`, `upgradeCard`, `addCinders`: permanent, and the
 * player wanted them. NOT `startCombat`: a fight can kill you, but you fight it
 * with everything you still have, and every one of the twenty events reaches it
 * through a choice that reads as a risk rather than a cost. `damage`/`heal` are
 * combat ops the run layer borrows and they move a number that moves back.
 *
 * The axis is `cannot be undone AND was paid, not gained` — which is why
 * `upgradeCard` is absent even though it is as permanent as anything here.
 */
export const BINDING_OPS = Object.freeze(['removeCardFromDeck', 'loseMaxHpPct']);

/**
 * `addCardToDeck` is the one op that is binding OR NOT depending on what it
 * names — the same opcode hands you a blessing or a Guilt. So it reads the
 * CARD's own declared `type`, which content already writes and `CARD_TYPES`
 * already closes. A card the registry does not know is treated as binding:
 * unknown is not "fine" (SOP 2), and the safe direction here is one extra hold.
 */
export const BINDING_CARD_TYPES = Object.freeze(['curse', 'status']);

/**
 * bindingReasons(choice, registries) -> string[]
 *
 * Empty means "a tap is enough". Non-empty is why, in the player's terms, and
 * the strings are for an instrument and a log — never rendered raw at a player.
 */
export function bindingReasons(choice, registries) {
  const out = [];
  if (!choice || !Array.isArray(choice.effects)) return out;
  for (const eff of choice.effects) {
    if (!eff || typeof eff !== 'object') continue;
    if (BINDING_OPS.includes(eff.op)) { out.push(eff.op); continue; }
    if (eff.op === 'addCardToDeck') {
      // `random: true` adds a card nobody named. It is not knowably a curse, so
      // it is not knowably safe either — and this function's whole contract is
      // that it never says "safe" about something it did not check.
      if (eff.random || eff.card == null) { out.push('addCardToDeck:unnamed'); continue; }
      const def = registries && registries.cards && registries.cards.get
        ? registries.cards.get(eff.card) : null;
      const type = def ? def.type : null;
      if (type == null || BINDING_CARD_TYPES.includes(type)) {
        out.push(`addCardToDeck:${type || 'unknown'}`);
      }
    }
  }
  return out;
}

/** The one predicate every caller asks. */
export function isBindingChoice(choice, registries) {
  return bindingReasons(choice, registries).length > 0;
}
