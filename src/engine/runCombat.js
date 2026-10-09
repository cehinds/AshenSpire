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
import { runHandRules } from '../model/handRules.js';
import { playInDeckOrder } from '../model/deckRules.js';
import { recoveryRulesFor } from '../model/recoveryRules.js';
import { ratingsConfigFor } from '../model/statRows.js';
import { runMods, resolveSwapCostRule } from '../model/loadout.js';
import { isPoolDeckMode } from '../model/cardRemoval.js';
import { staminaAtCombatStart, staminaDeficitAtCombatStart } from '../framework/resources.js';
import { settleFightConsumables, tickCompanions } from '../model/consumables.js';
import { resolveEnemyLevel } from '../model/levels.js';
import { stampSkillBonuses, critRulesFor } from '../model/skills.js';
import { openKnowledgeEncounter } from '../model/enemyKnowledgeRun.js';
import { emptyEnemyKnowledge, mergeEnemyKnowledge } from '../model/enemyKnowledgeProfile.js';
import { reconcileCombatKnowledge } from './enemyKnowledge.js';
import { effectiveAshenBlightAttributes } from '../model/ashenBlight.js';

export function enemyLevelsForFight(registries, run, enemyIds, encounter = null) {
  return enemyIds.map((enemyId, index) => {
    const profile = registries.enemies.get(enemyId)?.levelProfile;
    if (!profile) return 1;
    return resolveEnemyLevel(profile, {
      seed: run.seed >>> 0,
      contextKey: `${encounter?.id || enemyIds.join(',')}/${index}`,
      act: Number.isSafeInteger(run.actNumber) && run.actNumber > 0 ? run.actNumber : 1,
      floor: Number.isSafeInteger(run.floor) && run.floor >= 0 ? run.floor : 0,
      targetBand: encounter?.targetBand || profile,
    }).result;
  });
}

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
    ...(run.classUnequipped ? { classUnequipped: true } : {}),
    attributes: run.combatExpansionVersion === 2 ? effectiveAshenBlightAttributes(run) : run.attributes,
    allocatedAttributes: run.attributes,
    ashenBlight: run.ashenBlight,
    baseResourceMaxima: run.ashenBlightBasePools,
    // The character level every stat row's `perLevel` reads (ruleset 7).
    level: Number.isInteger(run.level?.level) && run.level.level >= 1 ? run.level.level : 1,
    attributeMode: run.attributeMode, // the scale the dodge reads Dexterity on (plan A3)
    // The rule this run was born with, so the Poise vessel combat stamps
    // is the one its character sheet shows (plan phase 9).
    derivedStatRuleSnapshot: run.derivedStatRuleSnapshot,
    skills: run.skills, // the ledger the progression predicates read (plan phase 4a)
    skillFeats: Array.isArray(run.skillFeats) ? [...run.skillFeats] : [],
    critRules: critRulesFor(run.skillFeats), // the skill feats' critical hits (SPEC §13.4o)
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
    sideboardedEquipmentCardIds: (run.sideboard || []).map((card) => card.instanceId),
    // A dealt deck's fight keeps the dealt deck's rule at its swap door.
    ...(isPoolDeckMode(run) ? { poolDeck: true } : {}),
    equipmentPoolDeficits,
    itemUpgradeLevels: run.itemUpgradeLevels,
    itemMounts: run.itemMounts,
    armamentLevels: run.armamentLevels,
    deck: run.deck,
    relicIds: run.relics,
    flasks: run.flasks,
    flaskCharges: run.flaskCharges,
    loadout: run.loadout,
    // SPEC §14.3: the fight's copy of the consumable counts (a revive token
    // spends from it), and the companions whose property mounts at its start.
    consumables: run.consumables && typeof run.consumables === 'object' ? { ...run.consumables } : {},
    companionIds: (Array.isArray(run.companions) ? run.companions : []).map((row) => row.id),
    // SPEC §14.4: the sigils set into slots, mounted while their armament is worn.
    sigilSlots: run.sigilSlots && typeof run.sigilSlots === 'object' ? run.sigilSlots : {},
    // SPEC §15.4: the attuned legendaries, mounted at combat start.
    attunedSigils: Array.isArray(run.attunedSigils) ? run.attunedSigils : [],
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
  registries, rng, run, enemyIds, encounter = null, settings = {},
  hpMult = 1, enemyDamageMult = 1, enemyStatuses = [], playerStatuses = [], player = {},
  enemyKnowledgeProfile = emptyEnemyKnowledge(),
}) {
  // The every-5th-level skill bonus is derived (SPEC §13.4o): stamped fresh
  // here so the fight's copies carry the levels and hands it starts with.
  stampSkillBonuses(registries, run);
  const knowledgeRun = run.enemyKnowledgeState ? { ...run, enemyKnowledgeState: structuredClone(run.enemyKnowledgeState) } : null;
  if (knowledgeRun) openKnowledgeEncounter(knowledgeRun, run.mapNodeId || 'combat', encounter?.id || enemyIds.join(','), enemyIds, enemyKnowledgeProfile);
  const combat = createCombat({
    ...(knowledgeRun ? { knowledge: { rules: run.enemyKnowledgeRules, encounter: knowledgeRun.enemyKnowledgeState.currentEncounter,
      bankable: knowledgeRun.enemyKnowledgeState.bankable, profiles: { player: mergeEnemyKnowledge(knowledgeRun.enemyKnowledgeState.pending, enemyKnowledgeProfile) } } } : {}),
    combatExpansionVersion: run.combatExpansionVersion || 1,
    reactionRulesVersion: run.reactionRulesVersion || null,
    combatExpansionRules: run.combatExpansionRules,
    combatKey: `${run.seed}/${run.actNumber}/${run.floor}/${run.mapNodeId || enemyIds.join(',')}`,
    // ONE ROW FORMAT, READ FROM THE RUN (ruleset 7). The rating rows and the
    // three hand rows are this run's own — its snapshot's (its class's opening
    // hand among them), or for a run born before ruleset 7 the retired homes it
    // was priced by (model/statRows.js). Snapshotted into the fight, so a saved
    // fight keeps the hand it was born with.
    ratingsRules: ratingsConfigFor(registries, run) || null,
    breakMeterVersion: run.advancedConfigSnapshot?.breakMeterVersion,
    handRules: runHandRules(registries, run, settings),
    // Play in deck order (SPEC §14.1): read here, once, like the other rules.
    orderedDraw: playInDeckOrder(settings),
    // Settings → Advanced → Recovery, read once here and snapshotted: null at
    // the defaults (model/recoveryRules.js).
    recoveryRules: recoveryRulesFor(settings),
    registries,
    rng,
    player: { ...runCombatPlayer(run), ...player },
    enemyIds,
    enemyLevels: enemyLevelsForFight(registries, run, enemyIds, encounter),
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
  if (knowledgeRun) run.enemyKnowledgeState = knowledgeRun.enemyKnowledgeState;
  return combat;
}

/** Write what a fight leaves behind back onto the run (live onCombatEnd's first half). */
export function runCombatEnd(run, combat) {
  reconcileCombatKnowledge(run, combat);
  if (combat.combatExpansionVersion === 2) {
    run.ashenBlight = structuredClone(combat.player.ashenBlight);
    run.ashenBlightBasePools = structuredClone(combat.player.baseResourceMaxima);
  }
  run.flasks = combat.player.flasks; // drunk flasks stay drunk
  run.flaskCharges = combat.player.flaskCharges ? { ...combat.player.flaskCharges } : run.flaskCharges;
  for (const field of ['hp', 'mana', 'stamina']) {
    run[field] = field === 'stamina' ? Math.min(combat.player.stamina, combat.player.maxStamina) : combat.player[field];
    const maxField = `max${field[0].toUpperCase()}${field.slice(1)}`;
    run[maxField] = combat.player[maxField];
  }
  run.equipmentPoolDeficits = { ...combat.equipmentPoolDeficits };
  // SPEC §14.3: a spent revive token stays spent, and every companion is one
  // fight closer to leaving, win or loss.
  settleFightConsumables(run, combat);
  tickCompanions(run);
}
