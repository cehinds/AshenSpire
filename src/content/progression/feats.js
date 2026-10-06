// Fifty class feats. Effects come from normalized property carriers; no feat callbacks.
export const progressionFeats = Object.freeze([
  {
    "id": "progression-coal-on-steel",
    "skillId": "class:reaver",
    "minLevel": 1,
    "name": "Coal on Steel",
    "description": "The first Blade hit each turn applies +1 Bleed buildup."
  },
  {
    "id": "progression-brace-and-bite",
    "skillId": "class:reaver",
    "minLevel": 1,
    "name": "Brace and Bite",
    "description": "The first Blade attack each turn played while you have Block deals +3 damage."
  },
  {
    "id": "progression-red-footwork",
    "skillId": "class:reaver",
    "minLevel": 1,
    "name": "Red Footwork",
    "description": "The first Guard card each turn targeting an enemy with Bleed buildup draws 1 card."
  },
  {
    "id": "progression-anvil-discipline",
    "skillId": "class:reaver",
    "minLevel": 4,
    "name": "Anvil Discipline",
    "description": "The first Heavy attack each turn deals +2 Break damage."
  },
  {
    "id": "progression-forge-momentum",
    "skillId": "class:reaver",
    "minLevel": 4,
    "name": "Forge Momentum",
    "description": "Your first Blade attack after a Guard card each turn deals +4 damage."
  },
  {
    "id": "progression-paid-in-blood",
    "skillId": "class:reaver",
    "minLevel": 8,
    "name": "Paid in Blood",
    "description": "The first Blood attack after you have lost HP since your previous turn began deals +4 damage."
  },
  {
    "id": "progression-last-rampart",
    "skillId": "class:reaver",
    "minLevel": 8,
    "name": "Last Rampart",
    "description": "At half HP or lower, your first Guard card each turn grants +4 Block."
  },
  {
    "id": "progression-war-cadence",
    "skillId": "class:reaver",
    "minLevel": 12,
    "name": "War Cadence",
    "description": "After your second Heavy card in a turn, gain 4 Block, once per turn."
  },
  {
    "id": "progression-broad-sentence",
    "skillId": "class:reaver",
    "minLevel": 12,
    "name": "Broad Sentence",
    "description": "Your first attack that hits all living enemies each turn deals +2 damage to each target."
  },
  {
    "id": "progression-ember-sovereign",
    "skillId": "class:reaver",
    "minLevel": 16,
    "name": "Ember Sovereign",
    "description": "Once per turn, a Crown of Cinders charge gains +2 damage before it is consumed."
  },
  {
    "id": "progression-dread-of-the-hammer",
    "skillId": "class:reaver",
    "minLevel": 16,
    "name": "Dread of the Hammer",
    "description": "Your first Heavy attack against a Staggered target each turn deals +4 damage."
  },
  {
    "id": "progression-scarred-oath",
    "skillId": "class:reaver",
    "minLevel": 20,
    "name": "Scarred Oath",
    "description": "Your first Guard card after losing HP since your previous turn began grants +3 Block, once per turn."
  },
  {
    "id": "progression-harvest-the-wound",
    "skillId": "class:reaver",
    "minLevel": 20,
    "name": "Harvest the Wound",
    "description": "Your first credited kill of an enemy with Bleed buildup heals 3 HP, once per combat."
  },
  {
    "id": "progression-orbit-keeper",
    "skillId": "class:starseer",
    "minLevel": 1,
    "name": "Orbit Keeper",
    "description": "Your first Starstone spell following another spell each turn deals +3 direct damage."
  },
  {
    "id": "progression-moonward-scholar",
    "skillId": "class:starseer",
    "minLevel": 1,
    "name": "Moonward Scholar",
    "description": "The first Guard spell played after you spent at least 2 Mana this turn grants +3 Block."
  },
  {
    "id": "progression-comet-reader",
    "skillId": "class:starseer",
    "minLevel": 1,
    "name": "Comet Reader",
    "description": "The first Comet Mark attack each turn applies +1 Vulnerable after damage."
  },
  {
    "id": "progression-mirror-of-rime",
    "skillId": "class:starseer",
    "minLevel": 4,
    "name": "Mirror of Rime",
    "description": "Your first Rime Mirror each turn applies +2 Frost buildup."
  },
  {
    "id": "progression-constellation-keeper",
    "skillId": "class:starseer",
    "minLevel": 4,
    "name": "Constellation Keeper",
    "description": "Your first Starstone attack after two distinct Starstone card IDs this turn deals +3 damage."
  },
  {
    "id": "progression-patient-wellspring",
    "skillId": "class:starseer",
    "minLevel": 8,
    "name": "Patient Wellspring",
    "description": "The first Mana Weave restoration each turn also grants 3 Block."
  },
  {
    "id": "progression-weight-of-the-void",
    "skillId": "class:starseer",
    "minLevel": 8,
    "name": "Weight of the Void",
    "description": "The first Gravity Snare each turn applies +1 Weak after damage."
  },
  {
    "id": "progression-nightglass-scholar",
    "skillId": "class:starseer",
    "minLevel": 12,
    "name": "Nightglass Scholar",
    "description": "Once per turn, your Nightglass charge grants +2 additional damage when consumed."
  },
  {
    "id": "progression-eclipse-hunter",
    "skillId": "class:starseer",
    "minLevel": 12,
    "name": "Eclipse Hunter",
    "description": "Your first Starstone attack against a Frost-built-up or Frost-exposed target each turn deals +4 damage."
  },
  {
    "id": "progression-firmament-keeper",
    "skillId": "class:starseer",
    "minLevel": 16,
    "name": "Firmament Keeper",
    "description": "Once per turn, consuming a Warded Casting charge also grants 4 Block."
  },
  {
    "id": "progression-celestial-refrain",
    "skillId": "class:starseer",
    "minLevel": 16,
    "name": "Celestial Refrain",
    "description": "The second play of the same Starstone card ID in a turn grants 4 Block, once per turn."
  },
  {
    "id": "progression-memory-of-winter",
    "skillId": "class:starseer",
    "minLevel": 20,
    "name": "Memory of Winter",
    "description": "Retain up to 4 Block into your next turn; use the highest retention allowance if another source also retains Block."
  },
  {
    "id": "progression-threefold-sky",
    "skillId": "class:starseer",
    "minLevel": 20,
    "name": "Threefold Sky",
    "description": "Playing your third distinct Starstone card ID in a turn draws 1 card, once per turn."
  },
  {
    "id": "progression-first-knife",
    "skillId": "class:rogue",
    "minLevel": 1,
    "name": "First Knife",
    "description": "If your first card this turn is a Blade attack, it deals +3 damage."
  },
  {
    "id": "progression-pocket-method",
    "skillId": "class:rogue",
    "minLevel": 1,
    "name": "Pocket Method",
    "description": "Your first Guard card after an explicit discard each turn grants +3 Block."
  },
  {
    "id": "progression-crooked-measure",
    "skillId": "class:rogue",
    "minLevel": 4,
    "name": "Crooked Measure",
    "description": "Your first Crooked Guard hit each turn applies +1 Weak after damage."
  },
  {
    "id": "progression-open-flank",
    "skillId": "class:rogue",
    "minLevel": 4,
    "name": "Open Flank",
    "description": "Your first Blade attack against an enemy with zero Block each turn deals +3 damage."
  },
  {
    "id": "progression-hidden-palm",
    "skillId": "class:rogue",
    "minLevel": 8,
    "name": "Hidden Palm",
    "description": "The first Sleight of Hand sequence each turn grants 3 Block after the discard."
  },
  {
    "id": "progression-tighten-the-wire",
    "skillId": "class:rogue",
    "minLevel": 8,
    "name": "Tighten the Wire",
    "description": "Your first Tether Cut attack each turn against a Weak or Vulnerable enemy deals +3 damage."
  },
  {
    "id": "progression-smoke-dancer",
    "skillId": "class:rogue",
    "minLevel": 12,
    "name": "Smoke Dancer",
    "description": "Once per turn, a Smoke Edge charge adds +2 damage before it is consumed."
  },
  {
    "id": "progression-carrion-measure",
    "skillId": "class:rogue",
    "minLevel": 12,
    "name": "Carrion Measure",
    "description": "Your first Blade attack against an enemy at half HP or lower each turn deals +4 damage."
  },
  {
    "id": "progression-two-quiet-knives",
    "skillId": "class:rogue",
    "minLevel": 16,
    "name": "Two Quiet Knives",
    "description": "Your first Paired Strikes attack each turn deals +1 damage on each of its two hits."
  },
  {
    "id": "progression-trapdoor-smile",
    "skillId": "class:rogue",
    "minLevel": 16,
    "name": "Trapdoor Smile",
    "description": "Your first Blade attack after both a Guile card and a Guard card this turn deals +4 damage."
  },
  {
    "id": "progression-clean-exit",
    "skillId": "class:rogue",
    "minLevel": 20,
    "name": "Clean Exit",
    "description": "Your first Guard card played before any attack this turn restores 1 Stamina, once per turn."
  },
  {
    "id": "progression-razor-ledger",
    "skillId": "class:rogue",
    "minLevel": 20,
    "name": "Razor Ledger",
    "description": "Your first Blade attack after an explicit discard each turn deals +3 damage."
  },
  {
    "id": "progression-ashen-mercy",
    "skillId": "class:herald",
    "minLevel": 1,
    "name": "Ashen Mercy",
    "description": "The first Mercy in Ash card each turn heals +2 HP."
  },
  {
    "id": "progression-censer-keeper",
    "skillId": "class:herald",
    "minLevel": 1,
    "name": "Censer Keeper",
    "description": "The first Blood Censer offering each turn grants +3 Block after its HP payment."
  },
  {
    "id": "progression-sower-of-blight",
    "skillId": "class:herald",
    "minLevel": 4,
    "name": "Sower of Blight",
    "description": "The first Blight Seed hit each turn applies +2 Crimson Blight buildup."
  },
  {
    "id": "progression-funeral-watch",
    "skillId": "class:herald",
    "minLevel": 4,
    "name": "Funeral Watch",
    "description": "At half HP or lower, your first Guard card each turn grants +3 Block."
  },
  {
    "id": "progression-ember-almoner",
    "skillId": "class:herald",
    "minLevel": 8,
    "name": "Ember Almoner",
    "description": "Your first Ember Tithe each turn grants +1 Regen after the HP payment."
  },
  {
    "id": "progression-choir-of-bone",
    "skillId": "class:herald",
    "minLevel": 8,
    "name": "Choir of Bone",
    "description": "The first Guard card you play while any living enemy has Crimson Blight buildup restores 1 Stamina, once per turn."
  },
  {
    "id": "progression-requiem-reader",
    "skillId": "class:herald",
    "minLevel": 12,
    "name": "Requiem Reader",
    "description": "The first Ritual hit against an enemy with Crimson Blight buildup each turn deals +3 damage."
  },
  {
    "id": "progression-pilgrim-of-scars",
    "skillId": "class:herald",
    "minLevel": 12,
    "name": "Pilgrim of Scars",
    "description": "If you began the turn at half HP or lower, your first Guard card that turn heals 3 HP."
  },
  {
    "id": "progression-crowned-offering",
    "skillId": "class:herald",
    "minLevel": 16,
    "name": "Crowned Offering",
    "description": "The first Ritual attack after an earlier HP offering this turn deals +4 damage."
  },
  {
    "id": "progression-dawn-cantor",
    "skillId": "class:herald",
    "minLevel": 16,
    "name": "Dawn Cantor",
    "description": "The first Dawn Rite removal each turn also grants 3 Block."
  },
  {
    "id": "progression-bearer-of-burdens",
    "skillId": "class:herald",
    "minLevel": 20,
    "name": "Bearer of Burdens",
    "description": "The first negative status newly applied to you by an enemy each turn restores 1 Mana."
  },
  {
    "id": "progression-sepulchral-promise",
    "skillId": "class:herald",
    "minLevel": 20,
    "name": "Sepulchral Promise",
    "description": "Your first credited kill of an enemy with Crimson Blight buildup heals 3 HP, once per combat."
  }
]);

