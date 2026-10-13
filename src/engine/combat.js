import { combatMatchups, combatIntent, combatExpansionMatchups } from '../content/combatMatchups.js';
import { combatStatusRules } from '../content/combatStatusRules.js';
import { ASHEN_BLIGHT_RULES } from '../content/ashenBlight.js';
import { reactionRulesSnapshot } from '../content/combatCardTraits.js';
import { createAshenBlightState, effectiveAshenBlightAttributes, ashenBlightBonuses } from '../model/ashenBlight.js';
import { resolveCombatCard } from './combatExpansion.js';
import * as Control from './combatStatusControl.js';
import * as Blight from './ashenBlight.js';
import { enqueueExpandedAction, previewExpandedActions } from './combatExpansionActions.js';
import { combatExpansionEquipment } from '../content/combatExpansionEquipment.js';
import { expandedEquipmentProjection, expandedEnemyProjection } from './combatExpansionEquipment.js';
import { settleExpandedPools, refreshExpandedLoadout } from './combatExpansionProjection.js';
import { tacticalCarrier, counterEffectPreview, prepareTacticalCard, enqueueCounterWard, enemyMoveCarrier, expandedEnemyMove, primeEnemyCounter, enemyCounterDefensePrimed } from './combatCardTactics.js';
import { clearCombatCounter, startTacticalTurn, setCombatStance, prepareCombatEvade, liveCounterCovers } from './combatMatchups.js';
import { damagePreviewState, previewDamageHits } from './combatDamagePreview.js';
import { hiddenIntentChance, concealIntent, combatIntentStance } from '../model/combatIntentVisibility.js';
import { initializeCombatKnowledge, rollEnemyKnowledge, knowledgeIntentProjection, predictEnemyIntent, cancelKnowledgeAction } from './enemyKnowledge.js';
import { passiveMax } from '../model/registries.js';
import { formationMovePlan } from '../model/formationMovement.js';
import { cardTargetPlan, assertCardTarget, immediateCardEffects } from '../model/cardTargets.js';
import { reconcileWardBlock } from '../model/blockPresentation.js';
// src/engine/combat.js — action queue + turn loop (generic interpreter)
// (SPEC §3.9, §4.1–§4.3, §4.6)
//
// Public API (see docs/ENGINE-API.md):
//   createCombat({ registries, rng, player, enemyIds })  → combat state
//   dispatch(combat, intent)                             → { events }
//   previewCard(combat, cardInstanceId, targetId?)       → resolved numbers
//   previewIntent(combat, enemyInstanceId)               → live intent numbers
//   getEntity(combat, id)                                → entity or null
//
// The engine contains no entity-specific code: all behavior is content data
// composed of the closed primitive sets (design law §3.1(2)).
//
// Headless: no document/window/localStorage/timers.

import * as A from './actions.js';
import { spellCardCostSurcharge, combatProfileFor } from '../model/combatCardProfile.js';
import * as R from './abilityRiders.js';
import { turnDrawCount, endTurnCardFate, validateDiscardChoice, applyDiscardChoice, returnUnplayedCards } from './handRules.js';
import { handRow, scaledCards } from '../model/handRules.js';
import { LEGACY_HAND_MAX } from '../model/statRows.js';
import { refreshCombatRatings, recoverRatingMeters, cardRatingBonus, clearMeterGuards } from './combatRatings.js';
import { persistentWardMaximum, persistentPoiseMaximum } from '../model/combatRatings.js';
import * as F from './combatRules.js';
import * as Reactions from './combatReactions.js';
import * as Rounds from './combatRoundsAdapter.js';
import { decayNormalMomentum, settleNormalMomentum, multiActionOn, withCardExchange, closeEnemyExchange } from './normalPreview.js';
import { clearEnemyReactionRolls } from './enemyReactions.js';
import { emitEvent, fireOwnerHooks, findEntity, hasEventTriggers } from './triggers.js';
import { attachSkillXp } from './skillXp.js';
import * as S from '../framework/statusSemantics.js';
import { resolveCard, passiveSum, passiveMult } from '../model/registries.js';
import { ownRestoreFunds } from '../model/actionCosts.js';
import { cardKind } from '../model/tree.js';
import { evaluate } from '../model/formulas.js';
import { computeTokenBindings } from '../model/validate.js';
import { createPlayerCombatEntity, createEnemyCombatEntity, stampPlayerPoiseMax, enemyMoveDamage } from '../model/state.js';
import { playerPoiseThresholdReceipt } from '../model/statProjection.js';
import { playerWeightClass } from '../model/combatWeight.js';
import { orderedDrawPile } from '../model/deckRules.js';
import { recoveryRulesProblems, turnRecovery } from '../model/recoveryRules.js';
import { RECOVERY_POOLS } from '../content/recoveryRules.js';
export { playerWeightClass };
import { canSwap, canEquip, cycleSet, equipPiece, ownership, swapCostFor, resolveSwapCostRule, createEquipmentProfileRuleSnapshot, runMods, EQUIPMENT_POOL_FIELDS, moveEquipmentPool, gripOf, gripTags } from '../model/loadout.js';
// Deck restamping goes through the framework's adopted composition door.
import { stampDeck, reconcileGrantedCardsInCombat } from '../framework/deckComposition.js';
import { cardChoice, assertCardChoice } from '../model/cardChoices.js';
import { chargeFlaskId } from '../model/gracerefill.js';
import { syncLoadoutProperties, syncRelicProperties, syncClassProperties, syncFeatProperties, syncCompanionProperties, syncSigilProperties, propertyMountsOf } from './properties.js';

const QUEUE_GUARD = 10000;

// ---------------------------------------------------------------------------
// createCombat
// ---------------------------------------------------------------------------

/**
 * createCombat({ registries, rng, player, enemyIds }) → combat state.
 *
 *   player = { classId, maxHp, hp, deck: [{ instanceId, cardId, upgraded }],
 *              relicIds: [], flasks?: [{ flaskId }] }
 *   enemyIds = [enemy def ids in row order] (instances get ids 'e1', 'e2', ...)
 *
 * Runs the full combat-start sequence (SPEC §4.1(1–2)): enemy HP rolled on
 * stream 'enemyHP', deck shuffled on 'shuffle' with Innate cards on top,
 * combatStart triggers fired, initial intents rolled ('enemyAI'), then the
 * first player turn starts (energy set, 5 drawn, playerTurnStart triggers).
 * Setup events are in combat.eventLog.
 */
const RECOVERY_MAX = { hp: 'maxHp', stamina: 'maxStamina', mana: 'maxMana' };
// What "using" a pool means for the idle count: spending Stamina or Mana on a
// card, losing HP to anything.
const RECOVERY_USE = { hp: 'hpLost', stamina: 'staminaSpent', mana: 'manaSpent' };

function newRecoveryState(rules) {
  const problems = recoveryRulesProblems(rules);
  if (problems.length) throw new Error(problems.join('; '));
  return { rules: structuredClone(rules), idle: { hp: 0, stamina: 0, mana: 0 }, logIndex: 0 };
}

/**
 * Settings → Advanced → Recovery, at the end of the player's turn. A pool is
 * "used" by any spend (Stamina, Mana) or loss (HP) logged since the last
 * check — the whole round, the enemies' turn included — and its idle streak
 * counts the turns in a row it was not. Each pool then restores what its row
 * gives this round (model/recoveryRules.js turnRecovery).
 */
function recoverAtTurnEnd(combat) {
  const p = combat.player;
  const state = combat.recovery;
  const used = { hp: false, stamina: false, mana: false };
  for (let i = state.logIndex; i < combat.eventLog.length; i++) {
    const event = combat.eventLog[i];
    for (const pool of RECOVERY_POOLS) {
      if (event.type === RECOVERY_USE[pool] && (event.amount || 0) > 0
        && (pool !== 'hp' || event.targetId === p.id)) used[pool] = true;
    }
  }
  for (const pool of RECOVERY_POOLS.filter((id) => id !== 'stamina')) {
    state.idle[pool] = used[pool] ? 0 : state.idle[pool] + 1;
    const max = p[RECOVERY_MAX[pool]];
    const amount = turnRecovery({ rules: state.rules, pool, round: combat.turn, idleStreak: state.idle[pool], current: p[pool], max });
    if (amount > 0) {
      p[pool] += amount;
      combat.emit(pool === 'hp' ? 'healed' : `${pool}Recovered`, { targetId: p.id, amount, reason: 'recovery' });
    }
  }
  state.logIndex = combat.eventLog.length;
}

