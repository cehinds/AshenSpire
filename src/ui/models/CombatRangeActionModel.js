// Display only: every price, distance and chance comes from the engine quote.
const percent = value => Number.isFinite(value) ? `${Number(value.toFixed(2))}%` : null;
export function rangeHitLabel(preview, { current = true } = {}) {
  const target = preview?.range?.targets?.[0];
  const inRange = current ? target?.currentInRange ?? preview?.inRange : target?.inRange ?? preview?.inRange;
  const chance = current ? target?.currentHitChance ?? preview?.hitChance : target?.hitChance ?? preview?.hitChance;
  return inRange === false ? 'Out of range · 0%' : percent(chance);
}
export function combatRangeActionPlan(preview, { targetName = id => id, targetId } = {}) {
  const range = preview?.range;
  if (!range?.enabled || !range.targets?.length) return null;
  const routes = range.routes.map(route => {
    const targets = targetId ? route.targets.filter(target => target.targetId === targetId) : route.targets;
    const label = route.id === 'throw'
      ? `Throw${route.precisionDelta < 0 ? ` · ${route.precisionDelta} Precision` : ''}`
      : route.advanceSp > 0 ? `Advance · +${route.advanceSp} SP` : 'Attack';
    const cost = route.costs;
    const total = cost ? `Total ${cost.energy} SP${cost.mana ? ` · ${cost.mana} MP` : ''}` : null;
    return { id: route.id, label, total, selected: range.selectedRoute === route.id,
      available: route.available, affordable: route.affordable,
      reason: !route.available ? route.reason || 'Unavailable' : route.affordable === false ? 'Not enough resources' : null,
      odds: targets.map(target => ({ targetId: target.targetId,
        text: `${targetName(target.targetId)} · ${['Melee', 'Reach', 'Ranged'][target.band]} · ${target.currentInRange === false ? 'Out of range · 0%' : percent(target.currentHitChance) ?? 'Chance unavailable'} → ${route.id === 'throw' ? 'Throw' : route.advanceSp > 0 ? 'After Advance' : 'Attack'} ${target.inRange === false ? '0%' : percent(target.hitChance) ?? 'chance unavailable'}${target.precisionDelta > 0 ? ` · +${target.precisionDelta} Precision` : ''}` })),
    };
  });
  return { selectedRoute: range.selectedRoute, routes };
}
