// src/model/validate/rewardSchedule.js — the card reward schedule (SPEC §15.1) and the reward tables.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

export function rewardScheduleProblems(b, err, ctx) {
  if (b.balance?.rewards?.rarityWeightsByClass !== undefined) {
    const overrides = b.balance.rewards.rarityWeightsByClass;
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const root = 'balance.rewards.rarityWeightsByClass';
    if (!object(overrides)) err(root, 'must be an object keyed by class id');
    else for (const [classId, pools] of Object.entries(overrides)) {
      const path = `${root}.${classId}`;
      if (!(b.classes || []).some(cls => cls.id === classId)) err(path, 'unknown class id');
      if (!object(pools)) { err(path, 'must be an object keyed by reward pool'); continue; }
      for (const [pool, weights] of Object.entries(pools)) {
        const poolPath = `${path}.${pool}`;
        if (!['normal', 'elite', 'boss'].includes(pool)) err(poolPath, 'unknown reward pool');
        if (!object(weights)) { err(poolPath, 'must be a rarity weight object'); continue; }
        for (const rarity of Object.keys(weights)) if (!['common', 'uncommon', 'rare'].includes(rarity)) err(`${poolPath}.${rarity}`, 'unknown reward rarity');
        for (const rarity of ['common', 'uncommon', 'rare']) {
          if (!Number.isFinite(weights[rarity]) || weights[rarity] < 0) err(`${poolPath}.${rarity}`, 'must be a finite non-negative weight');
        }
        if (!(weights.common + weights.uncommon + weights.rare > 0)) err(poolPath, 'must have a positive total weight');
      }
    }
  }

  // THE CARD REWARD SCHEDULE (SPEC §15.1). Absent reads as the shipped
  // defaults (model/rewardplan.js cardRewardSchedule, read by cardRewardPlan); present, every key is
  // checked, and a key it does not know is refused rather than ignored.
  if (b.balance?.rewards?.cardRewards !== undefined) {
    const s = b.balance.rewards.cardRewards;
    const root = 'balance.rewards.cardRewards';
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!object(s)) err(root, 'must be an object { afterCombat, chancePct, onLevelUp, onLevelUpMaxPerFight }');
    else {
      for (const key of Object.keys(s)) if (!['afterCombat', 'chancePct', 'onLevelUp', 'onLevelUpMaxPerFight'].includes(key)) err(`${root}.${key}`, 'Unknown field');
      for (const [key, check, want] of [
        ['afterCombat', value => typeof value === 'boolean', 'true or false'],
        ['chancePct', value => Number.isInteger(value) && value >= 0 && value <= 100, 'an integer percent 0–100'],
      ]) {
        const table = s[key];
        if (!object(table)) { err(`${root}.${key}`, 'must be an object { normal, elite, boss }'); continue; }
        for (const pool of Object.keys(table)) if (!['normal', 'elite', 'boss'].includes(pool)) err(`${root}.${key}.${pool}`, 'unknown reward pool');
        for (const pool of ['normal', 'elite', 'boss']) if (!check(table[pool])) err(`${root}.${key}.${pool}`, `must be ${want}, got ${JSON.stringify(table[pool])}`);
      }
      if (typeof s.onLevelUp !== 'boolean') err(`${root}.onLevelUp`, `must be true or false, got ${JSON.stringify(s.onLevelUp)}`);
      if (!(Number.isInteger(s.onLevelUpMaxPerFight) && s.onLevelUpMaxPerFight >= 0)) err(`${root}.onLevelUpMaxPerFight`, `must be a non-negative integer, got ${JSON.stringify(s.onLevelUpMaxPerFight)}`);
    }
  }

  if (b.balance?.rewards?.sourceBonuses !== undefined) {
    const bonuses = b.balance.rewards.sourceBonuses;
    const keys = ['combatFeatChancePct', 'classFeatChancePct', 'classCardChancePct'];
    if (!bonuses || typeof bonuses !== 'object' || Array.isArray(bonuses)) err('balance.rewards.sourceBonuses', 'must be an object');
    else {
      for (const key of Object.keys(bonuses)) if (!keys.includes(key)) err(`balance.rewards.sourceBonuses.${key}`, 'Unknown field');
      for (const key of keys) if (!Number.isInteger(bonuses[key]) || bonuses[key] < 0 || bonuses[key] > 100) err(`balance.rewards.sourceBonuses.${key}`, 'must be an integer percent 0–100');
    }
  }
}
