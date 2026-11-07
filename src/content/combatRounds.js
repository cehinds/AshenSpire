// The hit tables the combat screen and the counter read, as data (owner, 2026-10-11).
//
// The CSV texts are copies of docs/alternative-combat-rounds/evasion-armor.csv and stance-advantage.csv; the
// bundler cannot inline CSV files, so they live here as strings. The rest of the combat-rounds tables (evade bonus,
// evasion cards, speed mods, the SP and defence placeholders) went with the system (cleanup 3i-A).

// Source: docs/alternative-combat-rounds/evasion-armor.csv
export const EVASION_ARMOR_CSV = `armor,base,dexCap
Cloth,0,4
Leather,0,6
Studded,1,3
Chain,1,2
Scale,1,1
Plated,1,0
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
