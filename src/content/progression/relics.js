// Relic definitions and gates are one independently installable module.
export const progressionRelics = [
  {
    "id": "progression-emberjaw-token",
    "name": "Emberjaw Token",
    "rarity": "uncommon",
    "icon": "🦷",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "Your first Blade hit each combat applies {bleed} additional Bleed buildup.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-cracked-war-anvil",
    "name": "Cracked War Anvil",
    "rarity": "rare",
    "icon": "⚒️",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "Your first Heavy attack each turn deals {poiseDamage} additional Break damage.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-cinderbound-crown",
    "name": "Cinderbound Crown",
    "rarity": "rare",
    "icon": "👑",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "Your first credited kill of an enemy with Bleed buildup each combat heals {heal} HP.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-moonwell-lens",
    "name": "Moonwell Lens",
    "rarity": "uncommon",
    "icon": "🔮",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "Your first Starstone spell each turn played after spending at least 2 Mana grants {block} Block.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-nightglass-rosary",
    "name": "Nightglass Rosary",
    "rarity": "rare",
    "icon": "📿",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "The second play of the same Starstone card ID in a turn restores {restoreMana} Mana, once per turn.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-fragment-of-the-third-sky",
    "name": "Fragment of the Third Sky",
    "rarity": "rare",
    "icon": "🌌",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "Your third distinct Starstone card ID played in a turn grants {block} Block, once per turn.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-whisperglass-die",
    "name": "Whisperglass Die",
    "rarity": "uncommon",
    "icon": "🎲",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "If your first card in combat is a Blade attack, it deals +{chargeDamage} damage.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-purse-of-borrowed-shadows",
    "name": "Purse of Borrowed Shadows",
    "rarity": "rare",
    "icon": "👝",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "After your first explicit discard each turn, gain {block} Block.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-ember-alms-bowl",
    "name": "Ember Alms Bowl",
    "rarity": "uncommon",
    "icon": "🥣",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "Your first nonlethal HP offering each turn grants {block} Block after its payment.",
    "flavor": "A keepsake of the road through ash."
  },
  {
    "id": "progression-ossuary-prayer-wheel",
    "name": "Ossuary Prayer Wheel",
    "rarity": "rare",
    "icon": "🛞",
    "passives": {
      "modifiers": []
    },
    "textTemplate": "Your first credited kill of an enemy with Crimson Blight buildup each combat restores {restoreMana} Mana.",
    "flavor": "A keepsake of the road through ash."
  }
];
export const progressionRelicUnlocks = [
  {
    "classId": "reaver",
    "level": 8,
    "kind": "relic",
    "ref": "progression-emberjaw-token"
  },
  {
    "classId": "reaver",
    "level": 14,
    "kind": "relic",
    "ref": "progression-cracked-war-anvil"
  },
  {
    "classId": "reaver",
    "level": 20,
    "kind": "relic",
    "ref": "progression-cinderbound-crown"
  },
  {
    "classId": "starseer",
    "level": 8,
    "kind": "relic",
    "ref": "progression-moonwell-lens"
  },
  {
    "classId": "starseer",
    "level": 14,
    "kind": "relic",
    "ref": "progression-nightglass-rosary"
  },
  {
    "classId": "starseer",
    "level": 20,
    "kind": "relic",
    "ref": "progression-fragment-of-the-third-sky"
  },
  {
    "classId": "rogue",
    "level": 8,
    "kind": "relic",
    "ref": "progression-whisperglass-die"
  },
  {
    "classId": "rogue",
    "level": 14,
    "kind": "relic",
    "ref": "progression-purse-of-borrowed-shadows"
  },
  {
    "classId": "herald",
    "level": 8,
    "kind": "relic",
    "ref": "progression-ember-alms-bowl"
  },
  {
    "classId": "herald",
    "level": 14,
    "kind": "relic",
    "ref": "progression-ossuary-prayer-wheel"
  }
];
