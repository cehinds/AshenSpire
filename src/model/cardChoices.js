// src/model/cardChoices.js — the pending choice a card offers before it plays
// (SPEC §5.2 Warrior's Vow: "Enter a Stance of your choice").
//
// A card asks for a choice through its DATA: an `enterStance` effect with
// `choose: 'classStance'` instead of a fixed `stance`. The offer is every
// stance row whose `class` is the playing character's class; a character whose
// class owns no stance is offered the card's own class's stances, so a card
// carried across classes still has something to choose. The choice rides the
// play intent (`choice`), the same way a target does, and the engine refuses a
// play without a legal one before anything is spent. Solo (engine/combat.js),
// co-op (engine/coopCombat.js) and the screens all read this one function.

/** The closed set of choice selectors an `enterStance` effect may carry. */
export const STANCE_CHOICE_SELECTORS = Object.freeze(['classStance']);

/**
 * cardChoice(registries, def, classId) → null when the card plays without a
 * choice, else { kind: 'stance', options: [{ id, name, icon, tooltip }] }.
 */
export function cardChoice(registries, def, classId) {
  const effect = (def && def.effects || []).find((e) => e && e.op === 'enterStance' && e.choose);
  if (!effect) return null;
  const rows = registries.stances.all();
  let owned = rows.filter((s) => s.class && s.class === classId);
  if (!owned.length) owned = rows.filter((s) => s.class && s.class === def.class);
  return {
    kind: 'stance',
    options: owned.map((s) => ({ id: s.id, name: s.name, icon: s.icon, tooltip: s.tooltip })),
  };
}

/** Throws unless `choice` is legal for `plan` (null plan ⇒ no choice allowed). */
export function assertCardChoice(plan, choice) {
  if (!plan) {
    if (choice != null) throw new Error('This card offers no choice');
    return null;
  }
  if (!plan.options.some((o) => o.id === choice)) {
    throw new Error(`Choose a stance: ${plan.options.map((o) => o.id).join(', ')}`);
  }
  return choice;
}
