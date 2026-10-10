import { expandedProgression, queueClassMilestone, capRunClassGrants } from './classMilestones.js';
import { activateAbilitySkill } from './abilitySkillActivation.js';
// SPEC §13.4q. A scoped projection keeps authored content complete while live
// reward/shop readers see the run owner's current unlocks. Definitions remain
// readable, including a locked card taught by a book.
import { normalizeMasteryProfile, masterySpentXp, bankMasteryProfile, masteryProfileProblems, mergeMasteryProfiles } from './classMasteryProfile.js';
import { masteryRowId } from './classMastery.js';

export const hasClassMastery = run => run?.classMasteryState?.version === 1;
export const masteryProfileFor = run => run?.classMasteryState?.profile || {};

export function openClassMasteryTrack(registries, run, classId) {
  const profile = masteryProfileFor(run);
  const held = profile.classMastery?.[classId] || { xp: 0, level: 0 };
  run.skills ||= {};
  // Re-equipping/swapping back retains this run's earned progress.
  const spent = held.spentXp ?? masterySpentXp(null, held.level);
  run.skills[`class:${classId}`] ||= { xp: Math.max(0, held.xp - spent), level: held.level, pendingDrafts: 0 };
  (run.classMasteryState.spentXp ||= {})[classId] ??= spent;
  run.classRewardLevels = { ...run.classRewardLevels, [classId]: run.skills[`class:${classId}`].level };
  run.classMasteryState.earnedXp[classId] ||= 0;
  if (expandedProgression(run)) {
    for (let level = 1; level <= held.level; level++) {
      const receipt = queueClassMilestone(registries, run, classId, level, { veteran: true });
      if (!receipt) continue;
      for (const kind of ['cards','armory','relic']) if (receipt.grants[kind]) receipt.grants[kind].state = 'spent';
    }
    // Re-equipping a class re-checks its feat/attribute grants against the
    // run's shared budget (SPEC §13.4r), which another class may have used.
    capRunClassGrants(registries, run, classId);
    const ability = registries.balance.progression.classSkills[classId]?.find(id => ['item:magic-focus','combatManeuvers'].includes(id));
    if (ability) activateAbilitySkill(run, ability);
  }
}

export function openRunClassMastery(registries, run, meta, { receiptId, bankable = true } = {}) {
  if (typeof receiptId !== 'string' || !receiptId) throw new Error('class mastery requires a caller-owned unique run receipt ID');
  const canonical = normalizeMasteryProfile(meta, registries);
  run.classMasteryState = { version: 1, receiptId, bankable, earnedXp: {},
    profile: { classMastery: structuredClone(canonical.classMastery) },
    fullPools: ['draft', 'sealed'].includes(run.custom?.deckMode), initialTreeTiers: [] };
  openClassMasteryTrack(registries, run, run.class);
  if (expandedProgression(run)) run.initialProgressionPending = true;
  const held = run.skills[`class:${run.class}`].level;
  const tiers = registries.balance.skill.class.tierAt;
  run.classMasteryState.initialTreeTiers = tiers.map((at, index) => index === 0 ? 0 : at).flatMap((at, index) => held >= at ? [index + 1] : []);
  return run;
}

export function recordClassMasteryXp(run, classId, amount) {
  if (!hasClassMastery(run) || !(Number.isSafeInteger(amount) && amount > 0)) return;
  const ledger = run.classMasteryState.earnedXp;
  ledger[classId] = (ledger[classId] || 0) + amount;
}

export function adoptClassMasteryProfile(run, meta) {
  if (!hasClassMastery(run)) return;
  const id = run.classMasteryState.receiptId;
  run.classMasteryState.profile = { classMastery: structuredClone(meta.classMastery),
    classMasteryReceipts: { [id]: structuredClone(meta.classMasteryReceipts?.[id] || {}) } };
}

export function refreshRunClassMastery(run, meta, registries) {
  if (hasClassMastery(run)) adoptClassMasteryProfile(run, mergeMasteryProfiles(masteryProfileFor(run), meta, registries));
}

// Unlocks update immediately at a claim, even in nonbanking co-op. The profile
// write uses the same cumulative receipt when the solo owner persists it.
export function claimRunClassMastery(registries, run) {
  if (!hasClassMastery(run)) return;
  const result = bankMasteryProfile(masteryProfileFor(run), { ...run,
    classMasteryState: { ...run.classMasteryState, bankable: true } }, registries);
  run.classMasteryState.profile = { classMastery: result.meta.classMastery,
    classMasteryReceipts: result.meta.classMasteryReceipts };
}

