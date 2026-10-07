// src/content/recoveryRules.js — how HP, Stamina and Mana come back, as data.
//
// Owner, 2026-09-27: "add a setting to set recovery rate for hp stamina and mp
// to at rest and or after combat and or after x rounds and or if not being used
// for x turns". Each pool has one row of five TRIGGERS; any combination may be
// on at once, and each adds what it restores:
//
//   perTurn / unit   the amount a qualifying combat turn restores ('flat'
//                    points or 'percent' of the maximum, rounded down)
//   idleTurns        a turn qualifies only after this many turns in a row in
//                    which the pool was not used (Stamina and Mana: nothing
//                    spent; HP: no HP lost). 0: every turn qualifies.
//   everyRounds      …and only on every Nth round of the fight (1: every one)
//   afterCombat      % of the maximum restored when a fight is won
//   atRest           % of the maximum restored at every Rest, on top of what
//                    the place itself restores (SPEC §13.4j)
//
// Every default is the game as it shipped before these settings: Stamina
// recovers `mechanics.stamina.idleRecoveryPerTurn` at the end of a turn that
// spent none (framework contract: Mana and Stamina) — idleTurns 1, everyRounds
// 1 — and nothing else recovers on its own. A profile left at these defaults
// fights exactly as before: the engine's own idle-Stamina rule runs and no
// recovery state is written into a fight or its save.
import { mechanics } from '../framework/data/mechanics.js';

export const RECOVERY_POOLS = Object.freeze(['hp', 'stamina', 'mana']);
export const RECOVERY_UNITS = Object.freeze(['flat', 'percent']);

export const recoveryRules = Object.freeze({
  defaults: Object.freeze({
    hp: Object.freeze({ perTurn: 0, unit: 'flat', idleTurns: 0, everyRounds: 1, afterCombat: 0, atRest: 0 }),
    stamina: Object.freeze({ perTurn: mechanics.stamina.idleRecoveryPerTurn, unit: 'flat', idleTurns: 1, everyRounds: 1, afterCombat: 0, atRest: 0 }),
    mana: Object.freeze({ perTurn: mechanics.mana.naturalRecoveryPerTurn, unit: 'flat', idleTurns: 0, everyRounds: 1, afterCombat: 0, atRest: 0 }),
  }),
  // The ranges the Settings rows accept and the fight door re-checks.
  ranges: Object.freeze({
    perTurn: Object.freeze({ min: 0, max: 99 }),
    idleTurns: Object.freeze({ min: 0, max: 10 }),
    everyRounds: Object.freeze({ min: 1, max: 10 }),
    afterCombat: Object.freeze({ min: 0, max: 100 }),
    atRest: Object.freeze({ min: 0, max: 100 }),
  }),
});