export function createCombat({
  registries, rng, player, enemyIds, enemyLevels = [], hpMult = 1, enemyStatuses = [], playerStatuses = [],
  // Every enemy's move damage × this (SPEC §13.3 balance.bossTiers: a boss
  // met at a later tier hits harder). Stamped on each enemy entity, so a
  // snapshot carries it; 1 stamps nothing.
  enemyDamageMult = 1,
  // WHICH SWAP-COST RULE THIS FIGHT IS UNDER (A8). Resolved once here rather
  // than per swap, for the reason `hpMult` is: a fight's rules must not change
  // under the player halfway through it. Omitted resolves to the shipping
  // default, so every existing caller — and every test — keeps the price it
  // already had, and `resolveSwapCostRule(registries, meta)` is the one place
  // his Settings choice is read.
  swapCostRule = null, ruleset = null, combatProfiles = {}, handRules = null, ratingsRules = null, breakMeterVersion = null,
  // Settings → Advanced → Recovery (model/recoveryRules.js recoveryRulesFor):
  // null — every recovery setting at its default — keeps the idle-Stamina rule
  // below and writes no recovery state into the fight or its save.
  recoveryRules = null,
  knowledge = null, reactionRulesVersion, reactionRules = null,
  // SPEC §14.1 Play in deck order: read once by the caller (runCombat.js) and
  // carried on the fight as `orderedDraw`, so a saved fight keeps its rule.
  orderedDraw = false,
  // SPEC §4.11 Combat Rounds Preview: the frozen rules (model/combatRounds.js).
  // null — the preview is off — stamps nothing, so a normal fight and its save
  // are unchanged. Nothing reads the rounds state yet (P3 wires the adapter).
  combatRounds = null,
  // SPEC §4.11 (owner, 2026-10-12): the normal fight's momentum and multi-action toggles, frozen at New Run
  // (model/combatRounds.js normalPreviewFor). null — both off, or rounds mode on — stamps nothing.
  normalPreview = null,
  combatExpansionVersion = 1, combatExpansionRules = null, combatKey = 'headless',
}) {
  // New expanded fights carry reaction rules version 2; null (saved or explicit) stays without reactions.
  const reactionVersion = reactionRulesVersion === undefined ? (combatExpansionVersion === 2 ? 2 : null) : reactionRulesVersion;
  // Run creation owns derived Mana. Older headless fixtures without a Mana
  // pool get a harmless zero pool; class data is never a fallback authority.
  const maxMana = Number.isFinite(player.maxMana) ? player.maxMana : 0;
  const equipmentProfileRuleSnapshot = player.equipmentProfileRuleSnapshot
    ? structuredClone(player.equipmentProfileRuleSnapshot)
    : createEquipmentProfileRuleSnapshot(registries);
  // THE PLAYER'S POISE VESSEL — his layout twice over ("poise (very skinny
  // bar) under the health bar", D10.4; "should also effect player too", D17
  // q5). The MAX is real: the equipment/relic stagger-threshold receipt,
  // derived from the loadout this fight brings. The VALUE has no writer —
  // dealPoiseDamage refuses non-enemies — so the vessel ships real-but-empty;
  // the mechanics that will move it are dealt elsewhere and are NOT smuggled
  // in with this stamp. An explicit player.poiseMax is the override seam
  // (Law 0 clause 3: an override is data; it is also ?shotMaxPoise's door).
  // A fixture with no loadout gets no vessel — absent, never a lying 0/0 —
  // the same graceful shape the Mana pool takes above.
  const poiseMax = Number.isInteger(player.poiseMax)
    ? player.poiseMax
    : (player.loadout
      ? playerPoiseThresholdReceipt(registries, {
        loadout: player.loadout, relics: player.relicIds || [], class: player.classId,
        itemUpgradeLevels: player.itemUpgradeLevels || {}, attributes: player.attributes || null,
        // THE RUN'S OWN RULE TRAVELS WITH IT. Without this the meter is
        // priced from live content while the character sheet shows the
        // snapshot's number, and an Advanced tier override moves one and
        // not the other (Codex, #1217).
        derivedStatRuleSnapshot: player.derivedStatRuleSnapshot || null,
        // …and its level, or a row's `perLevel` never reaches the meter.
        ...(Number.isInteger(player.level) ? { level: { level: player.level } } : {}),
      }).value
      : 0);
  const combat = {
    ...(combatExpansionVersion === 2 ? { combatExpansionVersion, combatKey,
      combatExpansionRules: structuredClone(combatExpansionRules || { matchups: combatExpansionMatchups, statuses: combatStatusRules, ashenBlight: ASHEN_BLIGHT_RULES, equipment: combatExpansionEquipment }),
      allocatedAttributes: structuredClone(player.allocatedAttributes || player.attributes || {}) } : {}),
    combatMatchupRules: structuredClone(registries.balance?.combatMatchups || combatMatchups),
    combatIntentRules: structuredClone(registries.balance?.combatIntent || combatIntent),
    ...(ratingsRules?.enabled ? { ratingsRules: structuredClone(ratingsRules) } : {}),
    ...(breakMeterVersion === 2 ? { breakMeterVersion: 2 } : ratingsRules?.enabled && breakMeterVersion === 1 ? { breakMeterVersion: 1 } : {}),
    ...(handRules ? { handRules: structuredClone(handRules), pendingDiscardDraw: 0 } : {}),
    ...(recoveryRules ? { recovery: newRecoveryState(recoveryRules) } : {}),
    ...(combatRounds ? { combatRounds: { rules: structuredClone(combatRounds), momentum: {}, poiseDouble: {}, charges: {} } } : {}),
    ...(normalPreview ? { normalPreview: { momentum: normalPreview.momentum === true, multiAction: normalPreview.multiAction === true,
      state: { momentum: {}, poiseDouble: {}, pending: {} } } } : {}),
    foundation: F.createFoundation(ruleset, combatProfiles, registries),
    ...(reactionVersion >= 1 && combatExpansionVersion === 2 ? { reactionRulesVersion: reactionVersion, ...(reactionVersion === 2 ? { reactionRules: reactionRulesSnapshot(reactionRules) } : {}) } : {}),
    registries,
    equipmentProfileRuleSnapshot,
    // Carried from the run so a mid-combat swap can restamp against the quota
    // the run was BORN with. Absent for a headless fixture with no run behind
    // it, which is the one case a replan is the right answer.
    removedAttackSlotIds: structuredClone(player.removedAttackSlotIds || []),
    sideboardedEquipmentCardIds: structuredClone(player.sideboardedEquipmentCardIds || []),
    // A Sealed/Draft deck's fight: its swap door deals no lent cards (cardRemoval.js).
    ...(player.poolDeck === true ? { poolDeck: true } : {}),
    equipmentAttackSlotCount: Number.isFinite(player.equipmentAttackSlotCount)
      ? player.equipmentAttackSlotCount
      : undefined,
    // Namespaced item tiers are the sole current authority. The legacy armament
    // map is accepted only at the load/migration door, never written here.
    itemUpgradeLevels: structuredClone(player.itemUpgradeLevels || {}),
    // What a smith did to the run's item mounts (cardMounts.js), carried for
    // the same reason the quota above is: the swap door below builds a
    // synthetic run with `deck: []`, and without this an extracted art would
    // be re-minted from the item's authoring mid-fight. Read only in combat —
    // no smith works during a fight — so a plain copy is the whole contract.
    itemMounts: structuredClone(player.itemMounts || {}),
    equipmentPoolDeficits: player.equipmentPoolDeficits
      ? { ...player.equipmentPoolDeficits }
      : { hp: Math.max(0, player.maxHp - player.hp), mana: Math.max(0, maxMana - (player.mana ?? maxMana)), stamina: Math.max(0, (player.maxStamina || 0) - (player.stamina ?? player.maxStamina ?? 0)) },
    equipmentChanged: false,
    rng,
    turn: 0,
    phase: 'setup', // 'player' | 'enemy' | 'ended'
    result: null, // null | 'victory' | 'defeat'
    // THE HAND SIZE IS A STAT ROW (ruleset 7). A fight handed no hand rules —
    // an old headless fixture — keeps the retired fallback it always had.
    handMax: handRules ? scaledCards(handRow(handRules, 'handSize'), player.attributes, player.level) : LEGACY_HAND_MAX,
    // The character level a row's `perLevel` reads, for the hand and ratings.
    ...(Number.isInteger(player.level) ? { characterLevel: player.level } : {}),
    drawPerTurn: player.drawPerTurn,
    player: createPlayerCombatEntity({
      classId: player.classId,
      ...(player.classUnequipped ? { classUnequipped: true } : {}),
      maxHp: player.maxHp,
      hp: player.hp,
      maxMana,
      mana: player.mana != null ? player.mana : maxMana,
      maxStamina: player.maxStamina,
      stamina: player.stamina,
      relicIds: player.relicIds || [],
      flasks: player.flasks || [],
      flaskCharges: player.flaskCharges || null,
      energyMax: player.energyMax,
      drawPerTurn: player.drawPerTurn,
      poiseMax,
      damageBySchoolAdd: player.damageBySchoolAdd || {},
      itemUpgradeLevels: player.itemUpgradeLevels || {},
      // The skill feats' critical-hit rules (SPEC §13.4o), carried on the
      // player so a saved fight keeps the rules it was born with.
      ...(Array.isArray(player.critRules) && player.critRules.length ? { critRules: structuredClone(player.critRules) } : {}),
    }),
    enemies: [],
    // The SAME object the run holds, not a copy: equipment changed mid-fight is
    // still changed when the fight ends.
    loadout: player.loadout || null,
    attributes: player.attributes ? { ...player.attributes } : null,
    // The scale those attributes were made on: the dodge's Dexterity centre.
    attributeMode: player.attributeMode || null,
    // Carried for the same reason the attributes are: every mid-fight
    // restamp of the Poise vessel must read the rule this run was born with.
    derivedStatRuleSnapshot: player.derivedStatRuleSnapshot || null,
    // The run's skill ledger, read by the progression predicates
    // (triggers.js skillLevelAtLeast / classLevelAtLeast). A copy: combat
    // never writes it.
    skills: player.skills ? structuredClone(player.skills) : {},
    // The core card's picked tree nodes (plan phase 5b), mounted with the class.
    skillFeats: Array.isArray(player.skillFeats) ? [...player.skillFeats] : [],
    coreTags: Array.isArray(player.coreTags) ? [...player.coreTags] : [],
    // SPEC §14.3: the run's consumable counts, copied — a revive token spends
    // from this copy (engine/actions.js) and the run's owner settles it back
    // at combat end (runCombatEnd). Null for a fight handed none (a headless
    // fixture), whose end then leaves a run's counts alone.
    consumables: player.consumables && typeof player.consumables === 'object' ? { ...player.consumables } : null,
    // …and the companions travelling with the run, mounted below like relics.
    companions: Array.isArray(player.companionIds) ? [...player.companionIds] : [],
    // SPEC §14.4: a copy of the run's sigil slots. A sigil set into a slot of
    // an equipped armament mounts with it (syncLoadoutProperties).
    sigilSlots: player.sigilSlots && typeof player.sigilSlots === 'object' ? structuredClone(player.sigilSlots) : {},
    // SPEC §15.4: the legendary sigils attuned, mounted below like relics.
    attunedSigils: Array.isArray(player.attunedSigils) ? [...player.attunedSigils] : [],
    swapCostRule: swapCostRule || resolveSwapCostRule(registries, null),
    swapsLeft: 0,
    piles: { draw: [], hand: [], discard: [], exhaust: [] },
    orderedDraw: null, // { order: instanceIds } under Play in deck order (SPEC §14.1)
    queue: [],
    eventLog: [],
    _buffer: null,
    triggerState: new Map(),
    _idCounter: 0,
    _emitDepth: 0,
  };
  combat.emit = (type, payload) => emitEvent(combat, type, payload);
  combat._emitEvent = emitEvent;
  // The skill tracks listen to the same bus (plan phase 4a); the receipt they
  // write lives on the combat and reaches the run only through applySkillXp.
  attachSkillXp(combat);
  combat.enqueue = (action) => combat.queue.push(action);
  combat.nextInstanceId = () => `gen${++combat._idCounter}`;
  if (combatExpansionVersion === 2) {
    Object.assign(combat.player, expandedEquipmentProjection(registries, combat.loadout, combat.player.classId, combat.combatExpansionRules.equipment));
    combat.player.ashenBlight = structuredClone(player.ashenBlight || createAshenBlightState());
    combat.player.attributes = structuredClone(player.attributes || {});
    combat.combatControlRestrictions = entity => Control.controlRestrictions(combat, entity);
    combat.player.combatExpansionVersion = 2;
    combat.player.baseResourceMaxima = structuredClone(player.baseResourceMaxima || { maxHp: player.maxHp, maxMana: player.maxMana || 0, maxStamina: player.maxStamina || player.energyMax || 0 });
    combat.attributes = settleExpandedPools(combat, combat.player).attributes;
    combat.restorationModifierPercent = (entity, kind) => Blight.ashenBlightRestorationPercent(combat, entity, kind, String(entity.combatOwnerCycle || 0));
  }

  // Property carriers (engine/properties.js): the loadout's equipped pieces
  // mount their property rules before anything is emitted, so a property hears
  // enemySpawned and combatStart exactly as a relic does.
  syncLoadoutProperties(combat);
  // …and the relics the player carries, whose triggers are property rules too
  // since plan phase 2. Mounted before the first emit for the same reason.
  syncRelicProperties(combat);
  // …and the class card, the core zone's one card (plan phase 5a): its
  // `favored` leaning is a property like any other.
  syncClassProperties(combat);
  syncFeatProperties(combat);
  // …and the companions travelling with the run (SPEC §14.3): each mounts as a
  // `companion` carrier, its rules its tagging.csv property rows.
  syncCompanionProperties(combat);
  // …and the attuned legendary sigils (SPEC §15.4), held by the run.
  syncSigilProperties(combat);

  // Enemies — HP rolled on stream 'enemyHP' (SPEC §3.11, §4.6). An optional
  // hpMult (Custom Climb difficulty rules) scales the rolled HP after the roll,
  // so the same seed rolls the same base then scales — determinism preserved.
  enemyIds.forEach((enemyId, i) => {
    const def = registries.enemies.get(enemyId);
    let hp = rng.int('enemyHP', def.hp[0], def.hp[1]);
    if (hpMult !== 1) hp = Math.max(1, Math.round(hp * hpMult));
    combat.enemies.push(
      createEnemyCombatEntity({
        instanceId: `e${i + 1}`, enemyId, level: enemyLevels[i], hp, poiseMax: def.poiseMax,
        arcaneExposure: combat.breakMeterVersion === 1 ? undefined : def.arcaneExposure,
        damageResistanceBySchool: def.damageResistanceBySchool,
        damageMult: enemyDamageMult,
      })
    );
    if (combatExpansionVersion === 2) Object.assign(combat.enemies.at(-1), expandedEnemyProjection(enemyId, combat.combatExpansionRules.equipment));
    combat.emit('enemySpawned', { targetId: `e${i + 1}`, enemyId });
  });

  if (knowledge) initializeCombatKnowledge(combat, knowledge);
  if (combat.ratingsRules) {
    refreshCombatRatings(combat);
    for (const enemy of combat.enemies) {
      const values = combat.ratingsRules.enemyRatings?.[enemy.enemyId] || { poise: enemy.poiseMeter?.max || 1, ward: enemy.poiseMeter?.max || 1 };
      enemy.ratings = { ar: 0, dr: 0, pr: 0, ...values };
      for (const id of combat.breakMeterVersion === 1 ? ['poise'] : ['poise', 'ward']) enemy[id + 'Meter'] = { value: 0, max: Math.max(1, values[id]), growths: 0 };
    }
  }
  if (combatExpansionVersion === 2) {
    for (const entity of [combat.player, ...combat.enemies]) {
      Control.initializePersistentWard(entity, persistentWardMaximum(combat, entity));
      Control.initializePersistentPoise(entity, persistentPoiseMaximum(combat, entity));
      entity.barrier = 0;
    }
  }
  // Deck → draw pile: shuffle (stream 'shuffle'), Innate cards to top (§4.1(1)).
  const deck = player.deck.map((c) => ({
    ...([1, 2].includes(combat.breakMeterVersion) ? { breakMeterVersion: combat.breakMeterVersion } : {}),
    instanceId: c.instanceId,
    cardId: c.cardId,
    upgraded: !!c.upgraded,
    ...(Number.isInteger(c.abilityRank) ? { abilityRank: c.abilityRank } : {}),
    ...(c.legacyAbility === true ? { legacyAbility: true } : {}),
    ...(c.abilityOfferId ? { abilityOfferId: c.abilityOfferId } : {}),
    ...(c.rewardReceiptId ? { rewardReceiptId: c.rewardReceiptId } : {}),
    ...(Number.isInteger(c.rank) && c.rank > 1 ? { rank: c.rank } : {}),
    ...(Number.isInteger(c.skillBonus) && c.skillBonus > 0 ? { skillBonus: c.skillBonus } : {}),
    ...(Number.isInteger(c.passiveBlock) && c.passiveBlock > 0 ? { passiveBlock: c.passiveBlock } : {}),
    ...(c.acquiredAt !== undefined ? { acquiredAt: structuredClone(c.acquiredAt) } : {}),
    // Equipment numbers ride on the instance (model/loadout.js) — copy them in
    // or every card would come back to its bare-handed self at combat start.
    ...(c.mods && c.mods.length ? { mods: [...c.mods] } : {}),
    ...(typeof c.damageSchool === 'string' ? { damageSchool: c.damageSchool } : {}),
    ...(Number.isFinite(c.magicShare) ? { magicShare: c.magicShare } : {}),
    ...(typeof c.physicalDamageType === 'string' ? { physicalDamageType: c.physicalDamageType } : {}),
    ...(Number.isInteger(c.exposureBuildupPerHit) ? { exposureBuildupPerHit: c.exposureBuildupPerHit } : {}),
    ...(c.equipmentRole ? { equipmentRole: c.equipmentRole, profileId: c.profileId, profileReceipt: c.profileReceipt } : {}),
    ...(c.ratingId ? { ratingId: c.ratingId } : {}),
    ...(Number.isFinite(c.ratingValue) ? { ratingValue: c.ratingValue } : {}),
    ...(Number.isFinite(c.ratingCap) ? { ratingCap: c.ratingCap } : {}),
    ...(c.kitRole ? { kitRole: c.kitRole } : {}),
    ...(c.grantedBy ? { grantedBy: c.grantedBy, grantSource: c.grantSource } : {}),
    ...(c.equipmentAttackSlotId ? { equipmentAttackSlotId: c.equipmentAttackSlotId } : {}),
    ...(c.equipmentPlanFingerprint ? { equipmentPlanFingerprint: c.equipmentPlanFingerprint } : {}),
    ...(c.sourceHand ? { sourceHand: c.sourceHand } : {}),
    ...(c.weaponId ? { weaponId: c.weaponId } : {}),
    ...(c.sourceArmamentId ? { sourceArmamentId: c.sourceArmamentId } : {}),
    ...(Number.isInteger(c.smithingLevel) ? { smithingLevel: c.smithingLevel } : {}),
    ...(c.sourceEquipmentInstanceId ? { sourceEquipmentInstanceId: c.sourceEquipmentInstanceId } : {}),
  }));
  const isInnate = (card) => registries.framework.isInnate(resolveCard(registries, card));
  if (orderedDraw) {
    // In deck order, and no `shuffle` value is consumed (SPEC §14.1).
    combat.orderedDraw = { order: deck.map((card) => card.instanceId) };
    combat.piles.draw = orderedDrawPile(deck, isInnate);
  } else {
    combat.piles.draw = orderedDrawPile(rng.shuffle('shuffle', deck), isInnate);
  }

  if (combatExpansionVersion === 2) {
    refreshExpandedLoadout(combat, combat.player, { refreshPoise: false });
    const entry = Blight.rollAshenBlightEncounter(combat, combat.player, combatKey);
    if (entry.terminal) { combat.turn = 1; combat.player.alive = false; combat.player.hp = 0; combat.phase = 'ended'; combat.result = 'defeat'; combat.emit('ashenBlightLost', { targetId: combat.player.id, reason: 'encounter' }); return combat; }
  }
  combat.emit('combatStart', {});
  // Optional Custom Climb buffs (generic — statuses are content ids, applied via
  // the same applyStatus opcode content uses, so no entity-specific engine code).
  for (const s of playerStatuses) {
    combat.enqueue({ effect: { op: 'applyStatus', target: 'self', status: s.status, stacks: s.stacks }, source: combat.player, owner: combat.player, target: combat.player, meta: {} });
  }
  for (const enemy of combat.enemies) {
    for (const s of enemyStatuses) {
      combat.enqueue({ effect: { op: 'applyStatus', target: 'self', status: s.status, stacks: s.stacks }, source: enemy, owner: enemy, target: enemy, meta: {} });
    }
  }
  drainQueue(combat);
  rollIntents(combat, true);
  if (!combat.result) startPlayerTurn(combat);
  return combat;
}

// ---------------------------------------------------------------------------
// Queue draining + end check (SPEC §3.9: queue drains fully before control
// returns to the UI)
// ---------------------------------------------------------------------------

function drainQueue(combat) {
  let guard = 0;
  while (combat.queue.length) {
    if (++guard > QUEUE_GUARD) {
      throw new Error('Action queue did not drain (possible infinite trigger loop)');
    }
    if (Reactions.beforeReactionAction(combat, combat.queue[0], reactionHooks)) return;
    const action = combat.queue.shift();
    Reactions.startQueuedEnemy(combat, action);
    A.executeAction(combat, action);
    if (combat.pendingAbilityDiscard) return;
    endCheck(combat);
    if (combat.result) {
      combat.queue.length = 0;
      return;
    }
  }
  endCheck(combat);
}

function endCheck(combat) {
  if (combat.pendingExpansionActions > 0) return;
  if (combat.result) return;
  if (combat.pendingAbilityPlay) return;
  if (!combat.player.alive || combat.player.hp <= 0) {
    finishCombat(combat, 'defeat');
  } else if (combat.enemies.length > 0 && combat.enemies.every((e) => !e.alive)) {
    finishCombat(combat, 'victory');
  }
}

function finishCombat(combat, result) {
  combat.result = result;
  combat.phase = 'ended';
  Reactions.finishReactions(combat);
  combat.queue.length = 0;
  combat.emit('combatEnd', { victory: result === 'victory' });
  combat.queue.length = 0; // combatEnd triggers cannot enqueue combat actions
}

// ---------------------------------------------------------------------------
// Turn loop (SPEC §4.1 — order contractual)
// ---------------------------------------------------------------------------

function startPlayerTurn(combat) {
  combat.turn += 1;
  clearEnemyReactionRolls(combat);
  combat.phase = 'player';
  // SPEC §4.11: a turn is a round for normal-combat momentum; each enemy's M decays one step first (rounds rule).
  decayNormalMomentum(combat);
  const p = combat.player;
  R.beginAbilityTurn(p);
  delete p.combatRetainedCards;
  F.startFoundationTurn(combat, p);
  p.counters.cardsPlayedThisTurn = 0;
  const eqcfg = combat.registries.balance.equipment || {};
  combat.swapsLeft = eqcfg.swapCostKind === 'allowance' ? eqcfg.swapAllowancePerTurn || 0 : 0;

  // (2) Lose all block — unless modified (generic 'retainBlock' modifier;
  // a 'blockCap' modifier clamps what is kept).
  if (!S.getFlag(combat, p, 'retainBlock')) {
    p.block = Math.min(p.block, passiveMax(combat.registries, p.relicIds, 'retainBlockUpTo', propertyMountsOf(combat, p)));
  } else {
    const cap = S.getCap(combat, p, 'blockCap');
    if (cap != null) p.block = Math.min(p.block, cap);
  }
  reconcileWardBlock(p);
  // Poise and Ward guards (gainPoise / gainWard) expire with Block; no
  // retainBlock-style modifier keeps them.
  clearMeterGuards(p);
  clearCombatCounter(p);
  if (combat.combatExpansionVersion === 2) {
    p.barrier = 0;
    const protection = startTacticalTurn(combat, p);
    if (protection.block) A.gainBlock(combat, p, protection.block, { skipRatingBonus: true, logSource: 'defendStance' });
    if (protection.barrier) A.gainBarrier(combat, p, protection.barrier, { skipRatingBonus: true, logSource: 'defendStance' });
    Blight.beginAshenBlightCycle(combat, p, String(p.combatOwnerCycle));
  }

  // Set energy to base (relics that add energy hook playerTurnStart) — less
  // what a Stagger took (plan phase 8): the loss is owed to the next turn only.
  p.energy = Math.max(0, p.energyMax - (p.pendingActionLoss || 0));
  combat.equipmentPoolDeficits.stamina = p.energyMax - p.energy;
  p.pendingActionLoss = 0;
  recoverRatingMeters(combat, p);

  // Draw.
  A.drawCards(combat, Math.max(1, turnDrawCount(combat) - (combat.combatExpansionVersion === 2 && combat.turn === 1 ? (Blight.ashenBlightBonuses(p).openingHandPenalty || 0) : 0)));

  // playerTurnStart triggers + owner-relative status/stance hooks.
  combat.emit('playerTurnStart', { turn: combat.turn });
  fireOwnerHooks(combat, p, 'ownerTurnStart');
  drainQueue(combat);
  if (combat.combatExpansionVersion === 2 && !combat.result) {
    Control.recoverStatusesAtOwnerStart(combat, p, { cycle: p.combatOwnerCycle });
    Control.sleepRestoration(combat, p);
    p.energy = Math.max(0, p.energy - Control.consumeControlActionLoss(combat, p));
  }
}

function endPlayerTurn(combat, discardIds = []) {
  const p = combat.player;
  const preserveLockedHand = Control.controlRestrictions(combat, p).locked;

  // (4) playerTurnEnd triggers first…
  combat.emit('playerTurnEnd', { turn: combat.turn });
  fireOwnerHooks(combat, p, 'ownerTurnEnd');
  drainQueue(combat);
  if (combat.result) return;

  // …then each card still in hand fires its authored `onTurnEndInHand` effect
  // list (e.g. Guilt: lose 1 HP, SPEC §5.2). Content owns the numbers; the
  // engine only walks the hand, before the hand is discarded.
  let inHandFired = false;
  for (const card of [...combat.piles.hand]) {
    const hook = resolveCombatCard(combat, card).onTurnEndInHand;
    if (!Array.isArray(hook) || !hook.length) continue;
    for (const eff of hook) {
      combat.enqueue({ effect: eff, source: p, owner: p, target: p, meta: { cardInstanceId: card.instanceId, cardId: card.cardId, trigger: 'turnEndInHand' } });
    }
    inHandFired = true;
  }
  if (inHandFired) {
    drainQueue(combat);
    if (combat.result) return;
  }

  // …then player status decay (perTurnEnd statuses −1 stack at owner's turn end)…
  S.decayAtTurnEnd(combat, p);

  // Persistent pools use idle recovery; Stamina refills at turn start.
  if (combat.recovery && !combat.foundation) recoverAtTurnEnd(combat);
  p.counters.staminaSpentThisTurn = 0;

  // …then refresh ordinary cards, keeping Retain; Ethereal cards exhaust. The
  // fate of each card is the framework's call (src/framework/lifecycle.js);
  // this engine only moves the card and emits the receipt.
  applyDiscardChoice(combat, discardIds);
  if (Reactions.usesReactions(combat)) {
    combat.reactionHandCleanup = { preserveLockedHand };
    if (combat.combatExpansionVersion === 2) Control.endControlTurn(combat, p, combat.controlRecoveryChoice);
    return;
  }
  finishPlayerHand(combat, preserveLockedHand);
}

