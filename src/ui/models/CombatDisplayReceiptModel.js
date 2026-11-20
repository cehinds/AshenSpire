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
  // Counter and Reflect badges follow their own receipts (gain, a covered hit's spend, the owner-turn-start fade); `stacks` is the total after the change.
  if (event.type === 'counterStacksChanged' || event.type === 'reflectStacksChanged') {
    const key = event.type === 'counterStacksChanged' ? 'counterStacks' : 'reflectStacks';
    if (actor && Number.isFinite(event.stacks)) actor[key] = Math.max(0, event.stacks);
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
