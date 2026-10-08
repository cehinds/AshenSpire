// Optional temporary rank increases never mutate a deck instance.
export function upcastOptions(def) {
  if (!def?.upcast) return [];
  const { baseTier, unlockedTiers, maximumTier } = def.upcast;
  if (!Number.isInteger(baseTier) || baseTier < 0 || !Number.isInteger(maximumTier) || maximumTier <= baseTier || maximumTier - baseTier > 5
    || !Array.isArray(unlockedTiers) || !unlockedTiers.length || new Set(unlockedTiers).size !== unlockedTiers.length
    || unlockedTiers.some(tier => !Number.isInteger(tier) || tier <= baseTier || tier > maximumTier)) throw new Error('Upcast requires authored base, unlocked and maximum tiers');
  return [...unlockedTiers].sort((a, b) => a - b).map(tier => ({ tier, ranks: tier, stamina: tier - baseTier, mana: tier - baseTier }));
}

export function upcastCard(def, tier = def.upcast?.baseTier ?? 0) {
  const baseTier = def.upcast?.baseTier ?? 0;
  const ranks = tier - baseTier;
  if (!Number.isInteger(ranks) || ranks < 0) throw new Error('Upcast ranks must be a non-negative integer');
  if (!ranks) return def;
  if (!upcastOptions(def).some(option => option.tier === tier)) throw new Error('This technique cannot be upcast to that rank');
  const cfg = def.upcast;
  const effects = (def.effects || []).map(effect => {
    effect = { ...effect, ...(effect.chance !== undefined && cfg.chancePerRank ? { chance: Math.min(100, effect.chance + cfg.chancePerRank * ranks) } : {}) };
    const perRank = effect.op === 'damage' ? cfg.damagePerRank : effect.op === 'buildup' ? cfg.pressurePerRank
      : ['block', 'gainBarrier'].includes(effect.op) ? cfg.blockPerRank : effect.op === 'poiseDamage' ? cfg.poisePerRank : 0;
    if (!perRank) return structuredClone(effect);
    const bonus = perRank * ranks;
    return { ...structuredClone(effect), amount: typeof effect.amount === 'number' ? effect.amount + bonus
      : { f: 'add', args: [effect.amount, bonus] } };
  });
  for (const breakpoint of cfg.breakpoints || []) if (ranks >= breakpoint.ranks) effects.push(...structuredClone(breakpoint.effects || []));
  const counterPayload = def.counterPayload && { ...def.counterPayload,
    hp: (def.counterPayload.hp || 0) + (cfg.damagePerRank || 0) * ranks,
    poise: (def.counterPayload.poise || 0) + (cfg.poisePerRank || 0) * ranks,
    ward: (def.counterPayload.ward || 0) + (cfg.wardPerRank || 0) * ranks };
  return { ...def, effects, ...(counterPayload ? { counterPayload } : {}), upcastTier: tier, upcastRanks: ranks, upcastSurcharge: ranks };
}
