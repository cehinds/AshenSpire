import { itemCombatPower } from '../content/generated/combatPower.js';
import { RankName } from './combatPower.js';

export function ItemCombatPowerKey(kind, item, classId = null) {
  if (!item?.id) return null;
  if (kind === 'weapon' || kind === 'weapons' || kind === 'armament' || (!kind && (item.kind === 'weapon' || item.kind === 'shield' || item.kind === 'staff'))) {
    return `weapon:${item.id}`;
  }
  if (kind === 'armor' || kind === 'armour' || (!kind && item.kind === 'armor')) {
    const cls = item.classId || classId || '';
    return cls ? `armour:${cls}.${item.id}` : null;
  }
  if (kind === 'relic' || kind === 'relics' || (!kind && item.kind === 'relic')) {
    return `relic:${item.id}`;
  }
  return null;
}

export function ItemCombatPowerEntry(kind, item, classId = null) {
  const key = ItemCombatPowerKey(kind, item, classId);
  return (key && itemCombatPower[key]) || null;
}

export function ItemRankOf(kind, item, classId = null) {
  const entry = ItemCombatPowerEntry(kind, item, classId);
  if (entry && Number.isInteger(entry.rank)) return entry.rank;
  return Number.isInteger(item?.rank) && item.rank >= 0 ? item.rank : 0;
}

export function ItemRankBadge(kind, item, classId = null) {
  const rank = ItemRankOf(kind, item, classId);
  return RankName(rank);
}
