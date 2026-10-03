// Permanent deck removal retires a basic attack slot, not its current weapon face.
export function retiredAttackSlots(count, ids = []) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length
      || ids.some(id => typeof id !== 'string' || !/^attack:(0|[1-9]\d*)$/.test(id)
        || !Number.isInteger(count) || Number(id.slice(7)) >= count)) {
    throw new Error('removedAttackSlotIds must contain unique attack slots within the birth allocation');
  }
  return new Set(ids);
}

// THE CUSTOM STARTING DECKS BUILT FROM A POOL (Custom Climb, main.js newRun).
// Sealed and Draft throw the composed starting deck away and deal a new one
// from plain strikes, defends and class-pool cards. createRunState had already
// written the composed deck's birth attack quota (`equipmentAttackSlotCount`),
// so the run named N attack slots its deck never held, and the first full
// restamp (an Armoury swap, the load door) refused it: "attack instance count
// 0 does not match authored N". A Standard deck is composed from the equipment
// and holds every slot of its quota.
export const POOL_DECK_MODES = Object.freeze(['sealed', 'draft']);

// THE DEALT DECK'S OWN RULE, in two parts, both keyed on this predicate:
//   · its birth attack quota is the slots it was dealt (dealtAttackSlotCount);
//   · it is never dealt the equipment's lent cards (kit basics, weapon arts,
//     Dodge Roll): reconcileGrantedCards and reconcileGrantedCardsInCombat
//     leave a pool deck as it is at every restamp door — the load door, the
//     end of a fight, an Armoury change, a mid-fight swap.
// Combat works on a synthetic run with no `custom`, so a fight carries the
// flag itself (`poolDeck: true`, runCombat.js → combat → its snapshot).
export function isPoolDeckRun(run) {
  return !!run && (isPoolDeckMode(run) || run.poolDeck === true);
}

// The run-level answer, from the run's own Custom Climb rules only. Every
// door that holds a SAVED run (the load door, newRun, resumeRun, runCombat)
// asks this, never a flag: `poolDeck` belongs to a fight and its snapshot,
// and is cross-checked against this at the load door rather than trusted.
export function isPoolDeckMode(run) {
  return !!run && POOL_DECK_MODES.includes(run.custom && run.custom.deckMode);
}

// Written on a pool run by the build that holds it to its own rule (main.js
// newRun, or the load door's one-time heal). A pool save WITHOUT it was written
// before the fix and may carry the composed deck's quota; one WITH it is held
// to its quota like any run, so a lost attack card is corruption, not a heal.
export const POOL_DECK_RULE = 1;

/**
 * dealtAttackSlotCount(cards) → the birth attack quota a dealt deck was born
 * with: the number of attack-slot instances it holds, which must be exactly
 * `attack:0` … `attack:k−1`, once each (a fresh deal holds none, so 0 — zero is
 * a quota). Anything else is not a deal and throws by name; it is never
 * renumbered.
 */
export function dealtAttackSlotCount(cards) {
  const held = new Set();
  for (const card of cards || []) {
    if (!card || card.equipmentRole !== 'attack') continue;
    const id = card.equipmentAttackSlotId;
    if (typeof id !== 'string' || !/^attack:(0|[1-9]\d*)$/.test(id)) throw new Error(`attack instance '${card.instanceId}' has no valid equipmentAttackSlotId`);
    if (held.has(id)) throw new Error(`duplicate equipmentAttackSlotId '${id}'`);
    held.add(id);
  }
  for (let i = 0; i < held.size; i++) {
    if (!held.has(`attack:${i}`)) throw new Error(`a dealt deck's attack slots must run attack:0..${held.size - 1}; attack:${i} is missing`);
  }
  return held.size;
}

export function canRemoveDeckCard(card) {
  return !!card && !card.grantedBy;
}

/** Whether the Remove service has anything it could take out of this run's deck (never its last card). */
export function hasRemovableCard(run) {
  const deck = (run && run.deck) || [];
  return deck.length > 1 && deck.some(canRemoveDeckCard);
}

export function removeDeckCard(run, instanceId, { keepOne = false } = {}) {
  const index = run.deck.findIndex(card => card.instanceId === instanceId);
  const card = run.deck[index];
  if (!canRemoveDeckCard(card) || (keepOne && run.deck.length <= 1)) return false;
  if (card.equipmentAttackSlotId) {
    const count = run.equipmentAttackSlotCount ?? run.deck.filter(c => c.equipmentRole === 'attack').length;
    const retired = retiredAttackSlots(count, run.removedAttackSlotIds);
    retiredAttackSlots(count, [card.equipmentAttackSlotId]);
    if (retired.has(card.equipmentAttackSlotId)) return false;
    retired.add(card.equipmentAttackSlotId);
    run.equipmentAttackSlotCount = count;
    run.removedAttackSlotIds = [...retired];
  }
  run.deck.splice(index, 1);
  return true;
}