function finishPlayerHand(combat, preserveLockedHand = false) {
  const p = combat.player;
  const keep = [];
  const toDiscard = [];
  const toExhaust = [];
  for (const card of combat.piles.hand) {
    if (preserveLockedHand && combat.combatExpansionVersion === 2) { keep.push(card); continue; }
    const fate = endTurnCardFate(combat, card);
    if (fate === 'keep') keep.push(card);
    else if (fate === 'exhaust') toExhaust.push(card);
    else toDiscard.push(card);
  }
  if (combat.combatExpansionVersion === 2 && !combat.reactionHandCleanup) Control.endControlTurn(combat, p, combat.controlRecoveryChoice);
  combat.piles.hand = keep;
  for (const card of toExhaust) {
    combat.piles.exhaust.push(card);
    combat.emit('cardExhausted', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'ethereal' });
  }
  returnUnplayedCards(combat, toDiscard);

  // Unspent energy is lost.
  p.energy = 0;
  drainQueue(combat);
}

// The enemy turn start (SPEC §4.1 step 5): the start event, then each living enemy loses its block.
// The Combat Rounds Preview runs this in the round commit, before the enemies' moves (SPEC §4.11).
function enemyTurnStart(combat) {
  combat.emit('enemyTurnStart', { turn: combat.turn });
  // Enemies lose their block at the start of THEIR turn.
  for (const e of combat.enemies) {
    if (!e.alive) continue;
    if (!S.getFlag(combat, e, 'retainBlock')) e.block = 0;
    reconcileWardBlock(e);
    clearMeterGuards(e);
    clearCombatCounter(e);
    if (combat.combatExpansionVersion === 2) {
      e.barrier = 0;
      const protection = startTacticalTurn(combat, e);
      if (protection.block) A.gainBlock(combat, e, protection.block, { skipRatingBonus: true, logSource: 'defendStance' });
      if (protection.barrier) A.gainBarrier(combat, e, protection.barrier, { skipRatingBonus: true, logSource: 'defendStance' });
    }
  }
  drainQueue(combat);
}

// One enemy's own turn start: its owner-relative hooks (DoT ticks etc.) and, expanded, its status
// recovery. Leaves the enemy dead when a tick killed it.
function enemyOwnerTurnStart(combat, enemy) {
  Reactions.revealActor(combat, enemy);
  fireOwnerHooks(combat, enemy, 'ownerTurnStart');
  drainQueue(combat);
  if (combat.result || !enemy.alive) return;
  if (combat.combatExpansionVersion === 2) {
    Control.recoverStatusesAtOwnerStart(combat, enemy, { cycle: enemy.combatOwnerCycle });
    Control.sleepRestoration(combat, enemy);
  }
}

function enemyPhase(combat) {
  // With the Combat Rounds Preview on, the turn start ran in the round commit, before the moves.
  const preview = Boolean(combat.combatRounds);
  if (!combat.reactionCursor) {
    combat.phase = 'enemy';
    if (!preview) {
      enemyTurnStart(combat);
      if (combat.result) return;
    }
  }
  const cursor = combat.reactionCursor || { index: 0, stage: 'start' };
  if (Reactions.usesReactions(combat)) combat.reactionCursor = cursor;
  for (; cursor.index < combat.enemies.length; cursor.index++, cursor.stage = 'start') {
    const enemy = combat.enemies[cursor.index];
    if (combat.result) return;
    if (!enemy.alive) continue;
    if (cursor.stage === 'start') {
    if (!preview) {
      // Owner-relative turn-start hooks (DoT ticks etc.).
      enemyOwnerTurnStart(combat, enemy);
      if (combat.result) return;
      if (!enemy.alive) continue;
    }
    cursor.stage = 'payload';
    }
    if (cursor.stage === 'payload') {
    cursor.stage = 'drain';
    if (preview && Rounds.enemyQueued(combat, enemy.id)) {
      // The round's commit already ran this enemy's queued moves, and its skip flag is kept for its next turn.
    } else if (enemy.skipNextTurn || S.getFlag(combat, enemy, 'skipTurn') || Control.controlRestrictions(combat, enemy).locked || Control.consumeControlActionLoss(combat, enemy)) {
      // Staggered / skip: the telegraphed move does not happen, and neither does the rest of its plan this turn.
      if (!enemy.pendingMove) cancelKnowledgeAction(combat, enemy);
      enemy.skipNextTurn = false;
      enemy.planDue = false;
    } else if (enemy.pendingMove) {
      enemy.planDue = false;
      if (combat.turn >= enemy.pendingMove.resolveOnTurn) {
        // Delayed move resolving: the committed attack lands regardless of
        // newly rolled intents (SPEC §5.3 'Held Blade' pattern, generic data).
        const def = combat.registries.enemies.get(enemy.enemyId);
        const moveId = enemy.pendingMove.moveId;
        const move = def.moves[moveId];
        // Rounds mode: a charge whose hit roll missed resolves as that miss, applying nothing.
        const missed = enemy.pendingMove.missed === true;
        enemy.pendingMove = null;
        if (!missed) executeMovePayload(combat, enemy, move, moveId);
      }
      // else: still charging (delay.turns > 1) — the enemy does nothing.
    } else if (!preview && enemy.intent && enemy.intent.moveId) {
      // With the Combat Rounds Preview on, the queued moves run in the round's commit (SPEC §4.11).
      const def = combat.registries.enemies.get(enemy.enemyId);
      const move = expandedEnemyMove(enemy, def.moves[enemy.intent.moveId], enemy.intent.moveId, combat);
      if (move.delay) {
        // A charging move takes the enemy's turn: its planned follow-ups do not play this turn.
        enemy.planDue = false;
        enemy.plannedMoves = [];
        startDelayedMove(combat, enemy, move, enemy.intent.moveId);
      } else {
        executeMovePayload(combat, enemy, move, enemy.intent.moveId);
      }
    }
    }
    drainQueue(combat);
    if (Reactions.reactionPaused(combat)) return;
    if (combat.result) return;
    // The move has resolved: its momentum exchange ends with it (normalPreview.js), so its owner-turn-end hooks and
    // anything after are their own exchanges.
    closeEnemyExchange(combat, enemy.id);

    // Normal combat (SPEC §4.6, owner 2026-10-12): the rest of the enemy's planned pool plays in order after its head.
    // Each move leaves the plan before it runs, so a reaction pause resumes at the next planned move.
    while (!preview && enemy.alive && enemy.planDue && !enemy.pendingMove && enemy.plannedMoves?.length) {
      // A stagger or Control lock that landed during this turn ends it: a staggered enemy plays none of its plan
      // that turn (SPEC §4.6a), and keeps the rest of it (§4.11), as the turn-start stagger branch above does.
      if (enemyHalted(combat, enemy)) { enemy.planDue = false; break; }
      const next = enemy.plannedMoves.shift();
      const def = combat.registries.enemies.get(enemy.enemyId);
      presentIntent(combat, enemy, def, next.moveId);
      const move = expandedEnemyMove(enemy, def.moves[next.moveId], next.moveId, combat);
      if (move.delay) {
        enemy.plannedMoves = [];
        startDelayedMove(combat, enemy, move, next.moveId);
      } else {
        executeMovePayload(combat, enemy, move, next.moveId);
      }
      drainQueue(combat);
      if (Reactions.reactionPaused(combat)) return;
      if (combat.result) return;
      closeEnemyExchange(combat, enemy.id);
    }
    if (enemy.plannedMoves?.length === 0) enemy.planDue = false;

    // Owner-relative turn-end hooks, then decay (perTurnEnd statuses the
    // player applied to an enemy tick down at the ENEMY's turn end).
    if (enemy.alive) {
      fireOwnerHooks(combat, enemy, 'ownerTurnEnd');
      drainQueue(combat);
      if (combat.result) return;
      if (enemy.alive) S.decayAtTurnEnd(combat, enemy);
      if (combat.combatExpansionVersion === 2) Control.endControlTurn(combat, enemy);
    }
  }

  combat.emit('enemyTurnEnd', { turn: combat.turn });
  drainQueue(combat);
  // SPEC §4.11: the turn's momentum deltas settle once, after every enemy has acted.
  settleNormalMomentum(combat);
  delete combat.reactionCursor;
}

// Commit turn of a delayed move: telegraph stays, do the whileCharging part now, resolve the real
// payload on a later enemy turn.
function startDelayedMove(combat, enemy, move, moveId) {
  const wc = (move.delay && move.delay.whileCharging) || {};
  const carrier = enemyMoveCarrier(enemy, move, moveId, combat);
  if (wc.block != null) {
    combat.enqueue({
      effect: { op: 'block', target: 'self', amount: wc.block },
      source: enemy,
      owner: enemy,
      target: combat.player,
      card: carrier,
      meta: { preparing: true },
    });
  }
  if (wc.barrier != null) combat.enqueue({ effect: { op: 'gainBarrier', target: 'self', amount: wc.barrier },
    source: enemy, owner: enemy, target: enemy, card: carrier, meta: { moveId, preparing: true } });
  for (const eff of wc.effects || []) {
    combat.enqueue({ effect: eff, source: enemy, owner: enemy, target: combat.player, card: carrier, meta: { moveId, preparing: true } });
  }
  enemy.pendingMove = {
    moveId,
    resolveOnTurn: combat.turn + (move.delay.turns != null ? move.delay.turns : 1),
  };
  if (enemy.intent?.moveId === moveId) enemy.intent = { ...enemy.intent, pending: true };
}

// Enqueue a move's payload as ordinary actions (SPEC §3.9: only executed
// actions mutate). Order: damage hits, block, then effects.
// 'enemyMoveStarted' marks the acting enemy so the UI can pace playback
// one actor at a time (SPEC §7.4); content triggers may also key off it.
function executeMovePayload(combat, enemy, move, moveId) {
  move = expandedEnemyMove(enemy, move, moveId, combat);
  // movesHistory records ROLLS (maxConsecutive reads it); a roll a stagger
  // cancels never happens. This is what did — the inspector's history.
  const start = { sourceId: enemy.id, enemyId: enemy.enemyId, moveId, kind: move.intent };
  if (!Reactions.usesReactions(combat)) {
    (enemy.performedMoves ||= []).push(moveId);
    combat.emit('enemyMoveStarted', start);
  }
  const carrier = enemyMoveCarrier(enemy, move, moveId, combat);
  const actions = enemyMoveActions(combat, enemy, move, moveId, carrier);
  const group = enqueueExpandedAction(combat, actions, { source: enemy, target: combat.player, carrier });
  if (Reactions.usesReactions(combat) && group) group.enemyMoveStart = start;
}

// Enemy reactions: the reaction move's actions and carrier, planned by the stack
// (engine/enemyReactions.js pushEnemyReaction) instead of the queue.
function planEnemyReactionMove(combat, enemy, moveId) {
  const move = expandedEnemyMove(enemy, combat.registries.enemies.get(enemy.enemyId).moves[moveId], moveId, combat);
  const carrier = enemyMoveCarrier(enemy, move, moveId, combat);
  return { actions: enemyMoveActions(combat, enemy, move, moveId, carrier), carrier, target: combat.player, kind: move.intent };
}

const reactionHooks = { play: doPlayCard, drain: drainQueue, planEnemyReaction: planEnemyReactionMove };

