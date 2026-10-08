// Combat-owned power hooks and bounded next-roll/Retain effects survive saves.
export function mountCombatCombo(ctx, owner, carrier) {
  if (ctx.combatExpansionVersion !== 2 || !carrier?.comboHook) return;
  owner.combatComboHooks ||= {};
  owner.combatComboHooks[carrier.cardId] = { hook: structuredClone(carrier.comboHook), carrier: structuredClone(carrier) };
}
export function dispatchCombatCombos(ctx, event) {
  const owners = ctx.players ? [...ctx.players.values()].map(seat => seat.entity) : [ctx.player];
  for (const owner of owners) {
    if (owner?.combatExpansionVersion !== 2 || !owner.alive) continue;
    for (const [id, row] of Object.entries(owner.combatComboHooks || {})) {
      const hook = row.hook;
      if (hook.on !== event.type || !(event.amount > 0)) continue;
      if (hook.on === 'ashenBlightPaid' && (ctx.playerIdForEntity ? event.playerId !== ctx.playerIdForEntity(owner) : event.sourceId !== owner.id)) continue;
      if (hook.statuses?.length && !hook.statuses.includes(event.status)) continue;
      if (hook.reasons?.length && !hook.reasons.includes(event.reason)) continue;
      const target = ctx.enemies.find(entity => entity.id === event.targetId);
      if (hook.targetKind && target?.kind !== hook.targetKind) continue;
      const cycle = owner.combatOwnerCycle || 0;
      if (hook.oncePerTurn && row.lastCycle === cycle) continue;
      row.lastCycle = cycle;
      for (const effect of hook.effects) ctx.enqueue({ effect, owner, source: owner, target: owner, card: row.carrier, meta: { comboId: id } });
    }
  }
}
