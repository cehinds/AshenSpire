// Permanent deck removal retires a basic attack slot, not its current weapon face.
export function retiredAttackSlots(count, ids = []) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length
      || ids.some(id => typeof id !== 'string' || !/^attack:(0|[1-9]\d*)$/.test(id)
        || !Number.isInteger(count) || Number(id.slice(7)) >= count)) {
    throw new Error('removedAttackSlotIds must contain unique attack slots within the birth allocation');
  }
  return new Set(ids);
}

export function canRemoveDeckCard(card) {
  return !!card && !card.grantedBy;
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