function enemyMoveActions(combat, enemy, move, moveId, carrier) {
  const actions = [];
  if (move.damage != null && carrier.combatProfile.maneuver !== 'counter') {
    actions.push({
      effect: { op: 'damage', target: 'player', amount: enemyMoveDamage(enemy, move), hits: move.hits != null ? move.hits : 1, ...(move.damageSchool ? { damageSchool: move.damageSchool } : {}) },
      source: enemy,
      owner: enemy,
      target: combat.player,
      card: carrier,
      meta: { moveId },
    });
  }
  if (move.block != null && !(carrier.combatProfile.maneuver === 'counter' && enemyCounterDefensePrimed(enemy, moveId))) {
    actions.push({
      effect: { op: 'block', target: 'self', amount: move.block },
      source: enemy,
      owner: enemy,
      target: combat.player,
      card: carrier,
      meta: { moveId },
    });
  }
  if (move.barrier != null && !(carrier.combatProfile.maneuver === 'counter' && enemyCounterDefensePrimed(enemy, moveId))) {
    actions.push({ effect: { op: 'gainBarrier', target: 'self', amount: move.barrier }, source: enemy, owner: enemy,
      target: enemy, card: carrier, meta: { moveId } });
  }
  for (const eff of move.effects || []) {
    if (carrier.combatProfile.maneuver !== 'counter' || !['damage', 'poiseDamage', ...(combat.combatExpansionVersion === 2 ? ['wardDamage'] : [])].includes(eff.op)) actions.push({ effect: eff, source: enemy, owner: enemy, target: combat.player, card: carrier, meta: { moveId } });
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Enemy move selection — weighted state machine + maxConsecutive (SPEC §4.6)
// ---------------------------------------------------------------------------

function rollIntents(combat, isFirstTurn = false) {
  // Combat Rounds Preview (SPEC §4.11): every enemy's hidden queue is built first, from the enemyAI
  // stream; slot 0 becomes the intent, so the intent box and the visibility rolls read as before.
  const queues = combat.combatRounds ? Rounds.buildEnemyQueues(combat, {
    isFirstTurn,
    pick: (enemy, def, maxSp) => weightedMovePick(combat, enemy, def, maxSp),
    held: (enemy) => Boolean(enemy.pendingMove) || enemy.skipNextTurn || S.getFlag(combat, enemy, 'skipTurn'),
  }) : null;
  // Normal combat (SPEC §4.6, owner 2026-10-12): every enemy plans its pool of SP with the same weighted pick. The head
  // is this turn's first intent; the rest play in order during the enemy phase, each revealed as it plays.
  for (const enemy of combat.enemies) {
    delete enemy.actorIntentRevealed;
    if (!enemy.alive) continue;
    if (enemy.pendingMove) {
      // A committed delayed move stays telegraphed until it resolves.
      if (enemy.intent) enemy.intent = { ...enemy.intent, pending: true };
      continue;
    }
    if (enemy.skipNextTurn || S.getFlag(combat, enemy, 'skipTurn')) {
      enemy.intent = { kind: 'staggered', moveId: null };
      continue;
    }
    const def = combat.registries.enemies.get(enemy.enemyId);
    // Rounds mode: the queue's slot 0, already recorded in movesHistory. Normal combat: the head of the plan, whose picks
    // were recorded when planned (SPEC §4.11 multi-action preview; the pool plays all of it).
    const moveId = queues ? (queues[enemy.id]?.[0]?.moveId ?? null)
      : Rounds.takePlannedMove(combat, enemy, def, { isFirstTurn, pick: (e, d, maxSp) => weightedMovePick(combat, e, d, maxSp) });
    if (moveId == null) {
      enemy.intent = { kind: 'unknown', moveId: null };
      continue;
    }
    presentIntent(combat, enemy, def, moveId);
    // The pool's planned moves play after the head in the enemy phase (enemyPhase), so the plan is due this turn.
    if (!queues) enemy.planDue = true;
    drainQueue(combat);
  }
}

// Shows a move as the enemy's intent: its box, stance, visibility roll and counter priming. The head of a turn and
// each follow-up that plays both go through here, so a revealed follow-up reads like the first move.
function presentIntent(combat, enemy, def, moveId) {
  clearCombatCounter(enemy);
  enemy.intent = buildIntent(def.moves[moveId], moveId, enemy, combat);
  setCombatStance(combat, enemy, enemyMoveCarrier(enemy, def.moves[moveId], moveId, combat));
  if (combat.enemyKnowledge) {
    rollEnemyKnowledge(combat, enemy, { charging: !!def.moves[moveId].delay });
    delete enemy.intentRevealed;
  } else if (enemy.intent.combatProfile.camp) enemy.intentRevealed = combat.rng.float('enemyIntentVisibility') >= hiddenIntentChance(combat.attributes || {}, combat.combatIntentRules || {});
  else delete enemy.intentRevealed;
  primeEnemyCounter(combat, enemy, def.moves[moveId], moveId);
}

// The weighted pick (SPEC §4.6). `maxSp` is the SP left in the enemy's pool: a move that costs more is not picked
// (owner decision, 2026-10-12). Infinity offers every move (the minimum-one fallback).
// Reaction moves (docs/combat-card-traits-contract.md, "Enemy reactions") are never rolled: they are dropped before any
// weighting, maxConsecutive or pattern indexing.
function weightedMovePick(combat, enemy, def, maxSp = Infinity) {
  const entries = Object.entries(def.moves).filter(
    ([id, mv]) => !mv.reaction && (!mv.locked || enemy.unlockedMoves.includes(id))
      && Rounds.enemyMoveSp(mv, { enemy, moveId: id, combat }) <= maxSp
  );
  if (entries.length === 0) return null;

  const eligible = entries.filter(([id, mv]) => {
    if (mv.maxConsecutive == null) return true;
    // Count the consecutive run of `id` at the tail of movesHistory.
    let run = 0;
    for (let i = enemy.movesHistory.length - 1; i >= 0; i--) {
      if (enemy.movesHistory[i] === id) run++;
      else break;
    }
    return run < mv.maxConsecutive;
  });
  const pool = eligible.length > 0 ? eligible : entries;

  const total = pool.reduce((acc, [, mv]) => acc + mv.weight, 0);
  if (total <= 0) return pool[0][0];
  let r = combat.rng.float('enemyAI') * total;
  for (const [id, mv] of pool) {
    r -= mv.weight;
    if (r < 0) return id;
  }
  return pool[pool.length - 1][0];
}

function buildIntent(move, moveId, enemy = null, combat = null) {
  move = expandedEnemyMove(enemy || {}, move, moveId, combat);
  return {
    combatProfile: enemyMoveCarrier(enemy || {}, move, moveId, combat).combatProfile,
    kind: move.intent,
    moveId,
    damage: enemyMoveDamage(enemy, move),
    hits: move.damage != null ? (move.hits != null ? move.hits : 1) : null,
    block: move.block != null ? move.block : null,
    ...(combat?.combatExpansionVersion === 2 ? { barrier: move.barrier ?? null } : {}),
    delayed: !!move.delay,
    pending: false,
  };
}

// ---------------------------------------------------------------------------
// dispatch — player intents (closed set for combat: playCard / endTurn / useFlask)
// ---------------------------------------------------------------------------

/**
 * dispatch(combat, intent) → { events } (the events emitted by this intent).
 *
 *   { type: 'playCard', cardInstanceId, targetId?, choice? }   (choice: cardChoicePlan's option id)
 *   { type: 'endTurn' }
 *   { type: 'useFlask', slot, targetId? }
 *
 * Throws on illegal intents (wrong phase, unaffordable card, unknown ids).
 * The action queue drains fully before this returns (SPEC §3.9).
 */
export function dispatch(combat, intent) {
  if (!combat._foundationTransaction && (combat.combatExpansionVersion === 2 || combat.foundation || ['playCard', 'unqueueCard', 'chooseDiscard'].includes(intent.type))) return F.foundationTransaction(combat, (candidate) => dispatch(candidate, intent), { advanceAction: intent.type === 'chooseDiscard' ? !combat.reactionResume : !['predictIntent', 'chooseReaction', 'setReactions'].includes(intent.type) });
  if (combat.result) throw new Error('Combat is over');
  combat._buffer = [];
  try {
    if (combat.pendingReaction && intent.type !== 'chooseReaction') throw new Error('Answer the pending reaction first');
    if (intent.type !== 'chooseDiscard') R.assertNoAbilityChoice(combat);
    switch (intent.type) {
      case 'setReactions':
        Reactions.setReactionsEnabled(combat, combat.player, intent.enabled);
        break;
      case 'chooseReaction':
        if (Rounds.roundPaused(combat)) { resumeCombatRound(combat, intent); break; }
        Reactions.answerReaction(combat, 'player', intent, reactionHooks);
        resumeEnemyTurn(combat);
        break;
      case 'predictIntent':
        predictEnemyIntent(combat, combat.playerKey || 'player', intent.enemyInstanceId, intent.actionSerial, intent.maneuver);
        break;
      case 'recoverControl': {
        if (combat.phase !== 'player') throw new Error('Recovery requires your turn');
        const result = Control.manualRecovery(combat, combat.player, intent.selections);
        if (!result.ok) throw new Error(result.reason);
        drainQueue(combat);
        break;
      }
      case 'chooseBlightFeat': {
        Blight.chooseAshenBlightFeat(combat, combat.player, intent);
        combat.attributes = settleExpandedPools(combat, combat.player).attributes;
        combat.player.attributes = { ...combat.attributes };
        combat.drawPerTurn = combat.player.drawPerTurn;
        if (combat.handRules) combat.handMax = scaledCards(handRow(combat.handRules, 'handSize'), combat.attributes, combat.characterLevel);
        refreshExpandedLoadout(combat, combat.player);
        refreshCombatRatings(combat);
        break;
      }
      case 'chooseDiscard':
        R.chooseAbilityDiscard(combat, intent.cardInstanceIds);
        drainQueue(combat);
        finishAbilityPlay(combat);
        if (Reactions.restoreReactionQueue(combat) || combat.reactionCursor) resumeEnemyTurn(combat);
        break;
      case 'moveCharacter': {
        const move = formationMovePlan(combat, intent.cell, intent.settings);
        if (!move.ok) throw new Error(move.reason);
        combat.player.energy -= move.cost;
        combat.player.formationCell = move.cell;
        if (move.cost) combat.emit('energySpent', { amount: move.cost });
        combat.emit('characterMoved', { sourceId: combat.player.id, from: move.current, to: move.cell });
        drainQueue(combat);
        break;
      }
      case 'playCard':
        if (combat.combatRounds) queueRoundCard(combat, intent);
        else withPlayedCardStance(combat, intent, () => doPlayCard(combat, intent));
        break;
      case 'unqueueCard':
        unqueueRoundCard(combat, intent);
        break;
      case 'endTurn':
        doEndTurn(combat, intent.discardIds);
        break;
      case 'useFlask':
        doUseFlask(combat, intent);
        break;
      case 'swapArmament':
        doSwapArmament(combat, intent);
        break;
      case 'changeEquipment':
        doChangeEquipment(combat, intent);
        break;
      default:
        throw new Error(`Unknown combat intent '${intent.type}'`);
    }
    return { events: combat._buffer };
  } finally {
    combat._buffer = null;
  }
}

/**
 * doSwapArmament — cycle a hand to another of its sets, mid-fight.
 *
 * Everything about the price is data (balance.equipment): what it costs, what
 * currency it costs in, whether the turn ends, and whether the cards already
 * in your hand are rewritten or only the ones you draw next. The engine's part
 * is small on purpose — it charges the price and re-stamps piles.
 */
function doSwapArmament(combat, { slotId, setIndex }) {
  if (combat.phase !== 'player') throw new Error('Armaments can only be swapped on your turn');
  const cfg = combat.registries.balance.equipment || {};
  if (!cfg.enabled) throw new Error('Equipment is disabled');
  if (!combat.loadout) throw new Error('This combat has no loadout');

  const allowed = canSwap(combat.registries, slotId, { inCombat: true });
  if (!allowed.ok) throw new Error(allowed.reason);

  const p = combat.player;
  // THE PRICE IS DERIVED, NOT READ (A8). `cfg.swapCost` is one rung of a chain
  // now — the default — and which rungs are live is `combat.swapCostRule`, a row
  // of `balance.equipment.swapCostRules` resolved once at createCombat from his
  // Settings choice. The whole derivation comes back so the throw can name the
  // real number and the event can carry it; the relic half is summed here
  // because relic passives are this file's vocabulary (see `effectiveCost`
  // below, same shape) and model/loadout.js must not import back into
  // model/registries.js.
  const price = swapCostFor(combat.registries, {
    rule: combat.swapCostRule,
    loadout: combat.loadout,
    classId: p.classId,
    slotId,
    setIndex,
    relicDelta: passiveSum(combat.registries, p.relicIds, 'swapCostDelta', {}, propertyMountsOf(combat, p)),
  });
  if (cfg.swapCostKind === 'allowance') {
    if ((combat.swapsLeft || 0) < 1) throw new Error('No swaps left this turn');
  } else if (p.energy < price.cost) {
    throw new Error(`Swapping costs ${price.cost} Stamina`);
  }

  // THE LADDER BINDS HERE TOO (#90, Vira's gate), and combat has no profile —
  // `createCombat` is handed registries, rng, player and enemies, and nothing
  // that knows which rungs have been earned. So the bound here is
  // `openedSets(meta: {})`, which is "one, plus whatever this loadout is already
  // holding": in a fight you cycle between the sets you BROUGHT, and what you
  // brought is in the loadout.
  //
  // THIS MAKES THE ENGINE AGREE WITH THE SCREEN RATHER THAN NARROWING IT. The
  // in-combat armoury mount already passes a synthetic `meta` (equipment.js), so
  // the panel already draws only that many cells — the engine was the half that
  // still accepted any index. The limit is the SAME one already stated there for
  // `equipView` and the fold, not a new one: an earned-but-EMPTY set is not
  // reachable mid-fight. Making it reachable means giving combat the profile,
  // which is a different card and not one to open inside a gate.
  // AND `inCombat` IS NOW REQUIRED THERE TOO (#104, Vira). The `canSwap` above
  // is kept — it supplies the REASON this throws with, before the price is
  // charged — but it is no longer the only thing enforcing the seal: the
  // mutation asks the same function. Two questions, one home, no second copy.
  const activeBefore = combat.loadout.active[slotId];
  const poolBefore = runMods(combat.registries, combat.loadout, p.classId);
  if (!cycleSet(combat.registries, combat.loadout, slotId, setIndex, {
    meta: {},
    inCombat: true,
    classId: p.classId,
    onEquipmentChanged: (event) => combat.emit('equipmentChanged', event),
  })) {
    throw new Error(`No set ${setIndex} on '${slotId}'`);
  }
  const poolAfter = runMods(combat.registries, combat.loadout, p.classId);
  if (cfg.swapCostKind === 'allowance') combat.swapsLeft -= 1;
  else p.stamina -= price.cost;
  // The hand now holds a different set: its old piece's properties leave with
  // it and the new piece's arrive (source ownership, engine/properties.js).
  syncLoadoutProperties(combat);
  if (activeBefore !== combat.loadout.active[slotId]) {
    combat.equipmentChanged = true;
    const currentFor = { maxHp: 'hp', maxMana: 'mana', maxStamina: 'stamina' };
    for (const maxField of EQUIPMENT_POOL_FIELDS) {
      const currentField = currentFor[maxField];
      const floor = maxField === 'maxHp' ? 1 : 0;
      const nextMax = Math.max(floor, p[maxField] + poolAfter[maxField] - poolBefore[maxField]);
      combat.equipmentPoolDeficits[currentField] = moveEquipmentPool(
        p, maxField, nextMax, combat.equipmentPoolDeficits[currentField],
      );
    }
  }

  // Stable generated attack slots rebind wherever combat currently holds them.
  // The intent resolves before this mutation, so no in-flight card changes
  // underneath its own effects.
  const piles = [combat.piles.hand, combat.piles.draw, combat.piles.discard, combat.piles.exhaust];
  const run = {
    deck: [],
    loadout: combat.loadout,
    class: p.classId,
    attributes: combat.combatExpansionVersion === 2 ? combat.allocatedAttributes : combat.attributes,
    ...(combat.combatExpansionVersion === 2 ? { combatExpansionVersion: 2, ashenBlight: p.ashenBlight } : {}),
    itemUpgradeLevels: combat.itemUpgradeLevels,
    equipmentProfileRuleSnapshot: combat.equipmentProfileRuleSnapshot,
    // The birth quota travels with the snapshot. Without it this synthetic run
    // has `deck: []` and stampDeck has nothing to read the quota from, so each
    // pile stamp replans from the CURRENT loadout — and the pile holding the
    // slot the replan dropped throws mid-swap.
    equipmentAttackSlotCount: combat.equipmentAttackSlotCount,
    removedAttackSlotIds: combat.removedAttackSlotIds,
    sideboardedEquipmentCardIds: combat.sideboardedEquipmentCardIds,
    ...(combat.poolDeck ? { poolDeck: true } : {}),
    itemMounts: combat.itemMounts,
    // The rows a restamped card's rating reads are the run's own (ruleset 7,
    // model/statRows.js), at the level the fight opened at.
    derivedStatRuleSnapshot: combat.derivedStatRuleSnapshot,
    ...(Number.isInteger(combat.characterLevel) ? { level: { level: combat.characterLevel } } : {}),
  };
  // Pile stamps are subset calls, so granted/weaponArt instances reconcile
  // here explicitly, BEFORE the stamps: the swapped-out armament's leave every
  // pile, the swapped-in armament's land in the discard pile — and then get
  // carrier/mod-stamped by the pile pass like every other card (dormant while
  // no shipped armament authors either).
  reconcileGrantedCardsInCombat(combat.registries, run, combat.piles);
  for (const pile of piles) stampDeck(combat.registries, run, pile);

  // The vessel keeps telling the truth across the ONE mid-fight door equipment
  // moves through: re-derive the stagger threshold from the loadout this swap
  // just changed. Max only — stampPlayerPoiseMax preserves the accumulated
  // value (0 today; nothing writes it), so the future writer's build-up will
  // survive a swap unchanged. This deliberately re-derives over any explicit
  // poiseMax override: after a real swap, the receipt is the truth again.
  if (!combat.ratingsRules) stampPlayerPoiseMax(p, playerPoiseThresholdReceipt(combat.registries, {
    loadout: combat.loadout, relics: p.relicIds || [], class: p.classId,
    itemUpgradeLevels: combat.itemUpgradeLevels || {}, attributes: combat.attributes || null,
    derivedStatRuleSnapshot: combat.derivedStatRuleSnapshot || null,
    ...(Number.isInteger(combat.characterLevel) ? { level: { level: combat.characterLevel } } : {}),
  }).value);

  // The event carries what it COST and under which rule — a price nobody can
  // read back is a price nobody can check, and "try each" is a comparison.
  refreshCombatRatings(combat);
  if (combat.combatExpansionVersion === 2) {
    Object.assign(p, expandedEquipmentProjection(combat.registries, combat.loadout, p.classId, combat.combatExpansionRules.equipment));
    for (const field of EQUIPMENT_POOL_FIELDS) p.baseResourceMaxima[field] += (poolAfter[field] || 0) - (poolBefore[field] || 0);
    settleExpandedPools(combat, p);
  }
  combat.emit('armamentSwapped', { slotId, setIndex, cost: price.cost, rule: price.ruleId });
  if (cfg.swapEndsTurn) doEndTurn(combat);
}

/**
 * Replace, move, or unequip one carried item during the player's turn.
 *
 * This is a combat intent rather than a UI-side loadout edit because equipment
 * changes can rewrite live card piles, resource vessels, Poise, Energy, and the
 * persisted combat snapshot. The existing swap price is reused so switching a
 * prepared set and re-arming one position remain one predictable action economy.
 */
function doChangeEquipment(combat, { slotId, setIndex, pieceId = null }) {
  if (combat.phase !== 'player') throw new Error('Equipment can only be changed on your turn');
  const cfg = combat.registries.balance.equipment || {};
  if (!cfg.enabled) throw new Error('Equipment is disabled');
  if (!combat.loadout) throw new Error('This combat has no loadout');

  const allowed = canEquip(combat.registries, slotId, { inCombat: true });
  if (!allowed.ok) throw new Error(allowed.reason);

  const p = combat.player;
  const owned = ownership(combat.registries, { meta: {}, loadout: combat.loadout });
  const equipContext = {
    inCombat: true,
    attributes: combat.combatExpansionVersion === 2 ? combat.allocatedAttributes : combat.attributes,
    ...(combat.combatExpansionVersion === 2 ? { combatExpansionVersion: 2, ashenBlight: p.ashenBlight } : {}),
    itemUpgradeLevels: combat.itemUpgradeLevels,
    armamentLevels: combat.armamentLevels,
    classId: p.classId,
  };

  // Validate and price the requested destination before touching combat state.
  // Category pricing follows the item being equipped, so the preview loadout is
  // the exact input swapCostFor needs for this action.
  const previewLoadout = structuredClone(combat.loadout);
  if (!equipPiece(combat.registries, previewLoadout, slotId, setIndex, pieceId, owned, equipContext)) {
    throw new Error('That equipment change is not available');
  }
  const price = swapCostFor(combat.registries, {
    rule: combat.swapCostRule,
    loadout: previewLoadout,
    classId: p.classId,
    slotId,
    setIndex,
    relicDelta: passiveSum(combat.registries, p.relicIds, 'swapCostDelta', {}, propertyMountsOf(combat, p)),
  });
  if (cfg.swapCostKind === 'allowance') {
    if ((combat.swapsLeft || 0) < 1) throw new Error('No equipment changes left this turn');
  } else if (p.energy < price.cost) {
    throw new Error(`Changing equipment costs ${price.cost} Stamina`);
  }

  const poolBefore = runMods(combat.registries, combat.loadout, p.classId);
  let changeEvent = null;
  if (!equipPiece(combat.registries, combat.loadout, slotId, setIndex, pieceId, owned, {
    ...equipContext,
    onEquipmentChanged: (event) => { changeEvent = event; },
  })) {
    throw new Error('That equipment change is no longer available');
  }
  // Unmount the outgoing piece's properties and mount the incoming piece's,
  // now that equipPiece has committed (engine/properties.js).
  syncLoadoutProperties(combat);
  const poolAfter = runMods(combat.registries, combat.loadout, p.classId);
  if (cfg.swapCostKind === 'allowance') combat.swapsLeft -= 1;
  else p.stamina -= price.cost;
  combat.equipmentChanged = true;
  const currentFor = { maxHp: 'hp', maxMana: 'mana', maxStamina: 'stamina' };
  for (const maxField of EQUIPMENT_POOL_FIELDS) {
    const currentField = currentFor[maxField];
    const floor = maxField === 'maxHp' ? 1 : 0;
    const nextMax = Math.max(floor, p[maxField] + poolAfter[maxField] - poolBefore[maxField]);
    combat.equipmentPoolDeficits[currentField] = moveEquipmentPool(
      p, maxField, nextMax, combat.equipmentPoolDeficits[currentField],
    );
  }

  const run = {
    deck: [],
    loadout: combat.loadout,
    class: p.classId,
    attributes: combat.combatExpansionVersion === 2 ? combat.allocatedAttributes : combat.attributes,
    ...(combat.combatExpansionVersion === 2 ? { combatExpansionVersion: 2, ashenBlight: p.ashenBlight } : {}),
    itemUpgradeLevels: combat.itemUpgradeLevels,
    equipmentProfileRuleSnapshot: combat.equipmentProfileRuleSnapshot,
    equipmentAttackSlotCount: combat.equipmentAttackSlotCount,
    removedAttackSlotIds: combat.removedAttackSlotIds,
    sideboardedEquipmentCardIds: combat.sideboardedEquipmentCardIds,
    ...(combat.poolDeck ? { poolDeck: true } : {}),
    itemMounts: combat.itemMounts,
    // The rows a restamped card's rating reads are the run's own (ruleset 7,
    // model/statRows.js), at the level the fight opened at.
    derivedStatRuleSnapshot: combat.derivedStatRuleSnapshot,
    ...(Number.isInteger(combat.characterLevel) ? { level: { level: combat.characterLevel } } : {}),
  };
  reconcileGrantedCardsInCombat(combat.registries, run, combat.piles);
  for (const pile of [combat.piles.hand, combat.piles.draw, combat.piles.discard, combat.piles.exhaust]) {
    stampDeck(combat.registries, run, pile);
  }
  if (!combat.ratingsRules) stampPlayerPoiseMax(p, playerPoiseThresholdReceipt(combat.registries, {
    loadout: combat.loadout,
    relics: p.relicIds || [],
    class: p.classId,
    itemUpgradeLevels: combat.itemUpgradeLevels || {},
    attributes: combat.attributes || null,
    derivedStatRuleSnapshot: combat.derivedStatRuleSnapshot || null,
    ...(Number.isInteger(combat.characterLevel) ? { level: { level: combat.characterLevel } } : {}),
  }).value);

  refreshCombatRatings(combat);
  if (combat.combatExpansionVersion === 2) {
    Object.assign(p, expandedEquipmentProjection(combat.registries, combat.loadout, p.classId, combat.combatExpansionRules.equipment));
    for (const field of EQUIPMENT_POOL_FIELDS) p.baseResourceMaxima[field] += (poolAfter[field] || 0) - (poolBefore[field] || 0);
    settleExpandedPools(combat, p);
  }
  if (changeEvent) combat.emit('equipmentChanged', changeEvent);
  combat.emit('equipmentRearmed', {
    slotId, setIndex, pieceId, cost: price.cost, rule: price.ruleId,
  });
  if (cfg.swapEndsTurn) doEndTurn(combat);
}

function needsEnemyTarget(def) {
  return immediateCardEffects(def).some((eff) => eff.target === 'enemy');
}

// Effective numeric cost after relic passives (powerCostReduction, min 0).
// X-cost is unaffected (it always consumes all energy).
function effectiveCost(combat, def) {
  if (def.cost === 'X') return 'X';
  // The cost profile is the framework's call; this engine supplies the live
  // relic reduction and the framework applies it only where the card's
  // classification permits (Powers).
  return F.foundationCosts(combat, def, playerWeightClass(combat).weightClass, combat.registries.framework.costProfile(def, {
    powerCostReduction: passiveSum(combat.registries, combat.player.relicIds, 'powerCostReduction', combat.itemUpgradeLevels || {}, propertyMountsOf(combat, combat.player)),
    weightClass: playerWeightClass(combat).weightClass,
  })).action;
}

// What playing this card costs right now, in every pool: Actions (X spends
// them all), Mana and Stamina, weight class and relic reductions applied. The
// one pricing doPlayCard pays, exported so a bot can ask before it plays.
// `claimed` (preview only) is the set of charge keys queued cards already hold: they are not offered again.
export function resolvedCardPlayCosts(combat, def, claimed = null) {
  const weightClass = playerWeightClass(combat).weightClass;
  const pools = F.foundationCosts(combat, def, weightClass, combat.registries.framework.costProfile(def, { weightClass }));
  // A break-even restore pays its own part of the price (owner, 2026-10-13; model/actionCosts.js ownRestoreFunds).
  const funds = ownRestoreFunds(def);
  // Silenced (v2): each stack adds 1 SP to a spell-camp card. An X card already spends every point.
  const silenced = combat.combatExpansionVersion === 2 && def.cost !== 'X' ? spellCardCostSurcharge(combat.player, def) : 0;
  const stamina = def.cost === 'X' ? combat.player.stamina + (def.upcastSurcharge || 0)
    : Math.max(0, effectiveCost(combat, def) + (def.upcastSurcharge || 0) + silenced - funds.stamina);
  const player = withoutClaims(combat.player, claimed);
  return { energy: stamina, mana: Math.max(0, pools.mana + (def.upcastSurcharge || 0) - funds.mana - R.matchingAbilityCharges(player, { ...def, type: cardKind(def), authoredTags: def.cardTags || def.tags }).manaDiscount), stamina };
}

function playCosts(combat, def, claimed = null) { return resolvedCardPlayCosts(combat, def, claimed); }

/** cardPlayCosts(combat, cardInstanceId) → { energy, mana, stamina } for a card in hand. */
export function cardPlayCosts(combat, cardInstanceId, upcastRanks) {
  const inst = combat.piles.hand.find((c) => c.instanceId === cardInstanceId);
  if (!inst) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const def = resolveCombatCard(combat, inst, { upcastRanks });
  return preparedPlayCosts(combat, inst, def, claimedCharges(combat, cardInstanceId));
}

// A card's price as its play pays it: after its cardPreparing triggers (a preparing discount or surcharge), on a
// detached preview when anything listens. cardPlayCosts and the Combat Rounds queue both price through here, so a
// card the preview shows free queues free (SPEC §4.11). `targetId` aims the preview's preparing event.
function preparedPlayCosts(combat, inst, def, claimed, targetId) {
  // cardPreparing has no ledger side effect in recordAbilityEvent/skill XP.
  // With no listener or queued work it cannot change any input to playCosts.
  // Custom buses, paused/resolving actions and all hook sources keep the exact
  // detached preview; actual card execution always retains its transaction.
  if (!combat.result && combat.player?.alive && combat.player.hp > 0
    && combat.enemies?.some(enemy => enemy.alive && enemy.hp > 0)
    && combat._emitEvent === emitEvent && Array.isArray(combat.queue) && combat.queue.length === 0
    && !combat.pendingAbilityDiscard && !combat._abilityAction && !combat._emitDepth
    && !combat._foundationTransaction && !combat._foundationAncestry?.length
    && !hasEventTriggers(combat, 'cardPreparing', { cardTags: def.cardTags || def.tags || [] })) return playCosts(combat, def, claimed);
  return playCosts(preparingPreview(combat, inst, def, targetId), def, claimed);
}

// The ability kind a card plays with (SPEC §4.11 preview and live share it): its authored kind, else spell
// for a source:spell card and maneuver for the rest. Queue-time charge matching and play-time cardRef both read it.
function abilityKindOf(def) {
  return def.abilityKind || ((def.cardTags || def.tags || []).includes('source:spell') ? 'spell' : 'maneuver');
}

// A card's maneuver (SPEC §4.7): its combat profile's, else the `maneuver:*` tag the card carries.
function maneuverOf(def) {
  if (def.combatProfile?.maneuver) return def.combatProfile.maneuver;
  const tag = (def.cardTags ?? def.tags ?? []).find((t) => typeof t === 'string' && t.startsWith('maneuver:'));
  return tag ? tag.slice('maneuver:'.length) : undefined;
}

// The Mana a card costs before any Mana-discount charge (the pricing resolvedCardPlayCosts discounts).
function baseManaCost(combat, def) {
  const weightClass = playerWeightClass(combat).weightClass;
  const pools = F.foundationCosts(combat, def, weightClass, combat.registries.framework.costProfile(def, { weightClass }));
  return pools.mana + (def.upcastSurcharge || 0);
}

// Preview only (SPEC §4.11): the Mana-discount charges the queued cards hold, except the card named.
// A queued card claims the discount charges it priced with; unqueuing or resolving it releases them.
function claimedCharges(combat, exceptInstanceId = null) {
  if (!combat.combatRounds) return null;
  const claimed = new Set();
  for (const record of Rounds.queuedCards(combat)) {
    if (record.instanceId !== exceptInstanceId) for (const key of record.claims || []) claimed.add(key);
  }
  return claimed;
}

// The player as the pricing reads it, with the claimed charges taken out of its ability charges.
function withoutClaims(player, claimed) {
  if (!claimed?.size) return player;
  const charges = Object.fromEntries(Object.entries(player.abilityRiders?.charges || {}).filter(([key]) => !claimed.has(key)));
  return { ...player, abilityRiders: { ...(player.abilityRiders || {}), charges } };
}

// The charge keys this card's Mana discount comes from, net of the claimed ones. It matches the charges the
// price (resolvedCardPlayCosts) discounts, so a card claims a charge only when the price would discount it (SPEC §4.11).
function manaDiscountClaims(combat, def, claimed) {
  // A card with no Mana to discount holds no discount: it would take a charge a Mana card can use.
  if (!(baseManaCost(combat, def) > 0)) return [];
  const player = withoutClaims(combat.player, claimed);
  const charges = player.abilityRiders?.charges || {};
  const { keys } = R.matchingAbilityCharges(player, { ...def, type: cardKind(def), authoredTags: def.cardTags || def.tags });
  return keys.filter((key) => (charges[key]?.manaDiscount || 0) > 0);
}

/** Read only whether temporary buildup turns this card into an enemy aim.
 * Ordinary source cards need no full numeric preview. Uncertain preparing
 * work keeps the exact detached preview, including its validation/errors.
 */
export function cardNeedsEnemyTargetNow(combat, cardInstanceId) {
  const inst = combat.piles.hand.find(card => card.instanceId === cardInstanceId);
  if (!inst) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const def = resolveCombatCard(combat, inst);
  // Unlike the pricing optimization, this reader also runs inside the real
  // card transaction. Avoiding a nested preview never bypasses that outer
  // transaction or the actual cardPreparing event and its paid effects.
  if (!combat.result && combat.player?.alive && combat.player.hp > 0
    && combat.enemies?.some(enemy => enemy.alive && enemy.hp > 0)
    && combat._emitEvent === emitEvent && Array.isArray(combat.queue) && combat.queue.length === 0
    && !combat.pendingAbilityDiscard && !combat._abilityAction && !combat._emitDepth
    && !combat._foundationAncestry?.length && !hasEventTriggers(combat, 'cardPreparing', { cardTags: def.cardTags || def.tags || [] })) {
    const enemyAvailable = combat.enemies.some(enemy => enemy.alive);
    const charges = R.matchingAbilityCharges(combat.player, {
      ...def, type: cardKind(def), authoredTags: def.cardTags || def.tags,
    }, { enemyAvailable });
    const effects = R.abilityChargedEffects(def.effects || [], charges, enemyAvailable, combat);
    return needsEnemyTarget({ ...def, effects });
  }
  return previewCard(combat, cardInstanceId).needsTarget;
}

function preparingPreview(combat, inst, def, targetId) {
  const clone = F.candidateState(combat);
  if (clone.pendingAbilityDiscard) { clone.queue = []; return clone; }
  if (clone.foundation) { clone.foundation.actionSerial++; clone.foundation.eventCount = 0; clone.foundation.rolls = {}; clone.foundation.counts = {}; }
  clone._buffer = null;
  const target = targetId ? findEntity(clone, targetId) : clone.enemies.find(e => e.alive);
  clone.emit('cardPreparing', { cardInstanceId: inst.instanceId, cardId: inst.cardId, cardType: cardKind(def), cardTags: def.cardTags || def.tags || [], abilityKind: abilityKindOf(def), sourceId: clone.player.id, targetId: target?.id || null, ...R.beforeAbilityPlay(clone, clone.player), cardTargetsAllEnemies: R.cardTargetsAllEnemies(def) });
  drainQueue(clone);
  return clone;
}

/**
 * cardChoicePlan(combat, cardInstanceId) → the pending choice playing this
 * card offers ({ kind, options }), or null. The play intent answers it with
 * `choice` (model/cardChoices.js; SPEC §5.2 Warrior's Vow).
 */
export function cardChoicePlan(combat, cardInstanceId) {
  const inst = combat.piles.hand.find((c) => c.instanceId === cardInstanceId);
  if (!inst) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  return cardChoice(combat.registries, resolveCombatCard(combat, inst), combat.player.classId, combat.player.stanceId);
}

// prepaid: the costs the card paid when the Combat Rounds Preview queued it (SPEC §4.11). A prepaid
// play resolves its effects and pays nothing again; its meta reads the queued amounts.
function doPlayCard(combat, { cardInstanceId, targetId, choice, upcastTier, upcastRanks }, { prepaid = null } = {}) {
  if (combat.phase !== 'player' && !combat._reactionPlaying) throw new Error('Cards can only be played on the player turn');
  const p = combat.player;
  const idx = combat.piles.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx < 0) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const inst = combat.piles.hand[idx];
  const def = resolveCombatCard(combat, inst, { upcastTier, upcastRanks });
  const kws = def.keywords || [];
  if (!Control.controlGate(combat, p, def).allowed) throw F.playRefusal('Recover from the active control statuses before playing cards', 'controlled');
  if (p.ashenBlight?.milestones?.some(row => row.path === null)) throw new Error('Choose the pending Ashen Blight feat first');
  const chosen = assertCardChoice(cardChoice(combat.registries, def, p.classId), choice);
  F.assertFoundationPlayable(combat, def, chosen);

  if (combat.registries.framework.isUnplayable(def)) throw F.playRefusal(`'${def.name}' is unplayable`, 'unplayable');

  const isX = def.cost === 'X';
  let { energy: cost, mana: manaCost, stamina: staminaCost } = prepaid ?? playCosts(combat, def);

  const players = [{ id: p.id, alive: p.alive, connected: true }];
  const targetPlan = cardTargetPlan(def, p.id, combat.enemies, players, { solo: true });
  const chargedEnemyTarget = targetPlan.mode === 'friendly' && cardNeedsEnemyTargetNow(combat, inst.instanceId);
  assertCardTarget(chargedEnemyTarget
    ? cardTargetPlan({ ...def, combatPreview: { needsTarget: true } }, p.id, combat.enemies, players, { solo: true })
    : targetPlan, targetId);
  let target = null;
  if (targetId != null) {
    target = findEntity(combat, targetId);
    if (!target || !target.alive) throw new Error(`Invalid target '${targetId}'`);
  } else if (needsEnemyTarget(def) || chargedEnemyTarget) {
    target = combat.enemies.find((e) => e.alive) || null;
    if (!target) throw new Error('No living enemy to target');
  }

  // WHAT THE CARD IS comes from its kind tag (model/tree.js cardKind), never
  // from `def.type` — every reader downstream (the attack counter, the
  // cardTypeIs predicate, the cardPlayed receipt) sees the kind.
  const kind = cardKind(def);
  // DYNAMIC TAGS ARE READ HERE, ONCE, AND WRITTEN TO NO CARD (plan phase 3c).
  // The grip the hands are in when the card is played (model/loadout.js
  // gripOf) derives `equipment.dualWield` / `equipment.twoHanded`; they ride
  // this snapshot as `derivedTags`, beside the card's own `tags`, and a
  // predicate that asks about the card's tags reads both (triggers.js
  // cardTagIs). The card definition and the deck instance never carry them.
  const derivedTags = gripTags(gripOf(combat.registries, combat.loadout, p.classId));
  const cardRef = {
    abilityKind: abilityKindOf(def), abilityFamily: def.abilityFamily, abilityRank: def.abilityRank,
    sourceArmamentId: inst.sourceArmamentId || inst.weaponId,
    ratingId: inst.ratingId,
    ratingValue: inst.ratingValue,
    ratingCap: inst.ratingCap,
    equipmentRole: inst.equipmentRole,
    instanceId: inst.instanceId, cardId: inst.cardId, upgraded: inst.upgraded, ...(inst.rank > 1 ? { rank: inst.rank } : {}), ...(inst.skillBonus > 0 ? { skillBonus: inst.skillBonus } : {}), ...(inst.passiveBlock > 0 ? { passiveBlock: inst.passiveBlock } : {}),
    type: kind, tags: def.cardTags ?? (def.tags?.length ? def.tags : undefined), attack: def.attack, sourceHand: inst.sourceHand,
    derivedTags,
    // The card's AUTHORED tags, kept apart from `tags`: the foundation carrier
    // rewrites `tags` into the resolved attack tags (the weapon's inherited
    // ones included), and cardTagIs must read what the card row says.
    authoredTags: def.cardTags ?? (def.tags?.length ? def.tags : []),
    // Which piece lent this card, for the skill hooks (engine/skillXp.js).
    ...(inst.grantedBy ? { grantedBy: inst.grantedBy } : {}),
    damageSchool: inst.damageSchool ?? def.damageSchool,
    ...(Number.isFinite(inst.magicShare ?? def.magicShare) ? { magicShare: inst.magicShare ?? def.magicShare } : {}),
    ...(typeof (inst.physicalDamageType ?? def.physicalDamageType) === 'string' ? { physicalDamageType: inst.physicalDamageType ?? def.physicalDamageType } : {}),
    exposureBuildupPerHit: inst.exposureBuildupPerHit ?? def.exposureBuildupPerHit,
    // The resolved face's Poise/Ward values: a staff's Strike resolves
    // magical and carries Ward, which the registry def cannot (attackImpact).
    ...(def.cardRatingValues ? { cardRatingValues: def.cardRatingValues } : {}),
  };
  Object.assign(cardRef, tacticalCarrier(def, cardRef, combat, p));
  if (combat._reactionPlaying) cardRef.reactionDepth = 1;
  cardRef.committedInstance = structuredClone(inst);
  if (Number.isInteger(def.upcastTier)) cardRef.upcastTier = def.upcastTier;
  const sourceSnapshots = F.cardSourceSnapshots(combat, def, p, cardRef);
  if (cardRef.combatProfile?.maneuver === 'counter' && sourceSnapshots?.size) {
    Object.assign(cardRef, sourceSnapshots.values().next().value);
  }
  const before = { ...R.beforeAbilityPlay(combat, p), cardTargetsAllEnemies: R.cardTargetsAllEnemies(def) };
  A.preflightCardHp(combat, def, p, target, before);
  if (combat.combatExpansionVersion === 2) {
    const check = playCosts(preparingPreview(combat, inst, def, targetId), def);
    if (!prepaid && p.energy < check.energy) throw F.playRefusal('Not enough Stamina or Mana', 'cost', { resource: 'stamina', need: check.energy, have: p.energy });
    if (!prepaid && p.mana < check.mana) throw F.playRefusal('Not enough Stamina or Mana', 'cost', { resource: 'mana', need: check.mana, have: p.mana });
    const payment = Blight.payAshenBlight(combat, p, { amount: def.ashenBlightCost || 0, receiptId: `${combat.combatKey}:${p.combatOwnerCycle}:${p.counters.cardsPlayedThisCombat + 1}:${inst.instanceId}`, combatKey: combat.combatKey });
    if (payment.recorded) combat.emit('ashenBlightPaid', { sourceId: p.id, amount: payment.paid, value: payment.value });
    if (payment.terminal) {
      if (!prepaid) { p.energy -= check.energy; p.mana -= check.mana; }
      combat.piles.hand.splice(idx, 1); combat.piles.exhaust.push(inst);
      p.hp = 0; p.alive = false; combat.phase = 'ended'; combat.result = 'defeat';
      Reactions.finishReactions(combat);
      combat.emit('ashenBlightLost', { targetId: p.id, reason: 'threshold' }); return;
    }
  }
  combat.emit('cardPreparing', { cardInstanceId: inst.instanceId, cardId: inst.cardId, cardType: kind, cardTags: cardRef.authoredTags, abilityKind: cardRef.abilityKind, sourceId: p.id, targetId: target?.id || null, ...before });
  drainQueue(combat);
  // A charge another queued card claimed is not this card's to take, riders and all (SPEC §4.11).
  const charges = R.matchingAbilityCharges(withoutClaims(p, claimedCharges(combat, cardInstanceId)), cardRef, { enemyAvailable: combat.enemies.some(e => e.alive) });
  const chargedEffects = R.abilityChargedEffects(def.effects || [], charges, combat.enemies.some(e => e.alive), combat);
  if (chargedEffects !== def.effects) {
    if (target && target.kind !== 'enemy') throw new Error('Buildup charge requires a living enemy target');
    target ||= combat.enemies.find(e => e.alive) || null;
  }
  ({ energy: cost, mana: manaCost, stamina: staminaCost } = prepaid ?? playCosts(combat, def));
  if (!prepaid && p.energy < cost) throw F.playRefusal('Not enough Actions (Stamina) to play this card', 'cost', { resource: 'stamina', need: cost, have: p.energy });
  if (!prepaid && p.mana < manaCost) throw F.playRefusal('Not enough mana to play this card', 'cost', { resource: 'mana', need: manaCost, have: p.mana });

  // Pay cost (X-cost consumes ALL energy — SPEC §4.3). A prepaid card paid at queue time (§4.11).
  if (!prepaid) {
    p.energy -= cost;
    if (cost > 0 || isX) combat.emit('energySpent', { amount: cost });
    p.mana -= manaCost;
    if (manaCost > 0) combat.emit('manaSpent', { amount: manaCost });
    if (staminaCost > 0) {
      p.counters.staminaSpentThisTurn = (p.counters.staminaSpentThisTurn || 0) + staminaCost;
      combat.emit('staminaSpent', { amount: staminaCost });
    }
  }

  // Remove from hand; bump counters (used by predicates + formulas).
  combat.piles.hand.splice(idx, 1);
  p.counters.cardsPlayedThisTurn += 1;
  p.counters.cardsPlayedThisCombat += 1;
  const meta = {
    ...before,
    energySpent: cost,
    manaSpent: manaCost,
    staminaSpent: staminaCost,
    ordinalThisTurn: p.counters.cardsPlayedThisTurn,
    ordinalThisCombat: p.counters.cardsPlayedThisCombat,
    attackOrdinal: null,
    ...(chosen != null ? { choice: chosen } : {}),
  };
  if (kind === 'attack') {
    p.counters.attacksPlayedThisCombat += 1;
    meta.attackOrdinal = p.counters.attacksPlayedThisCombat;
  }
  // Enqueue the card's own effects first, then announce the play — triggers
  // reacting to cardPlayed enqueue after the card's effects (FIFO).
  R.recordAbilityCard(p, cardRef, manaCost);
  R.consumeAbilityCharges(p, charges.keys);
  if (charges.keys.length) combat.emit('cardChargeConsumed', { keys: charges.keys, cardId: inst.cardId, sourceId: p.id });
  combat.pendingAbilityPlay = { instance: inst, ref: cardRef, kind, printedManaCost: def.manaCost || 0, targetId: target?.id || null, before };
  const charged = new Set();
  const tacticalEffects = prepareTacticalCard(combat, p, target, cardRef, chargedEffects, meta, { damageBonus: charges.damage + charges.damageEffect, poiseBonus: charges.break });
  const expandedActions = [];
  for (const [index, action] of F.cardActions(combat, { ...def, effects: tacticalEffects }, p, target, cardRef, meta, sourceSnapshots).entries()) {
    action.meta = { ...action.meta, abilityEffectIndex: index };
    R.attachAbilityCharges(action, charges, charged, combat);
    expandedActions.push(action);
  }
  enqueueExpandedAction(combat, expandedActions, { source: p, target, carrier: cardRef });
  enqueueCounterWard(combat, p, cardRef, meta);
  combat.emit('cardPlayed', {
    ...before, abilityKind: cardRef.abilityKind, printedManaCost: def.manaCost || 0, sourceId: p.id,
    ...(combat.combatExpansionVersion === 2 ? { cardInstance: structuredClone(inst),
      ...(def.upcast ? { upcastTier: def.upcastTier ?? def.upcast.baseTier } : {}) } : {}),
    cardInstanceId: inst.instanceId,
    cardId: inst.cardId,
    cardType: kind,
    cardTags: cardRef.tags || [],
    derivedTags,
    targetId: target ? target.id : null,
    ordinalThisTurn: meta.ordinalThisTurn,
    ordinalThisCombat: meta.ordinalThisCombat,
    energySpent: cost,
    manaSpent: manaCost,
    staminaSpent: staminaCost,
  });
  drainQueue(combat);
  // An enemy reaction window on this card's own root: it resolves when the root resumes.
  if (Reactions.deferRootPlay(combat)) return;

  finishAbilityPlay(combat);
}

// ---------------------------------------------------------------------------
// Combat Rounds Preview (SPEC §4.11, PREVIEW-PLAN P3a): queue, unqueue, commit.
// Only reached when combat.combatRounds is set. The adapter keeps the queues.
// ---------------------------------------------------------------------------

// Playing a card on the preview queues it: the same checks as doPlayCard, then the card's Stamina
// (SP) and Mana are paid now. The live Actions charge is the same number here, so it is paid once.
// The card stays in hand; its effects run in the round's commit.
function queueRoundCard(combat, { cardInstanceId, targetId, choice, upcastTier, upcastRanks }) {
  if (combat.phase !== 'player') throw new Error('Cards can only be played on the player turn');
  const p = combat.player;
  if (Rounds.isQueued(combat, cardInstanceId)) throw new Error(`Card '${cardInstanceId}' is already queued`);
  const idx = combat.piles.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx < 0) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const inst = combat.piles.hand[idx];
  const def = resolveCombatCard(combat, inst, { upcastTier, upcastRanks });
  if (!Control.controlGate(combat, p, def).allowed) throw new Error('Recover from the active control statuses before playing cards');
  if (p.ashenBlight?.milestones?.some(row => row.path === null)) throw new Error('Choose the pending Ashen Blight feat first');
  const chosen = assertCardChoice(cardChoice(combat.registries, def, p.classId), choice);
  F.assertFoundationPlayable(combat, def, chosen);
  if (combat.registries.framework.isUnplayable(def)) throw new Error(`'${def.name}' is unplayable`);

  const players = [{ id: p.id, alive: p.alive, connected: true }];
  const targetPlan = cardTargetPlan(def, p.id, combat.enemies, players, { solo: true });
  const chargedEnemyTarget = targetPlan.mode === 'friendly' && cardNeedsEnemyTargetNow(combat, inst.instanceId);
  assertCardTarget(chargedEnemyTarget
    ? cardTargetPlan({ ...def, combatPreview: { needsTarget: true } }, p.id, combat.enemies, players, { solo: true })
    : targetPlan, targetId);
  let target = null;
  if (targetId != null) {
    target = findEntity(combat, targetId);
    if (!target || !target.alive) throw new Error(`Invalid target '${targetId}'`);
  } else if (needsEnemyTarget(def) || chargedEnemyTarget) {
    target = combat.enemies.find((e) => e.alive) || null;
    if (!target) throw new Error('No living enemy to target');
  }

  const isX = def.cost === 'X';
  const claimed = claimedCharges(combat, cardInstanceId);
  // Priced as the live play prices it: after the card's cardPreparing triggers (Codex P2 on PR #1953).
  const { energy: cost, mana: manaCost, stamina: staminaCost } = preparedPlayCosts(combat, inst, def, claimed, target ? target.id : undefined);
  const claims = manaDiscountClaims(combat, def, claimed);
  if (p.energy < cost) throw new Error('Not enough Actions (Stamina) to play this card');
  if (p.mana < manaCost) throw new Error('Not enough mana to play this card');
  p.energy -= cost;
  if (cost > 0 || isX) combat.emit('energySpent', { amount: cost });
  p.mana -= manaCost;
  if (manaCost > 0) combat.emit('manaSpent', { amount: manaCost });
  if (staminaCost > 0) {
    p.counters.staminaSpentThisTurn = (p.counters.staminaSpentThisTurn || 0) + staminaCost;
    combat.emit('staminaSpent', { amount: staminaCost });
  }

  const tl = roundTimelineView(def, inst, cardInstanceId, target, needsEnemyTarget(def) || chargedEnemyTarget, cost);
  Rounds.addQueuedCard(combat, {
    instanceId: cardInstanceId,
    cardId: inst.cardId,
    targetId: target ? target.id : null,
    ...(choice !== undefined ? { choice } : {}),
    ...(upcastTier !== undefined ? { upcastTier } : {}),
    ...(upcastRanks !== undefined ? { upcastRanks } : {}),
    paid: { energy: cost, mana: manaCost, stamina: staminaCost },
    claims,
    tl,
  });
}

