// SPEC §13.4q. Lifetime XP belongs to the profile; each run contributes only
// the delta beyond its durable receipt. The model has no storage or clock.
import { classes } from '../content/classes.js';
import { classMastery } from '../content/generated/classMastery.js';
import { balance } from '../content/balance.js';
import { xpStepCost } from './xpCurve.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const safeKey = key => !['__proto__', 'constructor', 'prototype'].includes(key);
const count = value => Number.isSafeInteger(value) && value >= 0;
const rowId = row => `${row.classId}:${row.level}:${row.kind}:${row.ref}`;
const classRows = registry => registry?.classes?.all?.() || classes;
const unlockRows = registry => registry?.classMastery || classMastery;

export function normalizeMasteryProfile(meta, registry = null, { veteran = false } = {}) {
  const mastery = { ...(meta.classMastery || {}) };
  for (const cls of classRows(registry)) {
    mastery[cls.id] = mastery[cls.id] || { xp: 0, level: 0, unlockedRows: veteran
      ? unlockRows(registry).filter(row => row.classId === cls.id).map(rowId) : [] };
  }
  return { ...meta, classMastery: mastery, classMasteryReceipts: meta.classMasteryReceipts || {} };
}

export function masteryProfileProblems(meta) {
  const problems = [];
  if (!object(meta.classMastery)) problems.push('profile.classMastery must be an object');
  else for (const [id, row] of Object.entries(meta.classMastery)) {
    if (!safeKey(id) || !object(row) || !count(row.xp) || !count(row.level) || !Array.isArray(row.unlockedRows)
      || row.unlockedRows.some(ref => typeof ref !== 'string')) problems.push(`profile.classMastery.${id} has invalid XP, level or unlock rows`);
  }
  if (!object(meta.classMasteryReceipts)) problems.push('profile.classMasteryReceipts must be an object');
  else for (const [id, receipt] of Object.entries(meta.classMasteryReceipts)) {
    if (!safeKey(id) || !object(receipt) || Object.values(receipt).some(value => !count(value))) problems.push(`profile.classMasteryReceipts.${id} has invalid earned XP`);
  }
  return problems;
}

// Ordinary settings/progress writes may hold an older snapshot. Keep the
// durable mastery and receipts monotonic even when that snapshot is saved.
export function mergeMasteryProfiles(incoming, current) {
  const next = normalizeMasteryProfile(incoming);
  const previous = normalizeMasteryProfile(current);
  const mastery = { ...next.classMastery };
  for (const [id, old] of Object.entries(previous.classMastery)) {
    const row = mastery[id] || { xp: 0, level: 0, unlockedRows: [] };
    mastery[id] = { ...row, xp: Math.max(row.xp, old.xp), level: Math.max(row.level, old.level),
      unlockedRows: [...new Set([...row.unlockedRows, ...old.unlockedRows])] };
  }
  const receipts = structuredClone(next.classMasteryReceipts);
  for (const [id, old] of Object.entries(previous.classMasteryReceipts)) {
    const receipt = receipts[id] || (receipts[id] = {});
    for (const [cls, xp] of Object.entries(old)) receipt[cls] = Math.max(receipt[cls] || 0, xp);
  }
  return { ...next, ...(next.progress ? { progress: { ...next.progress, maxClassLevel: Math.max(0, ...Object.values(mastery).map(row => row.level)) } } : {}), classMastery: mastery, classMasteryReceipts: receipts };
}

export function masterySpentXp(registry, level) {
  const curve = registry?.balance?.classMastery?.xp || balance.classMastery.xp;
  let total = 0;
  for (let step = 0; step < Math.min(level, curve.maxLevel); step++) total += xpStepCost(curve, step);
  return total;
}

export function bankMasteryProfile(meta, run, registry) {
  const state = run?.classMasteryState;
  if (!state || state.version !== 1 || state.bankable !== true) return { meta, changed: false };
  if (typeof state.receiptId !== 'string' || !state.receiptId || !safeKey(state.receiptId) || !object(state.earnedXp)) throw new Error('run.classMasteryState requires a receipt ID and earned XP ledger');
  const next = structuredClone(normalizeMasteryProfile(meta, registry));
  const receipt = next.classMasteryReceipts[state.receiptId] || (next.classMasteryReceipts[state.receiptId] = {});
  let changed = false;
  const cap = registry?.balance?.classMastery?.xp?.maxLevel || balance.classMastery.xp.maxLevel;
  for (const [id, earned] of Object.entries(state.earnedXp)) {
    if (!count(earned) || !classRows(registry).some(cls => cls.id === id)) throw new Error(`run.classMasteryState.earnedXp.${id} is invalid`);
    const row = next.classMastery[id];
    const delta = Math.max(0, earned - (receipt[id] || 0));
    if (!Number.isSafeInteger(row.xp + delta)) throw new Error(`class mastery XP for ${id} exceeds the safe integer range`);
    row.xp += delta;
    receipt[id] = Math.max(receipt[id] || 0, earned);
    const claimed = run.skills?.[`class:${id}`]?.level || 0;
    if (!count(claimed) || claimed > cap || masterySpentXp(registry, claimed) > row.xp) throw new Error(`class mastery claim for ${id} is not funded`);
    const level = Math.max(row.level, claimed);
    changed ||= delta > 0 || level > row.level;
    row.level = level;
    row.unlockedRows = [...new Set([...row.unlockedRows, ...unlockRows(registry).filter(unlock => unlock.classId === id && unlock.level <= level).map(rowId)])];
  }
  if (next.progress) next.progress.maxClassLevel = Math.max(0, ...Object.values(next.classMastery).map(row => row.level));
  return { meta: next, changed };
}
