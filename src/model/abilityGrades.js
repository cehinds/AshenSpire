export const SPELLCRAFT_SKILL = 'item:magic-focus';
export const MANEUVERS_SKILL = 'combatManeuvers';
export const isAbilitySkill = id => id === SPELLCRAFT_SKILL || id === MANEUVERS_SKILL;
export const abilityKindForSkill = id => id === SPELLCRAFT_SKILL ? 'spell' : id === MANEUVERS_SKILL ? 'maneuver' : null;
export const abilityRules = registries => registries.balance.progression.ability;
export function abilityRankAt(registries, level) {
  return Math.max(0, abilityRules(registries).ranksAt.filter(at => level >= at).length - 1);
}
export function applyAbilityGrade(card, rank) {
  if (!Array.isArray(card.gradeProfiles)) return card;
  const chosen = rank ?? card.abilityRank ?? 0;
  const profile = card.gradeProfiles.find(row => row.rank === chosen);
  if (!profile) throw new Error(`${card.id}: missing authored ability grade ${chosen}`);
  return { ...card, cost: profile.actionCost, manaCost: profile.manaCost,
    effects: profile.effects, ...(profile.textTemplate ? { textTemplate: profile.textTemplate } : {}), ...(profile.traits || {}), abilityRank: chosen };
}
// Migration is authored, never a guessed 1..10 -> 0..5 conversion. An absent
// mapping keeps the old instance and resolves its old printed face.
export function migrateAbilityGrades(registries, run) {
  const snapshot = run.combatEntered?.snapshot;
  const active = snapshot?.piles ? Object.values(snapshot.piles).filter(Array.isArray).flat() : [];
  for (const inst of [...(run.deck || []), ...(run.sideboard || []), ...active]) {
    if (inst.abilityRank !== undefined || !registries.cards.has(inst.cardId)) continue;
    const card = registries.cards.get(inst.cardId);
    const mapped = card.legacyGradeMap?.[inst.rank ?? 1];
    if (Number.isInteger(mapped)) { inst.abilityRank = mapped; delete inst.rank; }
    else if ((run.migratedFromRunSchemaVersion || run.schemaVersion) < 22 && card.gradeProfiles) inst.legacyAbility = true;
  }
}
