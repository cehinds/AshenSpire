// The class bonus a Core character holds from its odd character levels
// (owner, 2026-11-17). Pure: the run's class and level in, an attribute bonus
// out. Nothing is stored on the run, so a reload, a respec or an older save
// all read the same bonus; gameProfileEffectiveAttributes folds it in, so the
// pools, the ratings and a fight all price it.
import { classLevelBonuses } from '../content/classLevelBonuses.js';
import { gameModule } from './gameProfile.js';

/** True when the level's odd-level class bonus applies at this character level. */
export function IsClassBonusLevel(level) {
  return Number.isInteger(level) && level >= classLevelBonuses.fromLevel && level % 2 === 1;
}

/** How many class bonuses a character at `level` has earned. */
export function ClassBonusCount(level) {
  if (!Number.isInteger(level) || level < classLevelBonuses.fromLevel) return 0;
  let count = 0;
  for (let at = classLevelBonuses.fromLevel; at <= level; at += 1) if (IsClassBonusLevel(at)) count += 1;
  return count;
}

/** The attribute a class's bonus raises, or null for a class with none. */
export function ClassBonusAttribute(classId) {
  return classLevelBonuses.attributeByClass[classId] || null;
}

/** The run field value that marks a run born with the class bonus; a save without it (made before) gets none. */
export const CLASS_LEVEL_BONUS_VERSION = 1;

/** True for a run whose character levels pay the class bonus: born with it, a profile with character levels, and a class worn. */
export function ClassBonusApplies(run) {
  return !!(run && run.classLevelBonusVersion === CLASS_LEVEL_BONUS_VERSION && !run.classUnequipped
    && gameModule(run, 'progression')?.characterLevels && ClassBonusAttribute(run.class));
}

/** ClassLevelAttributeBonus(run) → { [attributeId]: n }, {} when none applies. */
export function ClassLevelAttributeBonus(run) {
  if (!ClassBonusApplies(run)) return {};
  const count = ClassBonusCount(Number.isInteger(run.level?.level) ? run.level.level : 1);
  return count ? { [ClassBonusAttribute(run.class)]: count * classLevelBonuses.amount } : {};
}
