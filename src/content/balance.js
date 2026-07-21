// src/content/balance.js — every global tuning constant (SPEC §3.1(4))
//
// Code never embeds a balance number; a balance change is a one-file diff here.

export const balance = {
  energy: 3,
  draw: 5,
  handMax: 10,
  flaskSlots: 3,
  startingCinders: 0,

  // Engine-consulted poise config (see ENGINE-API §1). onFill is where content
  // defines what "Staggered" means — the engine never names the status.
  poise: {
    growthMult: 1.25,
    onFill: [{ op: 'applyStatus', target: 'self', status: 'staggered', stacks: 2 }],
  },

  // ---- M2 run economy (SPEC §6) ---------------------------------------------
  rewards: {
    cardChoices: 3,
    cinders: { normal: [15, 25], elite: [35, 50], boss: [75, 90] },
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

  // ---- Forsaken Together (co-op) ------------------------------------------
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
    hoarderCinders: 250, // Hoarder: bonus starting cinders
    expensiveShopsMult: 1.5, // Greedy Merchants: ×shop price
    hoarderShopMult: 2, // Hoarder: ×shop price
    lessHealingMult: 0.5, // Scarce Embers: ×healing (shrine rest + between-act)
  },

  // ---- presentation config (read by the UI layer, never by the engine) ----
  // Same rule as the tuning above: code never embeds these numbers. Keeping the
  // audio defaults here in particular means the engine fallback and the settings
  // slider can't drift apart — they previously lived in two files and silently
  // disagreed.
  ui: {
    // Accent themes → --gold plus its rgb form (focus glow / halos).
    accents: {
      gold: { hex: '#c9a227', rgb: '201, 162, 39' },
      crimson: { hex: '#c1453a', rgb: '193, 69, 58' },
      frost: { hex: '#7fa8c9', rgb: '127, 168, 201' },
      verdant: { hex: '#8bae54', rgb: '139, 174, 84' },
      violet: { hex: '#a06cc8', rgb: '160, 108, 200' },
    },
    // UI size → whole-app zoom (--ui-zoom). 'Auto' flexes against the design
    // baseline below and is clamped so it never gets unusably tiny/huge.
    uiScale: {
      named: { s: 0.85, m: 1, l: 1.2, xl: 1.45 },
      designW: 1200,
      designH: 730,
      min: 0.62,
      max: 1.7,
    },
    // Text size → root font-size %. Because type + dimensions are rem, one
    // value rescales the whole UI (styles/base.css).
    textSize: { S: '56.25%', M: '62.5%', L: '68.75%', XL: '75%' },
    // Sprite display tiers an enemy def's `size` selects. px-magnitude; the
    // renderer emits them as rem (÷10).
    spriteTiers: {
      small: { w: 92, h: 128, font: 44 },
      medium: { w: 132, h: 168, font: 58 },
      large: { w: 194, h: 206, font: 78 },
    },
    // How many act backdrop plates exist (assets/bg/bg_act*.webp). Endless acts
    // past this cycle back through them.
    backdropActs: 3,
    // Card colour motif (Settings → Display). Cards carry two independent
    // colour axes: the owning class (each class def's cardTint) and the
    // player's accent. `cardMotif` picks how the class one is expressed;
    // `cardMotifStrength` is the wash depth for each choice.
    cardMotif: 'wash',
    cardMotifModes: ['off', 'wash', 'accent', 'band'],
    cardMotifStrength: { subtle: 0.06, normal: 0.10, strong: 0.17 },
    // Default audio levels for a profile that has never touched the sliders.
    // Music is 0 (muted) while testing; sfx stays audible.
    audio: { musicVolume: 0, sfxVolume: 75 },
  },
};