export const progressionFeatUnlocks = Object.freeze([
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "progression-coal-on-steel"
  },
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "progression-brace-and-bite"
  },
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "progression-red-footwork"
  },
  {
    "classId": "reaver",
    "level": 4,
    "kind": "feat",
    "ref": "progression-anvil-discipline"
  },
  {
    "classId": "reaver",
    "level": 4,
    "kind": "feat",
    "ref": "progression-forge-momentum"
  },
  {
    "classId": "reaver",
    "level": 8,
    "kind": "feat",
    "ref": "progression-paid-in-blood"
  },
  {
    "classId": "reaver",
    "level": 8,
    "kind": "feat",
    "ref": "progression-last-rampart"
  },
  {
    "classId": "reaver",
    "level": 12,
    "kind": "feat",
    "ref": "progression-war-cadence"
  },
  {
    "classId": "reaver",
    "level": 12,
    "kind": "feat",
    "ref": "progression-broad-sentence"
  },
  {
    "classId": "reaver",
    "level": 16,
    "kind": "feat",
    "ref": "progression-ember-sovereign"
  },
  {
    "classId": "reaver",
    "level": 16,
    "kind": "feat",
    "ref": "progression-dread-of-the-hammer"
  },
  {
    "classId": "reaver",
    "level": 20,
    "kind": "feat",
    "ref": "progression-scarred-oath"
  },
  {
    "classId": "reaver",
    "level": 20,
    "kind": "feat",
    "ref": "progression-harvest-the-wound"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "progression-orbit-keeper"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "progression-moonward-scholar"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "progression-comet-reader"
  },
  {
    "classId": "starseer",
    "level": 4,
    "kind": "feat",
    "ref": "progression-mirror-of-rime"
  },
  {
    "classId": "starseer",
    "level": 4,
    "kind": "feat",
    "ref": "progression-constellation-keeper"
  },
  {
    "classId": "starseer",
    "level": 8,
    "kind": "feat",
    "ref": "progression-patient-wellspring"
  },
  {
    "classId": "starseer",
    "level": 8,
    "kind": "feat",
    "ref": "progression-weight-of-the-void"
  },
  {
    "classId": "starseer",
    "level": 12,
    "kind": "feat",
    "ref": "progression-nightglass-scholar"
  },
  {
    "classId": "starseer",
    "level": 12,
    "kind": "feat",
    "ref": "progression-eclipse-hunter"
  },
  {
    "classId": "starseer",
    "level": 16,
    "kind": "feat",
    "ref": "progression-firmament-keeper"
  },
  {
    "classId": "starseer",
    "level": 16,
    "kind": "feat",
    "ref": "progression-celestial-refrain"
  },
  {
    "classId": "starseer",
    "level": 20,
    "kind": "feat",
    "ref": "progression-memory-of-winter"
  },
  {
    "classId": "starseer",
    "level": 20,
    "kind": "feat",
    "ref": "progression-threefold-sky"
  },
  {
    "classId": "rogue",
    "level": 1,
    "kind": "feat",
    "ref": "progression-first-knife"
  },
  {
    "classId": "rogue",
    "level": 1,
    "kind": "feat",
    "ref": "progression-pocket-method"
  },
  {
    "classId": "rogue",
    "level": 4,
    "kind": "feat",
    "ref": "progression-crooked-measure"
  },
  {
    "classId": "rogue",
    "level": 4,
    "kind": "feat",
    "ref": "progression-open-flank"
  },
  {
    "classId": "rogue",
    "level": 8,
    "kind": "feat",
    "ref": "progression-hidden-palm"
  },
  {
    "classId": "rogue",
    "level": 8,
    "kind": "feat",
    "ref": "progression-tighten-the-wire"
  },
  {
    "classId": "rogue",
    "level": 12,
    "kind": "feat",
    "ref": "progression-smoke-dancer"
  },
  {
    "classId": "rogue",
    "level": 12,
    "kind": "feat",
    "ref": "progression-carrion-measure"
  },
  {
    "classId": "rogue",
    "level": 16,
    "kind": "feat",
    "ref": "progression-two-quiet-knives"
  },
  {
    "classId": "rogue",
    "level": 16,
    "kind": "feat",
    "ref": "progression-trapdoor-smile"
  },
  {
    "classId": "rogue",
    "level": 20,
    "kind": "feat",
    "ref": "progression-clean-exit"
  },
  {
    "classId": "rogue",
    "level": 20,
    "kind": "feat",
    "ref": "progression-razor-ledger"
  },
  {
    "classId": "herald",
    "level": 1,
    "kind": "feat",
    "ref": "progression-ashen-mercy"
  },
  {
    "classId": "herald",
    "level": 1,
    "kind": "feat",
    "ref": "progression-censer-keeper"
  },
  {
    "classId": "herald",
    "level": 4,
    "kind": "feat",
    "ref": "progression-sower-of-blight"
  },
  {
    "classId": "herald",
    "level": 4,
    "kind": "feat",
    "ref": "progression-funeral-watch"
  },
  {
    "classId": "herald",
    "level": 8,
    "kind": "feat",
    "ref": "progression-ember-almoner"
  },
  {
    "classId": "herald",
    "level": 8,
    "kind": "feat",
    "ref": "progression-choir-of-bone"
  },
  {
    "classId": "herald",
    "level": 12,
    "kind": "feat",
    "ref": "progression-requiem-reader"
  },
  {
    "classId": "herald",
    "level": 12,
    "kind": "feat",
    "ref": "progression-pilgrim-of-scars"
  },
  {
    "classId": "herald",
    "level": 16,
    "kind": "feat",
    "ref": "progression-crowned-offering"
  },
  {
    "classId": "herald",
    "level": 16,
    "kind": "feat",
    "ref": "progression-dawn-cantor"
  },
  {
    "classId": "herald",
    "level": 20,
    "kind": "feat",
    "ref": "progression-bearer-of-burdens"
  },
  {
    "classId": "herald",
    "level": 20,
    "kind": "feat",
    "ref": "progression-sepulchral-promise"
  }
]);
