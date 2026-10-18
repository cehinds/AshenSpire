// Apply public receipts only to a presentation snapshot, never live combat.
export function applyCombatDisplayReceipt(entities, event) {
  const actor = entities[event.targetId || event.sourceId];
  if (event.type === 'statusRemoved') {
    const instance = actor?.statuses?.[event.status];
    if (instance) {
      const holder = instance.meter || instance;
      const key = instance.meter ? 'value' : 'stacks';
      holder[key] = Math.max(0, event.total ?? event.remaining ?? (holder[key] - event.amount));
      if (holder[key] === 0) delete actor.statuses[event.status];
    }
    return true;
  }
  if (event.type === 'combatStanceChanged') {
    if (actor) {
      const next = { ...actor.combatStance };
      for (const key of ['maneuver', 'camp', 'reach', 'range', 'school', 'expiresOnOwnerCycle'])
        if (event[key] !== undefined) next[key] = event[key];
      actor.combatStance = next;
    }
    return true;
  }
  return false;
}
