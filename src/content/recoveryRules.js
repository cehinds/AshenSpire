// src/content/recoveryRules.js — how HP, Stamina and Mana come back between fights, as data.
//
// Owner, 2026-09-27: "add a setting to set recovery rate for hp stamina and mp to at rest and or after combat".
// Each pool has one row of two triggers (cleanup 3i-A removed the in-combat ones and the Settings rows that changed
// them, so a stored `recovery.*` key changes nothing):
//
//   afterCombat   % of the maximum restored when a fight is won
//   atRest        % of the maximum restored at every Rest, on top of what the place itself restores
//                 (SPEC §13.4j)
//
// Both default to 0: a fight's end refills Mana and Stamina by their own rules (mechanics.mana.combatEndRefill,
// mechanics.stamina.combatStartRefill) and a Rest restores what the place says.

export const RECOVERY_POOLS = Object.freeze(['hp', 'stamina', 'mana']);

export const recoveryRules = Object.freeze({
  defaults: Object.freeze({
    hp: Object.freeze({ afterCombat: 0, atRest: 0 }),
    stamina: Object.freeze({ afterCombat: 0, atRest: 0 }),
    mana: Object.freeze({ afterCombat: 0, atRest: 0 }),
  }),
});
