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
  // `unknownNode` MOVED to mapConfigs[act].unknownWeights (EldenSpire#43-adjacent,
  // Freja's finding, Marina binding): what a `?` node resolves to is map geometry
  // and belongs beside `typeWeights`, per act. A flat global here could not vary
  // per act while the map it describes does, and nothing said so.

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
      // PROTOTYPE (EldenSpire#23, track B). A SECOND design baseline, for the
      // narrow layout in styles/combat.css. #23 reads as a clamp bug — the
      // floor of 0.62 winning on every phone — and it is not: lowering the
      // floor to 0.325 fits a 1200px layout onto a 390px screen and gives you
      // glyphs you can read on a board you still cannot use. The wrong number
      // is the BASELINE, which says every screen is 1200x730. Auto picks
      // whichever of the two baselines wants the LARGER zoom, so nothing here
      // decides "is this a phone" — the fit does, and the floor stops binding
      // on its own without being touched.
      //
      // 430x780 is a portrait-phone board: at 390x844 it wants 0.907 (local
      // 430x930), at 412x915 0.958, at 360x640 0.821 (local 438x780).
      //
      // narrowMax is the width, in LOCAL px, at or below which the narrow
      // layout is used. It lives HERE and nowhere else.
      //
      // It used to live in styles/combat.css instead, as `@container app
      // (max-width: 520px)`, because a container query condition cannot read a
      // custom property. That was a correct single-home argument and Vira
      // verified it — and it was not the point. The stylesheet asking the
      // question at all made TWO deciders out of one decision: the zoom judged
      // innerWidth/innerHeight against 430x780, the layout judged the
      // container's local width against 520, and nothing made them agree. On a
      // tablet they disagreed and the fight became unadvanceable (#24).
      // main.js now decides once and writes `data-layout` on <html>; the
      // stylesheets follow it and measure nothing. One decider, one home, and
      // CSS needs no copy of this number.
      narrowW: 430,
      narrowH: 780,
      narrowMax: 520,
    },
    // Text size → root font-size %. Because type + dimensions are rem, one
    // value rescales the whole UI (styles/base.css).
    textSize: { S: '56.25%', M: '62.5%', L: '68.75%', XL: '75%' },
    // MINIMUM TAP SIZE (Settings → Accessibility). THE ONE HOME OF THE 44.
    //
    // It used to be the literal `44px` inside `--tap-floor` in styles/base.css.
    // Constantine: "just make the tabs about 20% smaller or the size
    // configurable or scalable with UI or both" — and then, on the 44 floor,
    // "actually, I think it should be able to go smaller than 44px." Sunna
    // measured why the second half of the first sentence could never answer
    // him: `calc(44px / var(--ui-zoom))` under `body { zoom }` renders
    // 44 x zoom / zoom, so the floored controls are the one part of the
    // interface UI size cannot reach — 44.00 device px in all 20 UI-size x
    // shape cells, zero variance. So it is configurable, and this is the data.
    //
    // `sizes` IS THE CLOSED SET, largest first — that order is the order the
    // chips draw in and the order the row reads. The settings row derives its
    // `choices` and its `def` from here; nothing restates them.
    //
    // `missRate` is what the RESEARCH says, and ONLY where it says anything.
    // Two points exist: WCAG 2.1 AAA (SC 2.5.5) is 44x44 CSS px, WCAG 2.2 AA
    // (SC 2.5.8) is 24x24. 36 and 30 sit between them and carry no entry ON
    // PURPOSE — an interpolated statistic is a fabricated one, and the cost
    // line below 44 says less about them rather than inventing a number
    // (Sunna's ruling; Law 0 clause 5 is the same sentence about derivation).
    //
    // ADDING A FIFTH SIZE IS A ROW HERE AND NOTHING ELSE: it appears as a chip,
    // it applies, and it gets a cost line with no percentage unless someone
    // adds one. Removing `missRate` for a size removes the percentage and keeps
    // the sentence. That is the falsifier for Law 0 on this control.
    tapSize: {
      def: 44,
      sizes: [44, 36, 30, 24],
      missRate: { 44: '1 in 30', 24: '1 tap in 7' },
    },
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
    // Card TYPE presentation. Geometry carries the type (attack squarest,
    // power roundest, skill between) and each type owns its banner colour.
    // label is display-only — the engine keys on the id (CARD_TYPES is frozen
    // and the Bulwark stance matches 'skill'), so renaming here is safe.
    cardTypes: {
      attack: { label: 'ATTACK', color: '#c9502e', radius: 3, art: 0 },
      skill: { label: 'SKILL', color: '#7fa8c9', radius: 10, art: 6 },
      power: { label: 'POWER', color: '#c9a227', radius: 20, art: 16 },
      curse: { label: 'CURSE', color: '#6a3a7a', radius: 10, art: 6 },
      status: { label: 'STATUS', color: '#7a6f5a', radius: 10, art: 6 },
    },
    cardMotif: 'wash',
    cardMotifModes: ['off', 'wash', 'accent', 'band'],
    cardMotifStrength: { subtle: 0.06, normal: 0.10, strong: 0.17 },
    // Default audio levels for a profile that has never touched the sliders.
    // Music ships at 50, deliberately under SFX's 75: the score is ambience,
    // the SFX are information, and the hit-confirm must read over any swell.
    // The beds carry their own gain staging on top of this bus (music.js,
    // gains 0.34–0.6), so 50 is clearly audible from first boot without
    // crowding the feedback layer.
    audio: { musicVolume: 50, sfxVolume: 75 },
  },

  // ---- Armaments & armour (equipment) ---------------------------------------
  // What you carry rewrites the cards you start with, rather than adding new
  // ones: a dagger turns Strike into 3×2, a greatsword into one heavy swing.
  // The pieces themselves live in content/source/weapons.csv and outfits.csv;
  // what a mod is ALLOWED to say lives in equipMods.csv. Everything here is
  // the rules of the system, kept in one place so it can be tuned or switched
  // off without touching the model.
  equipment: {
    enabled: true,

    // 'perRun'   what you find is yours for this run only
    // 'unlocked' pieces are permanent once unlocked, chosen before a run
    // 'both'     unlocked pieces are choosable AND drops apply for the run
    persistence: 'both',

    // Swapping a hand mid-fight. 'energy' spends from the turn's pool;
    // 'allowance' gives a separate per-turn budget that energy never touches.
    swapCostKind: 'energy',
    swapCost: 2,
    swapAllowancePerTurn: 1, // only consulted when swapCostKind === 'allowance'
    swapEndsTurn: false,

    // true  → swapping rewrites the Strikes/Defends already in your hand
    // false → only cards drawn after the swap carry the new numbers
    restampHand: true,

    storageSlots: 8, // pieces carried but not slotted; hand slots lock in combat

    defaultView: 'hybrid', // 'grid' | 'rack' | 'hybrid'
    // What a NARROW layout opens on. Data, not a branch in the screen: the view
    // list is content, and picking one in JS would put a second copy of the
    // closed set below the content layer (Law 1 clause 3). EldenSpire#38 —
    // 'hybrid' asks for a figure and three cells side by side and a phone has
    // room for one of those, which is how two of six weapon slots went missing.
    // A player's own saved equipView still wins over this; it is what a phone
    // OPENS on, never what it is allowed to show.
    narrowDefaultView: 'rack',
    // A VIEW DESCRIBES ITSELF; the screen derives the layout (#78, Law 0 cl.1).
    // These were three bare ids and `equipment.js` was `if (view === 'grid') …
    // else …`, so a fourth id rendered AS HYBRID and said nothing — the author
    // did the data-driven thing correctly and got a silently wrong screen.
    //
    // Two characteristics are the whole difference, and every rule in ui.css
    // that used to key off `.view-<id>` keys off one of them now:
    //   figure — is the dressed class figure on screen at all
    //   slots  — 'flank': slot blocks split either side of the figure
    //            'list':  slot blocks in one column beside it
    //
    // WHAT IS CLOSED IS THE COMBINATION, NOT EACH FIELD. Read that before
    // inventing a row. The first pass said "both are closed sets", which is two
    // closed sets and a product of FOUR cells — and only three are drawn. A row
    // saying `figure: false, slots: 'flank'` used every legal word and rendered
    // an EMPTY armoury in silence (Vira, #78). The three combinations below are
    // the whole vocabulary; each one is a layout in LAYOUTS in equipment.js and
    // that table is the only place the list lives. Anything else fails loud and
    // names this row (Law 1 clause 5) — including a combination of two words
    // that are each fine on their own.
    views: [
      { id: 'grid', figure: true, slots: 'flank' },
      { id: 'rack', figure: false, slots: 'list' },
      { id: 'hybrid', figure: true, slots: 'list' },
    ],
    // WHICH PANE IS THE SUBJECT. One field, and it is the whole of "collapsible"
    // (#90). Constantine: *"I still want the armoury card list to be collapsable
    // SO THAT I CAN SEE THE ARMORY SLOTS BETTER."* The clause after "so that" is
    // the datum — on this screen the slots are what you came for and everything
    // else is what helps you decide. `collapsible: true` written on a pane is
    // that fact spelled as a mechanism, and it is a special case in a
    // characteristic's clothes.
    //
    // NOT A FLAG PER PANE, and this is the #78 lesson one screen over. A
    // two-valued `role` on each pane is a closed set per pane whose PRODUCT has
    // cells nobody built: NO subject (every pane collapsible — you can fold the
    // whole screen away) and TWO subjects (nothing to order by, nothing that
    // must stay open). A POINTER has no product. One field, one value, and
    // context is the COMPLEMENT — derived, never authored.
    //
    // The regions themselves are the vocabulary and live where they are drawn
    // (REGIONS in src/ui/screens/equipment.js), exactly as LAYOUTS holds the
    // view cells. A name here that is not a region fails BY NAME at boot with
    // the list printed; naming none fails the same way.
    subject: 'slots',

    spriteReacts: 'full', // 'none' | 'hands' | 'full'

    // Floors of the mod system, so a piece can't be authored past the point
    // where the card stops making sense.
    limits: { minCost: 0, minDamage: 0, minBlock: 0, maxHits: 6 },

    // ---- Where armaments come from ------------------------------------------
    // You start bare-handed and the run arms you. A found piece is yours for
    // the run immediately AND remembered forever, so a climb that ends badly
    // still widens the wardrobe — the roguelike bargain: this run's loss is
    // next run's option.
    drops: {
      enabled: true,
      // false makes every authored armament available from the start (a sandbox
      // for testing the mod system without playing for it).
      requireFound: true,
      permanentOnFind: true,
      // HOW MUCH OF THE UNKNOWN THE PLAYER SEES — the Compendium's whole dial,
      // and one word. Constantine: *"the potential weapons to unlock should be
      // in its own menu on the main menu that keeps most things hidden."* The
      // vocabulary is not new: it is `REVEAL_MODES` from unlocks.csv, applied to
      // the OTHER gate. An armament is withheld by not being found rather than
      // by an unearned condition, so it has no unlock row to read a reveal from,
      // and this is where that answer lives — one home, tunable, no code.
      //   'teased'  silhouette, rarity, hand. No name, no tags, no numbers.
      //   'listed'  the above plus its name and why it is not yours.
      //   'hidden'  the Compendium is empty until you find something.
      // 'teased' is the shipped line: shape is a promise, a name is the item
      // delivered without the climb. A piece that wants a different answer names
      // an unlock row, whose own `reveal` wins (Law 0 clause 3 — the override is
      // data). The Armoury picker is unaffected by this word: an offer you
      // cannot take shows its reason either way.
      reveal: 'teased',
      // Chance a node of each kind yields an armament, and the rarity odds when
      // it does. Bosses always drop; their table is weighted to the good stuff.
      chance: { treasure: 60, elite: 30, boss: 100, shop: 0 },
      rarityWeights: {
        treasure: { common: 55, uncommon: 35, rare: 10 },
        elite: { common: 40, uncommon: 45, rare: 15 },
        boss: { common: 15, uncommon: 45, rare: 40 },
      },
      // A duplicate is a non-event, so drops prefer something you have never
      // held. With nothing new left the node gives cinders instead.
      preferUnfound: true,
      consolationCinders: 40,
    },
  },
};
