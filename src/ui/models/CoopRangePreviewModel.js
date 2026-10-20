// The LAN host owns every route quote, including hidden preparation and the
// observing seat's knowledge. The client selects a quoted row, never reprices.
export function coopRangePreview(preview, { targetId, rangeRoute = 'advance' } = {}) {
  if (!preview?.range?.enabled || !preview.range.targets?.length) return preview;
  const range = targetId ? preview.rangeByTarget?.[targetId]
    ?? (preview.range.targets.some(target => target.targetId === targetId) ? preview.range : null) : preview.range;
  const route = range?.routes?.find(row => row.id === rangeRoute);
  if (!route) return { ...preview, range: null, rangeQuoteUnavailable: true };
  return { ...preview, cost: route.costs.energy, manaCost: route.costs.mana, staminaCost: route.costs.stamina,
    costs: route.costs, range: { ...range, selectedRoute: rangeRoute, targets: route.targets } };
}
