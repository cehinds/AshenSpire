// src/model/consequence.js — DOES THIS CHOICE LEAVE A MARK THE RUN CANNOT TAKE
// BACK? One home for that question, and it is asked of the entry's own
// characteristics, never of a list of event ids.
//
// WHY IT IS NOT A LIST. The obvious build for "hold to confirm the dangerous
// ones" is a set of event ids somewhere in the UI. That set is wrong the day
// someone authors the twenty-first event: the new curse ships with no hold and
// nothing goes red, because a hand-kept list cannot know what it was not told.
// Law 0 clause 1 says the entry DESCRIBES and the machinery DERIVES, and this
// is that sentence applied to danger.
//
// ---------------------------------------------------------------------------
// IT FAILS CLOSED, AND THE FIRST DRAFT DID NOT. Viki's gate, and both halves of
// it were right:
//
//   (1) SIGN-BLINDNESS. `addCinders` was excluded categorically, but a spend is
//       `{ op: 'addCinders', amount: -50 }` and three shipped choices do exactly
//       that. Under this file's own axis they qualified, and the answer came
//       back "a tap is enough".
//   (2) THE CLOSURE WAS OVER THE WRONG SET, and this is the sharper one. The
//       claim was bounded by `RUN_OPCODES`. Event effect lists DEMONSTRABLY
//       LEAVE IT — `damage` and `heal` ship in events today — because
//       `executeRunEffects` runs the whole `OPCODES` vocabulary through a
//       player facade. Nothing bleeds yet; the argument was simply unsound. An
//       event that borrows a permanent combat op (`exhaust`) would be invisible
//       with nothing red.
//
// His verdict, and it is the fix in one line: THE ENUMERATION WAS LOAD-BEARING
// WHERE A DEFAULT SHOULD BE. So the enumeration flipped. There is no list of
// dangerous ops any more. There is a list of ops POSITIVELY KNOWN TO BE SAFE,
// and everything else — every op nobody has ruled on, every opcode added after
// this file was written, every typo — is binding. Being wrong now costs one
// held thumb and is visible on screen; before, it cost a curse and was silent.
// ---------------------------------------------------------------------------
//
// THE FALSIFIERS, both run by tools/holdconfirm.mjs:
//   --new-entry   author one fictional event with a curse, content only, ZERO
//                 code commits: it arrives holding.
//   --fail-closed a choice carrying an op this file has never heard of holds,
//                 and the run prints every declared opcode that would.
//
// WHOSE THIS IS. The *characteristic* — what makes a consequence heavy — was
// dispatched to VIKI. Viki may replace the body and keep the name; every caller
// reads these functions and nothing re-derives them.

/**
 * THE AXIS: a choice is binding when it writes something this run has no way to
 * get back and the player did not want it. Everything below is the SAFE side of
 * that line, stated positively, with the reason each one is here — because an
 * unexplained entry on a fail-open list is how (1) and (2) happened.
 *
 * A word not in this set is BINDING. That is the whole design.
 */
export const SAFE_OPS = Object.freeze({
  // Gains. Permanent, and the player reached for them.
  addRelic: 'a relic is a gain, and permanence is the point of it',
  addFlask: 'a flask is a gain',
  upgradeCard: 'as permanent as anything here, and wanted — the axis is "paid, not gained"',

  // Numbers that move back.
  damage: 'HP moves both ways; a rest, a flask or a heal undoes it',
  heal: 'a gain, and the same number',
  loseHp: 'the combat spelling of `damage` — same number, same faucet',
  block: 'lives and dies inside one turn',
  gainEnergy: 'lives and dies inside one turn',

  // THE ONE COST WITH A FAUCET, and it is a named exception rather than a
  // silence — Viki asked for the line and the reason, so here they are.
  //
  // Cinders are ruled SAFE AT EVERY SIGN, spend included. Every other binding
  // op writes to something the run cannot refill: a card gone, max HP gone, a
  // curse in the deck for good. Cinders come back — combat pays, treasure pays,
  // events pay. So a mis-tapped spend costs TEMPO, not STATE, and tempo is what
  // the rest of the run is for.
  //
  // NOT justified by "every shipped spend buys something in the same effect
  // list" — which is true today (-50 + addRelic, -30 + heal, -60 + addRelic) and
  // is exactly the kind of property that dies green the day content moves. The
  // faucet is the reason; the pairing is a coincidence I am deliberately not
  // leaning on.
  //
  // OVERTURN THIS the day a spend can strand a run — a cost the player cannot
  // earn back before the thing it was needed for.
  addCinders: 'the one cost with a faucet: play refills it, so a mis-tap costs tempo, not state',

  // A RISK IS NOT A COST, and this one needs saying out loud because it is the
  // most common shape in the file — 7 of the 20 shipped events reach a fight.
  // You enter a fight with everything you still have; nothing has been spent at
  // the moment of the tap. Holding all seven would put ceremony on the ordinary
  // case, which is how a safety step teaches players to rush past it.
  startCombat: 'a risk taken with everything still in hand, not a cost paid',
});

/**
 * `addCardToDeck` is the one op that is binding OR NOT depending on WHAT IT
 * NAMES — the same opcode hands you a blessing or a Guilt. So it is not in
 * SAFE_OPS at all; it is decided below from the CARD's own declared `type`,
 * which content already writes and `CARD_TYPES` already closes.
 */
export const BINDING_CARD_TYPES = Object.freeze(['curse', 'status']);

/** Which of a declared vocabulary this file would hold. For the instrument. */
export function failClosedOps(opcodes) {
  return (opcodes || []).filter((op) => !(op in SAFE_OPS) && op !== 'addCardToDeck');
}

/**
 * bindingReasons(choice, registries) -> string[]
 *
 * Empty means "a tap is enough" — and it now means it only for ops this file
 * has positively ruled safe. Non-empty is why, for an instrument and a log;
 * never rendered raw at a player.
 */
export function bindingReasons(choice, registries) {
  const out = [];
  if (!choice || !Array.isArray(choice.effects)) return out;
  for (const eff of choice.effects) {
    // A malformed effect is not a safe effect.
    if (!eff || typeof eff !== 'object' || typeof eff.op !== 'string') { out.push('malformed-effect'); continue; }

    if (eff.op === 'addCardToDeck') {
      // `random: true` adds a card nobody named. Not knowably a curse, so not
      // knowably safe either — and this function never says "safe" about
      // something it did not check.
      if (eff.random || eff.card == null) { out.push('addCardToDeck:unnamed'); continue; }
      const def = registries && registries.cards && registries.cards.get ? registries.cards.get(eff.card) : null;
      const type = def ? def.type : null;
      if (type == null || BINDING_CARD_TYPES.includes(type)) out.push(`addCardToDeck:${type || 'unknown'}`);
      continue;
    }

    // THE DEFAULT, and it is the whole correction: unrecognised is binding.
    if (!(eff.op in SAFE_OPS)) out.push(`unrecognised-op:${eff.op}`);
  }
  return out;
}

/** The one predicate every caller asks. */
export function isBindingChoice(choice, registries) {
  return bindingReasons(choice, registries).length > 0;
}