// The timeline's view of a card (SPEC §4.11): an attack aims at its foe; a defensive card is for its owner.
// Shared by the queue and roundCardForecast, so the screen's speed hint reads the card the commit will run.
function roundTimelineView(def, inst, cardInstanceId, target, aimsAtFoe, sp) {
  const isAttack = cardKind(def) === 'attack' && Boolean(target);
  const kind = Rounds.playerKind({ isAttack, effects: def.effects ?? [], maneuver: maneuverOf(def) });
  const tlTarget = kind === 'attack' || aimsAtFoe ? (target ? target.id : 'self') : 'self';
  const tags = Array.isArray(def.cardTags ?? def.tags) ? [...(def.cardTags ?? def.tags)] : [];
  return {
    id: inst.cardId, instanceId: cardInstanceId, kind, speed: Rounds.cardSpeed(def, inst.cardId),
    stance: Rounds.stanceFor(kind, tags), target: tlTarget, sp, tags,
  };
}

// roundCardForecast(combat, instanceId, targetId) → the timeline view a hand card would be queued with, aimed at
// targetId, or null when the card is not in hand. Pays and queues nothing: the preview screen reads it for the
// plan-time speed hint (PREVIEW-PLAN, Screen).
export function roundCardForecast(combat, instanceId, targetId = null) {
  if (!combat.combatRounds) return null;
  return cardTimelineViewFor(combat, instanceId, targetId);
}