export function masteryReferenceOpen(registries, meta, ref, kinds = null) {
  const rows = (registries.classMastery || []).filter(row => row.ref === ref && (!kinds || kinds.includes(row.kind)));
  return !rows.length || rows.some(row => (meta.classMastery?.[row.classId]?.unlockedRows || []).includes(masteryRowId(row)));
}

export function registriesForClassMastery(registries, run) {
  const root = registries.masterySource || registries;
  const source = run && !expandedProgression(run) && root.legacyProgressionSource ? root.legacyProgressionSource : root;
  if (!hasClassMastery(run)) return source;
  const full = () => run.classMasteryState.fullPools === true;
  const open = (ref, kinds) => (full() && (!expandedProgression(run) || kinds?.includes('cards'))) || masteryReferenceOpen(source, masteryProfileFor(run), ref, kinds);
  const classRow = id => {
    const cls = source.classes.get(id);
    return { ...cls, cardPool: cls.cardPool.filter(ref => open(ref, ['cards'])) };
  };
  const curve = source.balance.classMastery.xp;
  return { ...source, masterySource: source, masteryRun: run, progressionEnabled: expandedProgression(run),
    balance: { ...source.balance, ...(expandedProgression(run) && run.progressionRuleSnapshot ? {progression:run.progressionRuleSnapshot} : {}), skill: { ...source.balance.skill, class: { ...source.balance.skill.class,
      xp: { ...curve }, tierAt: source.balance.skill.class.tierAt.map((at, index) => index === 0 ? 0 : at) } } },
    classes: { ...source.classes, get: classRow, all: () => source.classes.all().map(cls => classRow(cls.id)) },
    relics: { ...source.relics, all: () => source.relics.all().filter(row => open(row.id, ['relic'])), ids: () => source.relics.ids().filter(id => open(id, ['relic'])) },
    equipment: { ...source.equipment,
      get armaments() { return source.equipment.armaments.filter(row => open(`armament/${row.id}`, ['armament', 'weapon'])); },
      get armour() { return source.equipment.armour.filter(row => open(`armor/${row.classId}/${row.id}`, ['armament'])); },
    },
  };
}

export function masteryNextUnlocks(registries, meta, classId) {
  const held = meta.classMastery?.[classId]?.level || 0;
  return (registries.classMastery || []).filter(row => row.classId === classId && row.level === held + 1);
}

export function masteryUnlockName(registries, row) {
  const source = registries.masterySource || registries;
  if (row.kind === 'cards') return source.cards.get(row.ref).name;
  if (row.kind === 'relic') return source.relics.get(row.ref).name;
  if (row.kind === 'feat') return source.classSkillFeats.find(feat => feat.id === row.ref)?.name || row.ref;
  if (row.ref.startsWith('armament/')) return source.equipment.armaments.find(item => `armament/${item.id}` === row.ref)?.name || row.ref;
  return source.equipment.armour.find(item => `armor/${item.classId}/${item.id}` === row.ref)?.name || row.ref;
}

export function classMasteryRunProblems(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return ['classMasteryState must be an object'];
  const errors = [];
  if (state.version !== 1) errors.push('classMasteryState.version must be 1');
  if (typeof state.receiptId !== 'string' || !state.receiptId || ['__proto__', 'constructor', 'prototype'].includes(state.receiptId)) errors.push('classMasteryState.receiptId must be a safe nonempty ID');
  for (const field of ['bankable', 'fullPools']) if (typeof state[field] !== 'boolean') errors.push(`classMasteryState.${field} must be boolean`);
  if (!state.earnedXp || typeof state.earnedXp !== 'object' || Array.isArray(state.earnedXp)
    || Object.values(state.earnedXp).some(value => !Number.isSafeInteger(value) || value < 0)) errors.push('classMasteryState.earnedXp must hold nonnegative integer XP');
  if (state.spentXp !== undefined && (!state.spentXp || typeof state.spentXp !== 'object' || Array.isArray(state.spentXp) || Object.values(state.spentXp).some(value => !Number.isSafeInteger(value) || value < 0))) errors.push('classMasteryState.spentXp must hold nonnegative integer XP');
  if (!Array.isArray(state.initialTreeTiers) || state.initialTreeTiers.some(tier => ![1, 2, 3].includes(tier))) errors.push('classMasteryState.initialTreeTiers must name tree tiers');
  if (!state.profile || typeof state.profile !== 'object' || !state.profile.classMastery) errors.push('classMasteryState.profile must hold the owner mastery');
  else errors.push(...masteryProfileProblems({ ...state.profile, classMasteryReceipts: state.profile.classMasteryReceipts || {} }).map(error => `classMasteryState.${error}`));
  return errors;
}
