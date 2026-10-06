// SPEC §13.4q: data-driven mastery unlock identities and pool projections.
// No run is opted in here. The profile/run integration owns that boundary.
import { xpStepCost } from './xpCurve.js';

export const masteryRowId = row => `${row.classId}:${row.level}:${row.kind}:${row.ref}`;
export function masteryRows(registries, classId, level = null) {
  return (registries.classMastery || []).filter(row => row.classId === classId && (level === null || row.level === level));
}
export function masteryCorePool(registries, classId) {
  const gated = new Set(masteryRows(registries, classId).filter(row => row.kind === 'cards').map(row => row.ref));
  return registries.classes.get(classId).cardPool.filter(id => !gated.has(id));
}
export function masteryUnlockedRows(meta, classId = null) {
  const classes = Object.entries(meta?.classMastery || {});
  return new Set(classes.filter(([id]) => classId === null || id === classId).flatMap(([,row]) => row?.unlockedRows || []));
}
export function masteryRefAvailable(registries, meta, kind, ref, classId = null) {
  const rows = (registries.classMastery || []).filter(row => row.kind === kind && row.ref === ref && (classId === null || row.classId === classId));
  const unlocked = masteryUnlockedRows(meta, classId);
  return rows.length === 0 || rows.some(row => unlocked.has(masteryRowId(row)));
}
export function masteryCardPool(registries, meta, classId) {
  return registries.classes.get(classId).cardPool.filter(ref => masteryRefAvailable(registries, meta, 'cards', ref, classId));
}
export function masteryXpAtLevel(registries, level) {
  const curve = registries.balance.classMastery.xp;
  let total = 0;
  for (let step = 0; step < Math.min(level, curve.maxLevel); step++) total += xpStepCost(curve, step);
  return total;
}