// The timeline view of a hand card aimed at targetId (null when the card is not in hand). Pays and queues nothing.
// Shared by the rounds forecast and normal combat's momentum stance (SPEC §4.11).
export function cardTimelineViewFor(combat, instanceId, targetId = null) {
  const p = combat.player;
  const inst = combat.piles.hand.find((c) => c.instanceId === instanceId);
  if (!inst) return null;
  const def = resolveCombatCard(combat, inst);
  const players = [{ id: p.id, alive: p.alive, connected: true }];
  const targetPlan = cardTargetPlan(def, p.id, combat.enemies, players, { solo: true });
  const chargedEnemyTarget = targetPlan.mode === 'friendly' && cardNeedsEnemyTargetNow(combat, instanceId);
  const target = targetId == null ? null : findEntity(combat, targetId);
  return roundTimelineView(def, inst, instanceId, target && target.alive ? target : null, needsEnemyTarget(def) || chargedEnemyTarget, 0);
}

// Normal combat's momentum (SPEC §4.11): the card being played carries its timeline stance while it resolves, so
// the attack it lands is credited with that stance. Cleared afterwards; nothing saves it.
function withPlayedCardStance(combat, intent, fn) {
  if (!combat.normalPreview?.momentum) return fn();
  // A card that cannot be aimed is refused by the play itself; its stance is only a reading, so it falls back.
  let view = null;
  try { view = cardTimelineViewFor(combat, intent.cardInstanceId, intent.targetId ?? null); } catch { view = null; }
  // The card is one exchange per target, however many hits it lands (SPEC §4.11, as a round's timeline entry).
  return withCardExchange(combat, view?.stance ?? 'attack', fn);
}

// Pays a queued card's SP and MP back: the unqueue refund, and the refund of a card that never resolved.
function refundQueuedCard(combat, rec) {
  const p = combat.player;
  p.energy += rec.paid.energy;
  p.mana += rec.paid.mana;
  if (rec.paid.stamina > 0) p.counters.staminaSpentThisTurn = Math.max(0, (p.counters.staminaSpentThisTurn || 0) - rec.paid.stamina);
}

// Takes a queued card back out of the round and refunds exactly what it paid.
function unqueueRoundCard(combat, { cardInstanceId }) {
  if (!combat.combatRounds) throw new Error('combat rounds preview is not on');
  if (combat.phase !== 'player') throw new Error('Cards can only be unqueued on the player turn');
  const rec = Rounds.unqueueCard(combat, cardInstanceId);
  if (!rec) throw new Error(`Card '${cardInstanceId}' is not queued`);
  refundQueuedCard(combat, rec);
}

// A card the round did not let land leaves the hand as played (its costs were paid when queued),
// with no effects. It paid the discounted Mana, so the Mana-discount charges it claimed are spent with it.
function discardUnplayedCard(combat, record) {
  const p = combat.player;
  if (record.claims?.length) {
    R.consumeAbilityCharges(p, record.claims);
    combat.emit('cardChargeConsumed', { keys: record.claims, cardId: record.cardId, sourceId: p.id });
  }
  const idx = combat.piles.hand.findIndex((c) => c.instanceId === record.instanceId);
  if (idx < 0) return;
  const [inst] = combat.piles.hand.splice(idx, 1);
  p.counters.cardsPlayedThisTurn += 1;
  p.counters.cardsPlayedThisCombat += 1;
  const destination = combat.registries.framework.afterPlayDestination(resolveCombatCard(combat, inst));
  if (destination === 'EXHAUST_PILE') {
    combat.piles.exhaust.push(inst);
    combat.emit('cardExhausted', { cardInstanceId: inst.instanceId, cardId: inst.cardId, reason: 'played' });
  } else if (destination === 'HAND') {
    combat.piles.hand.push(inst);
  } else if (destination !== 'REMOVED_FROM_PLAY') {
    combat.piles.discard.push(inst);
  }
}

// A staggered (skip flag or Staggered intent's flag) or Control-locked enemy acts no further this turn or round.
function enemyHalted(combat, enemy) {
  return Boolean(enemy.skipNextTurn || S.getFlag(combat, enemy, 'skipTurn') || Control.controlRestrictions(combat, enemy).locked);
}

// One queued enemy move, as the round commit runs it. A move that is skipped this round does nothing.
// `landed` is the timeline's hit roll: a missed move does nothing, except a charging one, which still starts its
// charge (the charge is the enemy's action) and carries the miss to the payload it resolves later.
function enemyMoveAt(combat, enemy, moveId, { landed = true } = {}) {
  // A charge started this round takes the enemy's round: its later entries do not play (SPEC §4.6a). A charge from
  // an earlier round holds the enemy out of the queues, so a pendingMove here was started this round.
  if (enemy.pendingMove) return;
  const def = combat.registries.enemies.get(enemy.enemyId);
  const move = expandedEnemyMove(enemy, def.moves[moveId], moveId, combat);
  if (!landed && !move.delay) return;
  if (enemyHalted(combat, enemy)) {
    // A stagger that landed before the enemy's first move spends its round: dropping the queue makes
    // enemyPhase take its clearing branch. One that landed after the enemy acted keeps its flag for the next turn.
    if (!Rounds.enemyActedThisRound(combat, enemy.id)) delete combat.combatRounds.enemyQueues[enemy.id];
    return;
  }
  // Control action loss (Frozen, v2) is taken at the enemy's entry, as the live enemy phase takes it: one stack
  // per round. The enemy is then staggered for the round, so its later entries skip and its flag is spent.
  if (Control.consumeControlActionLoss(combat, enemy)) {
    enemy.skipNextTurn = true;
    delete combat.combatRounds.enemyQueues[enemy.id];
    return;
  }
  Rounds.markEnemyActed(combat, enemy.id);
  if (move.delay) {
    startDelayedMove(combat, enemy, move, moveId);
    if (!landed) enemy.pendingMove.missed = true;
  } else executeMovePayload(combat, enemy, move, moveId);
}

