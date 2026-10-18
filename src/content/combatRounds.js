// Combat rounds preview: the tables of docs/alternative-combat-rounds, as data (owner, 2026-10-11).
//
// The CSV texts below are copies of the files in docs/alternative-combat-rounds/. The bundler
// cannot inline CSV files, so they live here as strings. tests/combat-rounds-round.test.mjs
// fails when a copy drifts from its file. The placeholder numbers are PLACEHOLDERS until the
// owner tunes them; the engine in src/engine/combatRounds/ reads them from here.

// Source: docs/alternative-combat-rounds/evade-bonus.csv
export const EVADE_BONUS_CSV = `stance,bonusPct,note
evade,20,TBD status: evade stance adds to the evade percent for that exchange
block,5,TBD status: block adds a little to the evade percent for that exchange
attack,0,TBD status: attacking gives no evade bonus
`;

// Source: docs/alternative-combat-rounds/evasion-armor.csv
export const EVASION_ARMOR_CSV = `armor,base,dexCap
Cloth,0,4
Leather,0,6
Studded,1,3
Chain,1,2
Scale,1,1
Plated,1,0
`;

// Source: docs/alternative-combat-rounds/evasion-cards.csv
export const EVASION_CARDS_CSV = `card,bonus
Backstep,5
Shadowstep,4
Quickstep,3
Acrobatics,3
Dodge,3
Evasive Guard,2
`;

// Source: docs/alternative-combat-rounds/speed-mods.csv
export const SPEED_MODS_CSV = `source_type,source,mod,status,note
armor,heavy,-3,owner,
armor,medium,-2,owner,
armor,light,-1,owner,
armor,clothing,0,owner,
armor,magical-tier1,+1,owner,magical armor +1/+2/+3; tier-to-value mapping assumed 1 maps to +1; confirm
armor,magical-tier2,+2,owner,magical armor +1/+2/+3; tier-to-value mapping assumed 2 maps to +2; confirm
armor,magical-tier3,+3,owner,magical armor +1/+2/+3; tier-to-value mapping assumed 3 maps to +3; confirm
weapon,dagger,+2,owner,
weapon,straightSword,,TBD,placeholder; id from content/source/weapons.csv
weapon,greatsword,,TBD,placeholder; id from content/source/weapons.csv
weapon,shortbow,,TBD,placeholder; brief said bow; no bow id in weapons.csv; real id is shortbow (bowPierceAttack profile)
weapon,roundShield,,TBD,placeholder; id from content/source/weapons.csv
weapon,buckler,,TBD,placeholder; id from content/source/weapons.csv
weapon,ashStaff,,TBD,placeholder; id from content/source/weapons.csv
weapon,boneSceptre,,TBD,placeholder; id from content/source/weapons.csv
range,melee,,TBD,placeholder
range,reach,,TBD,placeholder
range,ranged,,TBD,placeholder
attackType,quick,,TBD,placeholder
attackType,heavy,,TBD,placeholder
attackType,telegraphed,,TBD,placeholder
skill,rank,,TBD,placeholder; skill rank mod not specified
initiative,initiative,,TBD,placeholder; initiative mod not specified
card,strike,1,owner,base action speed (owner)
card,counter,3,owner,base action speed (owner); no card id 'counter' in content/source; it is maneuver:counter in nodes.csv
card,gorefireSlash,1|2|3,TBD,base action speed; pick one
card,crimsonCleave,1|2|3,TBD,base action speed; pick one
card,shieldBash,1|2|3,TBD,base action speed; pick one
card,dodgeRoll,1|2|3,TBD,base action speed; pick one
card,quickstep,1|2|3,TBD,base action speed; pick one
card,backstep,1|2|3,TBD,base action speed; pick one
card,shadowstep,1|2|3,TBD,base action speed; pick one
`;

// Source: docs/alternative-combat-rounds/stance-advantage.csv
export const STANCE_ADVANTAGE_CSV = `attacker_stance,defender_stance,bonus,note
smash,block,2,owner: smash beats guard (block) and breaks it
counter,attack,1,owner: counter beats attack
counter,smash,1,TBD status: counter punishes a heavy attack
counter,sweep,1,TBD status: counter punishes a wide attack
block,attack,1,TBD status: block holds against a plain attack
evade,attack,1,TBD status: evade dodges a plain attack
evade,smash,1,TBD status: evade dodges a heavy attack
evade,sweep,1,TBD status: evade dodges a wide attack
attack,smash,1,owner 2026-10-12: a quick attack beats a slow heavy wind-up
attack,sweep,1,owner 2026-10-12: a direct attack beats a wide swing
`;

// PLACEHOLDER: SP budget per combatant per round when a spec gives none. SP is 3 for
// testing and refills each round (owner, 2026-10-11).
export const DEFAULT_SP = 3;

// PLACEHOLDER: a card with no `sp` costs this much SP (owner, 2026-10-11).
export const DEFAULT_CARD_SP = 1;

// PLACEHOLDER: a queued (preemptive) defensive card gets this buff. Reactions use base values.
export const REACTION_BUFF = Object.freeze({ speed: 1, block: 2, evadePct: 10, counterDamage: 1 });

// PLACEHOLDER: base values of the defensive cards, before any buff.
export const DEFENSE_BASE = Object.freeze({ block: 6, evadePct: 20, counterDamage: 2 });

// PLACEHOLDER (owner, 2026-10-11): enemy adaptation. Chance per WIS point is 15%, clamped to 0..60%.
export const ADAPT_PERCENT_PER_WIS = 15;
export const ADAPT_PERCENT_MAX = 60;
export const ADAPT_INDEX = 2;
export const ADAPT_COUNTER_DAMAGE = 2;
