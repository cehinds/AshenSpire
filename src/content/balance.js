// src/content/balance.js — every global tuning constant (SPEC §3.1(4))
//
// Code never embeds a balance number; a balance change is a one-file diff here.

export const balance = {
  energy: 3,
  draw: 5,
  handMax: 10,
  flaskSlots: 3,
  startingRunes: 0,

  // Engine-consulted poise config (see ENGINE-API §1). onFill is where content
  // defines what "Staggered" means — the engine never names the status.
  poise: {
    growthMult: 1.25,
    onFill: [{ op: 'applyStatus', target: 'self', status: 'staggered', stacks: 2 }],
  },

  // ---- M2 run economy (SPEC §6) ---------------------------------------------
  rewards: {
    cardChoices: 3,
    runes: { normal: [15, 25], elite: [35, 50], boss: [75, 90] },
    rarityWeights: {
      normal: { common: 60, uncommon: 35, rare: 5 },
      elite: { common: 45, uncommon: 40, rare: 15 },
      boss: { common: 45, uncommon: 40, rare: 15 },
    },
    // Decaying flask drop (StS potion rule): −step on drop, +step on miss.
    flaskDropBasePct: 35,
    flaskDropStepPct: 10,
  },

  shop: {
    cardStock: 5,
    relicStock: 2,
    flaskStock: 2,
    cardCost: { common: [45, 55], uncommon: [68, 82], rare: [135, 160] },
    relicCost: { common: [140, 160], uncommon: [200, 230], rare: [270, 300] },
    flaskCost: [50, 80],
    removeBase: 75,
    removeStep: 25,
  },

  shrine: { healPct: 35 },

  // Unknown (?) node resolution odds (SPEC §5.6 M2 tuning).
  unknownNode: { event: 55, fight: 25, shrine: 12, treasure: 8 },

  // M1 gauntlet glue (kept for the headless bot test; the map flow is M2+).
  gauntlet: {
    healPct: 15,
    rewardChoices: 3,
    rarityWeights: { common: 60, uncommon: 35, rare: 5 },
  },

  // ---- Tarnished Together (co-op) ------------------------------------------
  coop: {
    headcountHpFactor: 0.6, // enemy HP ×(1 + factor×(headcount−1)): 2p ×1.6, 3p ×2.2, 4p ×2.8
    mendHealPct: 30, // Mend at a shrine heals an ally this % of their max HP
    reviveHp: 1, // downed-but-not-dead members revive next floor at this HP (StS2)
  },

  // ---- Endless Spire + Custom Climb rule magnitudes ------------------------
  endless: {
    hpPerLoop: 0.35, // +% enemy HP per completed cycle
    strPerLoop: 1, // +Strength per completed cycle
    actsPerCycle: 3, // acts before the spire loops (also the act count)
  },
  customMods: {
    toughElitesHpMult: 1.3, // Tough Elites: elites & bosses ×HP
    bigBossesHpMult: 1.5, // Dread Bosses: act bosses ×HP
    hoarderRunes: 250, // Hoarder: bonus starting runes
    expensiveShopsMult: 1.5, // Greedy Merchants: ×shop price
    hoarderShopMult: 2, // Hoarder: ×shop price
    lessHealingMult: 0.5, // Scarce Grace: ×healing (shrine rest + between-act)
  },
};