// The live helpers the adapter's commit calls (combatRoundsAdapter.js never imports this file).
function previewRoundOps(hand = []) {
  return {
    enemyTurnStart,
    enemyOwnerTurnStart,
    playCard: (c, intent, paid) => doPlayCard(c, intent, { prepaid: paid }),
    discardUnplayed: discardUnplayedCard,
    refund: refundQueuedCard,
    enemyMove: enemyMoveAt,
    drain: drainQueue,
    findEntity,
    reactionHand: () => hand,
    reactionAvailable: (c, entry, eligible) => eligible.map(rec => roundReactionOffer(c, rec.instanceId, entry)).filter(Boolean),
    liveCounterCovers: (c, entry) => liveCounterCovers(c, c.player, enemyAttackProfile(c, entry)),
    playReaction: playRoundReaction,
  };
}

// The Counter and Evade cards in hand the player may play as a reaction to an enemy attack in this commit
// (SPEC §4.10, §4.11). Each is a timeline record: its speed, its Stamina as SP, and its Mana. A card that is
// queued is not a reaction, and nothing is offered while reactions are off. Costs are read now, so the
// commit's first offer and each later pause see what the player can still pay (SPEC §4.11).
function roundReactionHand(combat) {
  const p = combat.player;
  if (!Reactions.usesReactions(combat) || p.reactionsEnabled === false || !p.alive || p.hp <= 0) return [];
  return combat.piles.hand.map(inst => roundReactionOffer(combat, inst.instanceId)).filter(Boolean);
}

// Why a card in hand cannot be played as a reaction right now, or null when it can. `entry` is the attack
// being answered (its coverage is checked by later steps); the commit's first offer has none.
function roundReactionRefusal(combat, instanceId, entry = null) {
  const p = combat.player;
  if (!p.alive || p.hp <= 0) return 'The player cannot react';
  if (Rounds.isQueued(combat, instanceId)) return `Card '${instanceId}' is queued, not a reaction`;
  const inst = combat.piles.hand.find(c => c.instanceId === instanceId);
  if (!inst) return `Card '${instanceId}' is not in hand`;
  const def = resolveCombatCard(combat, inst);
  const kind = Rounds.playerKind({ isAttack: false, effects: def.effects ?? [], maneuver: maneuverOf(def) });
  if (kind !== 'counter' && kind !== 'evade') return `'${def.name ?? inst.cardId}' is not a reaction card`;
  if (def.cost === 'X' || combat.registries.framework.isUnplayable(def)) return `'${def.name ?? inst.cardId}' cannot be played as a reaction`;
  if (entry && !Reactions.counterCoversAttack(combat, def, enemyAttackProfile(combat, entry))) return `'${def.name ?? inst.cardId}' does not cover this attack`;
  if (!Control.controlGate(combat, p, def).allowed) return `'${def.name ?? inst.cardId}' can no longer be played as a reaction: recover from the active control statuses first`;
  const costs = playCosts(combat, def, claimedCharges(combat, instanceId));
  if (costs.energy > p.energy) return `Not enough Stamina to play '${def.name ?? inst.cardId}' as a reaction`;
  if (costs.mana > p.mana) return `Not enough Mana to play '${def.name ?? inst.cardId}' as a reaction`;
  return null;
}

// The combat profile of the enemy attack a reaction answers, read as its live contact reads it (reach and
// targeting from expandedEnemyMove, camp, maneuver and school from the move's tags).
function enemyAttackProfile(combat, entry) {
  const enemy = combat.enemies.find(e => e.id === entry.actor);
  const move = combat.registries.enemies.get(enemy.enemyId).moves[entry.cardId];
  const expanded = expandedEnemyMove(enemy, move, entry.cardId, combat);
  return { ...combatProfileFor({ ...move, enemyId: enemy.enemyId, moveId: entry.cardId }), range: expanded.range, targeting: expanded.targeting };
}

// The reaction record of a card in hand, priced now, or null when it cannot be played as a reaction now.
function roundReactionOffer(combat, instanceId, entry = null) {
  if (roundReactionRefusal(combat, instanceId, entry)) return null;
  const inst = combat.piles.hand.find(c => c.instanceId === instanceId);
  const def = resolveCombatCard(combat, inst);
  const kind = Rounds.playerKind({ isAttack: false, effects: def.effects ?? [], maneuver: maneuverOf(def) });
  const costs = playCosts(combat, def, claimedCharges(combat, instanceId));
  const tags = Array.isArray(def.cardTags ?? def.tags) ? [...(def.cardTags ?? def.tags)] : [];
  return {
    id: inst.cardId, instanceId: inst.instanceId, name: def.name ?? inst.cardId, kind,
    speed: Rounds.cardSpeed(def, inst.cardId), target: 'self', sp: costs.stamina, mana: costs.mana,
    tags, stance: Rounds.stanceFor(kind, tags),
  };
}

// Plays a reaction card the player chose in a paused commit (SPEC §4.10 Play): its Stamina and Mana are
// paid now, as a queued card's are at queue time, and its live effects run before the attack resolves.
// A card that can no longer be paid for or played is refused before anything is paid.
function playRoundReaction(combat, instanceId, entry) {
  const p = combat.player;
  const refusal = roundReactionRefusal(combat, instanceId, entry);
  if (refusal) throw new Error(refusal);
  const inst = combat.piles.hand.find((c) => c.instanceId === instanceId);
  const def = resolveCombatCard(combat, inst);
  const costs = playCosts(combat, def, claimedCharges(combat, instanceId));
  p.energy -= costs.energy;
  if (costs.energy > 0) combat.emit('energySpent', { amount: costs.energy });
  p.mana -= costs.mana;
  if (costs.mana > 0) combat.emit('manaSpent', { amount: costs.mana });
  if (costs.stamina > 0) {
    p.counters.staminaSpentThisTurn = (p.counters.staminaSpentThisTurn || 0) + costs.stamina;
    combat.emit('staminaSpent', { amount: costs.stamina });
  }
  const attackerId = entry.actor;
  const targetId = needsEnemyTarget(def) ? attackerId : undefined;
  combat._reactionPlaying = true;
  try {
    doPlayCard(combat, { cardInstanceId: instanceId, ...(targetId ? { targetId } : {}) }, { prepaid: { energy: costs.energy, mana: costs.mana, stamina: costs.stamina } });
  } finally {
    delete combat._reactionPlaying;
  }
  combat.emit('combatRoundReaction', { cardInstanceId: instanceId, cardId: inst.cardId, against: attackerId, sourceId: p.id });
  drainQueue(combat);
}

// Offers the paused commit's reaction choice through the existing reaction modal (combat.pendingReaction).
function offerRoundReaction(combat, offer) {
  const id = `combatRound:${offer.attack.seq}`;
  combat.pendingReaction = {
    id, groupKey: id, ownerId: 'player', sourceId: offer.attack.attacker,
    options: offer.eligible.map((c) => ({
      id: c.instanceId, name: c.name, cardId: c.id, play: { cardInstanceId: c.instanceId },
      staminaCost: c.sp, manaCost: c.mana, choiceName: null,
    })),
  };
  combat.emit('combatReactionOffered', { offerId: id, ownerId: 'player', sourceId: offer.attack.attacker });
}

// The player's answer to a paused commit (chooseReaction). The reaction is validated first; a pick that is
// not on offer throws and changes nothing. Declining (optionId null) resolves the attack with no reaction.
function resumeCombatRound(combat, { offerId, optionId = null }) {
  const pending = combat.pendingReaction;
  if (!pending || pending.id !== offerId || pending.ownerId !== 'player') throw new Error('This reaction choice is unavailable');
  let pick = null;
  if (optionId !== null && optionId !== undefined) {
    const option = pending.options.find((o) => o.id === optionId);
    if (!option) throw new Error('Choose an available reaction card');
    pick = option.play.cardInstanceId;
  }
  const discardIds = Rounds.pausedDiscardIds(combat);
  const p = combat.player;
  const saved = p.reactionsEnabled;
  p.reactionsEnabled = false;
  let out;
  try {
    out = combatRoundTransaction(combat, () => Rounds.resumeRound(combat, previewRoundOps(), pick));
  } finally {
    if (saved === undefined) delete p.reactionsEnabled;
    else p.reactionsEnabled = saved;
  }
  combat.emit('combatReactionChosen', { offerId, ownerId: 'player', cardInstanceId: pick });
  delete combat.pendingReaction;
  if (out.paused) { offerRoundReaction(combat, out.offer); return; }
  if (combat.result) return;
  completeEndTurn(combat, discardIds);
}

// Runs one step of the round. An expanded fight already runs this inside dispatch's foundation transaction.
// A legacy fight is made atomic here, so a throw part way restores the pre-step state.
function combatRoundTransaction(combat, fn) {
  return combat.combatExpansionVersion === 2 ? fn() : atomicCommit(combat, fn);
}

// Commits the round at End Turn (SPEC §4.11). The player's reaction candidates are read first; then the
// live reaction flag is cleared while the round runs, so the live enemy moves never offer their own choice
// (the round offers the player's). Returns true when the commit pauses for a reaction.
function commitCombatRound(combat, discardIds) {
  const p = combat.player;
  const hand = roundReactionHand(combat);
  const saved = p.reactionsEnabled;
  p.reactionsEnabled = false;
  let out;
  try {
    out = combatRoundTransaction(combat, () => Rounds.commitRound(combat, previewRoundOps(hand), discardIds));
  } finally {
    if (saved === undefined) delete p.reactionsEnabled;
    else p.reactionsEnabled = saved;
  }
  if (out.paused) offerRoundReaction(combat, out.offer);
  return out.paused;
}

// Runs fn; if it throws, puts the fight's plain data back as it was. Identity is restored per position
// only: an object or array at the same key or index is refilled in place (the player, each enemy and the
// piles), anything else is put back as a copy, and triggerState (a Map) is replaced with a copy. The RNG
// is rolled back by its counters; functions, registries and the RNG object itself are not touched. The
// same structuredClone pattern as atomically() in combatRounds/timeline.js, on the whole fight.
function atomicCommit(combat, fn) {
  const isData = (k, v) => typeof v !== 'function' && k !== 'registries' && k !== 'rng';
  const saved = structuredClone(Object.fromEntries(Object.entries(combat).filter(([k, v]) => isData(k, v))));
  const counters = combat.rng.getCounters();
  try {
    return fn();
  } catch (err) {
    restoreInPlace(combat, saved, isData);
    combat.rng.restoreCounters(counters);
    throw err;
  }
}

function restoreInPlace(target, source, isData = () => true) {
  if (Array.isArray(target) && Array.isArray(source)) {
    for (let i = 0; i < source.length; i++) {
      const cur = target[i];
      if (cur && typeof cur === 'object' && source[i] && typeof source[i] === 'object' && Array.isArray(cur) === Array.isArray(source[i]) && !(cur instanceof Map)) restoreInPlace(cur, source[i]);
      else target[i] = source[i];
    }
    target.length = source.length;
    return;
  }
  for (const key of Object.keys(target)) if (isData(key, target[key]) && !(key in source)) delete target[key];
  for (const [key, value] of Object.entries(source)) {
    const cur = target[key];
    if (cur && value && typeof cur === 'object' && typeof value === 'object' && !(cur instanceof Map) && Array.isArray(cur) === Array.isArray(value)) restoreInPlace(cur, value);
    else target[key] = value;
  }
}

function finishAbilityPlay(combat) {
  const play = R.abilityResolved(combat);
  if (!play) return;
  const inst = play.instance;
  const def = resolveCombatCard(combat, inst);

  // Expanded Powers carry Exhaust; legacy Powers without it leave play.
  // The destination is the framework's call; this engine moves the card.
  if (!combat.result) {
    const destination = combat.registries.framework.afterPlayDestination(def);
    if (destination === 'EXHAUST_PILE') {
      combat.piles.exhaust.push(inst);
      combat.emit('cardExhausted', { cardInstanceId: inst.instanceId, cardId: inst.cardId, reason: 'played' });
    } else if (destination === 'HAND') {
      combat.piles.hand.push(inst); // Recall After Use (no shipped card carries it yet)
    } else if (destination !== 'REMOVED_FROM_PLAY') {
      combat.piles.discard.push(inst);
    }
    drainQueue(combat);
  }
}

function doEndTurn(combat, discardIds = []) {
  if (combat.phase !== 'player') throw new Error('Not the player turn');
  if (combat.combatRounds && discardIds.some((id) => Rounds.isQueued(combat, id))) throw new Error('Unqueue a card before discarding it');
  validateDiscardChoice(combat, discardIds);
  if (combat.combatRounds) {
    if (commitCombatRound(combat, discardIds)) return;
    if (combat.result) return;
  }
  completeEndTurn(combat, discardIds);
}

// The live end of the player's turn: the hand's end-turn rules, then the enemy phase.
function completeEndTurn(combat, discardIds) {
  endPlayerTurn(combat, discardIds);
  if (combat.result) return;
  enemyPhase(combat);
  if (Reactions.reactionPaused(combat)) return;
  if (combat.result) return;
  finishReactionPhase(combat);
}

function resumeEnemyTurn(combat) {
  if (combat.pendingAbilityDiscard || combat.reactionResume) return;
  if (!combat.reactionCursor) { drainQueue(combat); finishAbilityPlay(combat); return; }
  enemyPhase(combat);
  if (combat.result || Reactions.reactionPaused(combat)) return;
  finishReactionPhase(combat);
}

function finishReactionPhase(combat) {
  if (combat.reactionHandCleanup) {
    finishPlayerHand(combat, combat.reactionHandCleanup.preserveLockedHand);
    delete combat.reactionHandCleanup;
    if (combat.result) return;
  }
  rollIntents(combat); // (6) new intents rolled, then back to (2)
  startPlayerTurn(combat);
}

function doUseFlask(combat, { slot, chargeKind, targetId }) {
  if (combat.phase !== 'player') throw new Error('Flasks can only be used on the player turn');
  const p = combat.player;
  const chargeId = chargeFlaskId(combat.registries, chargeKind);
  const currentKey = chargeKind && `${chargeKind}Current`;
  if (chargeId && (!p.flaskCharges || p.flaskCharges[currentKey] <= 0)) throw new Error(`No ${chargeKind} flask charges`);
  const flask = chargeId ? { flaskId: chargeId } : p.flasks[slot];
  if (!flask) throw new Error(`No flask in slot ${slot}`);
  const def = combat.registries.flasks.get(flask.flaskId);
  let target = null;
  if (targetId != null) {
    target = findEntity(combat, targetId);
    if (!target || !target.alive) throw new Error(`Invalid target '${targetId}'`);
  } else if (def.targeted) {
    target = combat.enemies.find((e) => e.alive) || null;
  }
  if (chargeId) p.flaskCharges[currentKey] -= 1;
  else p.flasks.splice(slot, 1);
  combat.emit('flaskUsed', { flaskId: flask.flaskId, slot, targetId: target ? target.id : null });
  // Cracked Tear-style passives scale flask amounts (rounded up, SPEC §5.4).
  const amountMult = passiveMult(combat.registries, p.relicIds, 'flaskPowerMult', propertyMountsOf(combat, p));
  for (const eff of def.effects || []) {
    combat.enqueue({ effect: eff, source: p, owner: p, target, meta: amountMult !== 1 ? { amountMult } : {} });
  }
  drainQueue(combat);
}

// ---------------------------------------------------------------------------
// Previews — the SAME math the engine executes (SPEC §3.13, §4.2)
// ---------------------------------------------------------------------------

export function getEntity(combat, id) {
  return findEntity(combat, id);
}

/**
 * previewCard(combat, cardInstanceId, targetId?) → resolved numbers for UI:
 * {
 *   cardId, upgraded, name, type,
 *   cost,           // number, or the player's current energy for X-cost
 *   costIsX,
 *   needsTarget,    // true if any effect targets 'enemy' (UI must aim it)
 *   values: [ { op, token, value, hits?, status?, target?, perTarget? } ],
 *   tokens: { tokenName: number }   // for textTemplate substitution
 * }
 *
 * Damage values run through computeAttackDamage (attacker adds/mults +
 * defender mults when a target is given); block through computeBlockGain.
 * perTarget maps every living enemy's instance id → the damage it would take.
 */
