import { rollFeatOptions } from '../model/feats.js';
import { classSkillId, skillKindOf, pendingSkillLevelCount } from '../model/skills.js';
import { rollCardRewardIds, rollSkillDraftIds } from './encounters.js';

// Every non-class skill level has a card offer. Prefer its own schools;
// armour and tracks with no available school cards use the class pool while
// retaining the skill level's rarity gates and draft size.
export function rollGuaranteedSkillDraftIds(registries, rng, args) {
  const kind = skillKindOf(registries, args.skillId);
  if (!kind || kind === 'class') return [];
  const ids = rollSkillDraftIds(registries, rng, args);
  if (ids.length) return ids;
  const schools = [...new Set(registries.classes.get(args.classId).cardPool
    .flatMap(id => registries.cards.get(id).tags || []))];
  return rollSkillDraftIds(registries, rng, { ...args, schools });
}

// Roll once before the pending reward checkpoint is saved. Class bonuses are
// independent of the tree draft and do not consume its pendingDrafts counter.
export function rollSourceRewardBonuses(registries, rng, {
  classId, pool = 'normal', classLevels = 0, bankedLevels = 0, relicIds = [], flatRarity = false,
} = {}) {
  const rules = registries.balance.rewards.sourceBonuses || {};
  const wins = pct => pct >= 100 || (pct > 0 && rng.chance('rewardRolls', pct));
  const levelChoices = [], levelCards = [];
  const feat = metadata => levelChoices.push({ ...metadata, ordinal: levelChoices.length,
    options: rollFeatOptions(rng).map(id => ({ kind: 'feat', id })) });
  if (wins(rules.combatFeatChancePct || 0)) feat({ source: 'combat' });
  for (let i = 0; i < classLevels + bankedLevels; i++) {
    const metadata = { source: 'class', skillId: classSkillId(classId), claimOrdinal: i < classLevels ? 0 : i - classLevels + 1 };
    if (wins(rules.classFeatChancePct || 0)) feat(metadata);
    if (wins(rules.classCardChancePct || 0)) {
      const cardIds = rollCardRewardIds(registries, rng, { classId, pool, relicIds, flatRarity });
      if (cardIds.length) levelCards.push({ ...metadata, ordinal: levelCards.length, cardIds });
    }
  }
  return { levelChoices, levelCards };
}

export function appendSourceRewardBonuses(rewards, bonuses) {
  const append = key => [...(rewards[key] || []), ...(bonuses[key] || [])]
    .map((row, ordinal) => ({ ...row, ordinal }));
  return { ...rewards, levelChoices: append('levelChoices'), levelCards: append('levelCards') };
}

// Issued alongside the offer in the same save transaction. Already claimed
// levels (including Armoury claims) are issued once; banked rows wait for
// their claimOrdinal and are marked issued by the level-claim callback.
export function runSourceRewardOffer(registries, rng, run, offer, { pool, includeBanked = false, levelsGained = 0, flatRarity = false } = {}) {
  const current = run.skills?.[classSkillId(run.class)]?.level || 0;
  const through = run.classRewardLevels?.[run.class] ?? (run.classRewardLevels ? 0 : current - levelsGained);
  const classLevels = run.classUnequipped ? 0 : Math.max(0, current - through);
  const bankedLevels = run.classUnequipped || !includeBanked ? 0 : pendingSkillLevelCount(registries, run, classSkillId(run.class));
  const result = appendSourceRewardBonuses(offer, rollSourceRewardBonuses(registries, rng, {
    classId: run.class, pool, classLevels, bankedLevels, relicIds: run.relics, flatRarity,
  }));
  if (!run.classUnequipped) run.classRewardLevels = { ...run.classRewardLevels, [run.class]: current };
  return result;
}
