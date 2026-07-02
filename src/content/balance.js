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

  // M1 gauntlet glue (reward screens between fights; full run economy is M2).
  gauntlet: {
    healPct: 15, // % max HP healed after each non-boss victory
    rewardChoices: 3,
    rarityWeights: { common: 60, uncommon: 35, rare: 5 },
  },
};
