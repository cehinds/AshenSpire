// Deliberately small arithmetic scenarios, independent of authored game balance.
// Add only fields exercised by a mechanics test; this is not a past content pack.
export function scoringContract() {
  const effect = (weight, per = 1) => ({ weight, per });
  return {
    model: { R: 3, D: 15, I: 6, ENEMIES: 2, AUTH_PHYS: .35, AUTH_SPELL: .5, AUTH_BLOCK: .49 },
    costs: { sp: { weight: -4 }, mp: { weight: -8 } },
    effects: {
      damage: effect(1, 3), block: effect(1, 3), poiseDamage: effect(1),
      draw: effect(2), heal: effect(3), loseHp: effect(-1, 2), discard: effect(-1),
      restoreStamina: effect(4), restoreMana: effect(8), removeStatus: effect(2),
      counterStack: effect(2), applyReflect: effect(2), pullEnemy: effect(1), moveEngagement: effect(1),
    },
    statuses: { venom: { weight: 1, target: 'enemy' }, burn: { weight: 1, target: 'enemy' }, ward: { weight: 1, target: 'self' }, strength: { weight: 4, target: 'self' } },
    cardModel: {
      decayOneStatuses: [], tickDamageTakenPerStack: .05, chillStacksPerStamina: 3,
      utility: { holdOne: 1, boost: 2, cull: 2, shuffle: 1, attr: 1 },
      copyDivisor: 3, counterstrikeTag: 'trait:counterstrike', honedTag: 'ramp.honed', areaTag: 'targeting:area',
    },
    keywords: { retain: { flat: 3 } }, tags: { 'damage:fire': { weight: 2 } },
    categories: { hybrid: { weight: 10, multiplier: false } },
    effectCount: { weight: 2, skipFirst: true, riders: ['poise'] },
    rarity: { discount: { common: 0, uncommon: 2, rare: 5, starter: 0 } },
    rank: { unrankedMax: 0, width: 4, maxRank: 10, maxCp: 40 },
    items: { rarityDiscount: { boss: 7 }, plays: { strike: 1, defend: 1 }, kit: { unarmedAttack: 3, unarmedGuard: 1 }, gearFields: { statDex: { weight: 6 } } },
    upgradeTags: {
      efficient: { mode: 'flat', base: 10 }, refined: { mode: 'flat', base: 6 },
      tempered: { mode: 'flat', base: 4 }, purified: { mode: 'flat', base: 4 }, gearAttribute: { mode: 'flat', base: 4 },
    },
    naming: { card: {
      element: { 'school:fire': 'Flame', 'damage:fire': 'Flame', 'school:frost': 'Frost', 'damage:frost': 'Frost', 'school:divine': 'Divine', 'damage:sacred': 'Divine', 'school:alteration': 'Warding' },
      effect: { damage: '@element', burn: 'Searing', ward: 'Warded', block: 'Guarding', heal: 'Mending' },
      rarity: { uncommon: 'Improved', rare: 'Greater' },
      base: { 'attack:martial:melee': 'Strike', 'attack:martial:reach': 'Shot', 'attack:magic:melee': 'Touch', 'attack:magic:reach': 'Bolt', 'attack:area:martial': 'Cleave', 'attack:area:magic': 'Wave', 'skill:martial': 'Technique', 'skill:magic': 'Rite' },
      range: { 'range:melee': 'melee', 'range:reach': 'reach' },
      defaultRange: { martial: 'melee', magic: 'reach' },
      tradition: { 'tradition:arcane': 'Arcane', 'tradition:divine': 'Divine' }, defaultTradition: 'Arcane',
      fallback: { damage: 'Keen' }, limit: { maxChars: 24, keep: ['base', 'rank', 'upgrade', 'element', 'effect', 'rarity'] },
    } },
  };
}

// Representative gate ladder for mechanics tests. Production ladders have their
// own source-to-runtime and boundary checks, and may be retuned independently.
export function tierContract() {
  return {
    enabled: true, rarityBonus: { common: 0, uncommon: 0, rare: 1 },
    upgradeRarityMinTier: [0, 1, 3],
    upgradeTagStacks: { improved: [0, 2, 3], efficient: [2, 3, 4], refined: [2, 3, 4], tempered: [0, 2, 3], purified: [1, 2, 3] },
    zeroCostMinTier: 3, hybridMinTier: 2,
    upgrades: { costSwap: 1, cost: 2, stkEase: 2, 'fx:unethereal': 2, 'fx:unexhaust': 3, hits: 3 },
    elements: { fire: 0, arcane: 1, lightning: 2, force: 3 },
    statuses: {
      prepared: { minTier: 0, maxStacksBase: 2, stacksPerExtraTier: 1 },
      weak: { minTier: 0, maxStacksBase: 3, stacksPerExtraTier: 1 },
      venom: { minTier: 1, maxStacksBase: 2, stacksPerExtraTier: 1 },
      burn: { minTier: 1, maxStacksBase: 2, stacksPerExtraTier: 1 },
      ward: { minTier: 2, maxStacksBase: 1, stacksPerExtraTier: 1 },
      evade: { minTier: 3, maxStacksBase: 1, stacksPerExtraTier: 1 },
      strength: { minTier: 4, maxStacksBase: 1, stacksPerExtraTier: 1 },
    },
    ceilings: { damage: [12, 18, 28, 40, null], block: [10, 15, 22, 32, null] },
  };
}
