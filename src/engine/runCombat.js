// engine/runCombat.js — the one door a run's fight is built through.
//
// The live game (src/main.js enterCombat) and every headless simulator
// (tools/runsim.mjs, tools/balance.mjs, tools/measure-classes.mjs) build a
// fight from a run here, so a simulated fight is the fight a player gets: the
// same hand rules, rating rules, swap price, equipment start statuses and
// stamped pools. Before this door each simulator kept its own copy of the
// option list, and the copies had drifted — none passed the hand or rating
// rules, so the bots were measuring a game nobody played.
//
// runCombatEnd(run, combat) is the matching exit: the pools a fight leaves
// behind (HP, Mana, Stamina and their maxima, flasks and their charges, the
// equipment pool deficits) are written back to the run, as the live
// onCombatEnd does, so the next fight opens where this one ended.

import { createCombat } from './combat.js';
import { resolveHandRules } from '../model/handRules.js';
import { handStatRows, ratingsConfigFor } from '../model/statRows.js';
import { runMods, resolveSwapCostRule } from '../model/loadout.js';
import { staminaAtCombatStart, staminaDeficitAtCombatStart } from '../framework/resources.js';

/** The run fields a fight consumes, by name — never `...run`. */
export function runCombatPlayer(run) {
  // A fight opens with the Stamina the framework's entry rule gives
  // (mechanics.stamina.combatStartRefill, plan A2); Mana carries as it is.
  // A refill also settles the Stamina deficit an equipment swap carried, so
  // the next swap cannot take the refilled points back.
  const stamina = staminaAtCombatStart({ currentStamina: run.stamina, maxStamina: run.maxStamina });
  const equipmentPoolDeficits = run.equipmentPoolDeficits
    ? { ...run.equipmentPoolDeficits, stamina: staminaDeficitAtCombatStart(run.equipmentPoolDeficits.stamina) }
    : run.equipmentPoolDeficits;
  return {
    classId: run.class,
    attributes: run.attributes,
    // The character level every stat row's `perLevel` reads (ruleset 7).
    level: Number.isInteger(run.level?.level) && run.level.level >= 1 ? run.level.level : 1,
    attributeMode: run.attributeMode, // the scale the dodge reads Dexterity on (plan A3)
    // The rule this run was born with, so the Poise vessel combat stamps
    // is the one its character sheet shows (plan phase 9).
    derivedStatRuleSnapshot: run.derivedStatRuleSnapshot,
    skills: run.skills, // the ledger the progression predicates read (plan phase 4a)
    coreTags: run.coreTags, // the class tree's picks, mounted with the class card (plan phase 5b)
    maxHp: run.maxHp,
    hp: run.hp,
    maxMana: run.maxMana,
    mana: run.mana,
    maxStamina: run.maxStamina,
    stamina,
    energyMax: run.energyMax,
    drawPerTurn: run.drawPerTurn,
    damageBySchoolAdd: run.damageBySchoolAdd,
    equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
    equipmentAttackSlotCount: run.equipmentAttackSlotCount,
    removedAttackSlotIds: run.removedAttackSlotIds,
    equipmentPoolDeficits,
    itemUpgradeLevels: run.itemUpgradeLevels,
    itemMounts: run.itemMounts,
    armamentLevels: run.armamentLevels,
    deck: run.deck,
    relicIds: run.relics,
    flasks: run.flasks,
    flaskCharges: run.flaskCharges,
    loadout: run.loadout,
  };
}

/**
 * createRunCombat({ registries, rng, run, enemyIds, settings, hpMult, enemyDamageMult,
 *   enemyStatuses, playerStatuses, player }) → combat
 *
 * `settings` is the profile's settings object (meta.settings); a fresh
 * profile's is `{}`, which resolves every per-fight rule to its default.
 * `playerStatuses` are the caller's extra start statuses (Custom Climb); the
 * equipment's own are added here. `player` overrides single player fields
 * (the screenshot door's Poise override).
 */
export function createRunCombat({
  registries, rng, run, enemyIds, settings = {},
  hpMult = 1, enemyDamageMult = 1, enemyStatuses = [], playerStatuses = [], player = {},
}) {
  return createCombat({
    // ONE ROW FORMAT, READ FROM THE RUN (ruleset 7). The rating rows and the
    // three hand rows are this run's own — its snapshot's, or for a run born
    // before ruleset 7 the retired homes it was priced by (model/statRows.js).
    ratingsRules: ratingsConfigFor(registries, run) || null,
    handRules: resolveHandRules(settings || {}, handStatRows(registries, run, { settings: settings || {} })),
    registries,
    rng,
    player: { ...runCombatPlayer(run), ...player },
    enemyIds,
    hpMult,
    enemyDamageMult,
    enemyStatuses,
    // WHICH SWAP PRICE THIS FIGHT IS UNDER (A8). Read once, here, at the same
    // point the other per-fight rules are decided — Settings → Advanced changes
    // it for the NEXT fight, which is what the row's note promises, and is why
    // there is no live re-read inside the swap.
    swapCostRule: resolveSwapCostRule(registries, { settings: settings || {} }),
    // `self.*` mods (Strength from an oathsworn set, Regen from a warm habit)
    // enter through the same door Custom Climb buffs already used — the engine
    // has no equipment code, only statuses applied at combat start.
    playerStatuses: [...playerStatuses, ...runMods(registries, run.loadout, run.class).startStatuses],
  });
}

/** Write what a fight leaves behind back onto the run (live onCombatEnd's first half). */
export function runCombatEnd(run, combat) {
  run.flasks = combat.player.flasks; // drunk flasks stay drunk
  run.flaskCharges = combat.player.flaskCharges ? { ...combat.player.flaskCharges } : run.flaskCharges;
  for (const field of ['hp', 'mana', 'stamina']) {
    run[field] = combat.player[field];
    const maxField = `max${field[0].toUpperCase()}${field.slice(1)}`;
    run[maxField] = combat.player[maxField];
  }
  run.equipmentPoolDeficits = { ...combat.equipmentPoolDeficits };
}
