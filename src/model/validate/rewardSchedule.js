// src/model/validate/rewardSchedule.js — the card reward schedule (SPEC §15.1) and the reward tables.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

export function rewardScheduleProblems(b, err, ctx) {
  // THE REWARD RARITY TABLE (owner ruling 2026-11-21): one table for every
  // class. Rare is under 10% of every source's row, and the chance a specific
  // card is offered (weight / that class's pool of the rarity) falls as
  // rarity rises: common > uncommon > rare.
  if (b.balance?.rewards?.rarityWeightsByClass !== undefined) err('balance.rewards.rarityWeightsByClass', 'retired: reward rarity is one table for every class (balance.rewards.rarityWeights)');
  if (b.balance?.rewards?.rarityWeights !== undefined) {
    const table = b.balance.rewards.rarityWeights;
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const root = 'balance.rewards.rarityWeights';
    const rarities = ['common', 'uncommon', 'rare'];
    if (!object(table)) err(root, 'must be an object keyed by reward pool');
    else for (const [pool, weights] of Object.entries(table)) {
      if (pool.startsWith('$')) continue;
      const path = `${root}.${pool}`;
      if (!['normal', 'elite', 'boss'].includes(pool)) err(path, 'unknown reward pool');
      if (!object(weights)) { err(path, 'must be a rarity weight object'); continue; }
      for (const rarity of Object.keys(weights)) if (!rarities.includes(rarity)) err(`${path}.${rarity}`, 'unknown reward rarity');
      let finite = true;
      for (const rarity of rarities) {
        if (!Number.isFinite(weights[rarity]) || weights[rarity] < 0) { err(`${path}.${rarity}`, 'must be a finite non-negative weight'); finite = false; }
      }
      if (!finite) continue;
      const total = weights.common + weights.uncommon + weights.rare;
      if (!(total > 0)) { err(path, 'must have a positive total weight'); continue; }
      if (weights.rare / total >= 0.1) err(`${path}.rare`, `rare must be under 10% of the ${pool} row, is ${(100 * weights.rare / total).toFixed(1)}%`);
      const cards = new Map((Array.isArray(b.cards) ? b.cards : []).map(card => [card.id, card]));
      for (const cls of Array.isArray(b.classes) ? b.classes : []) {
        const pools = { common: 0, uncommon: 0, rare: 0 };
        for (const id of cls.cardPool || []) { const rarity = cards.get(id)?.rarity; if (rarity in pools) pools[rarity]++; }
        const each = rarity => (pools[rarity] && weights[rarity] > 0 ? weights[rarity] / pools[rarity] : null);
        const [c, u, r] = rarities.map(each);
        if (c !== null && u !== null && !(c > u)) err(path, `${cls.id}: a specific uncommon card (${u.toFixed(3)}) must be rarer than a specific common (${c.toFixed(3)})`);
        if (u !== null && r !== null && !(u > r)) err(path, `${cls.id}: a specific rare card (${r.toFixed(3)}) must be rarer than a specific uncommon (${u.toFixed(3)})`);
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