export function previewCard(combat, cardInstanceId, targetId, upcastRanks) {
  if (combat.enemyKnowledge && !combat._knowledgePreview) {
    const visible = F.candidateState(combat);
    visible._knowledgePreview = true;
    for (const enemy of visible.enemies) if (!knowledgeIntentProjection(visible, enemy)?.exact) {
      enemy.intent = { kind: 'unknown', moveId: null };
      delete enemy.combatStance;
      delete enemy.combatCounter;
      delete enemy.pendingMove;
    }
    return previewCard(visible, cardInstanceId, targetId, upcastRanks);
  }
  const inst =
    combat.piles.hand.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.draw.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.discard.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.exhaust.find((c) => c.instanceId === cardInstanceId);
  if (!inst) throw new Error(`Unknown card instance '${cardInstanceId}'`);
  const def = resolveCombatCard(combat, inst, { upcastRanks });
  if (!combat._abilityPreparingPreview) {
    const clone = preparingPreview(combat, inst, def, targetId);
    clone._abilityPreparingPreview = true;
    return previewCard(clone, cardInstanceId, targetId, upcastRanks);
  }
  const p = combat.player;
  const isX = def.cost === 'X';
  const paidCosts = playCosts(combat, def);
  const shownCost = combat.combatExpansionVersion === 2 ? paidCosts.energy : isX ? p.energy : effectiveCost(combat, def);
  const target = targetId != null ? findEntity(combat, targetId) : null;
  const living = combat.enemies.filter((e) => e.alive);

  // Same action shape execution uses, so formulas resolve identically.
  const action = {
    source: p,
    owner: p,
    target: target || (needsEnemyTarget(def) ? living[0] || null : null),
    card: {
      abilityKind: abilityKindOf(def), abilityFamily: def.abilityFamily,
      sourceArmamentId: inst.sourceArmamentId || inst.weaponId,
      ratingId: inst.ratingId,
      ratingValue: inst.ratingValue,
      ratingCap: inst.ratingCap,
      equipmentRole: inst.equipmentRole,
      instanceId: inst.instanceId, cardId: inst.cardId, upgraded: inst.upgraded, ...(inst.rank > 1 ? { rank: inst.rank } : {}), ...(inst.skillBonus > 0 ? { skillBonus: inst.skillBonus } : {}), ...(inst.passiveBlock > 0 ? { passiveBlock: inst.passiveBlock } : {}),
      // The kind tag and the grip's derived tags, as the live play reads them
      // (above) — a preview that disagreed with the play would lie.
      type: cardKind(def), tags: def.cardTags ?? (def.tags?.length ? def.tags : undefined), attack: def.attack, sourceHand: inst.sourceHand,
      derivedTags: gripTags(gripOf(combat.registries, combat.loadout, combat.player.classId)),
      authoredTags: def.cardTags ?? (def.tags?.length ? def.tags : []),
      damageSchool: inst.damageSchool ?? def.damageSchool,
      ...(Number.isFinite(inst.magicShare ?? def.magicShare) ? { magicShare: inst.magicShare ?? def.magicShare } : {}),
      ...(typeof (inst.physicalDamageType ?? def.physicalDamageType) === 'string' ? { physicalDamageType: inst.physicalDamageType ?? def.physicalDamageType } : {}),
      exposureBuildupPerHit: inst.exposureBuildupPerHit ?? def.exposureBuildupPerHit,
      ...(def.cardRatingValues ? { cardRatingValues: def.cardRatingValues } : {}),
    },
    meta: { energySpent: isX ? p.energy : typeof shownCost === 'number' ? shownCost : 0 },
  };

  Object.assign(action.card, tacticalCarrier(def, action.card, combat, p));
  const bindings = computeTokenBindings(def.effects || []);
  const tokenByIndexField = new Map();
  for (const bd of bindings) tokenByIndexField.set(`${bd.index}:${bd.field}`, bd.token);

  const values = [];
  const tokens = {};
  const damageSequences = [];
  const charges = R.matchingAbilityCharges(p, action.card, { enemyAvailable: living.length > 0 });
  const chargedEffects = R.abilityChargedEffects(def.effects || [], charges, living.length > 0, combat);
  if (chargedEffects !== def.effects) {
    if (target && (!target.alive || target.kind !== 'enemy')) throw new Error('Buildup charge requires a living enemy target');
    action.target ||= living[0] || null;
  }
  const applied = new Set();
  const expandedPreviewTargets = new Map();
  const expandedPreview = (enemy, effectIndex) => {
    if (!expandedPreviewTargets.has(enemy.id)) {
      const used = new Set();
      const actions = chargedEffects.map((effect, index) => {
        const row = { effect, source: p, owner: p, target: enemy, card: action.card,
          meta: { ...R.beforeAbilityPlay(combat, p), energySpent: shownCost, abilityEffectIndex: index } };
        R.attachAbilityCharges(row, charges, used, combat);
        return row;
      });
      expandedPreviewTargets.set(enemy.id, previewExpandedActions(combat, actions, { source: p, target: enemy, carrier: action.card }));
    }
    const contacts = expandedPreviewTargets.get(enemy.id)[effectIndex].filter(contact => contact.id === enemy.id);
    const hitDamages = contacts.map(contact => contact.amount);
    return { damage: hitDamages[0] || 0, hits: hitDamages.length, hitDamages, totalDamage: hitDamages.reduce((sum, n) => sum + n, 0), avoidance: contacts[0]?.receipt?.avoidance };
  };
  // Preparation adds the charge once to the whole Counter. Its display belongs
  // to the first eligible contact, even if an earlier opcode has no contacts.
  const counterPreviews = new Map();
  const previewCounter = (resolvedTarget, index) => {
    const key = resolvedTarget?.id || null;
    if (!counterPreviews.has(key)) {
      const eligible = chargedEffects.map(effect => effect.op === 'damage'
        ? counterEffectPreview(combat, p, resolvedTarget, action.card, effect, { energySpent: shownCost }) : null);
      // Conditional text prints each branch's potential value, like other cards;
      // preparation and charge ownership still use only eligible branches.
      const replies = chargedEffects.map(effect => effect.op === 'damage'
        ? counterEffectPreview(combat, p, resolvedTarget, action.card, effect,
          { energySpent: shownCost }, { ignoreCondition: true }) : null);
      let bonusIndex = eligible.findIndex(reply => reply?.hits > 0);
      if (bonusIndex < 0) bonusIndex = chargedEffects.findIndex(effect => effect.op === 'damage');
      const bonus = Math.max(0, charges.damage + charges.damageEffect);
      counterPreviews.set(key, replies.map((reply, effectIndex) => {
        const hitDamages = Array.from({ length: reply?.hits || 0 }, () => reply.value);
        if (effectIndex === bonusIndex && bonus) {
          if (!hitDamages.length) hitDamages.push(0);
          hitDamages[0] += bonus;
        }
        return { damage: hitDamages[0] || 0, hitDamages,
          totalDamage: hitDamages.reduce((sum, amount) => sum + amount, 0) };
      }));
    }
    return counterPreviews.get(key)[index];
  };
  // One detached tactical timeline per prospective target for the whole card.
  // Damage effects execute in authored order, so later effects must see a
  // Counter, Guard, Ward, and rider budget spent by earlier contacts.
  const damagePreviewStates = new Map(living.map(enemy => [enemy.id, damagePreviewState(combat, enemy)]));
  chargedEffects.forEach((eff, i) => {
    if (typeof eff.op !== 'string') return;
    const authoredIndex = (def.effects || []).indexOf(eff);
    const entry = { op: eff.op, target: eff.target || null };
    const primary = firstResolvedTarget(combat, action, eff);
    action.effect = eff;
    action.meta = { energySpent: shownCost };
    R.attachAbilityCharges(action, charges, applied, combat);
    switch (eff.op) {
      case 'damage': {
        let attackTags = A.attackTagsFor(action, eff, combat.registries);
        const carrier = combat.foundation ? F.foundationCarrier(combat, p, action.card, eff.attack) : action.card;
        if (combat.foundation) {
          entry.sourceInstanceId = carrier.resolvedSource.id;
          entry.sourceName = carrier.resolvedSource.name || combat.registries.equipment.armaments.find((piece) => piece.id === carrier.resolvedSource.itemId)?.name || 'Attack source';
          entry.tags = carrier.tags;
          entry.inheritedTags = carrier.tags.filter((tag) => !attackTags.includes(tag));
          entry.sourceBuildup = structuredClone(carrier.resolvedSource.buildup || []);
          attackTags = carrier.tags;
        }
        const isCounterReply = action.card.combatProfile?.maneuver === 'counter';
        entry.hits = isCounterReply
          ? previewCounter(primary, i).hitDamages.length
          : evalPreview(combat, action, eff.hits != null ? eff.hits : 1, primary);
        entry.perTarget = {};
        entry.perTargetHitDamages = {};
        for (const e of living) {
          const result = isCounterReply
            ? previewCounter(e, i)
            : combat.combatExpansionVersion === 2 ? expandedPreview(e, i)
            : previewDamageHits(combat, p, e,
              evalPreview(combat, action, eff.amount, e) + (action.meta.abilityChargeDamage || 0) + (action.meta.abilityChargeDamageEffect || 0),
              attackTags, carrier, entry.hits, damagePreviewStates.get(e.id));
          entry.perTarget[e.id] = result.damage;
          entry.perTargetHitDamages[e.id] = result.hitDamages;
          if (primary?.id === e.id) Object.assign(entry, { value: result.damage,
            hitDamages: result.hitDamages, totalDamage: result.totalDamage });
        }
        if (entry.value == null && isCounterReply) {
          const result = previewCounter(primary, i);
          Object.assign(entry, { value: result.damage, hitDamages: result.hitDamages, totalDamage: result.totalDamage });
        } else if (entry.value == null) {
          const base = evalPreview(combat, action, eff.amount, primary) + (action.meta.abilityChargeDamage || 0) + (action.meta.abilityChargeDamageEffect || 0);
          entry.value = A.computeAttackDamage(combat, p, primary && primary.kind === 'enemy' ? primary : null, base, attackTags, carrier);
          entry.hitDamages = Array.from({ length: Math.max(0, Math.floor(entry.hits)) }, () => entry.value);
          entry.totalDamage = entry.hitDamages.reduce((sum, amount) => sum + amount, 0);
        }
        // An un-aimed face states the card's offensive amount. Target rows
        // retain exact mitigation for inspection and target previews.
        if (combat.combatExpansionVersion === 2 && !targetId && !isCounterReply) {
          const printedBase = evalPreview(combat, action, eff.amount, null) + (action.meta.abilityChargeDamage || 0) + (action.meta.abilityChargeDamageEffect || 0);
          entry.faceValue = A.computeAttackDamage(combat, p, null, printedBase, attackTags, carrier, { matchups: false, beforeDefense: true });
          // The face splits its amount as the contacts do: the card's own damage, then its rating bonus by category.
          entry.splitBase = Math.max(0, Math.floor(evalPreview(combat, action, eff.amount, null)));
          entry.ratingBonus = A.cardRatingDamage(combat, p, carrier, printedBase);
          entry.ratingPart = A.ratingBonusPart(combat, carrier);
          // The physical type the carrier resolved (a lending weapon, or a technique's wielded weapon) names the face's physical part.
          if (carrier.physicalDamageType) entry.physicalDamageType = carrier.physicalDamageType;
        }
        // #61 M5: when the aimed target's tag-scoped vulnerability matches
        // this hit's tags, name the matched row's tint so the hand can accent
        // the boosted number. Engine states the fact; display reads it.
        if (!isCounterReply && attackTags.length && primary && primary.kind === 'enemy') {
          for (const [sid, inst] of Object.entries(primary.statuses || {})) {
            if (!inst || (inst.meter ? inst.meter.value : inst.stacks) <= 0) continue;
            const sdef = combat.registries.statuses.get(sid);
            const tv = sdef && sdef.taggedVulnerability;
            if (tv && tv.tags.some((t) => attackTags.includes(t))) {
              entry.boostTint = sdef.tint || null;
              break;
            }
          }
        }
        break;
      }
      case 'block': {
        entry.value = A.computeBlockGain(combat, p, evalPreview(combat, action, eff.amount, primary) + (action.meta.abilityChargeBlock || 0), action.card);
        break;
      }
      case 'gainBarrier': {
        entry.value = A.computeBlockGain(combat, p, evalPreview(combat, action, eff.amount, primary) + (action.meta.abilityChargeBlock || 0), action.card);
        break;
      }
      case 'gainPoise':
      case 'gainWard': {
        entry.value = A.computeMeterGuardGain(combat, p, evalPreview(combat, action, eff.amount, primary), action.card);
        break;
      }
      case 'applyStatus': {
        entry.status = eff.status;
        entry.value = evalPreview(combat, action, eff.stacks != null ? eff.stacks : 1, primary) + (action.meta.abilityChargeBuildup || 0);
        break;
      }
      case 'heal':
        {
          const amount = evalPreview(combat, action, eff.amount, primary);
          entry.value = amount + cardRatingBonus(combat, p, action.card, 'heal', amount) + (action.meta.abilityChargeHeal || 0);
        }
        break;
      case 'buildup':
      case 'wardDamage':
      case 'loseHp':
      case 'draw':
      case 'discard':
      case 'removeStatus':
      case 'gainEnergy':
      case 'restoreMana':
      case 'restoreStamina':
      case 'poiseDamage':
      case 'addCinders': {
        entry.value = evalPreview(combat, action, eff.amount != null ? eff.amount : 1, primary);
        break;
      }
      case 'loseMaxHpPct': {
        entry.value = evalPreview(combat, action, eff.pct != null ? eff.pct : 0, primary);
        break;
      }
      case 'grantCardCharge': {
        for (const field of ['damage', 'manaDiscount', 'block', 'heal', 'break', 'buildup']) {
          const token = tokenByIndexField.get(`${authoredIndex}:${field}`);
          if (token) tokens[token] = Math.max(0, evalPreview(combat, action, eff[field], primary));
        }
        entry.value = null;
        break;
      }
      default:
        entry.value = null;
    }
    if (entry.value != null) {
      const valueField = eff.op === 'applyStatus' ? 'stacks' : eff.op === 'loseMaxHpPct' ? 'pct' : 'amount';
      const token = tokenByIndexField.get(`${authoredIndex}:${valueField}`);
      if (token) {
        entry.token = token;
        tokens[token] = entry.faceValue ?? entry.value;
        if (eff.op === 'damage' && entry.hitDamages?.length > 1
          && entry.hitDamages.some(amount => amount !== entry.hitDamages[0])) {
          const hitsToken = tokenByIndexField.get(`${authoredIndex}:hits`);
          if (hitsToken) damageSequences.push({ amountToken: token, hitsToken,
            hitDamages: entry.hitDamages, totalDamage: entry.totalDamage });
        }
      }
      const hitsToken = tokenByIndexField.get(`${authoredIndex}:hits`);
      if (hitsToken && entry.hits != null) tokens[hitsToken] = entry.hits;
    }
    values.push(entry);
  });

  return {
    resolvedDefinition: def, combatExpansionVersion: combat.combatExpansionVersion || 1,
    cardId: inst.cardId,
    upgraded: inst.upgraded,
    name: def.name,
    type: def.type,
    cost: shownCost,
    costIsX: isX,
    manaCost: paidCosts.mana,
    // Expanded badges and affordability use the same complete receipt as pay.
    staminaCost: combat.combatExpansionVersion === 2 ? paidCosts.stamina : shownCost,
    needsTarget: needsEnemyTarget({ ...def, effects: chargedEffects }),
    values,
    tokens,
    damageSequences,
  };
}

function firstResolvedTarget(combat, action, eff) {
  try {
    // 'randomEnemy' must not consume RNG in a preview — approximate with the
    // first living enemy for display purposes.
    const spec = eff.target === 'randomEnemy' ? 'allEnemies' : eff.target;
    const targets = A.resolveTargets(combat, action, spec);
    return targets[0] || null;
  } catch (e) {
    return null;
  }
}

// Previews share the exact execution evaluator (SPEC §3.5, §3.13).
function evalPreview(combat, action, value, target) {
  if (value == null) return 0;
  if (typeof value === 'number') return Math.floor(value);
  return evaluate(value, A.formulaCtxFor(combat, action, target));
}

/**
 * previewIntent(combat, enemyInstanceId) → live intent for the UI (SPEC §4.6):
 * { kind, moveId, damage, hits, hitDamages, totalDamage, block, delayed, pending }
 * Attack numbers include the enemy's attack modifiers and the player's
 * damage-taken modifiers, recomputed live through the same §4.2 math.
 */
export function previewIntent(combat, enemyInstanceId) {
  const enemy = findEntity(combat, enemyInstanceId);
  if (!enemy || enemy.kind !== 'enemy') throw new Error(`Unknown enemy instance '${enemyInstanceId}'`);
  const intent = enemy.intent || { kind: 'unknown', moveId: null };
  const profile = intent.combatProfile || {};
  const knowledge = knowledgeIntentProjection(combat, enemy);
  if (knowledge && !knowledge.exact) return knowledge.intent;
  const revealed = enemy.actorIntentRevealed || (enemy.intentReads ? enemy.intentReads[combat.playerKey] === true : enemy.intentRevealed !== false);
  if (!knowledge && !revealed && profile.camp && intent.kind !== 'staggered') return concealIntent(intent, profile);
  const out = { ...intent, profile, stance: combatIntentStance(intent, profile), revealed: true, hidden: false };
  // The armed payload is public only after this observer's read gate. This is
  // base counter damage, matching the inspector's prepared reaction value.
  if (out.stance === 'countering') {
    const counter = enemy.combatCounter;
    out.counterDamage = counter?.payload?.hp ?? counter?.damage ?? 0;
    out.counterPoiseDamage = counter?.payload?.poise ?? counter?.poiseDamage ?? 0;
  }
  if (intent.damage != null) {
    const damageSchool = combat.ratingsRules?.enemyAttackType?.[`${enemy.enemyId}:${intent.moveId}`];
    const move = expandedEnemyMove(enemy, combat.registries.enemies.get(enemy.enemyId).moves[intent.moveId], intent.moveId, combat);
    const effect = move?.effects?.find(e => e.op === 'damage');
    const carrier = { ...enemyMoveCarrier(enemy, move || {}, intent.moveId, combat), damageSchool: damageSchool && damageSchool !== 'auto' ? damageSchool : effect?.damageSchool || move?.damageSchool };
    Object.assign(out, previewDamageHits(combat, enemy, combat.player, intent.damage, carrier.tags, carrier,
      intent.hits != null ? intent.hits : 1));
  }
  out.pending = !!enemy.pendingMove;
  if (knowledge) {
    out.actionSerial = knowledge.actionSerial || enemy.knowledgeAction?.serial || 0;
    out.knowledgeRead = 'exact';
    out.label = intent.kind === 'staggered' ? 'Staggered' : enemy.knowledgeAction?.category;
  }
  return out;
}
