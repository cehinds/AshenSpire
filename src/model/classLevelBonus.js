// Current class bonuses come from each run's saved level-reward rules.
// Earlier marked runs keep the original odd-level recipe.
import { classLevelBonuses } from '../content/classLevelBonuses.js';
import { gameModule } from './gameProfile.js';

/** True when the class milestone falls on this character level. */
export function IsClassBonusLevel(level, run) {
  if (run?.levelRewardRuleSnapshot) return IsLevelReward(level, run.levelRewardRuleSnapshot.classPrimary);
  return Number.isInteger(level) && level >= classLevelBonuses.fromLevel && level % 2 === 1;
}

/** How many class bonuses a character at `level` has earned. */
export function ClassBonusCount(level, run) {
  const cadence = run?.levelRewardRuleSnapshot?.classPrimary || { firstLevel: classLevelBonuses.fromLevel, every: 2 };
  return Number.isInteger(level) && level >= cadence.firstLevel ? 1 + Math.floor((level - cadence.firstLevel) / cadence.every) : 0;
}

export function IsLevelReward(level, cadence) {
  return Number.isInteger(level) && level >= cadence.firstLevel && (level - cadence.firstLevel) % cadence.every === 0;
}

export function ValidLevelRewardRules(rules) {
  const positive = value => Number.isInteger(value) && value > 0;
  const cadence = rule => rule && Number.isInteger(rule.firstLevel) && rule.firstLevel >= 2 && positive(rule.every) && positive(rule.amount);
  const attributes = rules?.classPrimaryAttribute;
  const validMap = attributes && !Array.isArray(attributes) && typeof attributes === 'object'
    && Object.entries(attributes).every(([id, attribute]) => (
      id && ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'].includes(attribute)
    ));
  return rules?.version === 1 && validMap && cadence(rules.classPrimary) && cadence(rules.freeAttribute)
    && Number.isInteger(rules.cardRankUpsPerLevel) && rules.cardRankUpsPerLevel >= 0;
}

export function ClassBonusAmount(run) {
  return run?.levelRewardRuleSnapshot?.classPrimary.amount ?? classLevelBonuses.amount;
}

/** The attribute a class's bonus raises, or null for a class with none. */
export function ClassBonusAttribute(classId, run) {
  const mapping = run?.levelRewardRuleSnapshot?.classPrimaryAttribute || classLevelBonuses.attributeByClass;
  return Object.hasOwn(mapping, classId) ? mapping[classId] : null;
}

/** The run field value that marks a run born with the class bonus; a save without it (made before) gets none. */
export const CLASS_LEVEL_BONUS_VERSION = 1;

/** True for a run whose character levels pay the class bonus: born with it, a profile with character levels, and a class worn. */
export function ClassBonusApplies(run) {
  return !!(run && (run.levelRewardRuleSnapshot || run.classLevelBonusVersion === CLASS_LEVEL_BONUS_VERSION) && !run.classUnequipped
    && gameModule(run, 'progression')?.characterLevels && ClassBonusAttribute(run.class, run));
}

/** ClassLevelAttributeBonus(run) → { [attributeId]: n }, {} when none applies. */
export function ClassLevelAttributeBonus(run) {
  if (!ClassBonusApplies(run)) return {};
  const count = ClassBonusCount(Number.isInteger(run.level?.level) ? run.level.level : 1, run);
  return count ? { [ClassBonusAttribute(run.class, run)]: count * ClassBonusAmount(run) } : {};
}
