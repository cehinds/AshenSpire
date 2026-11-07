import { t } from '../strings.js';
// Display only: every price, distance and chance comes from the engine quote.
const percent = value => Number.isFinite(value) ? `${Number(value.toFixed(2))}%` : null;
function chanceLabel(target, current) {
  const scalar = current ? target?.currentHitChance : target?.hitChance;
  const values = (current ? target?.currentHitChances : target?.hitChances)?.filter(Number.isFinite) || [];
  if (Number.isFinite(scalar)) return percent(scalar);
  if (!values.length) return null;
  const low = Math.min(...values), high = Math.max(...values);
  return low === high ? percent(low) : t('combat.range.chanceSpan', { low: Number(low.toFixed(2)), high: Number(high.toFixed(2)) });
}
function targetChanceLabel(target, current) {
  const covered = current ? target?.currentInRange : target?.inRange;
  const contacts = target?.contacts;
  const allUnreachable = contacts?.length ? contacts.every(contact => (current ? contact.currentInRange : contact.inRange) === false)
    : covered === false && !(current ? target?.currentHitChances : target?.hitChances)?.some(value => value > 0);
  return allUnreachable ? t('combat.range.outOfRange') : chanceLabel(target, current);
}
export function rangeHitLabel(preview, { current = true, targetId } = {}) {
  // An insight contest has a DC, not a hit chance or a range (SPEC §17 Contests).
  if (preview?.contest) return t('combat.contest.dc', { dc: preview.contest.dc });
  const targets = preview?.range?.targets;
  const target = targetId ? targets?.find(row => row.targetId === targetId) : targets?.[0];
  const row = target ?? { inRange: preview?.inRange, currentInRange: preview?.inRange, hitChance: preview?.hitChance, currentHitChance: preview?.hitChance };
  const label = targetChanceLabel(row, current);
  return label && target?.precisionDelta > 0 ? t('combat.range.precisionBonus', { chance: label, amount: target.precisionDelta }) : label;
}
const needsApproach = target => target.allCurrentInRange === false || target.currentInRange === false || target.contacts?.some(contact => contact.currentInRange === false);
export function combatRangeActionPlan(preview, { targetName = id => id, targetId } = {}) {
  const range = preview?.range;
  if (!range?.enabled || !range.targets?.length) return null;
  if (!range.targets.some(needsApproach) && !range.routes.some(route => route.advanceSp > 0)) return null;
  const routes = range.routes.filter(route => route.id !== 'throw' || range.selectedRoute === 'throw' || route.targets.some(target => needsApproach(target) && target.inRange)).map(route => {
    const targets = targetId ? route.targets.filter(target => target.targetId === targetId) : route.targets;
    const label = route.id === 'throw'
      ? route.precisionDelta < 0 ? t('combat.range.throwPenalty', { delta: route.precisionDelta }) : t('combat.range.throw')
      : route.targets.some(needsApproach) ? t('combat.range.advance', { amount: route.advanceSp }) : t('stance.name.attack');
    const cost = route.costs;
    const total = cost ? cost.mana ? t('combat.range.totalSpMp', { sp: cost.energy, mp: cost.mana }) : t('combat.range.totalSp', { amount: cost.energy }) : null;
    return { id: route.id, label, total, selected: range.selectedRoute === route.id,
      available: route.available, affordable: route.affordable,
      reason: !route.available ? t('combat.range.unavailable') : route.affordable === false ? t('combat.range.insufficient') : null,
      odds: targets.map(target => ({ targetId: target.targetId,
        text: t('combat.range.targetOdds', { target: targetName(target.targetId), band: t(`combat.range.band.${['melee', 'reach', 'ranged'][target.band]}`), current: targetChanceLabel(target, true) ?? t('combat.range.chanceUnavailable'), route: route.id === 'throw' ? t('combat.range.throw') : route.targets.some(needsApproach) ? t('combat.range.afterAdvance') : t('stance.name.attack'), after: targetChanceLabel(target, false) ?? t('combat.range.chanceUnavailable'), bonus: target.precisionDelta > 0 ? t('combat.range.precisionSuffix', { amount: target.precisionDelta }) : '' }) })),
    };
  });
  return { selectedRoute: range.selectedRoute, routes };
}

// Choosing an affordable alternative must remain possible when the default is
// too expensive. This permits selection only; the canonical commit still pays.
export const canChooseRangeRoute = preview => !!(preview?.range?.enabled && preview.range.targets?.length && preview.range.routes?.some(route => route.available));
