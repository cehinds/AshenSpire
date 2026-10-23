import { gameModule } from './gameProfile.js';
import { skillTracks, skillBonusFor, skillMaxLevel } from './skills.js';
import { resolveCard, primaryEffectIndex } from './registries.js';
import { hasClassMastery, masteryUnlockName } from './classMasteryRun.js';
import { masteryRowId } from './classMastery.js';

// Configured runs keep the existing class/weapon-group ledgers and XP curves.
// Equipment's procedural rank remains owned by Smithing tiers.
export function configuredSkillProgression(subject) {
  return subject?.gameProfile?.foundation?.mode === 'configured'
    && gameModule(subject, 'progression')?.mode === 'configured';
}

/** Persist only actual level crossings, never a re-derived modal on reload. */
export function skillLevelNotices(registries, awards, { usedArmaments = [], run, beforeState } = {}) {
  const tracks = skillTracks(registries);
  const crossings = awards.filter(award => award?.levelUps > 0);
  // Attribute simultaneous crossings in receipt order, without counting a
  // shared-school bonus twice. The saved receipt never needs to pay XP again.
  let previous = run && { ...run, skills: { ...run.skills } };
  if (previous) for (const award of crossings) previous.skills[award.skillId] = { ...previous.skills[award.skillId], level: award.before };
  return crossings.map(award => {
    const track = tracks.find(track => track.id === award.skillId);
    const weapons = usedArmaments.map(id => registries.equipment.armaments.find(piece => piece.id === id))
      .filter(piece => piece?.itemTypeTags?.includes(award.skillId)).map(piece => piece.name);
    const next = previous && { ...previous, skills: { ...previous.skills,
      [award.skillId]: { ...previous.skills[award.skillId], level: award.after } } };
    const effects = next && { ...progressionEffects(registries, previous, next, award, beforeState, run),
      maxLevel: track ? skillMaxLevel(registries, track.kind) : null };
    previous = next;
    return {
      skillId: award.skillId,
      label: track?.label || award.skillId,
      before: award.before,
      after: award.after,
      ...(weapons.length ? { weapons: [...new Set(weapons)] } : {}),
      ...(effects ? { effects } : {}),
    };
  });
}

// Compare the actual resolved primary numbers: ability-grade cards, capped
// bonuses, and cards without matching schools must never promise a gain.
function cardChanges(registries, before, after) {
  const changes = new Map();
  for (const inst of [...(after.deck || []), ...(after.sideboard || [])]) {
    if (!registries.cards.has(inst.cardId)) continue;
    const oldBonus = skillBonusFor(registries, before, inst), newBonus = skillBonusFor(registries, after, inst);
    if (oldBonus === newBonus) continue;
    const oldCard = resolveCard(registries, { ...inst, skillBonus: oldBonus });
    const newCard = resolveCard(registries, { ...inst, skillBonus: newBonus });
    const index = primaryEffectIndex(oldCard);
    if (index < 0) continue;
    const oldEffect = oldCard.effects[index], newEffect = newCard.effects[index];
    const field = oldEffect.op === 'applyStatus' ? 'stacks' : 'amount';
    if (oldEffect[field] === newEffect?.[field]) continue;
    const stat = oldEffect.op === 'damage' ? 'Damage' : oldEffect.op === 'block' ? 'Block'
      : oldEffect.op === 'applyStatus' ? `${registries.statuses?.get(oldEffect.status)?.name || oldEffect.status} stacks`
        : oldEffect.op === 'heal' ? 'Healing' : 'Poise damage';
    const change = { kind: 'card', label: `${newCard.name} · ${stat}${oldEffect.hits > 1 ? ' per hit' : ''}`,
      before: oldEffect[field], after: newEffect[field] };
    changes.set(JSON.stringify(change), change);
  }
  return [...changes.values()];
}

function progressionEffects(registries, before, after, award, beforeState, settled) {
  const changes = cardChanges(registries, before, after);
  const track = skillTracks(registries).find(row => row.id === award.skillId);
  let nextMilestone = null;
  if (track?.kind === 'class' && hasClassMastery(after)) {
    // A veteran may already own a threshold's unlocks. Only an actual profile
    // transition proves something became available at this crossing.
    if (!beforeState?.classMasteryState) return { version: 1, changes, unavailable: true };
    const classId = award.skillId.slice(6);
    const oldRows = new Set(beforeState.classMasteryState.profile?.classMastery?.[classId]?.unlockedRows || []);
    const newRows = new Set(after.classMasteryState.profile?.classMastery?.[classId]?.unlockedRows || []);
    const rows = (registries.classMastery || []).filter(row => row.classId === classId);
    for (const row of rows) if (!oldRows.has(masteryRowId(row)) && newRows.has(masteryRowId(row))) {
      changes.push({ kind: 'unlock', label: masteryUnlockName(registries, row), before: 'Locked', after: 'Available' });
    }
    const upcoming = rows.filter(row => row.level > award.after && !newRows.has(masteryRowId(row)));
    const level = Math.min(...upcoming.map(row => row.level));
    if (Number.isFinite(level)) nextMilestone = { level, labels: upcoming.filter(row => row.level === level).map(row => masteryUnlockName(registries, row)) };
  } else if (['weapon', 'focus', 'dual'].includes(track?.kind)) {
    const every = registries.balance.skill.flatEvery;
    const level = Number.isInteger(every) && every > 0 ? (Math.floor(award.after / every) + 1) * every : null;
    const cap = skillMaxLevel(registries, track.kind);
    if (level && (cap === null || level <= cap)) {
      const future = { ...settled, skills: { ...settled.skills, [award.skillId]: { ...settled.skills[award.skillId], level } } };
      const gains = cardChanges(registries, settled, future);
      if (gains.length) nextMilestone = { level, labels: gains.map(row => `${row.label} ${row.before} → ${row.after}`) };
    }
  }
  return { version: 1, changes, nextMilestone };
}

export function acknowledgeSkillLevelNotices(pending) {
  delete pending.progression;
}

// Missing means the old snapshotted rate, so loading an existing run never
// retroactively slows its progression. New Core profiles author their own rate.
export function configuredSkillXpMultiplier(subject, kind = 'weapon') {
  const value = gameModule(subject, 'progression')?.[kind === 'class' ? 'classXpMultiplier' : 'weaponXpMultiplier'];
  return Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 1;
}

// Core progression policy v1: preserve earned character ledgers and attributes,
// but stop future character XP, including old saves. Existing earned points
// and already queued character rewards remain claimable.
export const CORE_PROGRESSION_POLICY_VERSION = 1;
export function coreSkillOnlyProgression(subject) {
  return subject?.gameProfile?.foundation?.mode === 'configured'
    && subject.gameProfile.author?.core === 'ashen.core@2.0.0';
}
export function configuredCharacterLevels(subject) {
  return !coreSkillOnlyProgression(subject) && gameModule(subject, 'progression')?.characterLevels === true;
}

// A receipt acknowledges already-paid XP. A failed save keeps it resumable;
// neither opening nor continuing this screen may pay a ledger again.
export function acknowledgeVictoryReceipt(pending, persist) {
  const receipt = pending.victoryReceipt;
  if (!receipt) return false;
  delete pending.victoryReceipt;
  try {
    if (persist() === false) throw new Error('Victory receipt save was refused.');
  } catch (error) {
    pending.victoryReceipt = receipt;
    throw error;
  }
  return true;
}
