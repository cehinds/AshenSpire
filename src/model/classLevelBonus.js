// The class bonus a Core character holds from its odd character levels
// (owner, 2026-11-17). Pure: the run's class and level in, an attribute bonus
// out. Nothing is stored on the run, so a reload, a respec or an older save
// all read the same bonus; gameProfileEffectiveAttributes folds it in, so the
// pools, the ratings and a fight all price it.
import { classLevelBonuses } from '../content/classLevelBonuses.js';
import { gameModule } from './gameProfile.js';

/** True when the level's odd-level class bonus applies at this character level. */
export function isClassBonusLevel(level) {
  return Number.isInteger(level) && level >= classLevelBonuses.fromLevel && level % 2 === 1;
}

/** How many class bonuses a character at `level` has earned. */
export function classBonusCount(level) {
  if (!Number.isInteger(level) || level < classLevelBonuses.fromLevel) return 0;
  let count = 0;
  for (let at = classLevelBonuses.fromLevel; at <= level; at += 1) if (isClassBonusLevel(at)) count += 1;
  return count;
}

/** The attribute a class's bonus raises, or null for a class with none. */
export function classBonusAttribute(classId) {
  return classLevelBonuses.attributeByClass[classId] || null;
}

/** True for a run whose character levels pay the class bonus: a configured profile with character levels and a class worn. */
export function classBonusApplies(run) {
  return !!(run && !run.classUnequipped && gameModule(run, 'progression')?.characterLevels && classBonusAttribute(run.class));
}

/** ClassLevelAttributeBonus(run) → { [attributeId]: n }, {} when none applies. */
export function ClassLevelAttributeBonus(run) {
  if (!classBonusApplies(run)) return {};
  const count = classBonusCount(Number.isInteger(run.level?.level) ? run.level.level : 1);
  return count ? { [classBonusAttribute(run.class)]: count * classLevelBonuses.amount } : {};
}
