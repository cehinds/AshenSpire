import { previewEnemyAction } from './enemyActionPreview.js';
import { CORE2_ACTION_RULES_VERSION, core2ActionPolicyEnabled, core2MultiHitRulesEnabled } from '../model/core2ActionPolicy.js';
import { initializeCombatRange, assertRangeCardEnabled, quoteRangeActions, addRangeCosts, previewRangeRoutes, paidCounterRange, rangeCardSourceSnapshots } from './combatEngagement.js';
import { actorRangeKey, engagementBand, rangeBand, bandCap } from '../model/combatEngagement.js';
import { ownGameProfile } from '../model/ownedGameProfile.js';
import { gameProfileEnemyRatings } from '../model/gameProfileEnemy.js';
import { snapshotEnemyKnowledgeRules } from '../model/enemyKnowledgeRules.js';
import { decayAtTurnStart } from './statuses.js';
import { coreStatusPresentation } from '../model/statusPresentation.js';
import { startingWeaknesses } from './weaknesses.js';
import { seedElementStatuses } from './elementLightning.js';
import { scaleOwnElementActions } from './elementRules.js';
import { damageReceipt, fixCoreEnabled, snapshotFixCoreRules } from '../model/fixCoreMechanics.js';
import { initializeFormationOccupancy } from '../model/formationOccupancy.js';
import { proposalCardPlan, applyProposalPlan, proposalTurn, proposalRetained } from './proposalStatusRuntime.js';
import { beginEnemyBurdens, endEnemyBurdens, allowBurdenMove } from './enemyBurdens.js';
import { selectCardVariant } from './cardBehavior.js';
import { chooseZoneCards, hasCardChoice, returnHiddenCards } from './cardZones.js';
import { configuredCombat, configuredModule, setProfileStance, profileCardCosts, profileHandSize, profileFallbackDamage, freezeProfile } from './gameProfileCombat.js';
import { decayStanceRoundStart } from './combatMatchups.js';
import { previewCardAttackHit, previewTargetFor, precisionEntryGrant } from './stanceHit.js';
import { stanceStaminaCost, stanceManaCost, stanceEffectiveness, stanceEntryBonuses } from '../model/stanceRules.js';
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
import { settleExpandedPools, refreshExpandedLoadout, combatEquipmentPoolProjection } from './combatExpansionProjection.js';
import { counterPreviewAgainst } from './counterRule.js';
import { tacticalCarrier, counterEffectPreview, prepareTacticalCard, previewTacticalEffects, enqueueCounterWard, enemyMoveCarrier, expandedEnemyMove, primeEnemyCounter, enemyCounterDefensePrimed, wieldedArmament } from './combatCardTactics.js';
import { clearCombatCounter, startTacticalTurn, setCombatStance, prepareCombatEvade } from './combatMatchups.js';
import { damagePreviewState, previewDamageHits, previewPoiseDrain } from './combatDamagePreview.js';
import { hiddenIntentChance, concealIntent, combatIntentStance } from '../model/combatIntentVisibility.js';
import { initializeCombatKnowledge, rollEnemyKnowledge, knowledgeIntentProjection, predictEnemyIntent, cancelKnowledgeAction } from './enemyKnowledge.js';
import { proposalIntentRevealUntil } from '../model/proposalIntentReveal.js';
import { passiveMax, deepFreeze } from '../model/registries.js';
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
import { spellCardCostSurcharge } from '../model/combatCardProfile.js';
import * as R from './abilityRiders.js';
import { turnDrawCount, endTurnCardFate, validateDiscardChoice, applyDiscardChoice, returnUnplayedCards } from './handRules.js';
import { handRow, scaledCards } from '../model/handRules.js';
import { FALLBACK_HAND_MAX } from '../model/statRows.js';
import { cardRatingBonus, clearMeterGuards } from './combatRatings.js';
import { persistentWardMaximum, persistentPoiseMaximum } from '../model/combatRatings.js';
import * as F from './combatRules.js';
import * as Reactions from './combatReactions.js';
import * as Rounds from './combatRoundsAdapter.js';
import { clearEnemyReactionRolls } from './enemyReactions.js';
import { emitEvent, fireOwnerHooks, findEntity, hasEventTriggers } from './triggers.js';
import { attachSkillXp } from './skillXp.js';
import { configuredSkillProgression } from '../model/gameProfileProgression.js';
import { gameModule } from '../model/gameProfile.js';
import * as S from '../framework/statusSemantics.js';
import { resolveCard, passiveSum, passiveMult } from '../model/registries.js';
import { focusManaDiscount, applyFocusManaDiscount } from '../model/focusMana.js';
import { ownRestoreFunds, multiHitSpFloor } from '../model/actionCosts.js';
import { cardKind } from '../model/tree.js';
import { evaluate } from '../model/formulas.js';
import { computeTokenBindings } from '../model/validate.js';
import * as IntentProjection from './enemyIntentProjection.js';
import { createPlayerCombatEntity, createEnemyCombatEntity, stampPlayerPoiseMax, enemyMoveDamage } from '../model/state.js';
import { playerPoiseThresholdReceipt } from '../model/statProjection.js';
import { playerWeightClass } from '../model/combatWeight.js';
import { orderedDrawPile } from '../model/deckRules.js';
export { playerWeightClass };
import { canSwap, canEquip, cycleSet, equipPiece, ownership, swapCostFor, resolveSwapCostRule, createEquipmentProfileRuleSnapshot, runMods, EQUIPMENT_POOL_FIELDS, moveEquipmentPool, gripOf, gripTags } from '../model/loadout.js';
// Deck restamping goes through the framework's adopted composition door.
import { stampDeck, reconcileGrantedCardsInCombat } from '../framework/deckComposition.js';
import { limitEnemyIds } from '../model/combatLimits.js';
import { cardChoice, assertCardChoice } from '../model/cardChoices.js';
import { chargeFlaskId } from '../model/gracerefill.js';
import { syncConfiguredEnemyProperties, syncLoadoutProperties, syncRelicProperties, syncClassProperties, syncCompanionProperties, syncSigilProperties, propertyMountsOf } from './properties.js';

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
export function createCombat({
  registries, rng, player, enemyIds: requestedEnemyIds, enemyLevels = [], hpMult = 1, enemyStatuses = [], playerStatuses = [],
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
  swapCostRule = null, handRules = null, breakMeterVersion = null,
  knowledge = null, reactionRulesVersion, reactionRules = null,
  // SPEC §14.1 Play in deck order: read once by the caller (runCombat.js) and
  // carried on the fight as `orderedDraw`, so a saved fight keeps its rule.
  orderedDraw = false,
  combatExpansionVersion = 1, combatExpansionRules = null, combatKey = 'headless', gameProfile = null, rangePolicy = null,
}) {
  // Owner (2026-11-03): a combat never has more than 3 enemies (model/combatLimits.js).
  const enemyIds = limitEnemyIds(requestedEnemyIds);
  if (configuredCombat({ gameProfile })) {
    // Keep the existing orchestrator; new profile providers replace legacy v2 extras.
    combatExpansionVersion = 2;
    const reactions = configuredModule({ gameProfile }, 'reactions');
    reactionRulesVersion = reactions && reactions.chainLimit > 0 ? 2 : null;
  }
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
    ...(gameProfile ? { gameProfile: ownGameProfile(gameProfile, freezeProfile) } : {}),
    ...(combatExpansionVersion === 2 ? { combatExpansionVersion, combatKey,
      combatExpansionRules: structuredClone(combatExpansionRules || { matchups: combatExpansionMatchups, statuses: combatStatusRules, ashenBlight: ASHEN_BLIGHT_RULES, equipment: combatExpansionEquipment }),
      allocatedAttributes: structuredClone(player.allocatedAttributes || player.attributes || {}) } : {}),
    combatMatchupRules: structuredClone(registries.balance?.combatMatchups || combatMatchups),
    combatIntentRules: structuredClone(registries.balance?.combatIntent || combatIntent),
    ...(breakMeterVersion === 2 ? { breakMeterVersion: 2 } : {}),
    ...(handRules ? { handRules: structuredClone(handRules), pendingDiscardDraw: 0 } : {}),
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
    handMax: handRules ? scaledCards(handRow(handRules, 'handSize'), player.attributes, player.level) : FALLBACK_HAND_MAX,
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
  if (fixCoreEnabled(combat)) {
    combat.fixCoreRules = snapshotFixCoreRules(combat);
    // Stamp v2 only when the run's own profile carries the current rules; a run started on an older profile keeps v1.
    combat.core2ActionRulesVersion = Math.min(CORE2_ACTION_RULES_VERSION, gameModule(combat, 'effects')?.core2ActionRulesVersion ?? 1);
    if (combat.reactionRulesVersion === 2) combat.reactionRules.contactPolicy = 'perHit';
  }
  combat.emit = (type, payload) => emitEvent(combat, type, payload);
  combat._emitEvent = emitEvent;
  // The skill tracks listen to the same bus (plan phase 4a); the receipt they
  // write lives on the combat and reaches the run only through applySkillXp.
  if (!configuredCombat(combat) || configuredSkillProgression(combat)) attachSkillXp(combat);
  else combat.skillXp = {};
  combat.enqueue = (action) => combat.queue.push(action);
  combat.nextInstanceId = () => `gen${++combat._idCounter}`;
  if (combatExpansionVersion === 2) {
    if (!configuredCombat(combat)) Object.assign(combat.player, expandedEquipmentProjection(registries, combat.loadout, combat.player.classId, combat.combatExpansionRules.equipment));
    combat.player.ashenBlight = structuredClone(player.ashenBlight || createAshenBlightState());
    combat.player.attributes = structuredClone(player.attributes || {});
    combat.combatControlRestrictions = entity => Control.controlRestrictions(combat, entity);
    combat.player.combatExpansionVersion = 2;
    combat.player.baseResourceMaxima = structuredClone(player.baseResourceMaxima || { maxHp: player.maxHp, maxMana: player.maxMana || 0, maxStamina: player.maxStamina || player.energyMax || 0 });
    if (!configuredCombat(combat)) combat.attributes = settleExpandedPools(combat, combat.player).attributes;
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
        damageResistanceBySchool: def.damageResistanceBySchool, weaknesses: startingWeaknesses(combat, def),
        damageMult: enemyDamageMult,
      })
    );
    seedElementStatuses(combat, combat.enemies.at(-1), def); // Bedrock for an earth enemy, authored startStatuses (SPEC 4.7)
    if (combatExpansionVersion === 2 && !configuredCombat(combat)) Object.assign(combat.enemies.at(-1), expandedEnemyProjection(enemyId, combat.combatExpansionRules.equipment));
    combat.emit('enemySpawned', { targetId: `e${i + 1}`, enemyId });
  });

  initializeFormationOccupancy(combat);
  initializeCombatRange(combat, rangePolicy);
  if (knowledge) initializeCombatKnowledge(combat, knowledge);
  else if (fixCoreEnabled(combat)) initializeCombatKnowledge(combat, { rules: snapshotEnemyKnowledgeRules(registries) });
  if (configuredCombat(combat)) {
    combat.player.ratings = { ar: 0, dr: 0, pr: 0, ward: 0, poise: poiseMax, ...(player.ratings || {}) };
    combat.player.attributes = { ...(player.attributes || {}) };
    combat.player.ratingSources = structuredClone(player.ratingSources || combat.player.ratingSources || []);
    if (fixCoreEnabled(combat)) {
      combat.player.baseEvasionBonus = player.baseEvasionBonus || 0;
      combat.player.basePrecisionBonus = player.basePrecisionBonus || 0;
      for (const enemy of combat.enemies) {
        const definition = registries.enemies.get(enemy.enemyId);
        enemy.attributes = { ...(definition.attributes || {}) };
        enemy.baseEvasionBonus = definition.baseEvasionBonus || definition.evasionBonus || 0;
        enemy.basePrecisionBonus = definition.basePrecisionBonus || definition.precisionBonus || 0;
        enemy.ratings ||= { ar: definition.ar || 0, dr: definition.dr || 0, pr: 0,
          ward: definition.ward || definition.poiseMax || 0, poise: definition.poise || definition.poiseMax || 0 };
        Object.assign(enemy, gameProfileEnemyRatings(combat,enemy) || {});
      }
    }
  }
  syncConfiguredEnemyProperties(combat);
  if (combatExpansionVersion === 2) {
    for (const entity of [combat.player, ...combat.enemies]) {
      Control.initializePersistentWard(entity, configuredCombat(combat) && !fixCoreEnabled(combat) ? 0 : persistentWardMaximum(combat, entity));
      Control.initializePersistentPoise(entity, configuredCombat(combat) && !fixCoreEnabled(combat) ? 0 : persistentPoiseMaximum(combat, entity));
    }
  }
  // Deck → draw pile: shuffle (stream 'shuffle'), Innate cards to top (§4.1(1)).
  const deck = (configuredCombat(combat) && !configuredModule(combat, 'cards') ? [] : player.deck).map((c) => ({
    ...([1, 2].includes(combat.breakMeterVersion) ? { breakMeterVersion: combat.breakMeterVersion } : {}),
    instanceId: c.instanceId,
    cardId: c.cardId,
    upgraded: !!c.upgraded,
    ...(Array.isArray(c.upgradeSteps) && c.upgradeSteps.length ? { upgradeSteps: structuredClone(c.upgradeSteps) } : {}),
    ...(Number.isInteger(c.abilityRank) ? { abilityRank: c.abilityRank } : {}),
    ...(c.legacyAbility === true ? { legacyAbility: true } : {}),
    ...(c.abilityOfferId ? { abilityOfferId: c.abilityOfferId } : {}),
    ...(c.rewardReceiptId ? { rewardReceiptId: c.rewardReceiptId } : {}),
    ...(Number.isInteger(c.rank) && c.rank > 1 ? { rank: c.rank } : {}),
    ...(Number.isInteger(c.skillBonus) && c.skillBonus > 0 ? { skillBonus: c.skillBonus } : {}),
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
  const isInnate = (card) => configuredCombat(combat)
    ? (resolveCombatCard(combat, card).keywords || []).includes('innate')
    : registries.framework.isInnate(resolveCard(registries, card));
  if (orderedDraw) {
    // In deck order, and no `shuffle` value is consumed (SPEC §14.1).
    combat.orderedDraw = { order: deck.map((card) => card.instanceId) };
    combat.piles.draw = orderedDrawPile(deck, isInnate);
  } else {
    combat.piles.draw = orderedDrawPile(rng.shuffle('shuffle', deck), isInnate);
  }

  if (combatExpansionVersion === 2 && !configuredCombat(combat)) {
    refreshExpandedLoadout(combat, combat.player, { refreshPoise: false });
    const entry = Blight.rollAshenBlightEncounter(combat, combat.player, combatKey);
    if (entry.terminal) { combat.turn = 1; combat.player.alive = false; combat.player.hp = 0; combat.phase = 'ended'; combat.result = 'defeat'; combat.emit('ashenBlightLost', { targetId: combat.player.id, reason: 'encounter' }); return combat; }
  }
  if (configuredCombat(combat)) {
    combat.handMax = profileHandSize(combat);
    combat.gameProfileCommands = 0;
    if (!configuredModule(combat, 'stances')) for (const entity of [combat.player, ...combat.enemies]) entity.combatStance = { maneuver: 'neutral' };
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
    const group = action.meta?.expansionGroup;
    if (action.effect?.op === 'completeCombatAction' && !action.meta?.contactCompletion
      && action.source?.kind === 'enemy' && group?.enemyMoveStart) {
      // The head forecast has been spent. A follow-up replaces it through
      // presentIntent; a reaction pause on another actor must not revive it.
      if (!group.enemyMoveStart.reaction) consumeEnemyIntent(combat, action.source, group.enemyMoveStart.moveId);
    }
    if (hasCardChoice(combat)) return;
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
  returnHiddenCards(combat);
  if (!fixCoreEnabled(combat)) decayStanceRoundStart(combat);
  clearEnemyReactionRolls(combat);
  combat.phase = 'player';
  const p = combat.player;
  decayAtTurnStart(combat, p);
  R.beginAbilityTurn(p);
  delete p.combatRetainedCards;
  p.counters.cardsPlayedThisTurn = 0;
  const eqcfg = combat.registries.balance.equipment || {};
  combat.swapsLeft = eqcfg.swapCostKind === 'allowance' ? eqcfg.swapAllowancePerTurn || 0 : 0;

  // (2) Lose all block — unless modified (generic 'retainBlock' modifier;
  // a 'blockCap' modifier clamps what is kept).
  if (!S.getFlag(combat, p, 'retainBlock')) {
    p.block = Math.min(p.block, Math.max(proposalRetained(combat,p),passiveMax(combat.registries, p.relicIds, 'retainBlockUpTo', propertyMountsOf(combat, p))));
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
    const protection = startTacticalTurn(combat, p);
    if (protection.block) A.gainBlock(combat, p, protection.block, { skipRatingBonus: true, logSource: 'defendStance' });
    if (protection.barrier) A.gainBarrier(combat, p, protection.barrier, { skipRatingBonus: true, logSource: 'defendStance' });
    Blight.beginAshenBlightCycle(combat, p, String(p.combatOwnerCycle));
  }

  // Set energy to base (relics that add energy hook playerTurnStart) — less
  // what a Stagger took (plan phase 8): the loss is owed to the next turn only.
  p.energy = Math.max(0, p.energyMax - (p.pendingActionLoss || 0));
  if (configuredCombat(combat)) {
    combat.gameProfileCommands = 0;
    const resources = configuredModule(combat, 'resources');
    if (!resources?.include?.includes('sp')) p.energy = 0;
    if (resources?.manaPerTurn) p.mana = Math.min(p.maxMana, p.mana + resources.manaPerTurn);
  }
  combat.equipmentPoolDeficits.stamina = p.energyMax - p.energy;
  p.pendingActionLoss = 0;

  // Draw.
  A.drawCards(combat, Math.max(1, turnDrawCount(combat) - (combat.combatExpansionVersion === 2 && combat.turn === 1 ? (Blight.ashenBlightBonuses(p).openingHandPenalty || 0) : 0)));

  // playerTurnStart triggers + owner-relative status/stance hooks.
  combat.emit('playerTurnStart', { turn: combat.turn });
  proposalTurn(combat,p,'start');
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
  proposalTurn(combat,p,'end');
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

  // Stamina refills at turn start.
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
  decayAtTurnStart(combat, enemy);
  if (fixCoreEnabled(combat)) {
    // A Poise break (Staggered stance) took SP from this turn's pool; it is owed once.
    enemy.fixCoreStaminaRemaining = Math.max(0, (enemy.maxStamina ?? Rounds.enemyPool(combat.registries.enemies.get(enemy.enemyId))) - (enemy.pendingStaminaLoss || 0));
    if (core2ActionPolicyEnabled(combat)) enemy.stamina = enemy.fixCoreStaminaRemaining;
    enemy.pendingStaminaLoss = 0;
  }
  beginEnemyBurdens(combat,enemy,Rounds.enemyPool(combat.registries.enemies.get(enemy.enemyId)));
  Reactions.revealActor(combat, enemy);
  proposalTurn(combat,enemy,'start');
  fireOwnerHooks(combat, enemy, 'ownerTurnStart');
  drainQueue(combat);
  if (combat.result || !enemy.alive) return;
  if (combat.combatExpansionVersion === 2) {
    Control.recoverStatusesAtOwnerStart(combat, enemy, { cycle: enemy.combatOwnerCycle });
    Control.sleepRestoration(combat, enemy);
  }
}

function consumeEnemyIntent(combat, enemy, moveId = enemy.intent?.moveId) {
  // A held delayed payload is still next, even on a turn with no action.
  if (enemy.pendingMove || !enemy.intent || enemy.intent.kind === 'staggered'
    || enemy.intent.resolved || enemy.intent.moveId !== moveId) return;
  enemy.intent.resolved = true;
  combat.emit('enemyMoveEnded', { sourceId: enemy.id, moveId });
}

// Owner 2026-11-06: when an enemy loses SP during its own turn (a Poise break, a weakness, a reaction), the right-most
// planned move leaves the plan first, as visible feedback, until the rest fits the SP it has left. Nothing is
// re-picked and no RNG is drawn; each move is priced alone (enemyMoveQuote), as execution prices it.
export function trimEnemyPlanDuringTurn(combat, enemy) {
  if (!core2ActionPolicyEnabled(combat) || !enemy.alive || enemy.pendingMove || !enemy.plannedMoves?.length) return;
  const def = combat.registries.enemies.get(enemy.enemyId);
  // Only a real SP loss trims: the SP the enemy was due to have after its last move (payment and Advance) must have dropped
  // (a Poise break, a weakness, a reaction). A shortfall without one (the range changed) stays what it was, a refusal
  // at act time, so the moves that play are exactly the ones that played before this trim existed.
  let paidLeft = null;
  for (let i = combat.eventLog.length - 1; i >= 0; i--) {
    const row = combat.eventLog[i];
    if (row.type === 'enemyTurnStart') break;
    if (row.type === 'enemyStaminaSpent' && row.sourceId === enemy.id) { paidLeft = row.expectedLeft ?? row.remaining; break; }
  }
  if (paidLeft == null || Rounds.enemyAvailableSp(enemy) >= paidLeft) return;
  // trimEnemyPlan prices the plan in order against a detached projected range state (a move that closes the distance
  // makes the next one cheaper) from a pool; the pool here is what the enemy has left now.
  const left = { ...enemy, maxStamina: Rounds.enemyAvailableSp(enemy), pendingStaminaLoss: 0 };
  const before = enemy.plannedMoves, ids = rows => rows.map(row => row.moveId).join(',');
  const kept = [...before], dropped = [];
  // Right-most first: shorten the plan until the whole remaining prefix is affordable as quoted in sequence.
  while (kept.length && ids(Rounds.trimEnemyPlan(left, def, kept, { combat })) !== ids(kept)) dropped.unshift(kept.pop().moveId);
  if (!dropped.length) return;
  // The plan is the tail of movesHistory: drop the same moves there so maxConsecutive sees what will play.
  const history = enemy.movesHistory;
  const start = history?.length - before.length;
  if (history && start >= 0 && ids(before) === history.slice(start).join(',')) history.splice(start, before.length, ...kept.map(row => row.moveId));
  enemy.plannedMoves = kept;
  combat.emit('enemyPlanTrimmed', { sourceId: enemy.id, dropped, remaining: kept.map(row => row.moveId) });
}

function enemyPhase(combat) {
  if (!combat.reactionCursor) {
    combat.phase = 'enemy';
    delete combat.followTrace;
    enemyTurnStart(combat);
    if (combat.result) return;
  }
  const cursor = combat.reactionCursor || { index: 0, stage: 'start' };
  if (Reactions.usesReactions(combat)) combat.reactionCursor = cursor;
  for (; cursor.index < combat.enemies.length; cursor.index++, cursor.stage = 'start') {
    const enemy = combat.enemies[cursor.index];
    if (combat.result) return;
    if (!enemy.alive) continue;
    if (cursor.stage === 'start') {
      // Owner-relative turn-start hooks (DoT ticks etc.).
      enemyOwnerTurnStart(combat, enemy);
      if (combat.result) return;
      if (!enemy.alive) continue;
      cursor.stage = 'payload';
    }
    if (cursor.stage === 'payload') {
    cursor.stage = 'drain';
    if (enemy.skipNextTurn || S.getFlag(combat, enemy, 'skipTurn') || Control.controlRestrictions(combat, enemy).locked || Control.consumeControlActionLoss(combat, enemy)) {
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
        const spPayment = enemy.pendingMove.spPayment;
        enemy.pendingMove = null;
        executeMovePayload(combat, enemy, move, moveId, { spPayment });
      }
      // else: still charging (delay.turns > 1) — the enemy does nothing.
    } else if (enemy.intent && enemy.intent.moveId) {
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
    consumeEnemyIntent(combat, enemy);
    trimEnemyPlanDuringTurn(combat, enemy);

    // Normal combat (SPEC §4.6, owner 2026-10-12): the rest of the enemy's planned pool plays in order after its head.
    // Each move leaves the plan before it runs, so a reaction pause resumes at the next planned move.
    while (enemy.alive && enemy.planDue && !enemy.pendingMove && enemy.plannedMoves?.length) {
      // A stagger or Control lock that landed during this turn ends it: a staggered enemy plays none of its plan
      // that turn (SPEC §4.6a), and keeps the rest of it, as the turn-start stagger branch above does.
      if (enemyHalted(combat, enemy)) { enemy.planDue = false; break; }
      const next = enemy.plannedMoves.shift();
      const def = combat.registries.enemies.get(enemy.enemyId);
      presentIntent(combat, enemy, def, next.moveId);
      // The UI's "?" row (SPEC §4.6a): this follow-up's own read, rolled once by presentIntent, and what became of it.
      // No move id: a failed read must leave nothing about the move in state.
      const traced = { read: perceptionRead(combat, enemy), outcome: 'played' };
      ((combat.followTrace ||= {})[enemy.id] ||= []).push(traced);
      const move = expandedEnemyMove(enemy, def.moves[next.moveId], next.moveId, combat);
      if (move.delay) {
        enemy.plannedMoves = [];
        traced.outcome = 'charging';
        startDelayedMove(combat, enemy, move, next.moveId);
      } else {
        traced.outcome = executeMovePayload(combat, enemy, move, next.moveId) || 'played';
      }
      drainQueue(combat);
      if (Reactions.reactionPaused(combat)) return;
      if (combat.result) return;
      consumeEnemyIntent(combat, enemy);
      trimEnemyPlanDuringTurn(combat, enemy);
    }
    if (enemy.plannedMoves?.length === 0) enemy.planDue = false;

    // Owner-relative turn-end hooks, then decay (perTurnEnd statuses the
    // player applied to an enemy tick down at the ENEMY's turn end).
    if (enemy.alive) {
      endEnemyBurdens(combat,enemy);
      proposalTurn(combat,enemy,'end');
      fireOwnerHooks(combat, enemy, 'ownerTurnEnd');
      drainQueue(combat);
      if (combat.result) return;
      if (enemy.alive) S.decayAtTurnEnd(combat, enemy);
      if (combat.combatExpansionVersion === 2) Control.endControlTurn(combat, enemy);
    }
  }

  combat.emit('enemyTurnEnd', { turn: combat.turn });
  drainQueue(combat);
  delete combat.reactionCursor;
}

// Commit turn of a delayed move: telegraph stays, do the whileCharging part now, resolve the real
// payload on a later enemy turn.
function startDelayedMove(combat, enemy, move, moveId) {
  let spPayment;
  if (core2ActionPolicyEnabled(combat)) {
    const quote = Rounds.enemyMoveQuote(move, { enemy, moveId, combat });
    if (!Rounds.commitEnemySp(combat, enemy, moveId, quote.totalSp)) return 'refused';
    spPayment = { sp: quote.sp, advanceSp: quote.advanceSp, totalSp: quote.totalSp };
  }
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
  const chargingActions = (wc.effects || []).map(effect => ({ effect, source: enemy, owner: enemy,
    target: combat.player, card: carrier, meta: { moveId, preparing: true } }));
  // Keep charging damage, statuses and generated pressure on one hit receipt.
  if (chargingActions.length) enqueueExpandedAction(combat, chargingActions, { source: enemy, target: combat.player, carrier });
  enemy.pendingMove = {
    moveId,
    resolveOnTurn: combat.turn + (move.delay.turns != null ? move.delay.turns : 1),
    ...(spPayment ? { spPayment } : {}),
  };
  if (enemy.intent?.moveId === moveId) enemy.intent = { ...enemy.intent, pending: true };
}

// Enqueue a move's payload as ordinary actions (SPEC §3.9: only executed
// actions mutate). Order: damage hits, block, then effects.
// 'enemyMoveStarted' marks the acting enemy so the UI can pace playback
// one actor at a time (SPEC §7.4); content triggers may also key off it.
function executeMovePayload(combat, enemy, move, moveId, { spPayment } = {}) {
  const prepaid = core2ActionPolicyEnabled(combat) && spPayment;
  const spCost=prepaid ? spPayment.sp : Rounds.enemyMoveSp(move,{enemy,moveId,combat});
  move = expandedEnemyMove(enemy, move, moveId, combat);
  const carrier = enemyMoveCarrier(enemy, move, moveId, combat);
  const actions = enemyMoveActions(combat, enemy, move, moveId, carrier);
  const rangeQuote = quoteRangeActions(combat, enemy, actions, { route: 'advance', preview: true });
  const totalSp = spCost + (rangeQuote?.advanceSp || 0);
  if (fixCoreEnabled(combat)) {
    const available=core2ActionPolicyEnabled(combat) ? Rounds.enemyAvailableSp(enemy) : enemy.fixCoreStaminaRemaining ?? enemy.maxStamina ?? Rounds.enemyPool(combat.registries.enemies.get(enemy.enemyId));
    const required = prepaid ? Math.max(0, (rangeQuote?.advanceSp || 0) - spPayment.advanceSp) : totalSp;
    if(!prepaid && required>available && rangeQuote?.advanceSp > 0) {
      const def = combat.registries.enemies.get(enemy.enemyId), closingId = def.rangeClosingMove, closing = def.moves[closingId];
      const closingEligible = !core2ActionPolicyEnabled(combat) || (!closing?.reaction && (!closing?.locked || enemy.unlockedMoves.includes(closingId)));
      if (closingEligible && closing && closingId !== moveId && closing.effects?.some(effect => effect.op === 'moveEngagement') && Rounds.enemyMoveSp(closing,{enemy,moveId:closingId,combat}) <= available) return executeMovePayload(combat, enemy, closing, closingId);
    }
    if(required>available) {combat.emit('enemyMoveUnavailable',{sourceId:enemy.id,moveId,required,available,resource:'sp'});return 'refused';}
    enemy.fixCoreStaminaRemaining=available-(prepaid ? required : spCost);
    enemy.stamina=enemy.fixCoreStaminaRemaining;
    // Owner 2026-11-06: the enemy visibly pays its move's SP before the move plays (the UI floats it and updates the SP meter).
    // The receipt covers the whole payment, the Advance surcharge included (acceptRangeActions deducts it with no receipt of
    // its own), so the amount and the SP left shown match enemy.fixCoreStaminaRemaining once the move has resolved.
    const paid = prepaid ? required : totalSp;
    if (paid > 0) combat.emit('enemyStaminaSpent', { sourceId: enemy.id, moveId, amount: paid, remaining: available - paid, expectedLeft: available - paid });
    if (prepaid && combat.rangeState) {
      // The charge already paid its accepted price. Retain that payment when
      // it lands; only a newly required Advance surcharge is charged above.
      carrier.rangePlan = quoteRangeActions(combat, enemy, actions, { route: 'advance' });
      carrier.rangePlan.paid = { energy: spPayment.totalSp + required, stamina: spPayment.totalSp + required, mana: 0 };
    }
  }
  if (!allowBurdenMove(combat,enemy,spCost,move)) return 'blocked';
  // movesHistory records ROLLS (maxConsecutive reads it); a roll a stagger
  // cancels never happens. This is what did — the inspector's history.
  const start = { sourceId: enemy.id, enemyId: enemy.enemyId, moveId, kind: move.intent,
    actionPreview: { ...previewEnemyAction(combat, enemy, moveId), spCost, totalSp } };
  if (!Reactions.usesReactions(combat)) {
    (enemy.performedMoves ||= []).push(moveId);
    combat.emit('enemyMoveStarted', start);
  }
  carrier.rangeQuotedPlan = rangeQuote;
  carrier.rangeBaseCosts = { energy: spCost, stamina: spCost, mana: 0 };
  const group = enqueueExpandedAction(combat, actions, {
    source: enemy, target: combat.player, carrier,
  });
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
  return scaleOwnElementActions(combat, enemy, carrier, actions, combat.registries.enemies.get(enemy.enemyId)); // own-element x1.25 (SPEC 4.7)
}

// ---------------------------------------------------------------------------
// Enemy move selection — weighted state machine + maxConsecutive (SPEC §4.6)
// ---------------------------------------------------------------------------

function rollIntents(combat, isFirstTurn = false) {
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
    // The head of the plan, whose picks were recorded when planned (the pool plays all of it).
    const moveId = Rounds.takePlannedMove(combat, enemy, def, { isFirstTurn, pick: (e, d, maxSp, pricing = combat) => weightedMovePick(pricing, e, d, maxSp) });
    if (moveId == null) {
      enemy.intent = { kind: 'unknown', moveId: null };
      continue;
    }
    presentIntent(combat, enemy, def, moveId);
    // The pool's planned moves play after the head in the enemy phase (enemyPhase), so the plan is due this turn.
    enemy.planDue = true;
    drainQueue(combat);
  }
}

// Core 2 commitment (SPEC §4.6, owner 2026-11-02): the plan rolled at the start of the player's turn is what the enemy
// plays. What the player does can still make part of it impossible (a Poise break or a weakness takes the enemy's SP, a
// range change adds an Advance surcharge), so after each player action the committed plan is re-quoted and trimmed,
// and the shown intent follows at once instead of the enemy refusing or swapping the move silently at act time.
// Nothing is re-picked: dropped moves leave the plan (and movesHistory), and no enemyAI roll is drawn.
function revalidateEnemyPlans(combat) {
  if (combat.phase !== 'player' || !core2ActionPolicyEnabled(combat)) return;
  for (const enemy of combat.enemies) {
    const head = enemy.intent;
    if (!enemy.alive || !enemy.planDue || enemy.pendingMove || enemy.skipNextTurn || !head?.moveId || head.resolved) continue;
    const def = combat.registries.enemies.get(enemy.enemyId);
    const before = [{ moveId: head.moveId }, ...(enemy.plannedMoves ?? [])];
    const kept = Rounds.trimEnemyPlan(enemy, def, before, { combat });
    const ids = rows => rows.map(row => row.moveId).join(',');
    if (ids(kept) === ids(before)) { enemy.plannedMoves = kept.slice(1); continue; }
    // The plan is the tail of movesHistory (each pick was recorded when made): rewrite it so maxConsecutive sees what will play.
    const history = enemy.movesHistory, start = history.length - before.length;
    if (start >= 0 && ids(before) === history.slice(start).join(',')) history.splice(start, before.length, ...kept.map(row => row.moveId));
    enemy.plannedMoves = kept.slice(1);
    if (kept[0]?.moveId === head.moveId) continue;
    delete enemy.actorIntentRevealed;
    if (!kept.length) {
      clearCombatCounter(enemy);
      delete enemy.intentRevealed;
      enemy.intent = { kind: 'unknown', moveId: null };
      enemy.planDue = false;
      continue;
    }
    presentIntent(combat, enemy, def, kept[0].moveId);
    drainQueue(combat);
  }
}

// Shows a move as the enemy's intent: its box, stance, visibility roll and counter priming. The head of a turn and
// each follow-up that plays both go through here, so a revealed follow-up reads like the first move.
function presentIntent(combat, enemy, def, moveId) {
  clearCombatCounter(enemy);
  enemy.intent = buildIntent(def.moves[moveId], moveId, enemy, combat);
  if (combat.enemyKnowledge) {
    rollEnemyKnowledge(combat, enemy, { charging: !!def.moves[moveId].delay });
    delete enemy.intentRevealed;
  } else if (enemy.intent.combatProfile.camp) {
    // A configured profile whose intent module reads `exact` (the Core preview route, owner, 2026-10-18) shows every
    // intent and skips the hidden-intent roll. `enemyIntentVisibility` is its own rng stream, so not drawing it moves
    // no other roll. The profile is frozen into the fight and its save, so a saved fight keeps this rule.
    enemy.intentRevealed = configuredModule(combat, 'intent')?.reads === 'exact'
      ? true
      : combat.rng.float('enemyIntentVisibility') >= hiddenIntentChance(combat.attributes || {}, combat.combatIntentRules || {});
  } else delete enemy.intentRevealed;
  primeEnemyCounter(combat, enemy, def.moves[moveId], moveId);
}

// The weighted pick (SPEC §4.6). `maxSp` is the SP left in the enemy's pool: a move that costs more is not picked
// (owner decision, 2026-10-12). Infinity offers every move (the minimum-one fallback).
// Reaction moves (docs/combat-card-traits-contract.md, "Enemy reactions") are never rolled: they are dropped before any
// weighting, maxConsecutive or pattern indexing.
function weightedMovePick(combat, enemy, def, maxSp = Infinity) {
  const policy = core2ActionPolicyEnabled(combat);
  const closingId = def.rangeClosingMove, closing = def.moves[closingId];
  const canClose = policy && !closing?.reaction && (!closing?.locked || enemy.unlockedMoves.includes(closingId))
    && closing?.effects?.some(effect => effect.op === 'moveEngagement')
    && Rounds.enemyMoveQuote(closing, { enemy, moveId: closingId, combat }).totalSp <= maxSp;
  const replacements = new Map();
  // A retreat (a move with its own retreatWeight) is offered only while the fight is closer than the enemy
  // prefers; maxConsecutive keeps it from repeating back to back, so the player is not chased out of reach forever.
  const wantsDistance = policy && combat.rangeState?.policy.enabled && def.startingRange !== undefined
    && engagementBand(combat.rangeState, actorRangeKey(combat, enemy), actorRangeKey(combat, combat.player)) < Math.min(rangeBand(def.startingRange), bandCap(combat.rangeState.policy));
  const entries = Object.entries(def.moves).filter(
    ([id, mv]) => {
      if (mv.retreatWeight != null && !wantsDistance) return false;
      if (mv.reaction || (mv.locked && !enemy.unlockedMoves.includes(id))) return false;
      if (!policy) return Rounds.enemyMoveSp(mv, { enemy, moveId: id, combat }) <= maxSp;
      const quote = Rounds.enemyMoveQuote(mv, { enemy, moveId: id, combat });
      if (quote.totalSp <= maxSp) return true;
      // Preserve the authored attack choice when only its approach is too
      // expensive. Commit its owned, affordable closing move in the forecast,
      // rather than filtering the attack before AI weighting can choose it.
      if (canClose && quote.sp <= maxSp && quote.advanceSp > 0) {
        replacements.set(id, closingId);
        return true;
      }
      return false;
    }
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

  const weightOf = mv => mv.retreatWeight ?? mv.weight;
  const total = pool.reduce((acc, [, mv]) => acc + weightOf(mv), 0);
  if (total <= 0) return replacements.get(pool[0][0]) ?? pool[0][0];
  let r = combat.rng.float('enemyAI') * total;
  for (const [id, mv] of pool) {
    r -= weightOf(mv);
    if (r < 0) return replacements.get(id) ?? id;
  }
  const last = pool[pool.length - 1][0];
  return replacements.get(last) ?? last;
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
  if (combat.gameProfile) freezeProfile(combat.gameProfile);
  if (configuredCombat(combat)) {
    combat.emit = (type, payload) => combat._emitEvent(combat, type, payload);
    if (configuredSkillProgression(combat)) attachSkillXp(combat);
  }
  if (!combat._foundationTransaction && (configuredCombat(combat) || combat.combatExpansionVersion === 2 || ['playCard', 'chooseDiscard', 'chooseCards'].includes(intent.type))) return F.foundationTransaction(combat, (candidate) => dispatch(candidate, intent), { advanceAction: ['chooseDiscard','chooseCards'].includes(intent.type) ? !combat.reactionResume : !['predictIntent', 'chooseReaction', 'setReactions'].includes(intent.type) });
  if (combat.result) throw new Error('Combat is over');
  combat._buffer = [];
  try {
    if (combat.pendingReaction && intent.type !== 'chooseReaction') throw new Error('Answer the pending reaction first');
    if (!['chooseDiscard','chooseCards'].includes(intent.type)) R.assertNoAbilityChoice(combat);
    switch (intent.type) {
      case 'setReactions':
        Reactions.setReactionsEnabled(combat, combat.player, intent.enabled);
        break;
      case 'chooseReaction':
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
        break;
      }
      case 'chooseCards':
        chooseZoneCards(combat, intent.cardInstanceIds);
        drainQueue(combat);
        finishAbilityPlay(combat);
        if (Reactions.restoreReactionQueue(combat) || combat.reactionCursor) resumeEnemyTurn(combat);
        break;
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
      case 'basicAttack': {
        if (!configuredCombat(combat) || configuredModule(combat, 'cards')) throw new Error('Basic attack fallback is unavailable');
        if (combat.phase !== 'player') throw new Error('Not your turn');
        const target = combat.enemies.find(enemy => enemy.id === intent.targetId && enemy.alive);
        if (!target) throw new Error('Choose a living enemy');
        const carrier = { combatProfile: { maneuver: 'attack', camp: 'physical' } };
        setProfileStance(combat, combat.player, carrier);
        A.applyAttackDamage(combat, combat.player, target, profileFallbackDamage(combat), [], carrier);
        drainQueue(combat);
        if (!combat.result) doEndTurn(combat);
        break;
      }
      case 'pass':
        if (!configuredCombat(combat)) throw new Error('Pass fallback is unavailable');
        doEndTurn(combat);
        break;
      case 'playCard':
        if (configuredCombat(combat) && !configuredModule(combat, 'cards')) throw new Error('Cards are disabled');
        doPlayCard(combat, intent);
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
    // Not while a choice or reaction holds the queue: re-showing the intent drains it, and the check runs again when it resolves.
    if (!combat.result && !combat.pendingReaction && !hasCardChoice(combat) && !combat.queue.length) revalidateEnemyPlans(combat);
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
  const poolBefore = combatEquipmentPoolProjection(combat);
  if (!cycleSet(combat.registries, combat.loadout, slotId, setIndex, {
    meta: {},
    inCombat: true,
    classId: p.classId,
    onEquipmentChanged: (event) => combat.emit('equipmentChanged', event),
  })) {
    throw new Error(`No set ${setIndex} on '${slotId}'`);
  }
  const poolAfter = combatEquipmentPoolProjection(combat);
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
  stampPlayerPoiseMax(p, playerPoiseThresholdReceipt(combat.registries, {
    loadout: combat.loadout, relics: p.relicIds || [], class: p.classId,
    itemUpgradeLevels: combat.itemUpgradeLevels || {}, attributes: combat.attributes || null,
    derivedStatRuleSnapshot: combat.derivedStatRuleSnapshot || null,
    ...(Number.isInteger(combat.characterLevel) ? { level: { level: combat.characterLevel } } : {}),
  }).value);

  // The event carries what it COST and under which rule — a price nobody can
  // read back is a price nobody can check, and "try each" is a comparison.
  if (combat.combatExpansionVersion === 2) {
    if (!configuredCombat(combat)) Object.assign(p, expandedEquipmentProjection(combat.registries, combat.loadout, p.classId, combat.combatExpansionRules.equipment));
    for (const field of EQUIPMENT_POOL_FIELDS) p.baseResourceMaxima[field] += (poolAfter[field] || 0) - (poolBefore[field] || 0);
    if (poolAfter.drawPerTurn !== undefined) {
      // Core's equipment attributes already priced the delta above. The legacy
      // Blight adapter would discard those attributes and reset Draw and pools.
      p.energyMax = p.maxStamina;
      p.drawPerTurn = poolAfter.drawPerTurn;
    } else settleExpandedPools(combat, p);
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

  const poolBefore = combatEquipmentPoolProjection(combat);
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
  const poolAfter = combatEquipmentPoolProjection(combat);
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
  stampPlayerPoiseMax(p, playerPoiseThresholdReceipt(combat.registries, {
    loadout: combat.loadout,
    relics: p.relicIds || [],
    class: p.classId,
    itemUpgradeLevels: combat.itemUpgradeLevels || {},
    attributes: combat.attributes || null,
    derivedStatRuleSnapshot: combat.derivedStatRuleSnapshot || null,
    ...(Number.isInteger(combat.characterLevel) ? { level: { level: combat.characterLevel } } : {}),
  }).value);

  if (combat.combatExpansionVersion === 2) {
    if (!configuredCombat(combat)) Object.assign(p, expandedEquipmentProjection(combat.registries, combat.loadout, p.classId, combat.combatExpansionRules.equipment));
    for (const field of EQUIPMENT_POOL_FIELDS) p.baseResourceMaxima[field] += (poolAfter[field] || 0) - (poolBefore[field] || 0);
    if (poolAfter.drawPerTurn !== undefined) {
      // Core's equipment attributes already priced the delta above. The legacy
      // Blight adapter would discard those attributes and reset Draw and pools.
      p.energyMax = p.maxStamina;
      p.drawPerTurn = poolAfter.drawPerTurn;
    } else settleExpandedPools(combat, p);
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
  return combat.registries.framework.costProfile(def, {
    powerCostReduction: passiveSum(combat.registries, combat.player.relicIds, 'powerCostReduction', combat.itemUpgradeLevels || {}, propertyMountsOf(combat, combat.player)),
    weightClass: playerWeightClass(combat).weightClass,
  }).action;
}

// What playing this card costs right now, in every pool: Actions (X spends
// them all), Mana and Stamina, weight class and relic reductions applied. The
// one pricing doPlayCard pays, exported so a bot can ask before it plays.
export function resolvedCardPlayCosts(combat, def) {
  return resolvedCardPriceReceipt(combat, def).paid;
}

// Restore cards show their full discounted price, although their own restore
// funds part of the payment. Keep both amounts before payment clamps to zero.
function resolvedCardPriceReceipt(combat,def) {
 const result=baseCardPriceReceipt(combat,def),status=proposalCardPlan(combat,combat.player,def);
 if(status.staminaTax || status.manaTax) {
  result.paid={...result.paid,energy:result.paid.energy+status.staminaTax,stamina:result.paid.stamina+status.staminaTax,mana:result.paid.mana+status.manaTax};
  result.display={...result.display,action:result.display.action+status.staminaTax,stamina:result.display.stamina+status.staminaTax,mana:result.display.mana+status.manaTax};
 }
 // Focus (owner, 2026-11-01): in the Prepared stance a held Focus armament takes Mana off a magic card's final price, floored at 0, so the face badge,
 // affordability checks, the bot and the payment all read the same number.
 const focus=focusManaDiscount(combat.registries,combat.loadout,combat.player?.classId,def,combat.player);
 if(focus>0) {
  result.paid={...result.paid,mana:applyFocusManaDiscount(result.paid.mana,focus)};
  result.display={...result.display,mana:applyFocusManaDiscount(result.display.mana,focus)};
 }
 return result;
}
function baseCardPriceReceipt(combat, def) {
  if (configuredCombat(combat)) {
    const paid = profileCardCosts(combat, def);
    // Multi-hit floor (owner, 2026-10-25): a fixed Core cost is read here, so the floor applies here too.
    const hitFloor = core2MultiHitRulesEnabled(combat) ? multiHitSpFloor(def, { mana: paid.mana }) : 0;
    if (hitFloor > paid.stamina) { paid.energy = hitFloor; paid.stamina = hitFloor; }
    return { paid, display: { action: paid.energy, stamina: paid.stamina, mana: paid.mana }, selfFunded: false };
  }
  const weightClass = playerWeightClass(combat).weightClass;
  const pools = combat.registries.framework.costProfile(def, { weightClass });
  // A break-even restore pays its own part of the price (owner, 2026-10-13; model/actionCosts.js ownRestoreFunds).
  const funds = ownRestoreFunds(def);
  // Silenced (v2): each stack adds 1 SP to a spell-camp card. An X card already spends every point.
  const silenced = combat.combatExpansionVersion === 2 && def.cost !== 'X' ? spellCardCostSurcharge(combat.player, def) : 0;
  const cardMana = Math.max(0, pools.mana + (def.upcastSurcharge || 0));
  const fullStamina = def.cost === 'X' ? combat.player.stamina + (def.upcastSurcharge || 0)
    : Math.max(0, stanceStaminaCost(effectiveCost(combat, def), combat.player, def, combat, cardMana) + (def.upcastSurcharge || 0) + silenced);
  const fullMana = stanceManaCost(Math.max(0, pools.mana + (def.upcastSurcharge || 0)
    - R.matchingAbilityCharges(combat.player, { ...def, type: cardKind(def), authoredTags: def.cardTags || def.tags }).manaDiscount), combat.player, def, combat);
  const stamina = def.cost === 'X' ? fullStamina : Math.max(0, fullStamina - funds.stamina);
  return {
    paid: { energy: stamina, mana: Math.max(0, fullMana - funds.mana), stamina },
    display: { action: fullStamina, mana: fullMana, stamina: fullStamina },
    selfFunded: funds.stamina > 0 || funds.mana > 0,
  };
}

function playCosts(combat, def) { return resolvedCardPlayCosts(combat, def); }

/** cardPlayCosts(combat, cardInstanceId) → { energy, mana, stamina } for a card in hand. */
export function cardPlayCosts(combat, cardInstanceId, upcastRanks) {
  const inst = combat.piles.hand.find((c) => c.instanceId === cardInstanceId);
  if (!inst) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const def = resolveCombatCard(combat, inst, { upcastRanks });
  return preparedPlayCosts(combat, inst, def);
}

// A card's price as its play pays it: after its cardPreparing triggers (a preparing discount or surcharge), on a
// detached preview when anything listens. `targetId` aims the preview's preparing event.
function preparedPlayCosts(combat, inst, def, targetId) {
  // cardPreparing has no ledger side effect in recordAbilityEvent/skill XP.
  // With no listener or queued work it cannot change any input to playCosts.
  // Custom buses, paused/resolving actions and all hook sources keep the exact
  // detached preview; actual card execution always retains its transaction.
  if (!combat.result && combat.player?.alive && combat.player.hp > 0
    && combat.enemies?.some(enemy => enemy.alive && enemy.hp > 0)
    && combat._emitEvent === emitEvent && Array.isArray(combat.queue) && combat.queue.length === 0
    && !hasCardChoice(combat) && !combat._abilityAction && !combat._emitDepth
    && !combat._foundationTransaction
    && !hasEventTriggers(combat, 'cardPreparing', { cardTags: def.cardTags || def.tags || [] })) return playCosts(combat, def);
  return playCosts(preparingPreview(combat, inst, def, targetId), def);
}

// The ability kind a card plays with: its authored kind, else spell
// for a source:spell card and maneuver for the rest. Play-time cardRef reads it.
function abilityKindOf(def) {
  return def.abilityKind || ((def.cardTags || def.tags || []).includes('source:spell') ? 'spell' : 'maneuver');
}

// A card's maneuver (SPEC §4.7): its combat profile's, else the `maneuver:*` tag the card carries.
function maneuverOf(def) {
  if (def.combatProfile?.maneuver) return def.combatProfile.maneuver;
  const tag = (def.cardTags ?? def.tags ?? []).find((t) => typeof t === 'string' && t.startsWith('maneuver:'));
  return tag ? tag.slice('maneuver:'.length) : undefined;
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
    && !hasCardChoice(combat) && !combat._abilityAction && !combat._emitDepth
    && !hasEventTriggers(combat, 'cardPreparing', { cardTags: def.cardTags || def.tags || [] })) {
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
  const clone = F.candidateState(combat, { detached: true });
  if (hasCardChoice(clone)) { clone.queue = []; return clone; }
  // A reaction choice waiting on the live fight would hold the preview's trigger effects back
  // (beforeReactionAction); the detached preview prices the card as it will play.
  delete clone.pendingReaction;
  emitPreparing(clone, inst, def, targetId);
  return clone;
}

// One card's cardPreparing on a detached preview, drained.
function emitPreparing(clone, inst, def, targetId) {
  clone._buffer = null;
  const target = targetId ? findEntity(clone, targetId) : clone.enemies.find(e => e.alive);
  clone.emit('cardPreparing', { cardInstanceId: inst.instanceId, cardId: inst.cardId, cardType: cardKind(def), cardTags: def.cardTags || def.tags || [], abilityKind: abilityKindOf(def), sourceId: clone.player.id, targetId: target?.id || null, ...R.beforeAbilityPlay(clone, clone.player), cardTargetsAllEnemies: R.cardTargetsAllEnemies(def) });
  drainQueue(clone);
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

function doPlayCard(combat, { cardInstanceId, targetId, choice, upcastTier, upcastRanks, rangeRoute }) {
  if (combat.phase !== 'player' && !combat._reactionPlaying) throw new Error('Cards can only be played on the player turn');
  const p = combat.player;
  const idx = combat.piles.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx < 0) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const inst = combat.piles.hand[idx];
  let def = resolveCombatCard(combat, inst, { upcastTier, upcastRanks });
  assertRangeCardEnabled(combat, def);
  const kws = def.keywords || [];
  const statusPlan=proposalCardPlan(combat,p,def);
  if(!statusPlan.allowed) throw F.playRefusal(statusPlan.refusal,'controlled');
  if (!Control.controlGate(combat, p, def).allowed) throw F.playRefusal('Recover from the active control statuses before playing cards', 'controlled');
  if (p.ashenBlight?.milestones?.some(row => row.path === null)) throw new Error('Choose the pending Ashen Blight feat first');
  const chosen = assertCardChoice(cardChoice(combat.registries, def, p.classId), choice);

  if (combat.registries.framework.isUnplayable(def)) throw F.playRefusal(`'${def.name}' is unplayable`, 'unplayable');

  const isX = def.cost === 'X';
  let { energy: cost, mana: manaCost, stamina: staminaCost } = playCosts(combat, def);
  def=selectCardVariant(combat,def,{energy:cost,mana:manaCost,stamina:staminaCost},targetId ? findEntity(combat,targetId) : null);

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
    instanceId: inst.instanceId, cardId: inst.cardId, upgraded: inst.upgraded, ...(inst.upgradeSteps?.length ? { upgradeSteps: inst.upgradeSteps } : {}), ...(inst.rank > 1 ? { rank: inst.rank } : {}), ...(inst.skillBonus > 0 ? { skillBonus: inst.skillBonus } : {}),
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
  const sourceSnapshots = rangeCardSourceSnapshots(combat,def,p,cardRef);
  if (combat.gameProfile?.foundation?.mode === 'configured' && (sourceSnapshots?.size || def.effects.some(effect => effect.op === 'damage') || cardRef.combatProfile?.maneuver === 'counter')) {
    // Reuse the damage-type resolver's chosen piece. This receipt field must
    // never become sourceArmamentId, which also scopes combat rating bonuses.
    const capturedSource = sourceSnapshots?.values().next().value;
    const resolvedSource = capturedSource?.resolvedSource;
    const used = capturedSource && Object.hasOwn(capturedSource,'usedArmamentId') ? capturedSource.usedArmamentId : resolvedSource
      ? resolvedSource.sourceType === 'unarmed' ? null : resolvedSource.itemId
      : wieldedArmament(combat, cardRef, p, cardRef.attack?.source || (cardRef.combatProfile?.camp === 'spell' ? 'spell' : 'weapon'))?.id || null;
    if (used !== undefined) {
      cardRef.usedArmamentId = used;
      cardRef.committedInstance.usedArmamentId = used;
    }
  }
  if (cardRef.combatProfile?.maneuver === 'counter' && sourceSnapshots?.size) {
    Object.assign(cardRef, sourceSnapshots.values().next().value);
  }
  const before = { ...R.beforeAbilityPlay(combat, p), cardTargetsAllEnemies: R.cardTargetsAllEnemies(def) };
  A.preflightCardHp(combat, def, p, target, before);
  if (combat.combatExpansionVersion === 2) {
    const check = playCosts(preparingPreview(combat, inst, def, targetId), def);
    if (p.energy < check.energy) throw F.playRefusal('Not enough Stamina or Mana', 'cost', { resource: 'stamina', need: check.energy, have: p.energy });
    if (p.mana < check.mana) throw F.playRefusal('Not enough Stamina or Mana', 'cost', { resource: 'mana', need: check.mana, have: p.mana });
    const payment = Blight.payAshenBlight(combat, p, { amount: def.ashenBlightCost || 0, receiptId: `${combat.combatKey}:${p.combatOwnerCycle}:${p.counters.cardsPlayedThisCombat + 1}:${inst.instanceId}`, combatKey: combat.combatKey });
    if (payment.recorded) combat.emit('ashenBlightPaid', { sourceId: p.id, amount: payment.paid, value: payment.value });
    if (payment.terminal) {
      p.energy -= check.energy; p.mana -= check.mana;
      combat.piles.hand.splice(idx, 1); combat.piles.exhaust.push(inst);
      p.hp = 0; p.alive = false; combat.phase = 'ended'; combat.result = 'defeat';
      Reactions.finishReactions(combat);
      combat.emit('ashenBlightLost', { targetId: p.id, reason: 'threshold' }); return;
    }
  }
  combat.emit('cardPreparing', { cardInstanceId: inst.instanceId, cardId: inst.cardId, cardType: kind, cardTags: cardRef.authoredTags, abilityKind: cardRef.abilityKind, sourceId: p.id, targetId: target?.id || null, ...before });
  drainQueue(combat);
  const charges = R.matchingAbilityCharges(p, cardRef, { enemyAvailable: combat.enemies.some(e => e.alive) });
  const chargedEffects = R.abilityChargedEffects(def.effects || [], charges, combat.enemies.some(e => e.alive), combat);
  if (chargedEffects !== def.effects) {
    if (target && target.kind !== 'enemy') throw new Error('Buildup charge requires a living enemy target');
    target ||= combat.enemies.find(e => e.alive) || null;
  }
  ({ energy: cost, mana: manaCost, stamina: staminaCost } = playCosts(combat, def));
  const counterRange = paidCounterRange(combat,p,cardRef,{energy:cost,stamina:staminaCost,mana:manaCost},rangeRoute || 'advance');
  if (counterRange) { ({energy:cost,stamina:staminaCost,mana:manaCost}=counterRange.costs); cardRef.rangeCounterReservation=counterRange.reservation; }
  if (p.energy < cost) throw F.playRefusal('Not enough Actions (Stamina) to play this card', 'cost', { resource: 'stamina', need: cost, have: p.energy });
  if (p.mana < manaCost) throw F.playRefusal('Not enough mana to play this card', 'cost', { resource: 'mana', need: manaCost, have: p.mana });

  // Pay cost (X-cost consumes ALL energy — SPEC §4.3).
  p.energy -= cost;
  if (cost > 0 || isX) combat.emit('energySpent', { amount: cost });
  p.mana -= manaCost;
  if (manaCost > 0) combat.emit('manaSpent', { amount: manaCost });
  if (staminaCost > 0) {
    p.counters.staminaSpentThisTurn = (p.counters.staminaSpentThisTurn || 0) + staminaCost;
    combat.emit('staminaSpent', { amount: staminaCost });
  }

  // Remove from hand; bump counters (used by predicates + formulas).
  combat.piles.hand.splice(idx, 1);
  p.counters.cardsPlayedThisTurn += 1;
  p.counters.cardsPlayedThisCombat += 1;
  const meta = {
    ...before,proposalTargetDecisions:{},
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
  if (configuredCombat(combat)) {
    const limit = configuredModule(combat, 'cards')?.freeCommandLimit ?? 32;
    if ((combat.gameProfileCommands || 0) >= limit) throw new Error('Turn work budget reached; End Turn remains available');
    combat.gameProfileCommands = (combat.gameProfileCommands || 0) + 1;
    setProfileStance(combat, p, cardRef);
  }
  const expandedActions = [];
  for (const [index, action] of F.cardActions(combat, { ...def, effects: tacticalEffects }, p, target, cardRef, meta, sourceSnapshots).entries()) {
    action.meta = { ...action.meta, abilityEffectIndex: index };
    R.attachAbilityCharges(action, charges, charged, combat);
    expandedActions.push(action);
  }
  cardRef.rangeRoute = rangeRoute || 'advance';
  cardRef.rangeBaseCosts = { energy: cost, stamina: staminaCost, mana: manaCost };
  const acceptedGroup = enqueueExpandedAction(combat, expandedActions, { source: p, target, carrier: cardRef });
  if (acceptedGroup?.carrier.rangePlan) { const extra = acceptedGroup.carrier.rangePlan.advanceSp; cost += extra; staminaCost += extra; }
  applyProposalPlan(combat,statusPlan,p,target,cardRef);
  if (!configuredCombat(combat)) enqueueCounterWard(combat, p, cardRef, meta);
  combat.emit('cardPlayed', {
    ...before, abilityKind: cardRef.abilityKind, printedManaCost: def.manaCost || 0, sourceId: p.id,
    ...(combat.combatExpansionVersion === 2 ? { cardInstance: structuredClone(combat.gameProfile?.foundation?.mode === 'configured' ? cardRef.committedInstance : inst),
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
// The stance view of a hand card (the target outline on the combat screen)
// ---------------------------------------------------------------------------

// The timeline's view of a card: an attack aims at its foe; a defensive card is for its owner.
function roundTimelineView(def, inst, cardInstanceId, target, aimsAtFoe, sp) {
  const isAttack = cardKind(def) === 'attack' && Boolean(target);
  const kind = Rounds.playerKind({ isAttack, effects: def.effects ?? [], maneuver: maneuverOf(def) });
  const tlTarget = kind === 'attack' || aimsAtFoe ? (target ? target.id : 'self') : 'self';
  const tags = Array.isArray(def.cardTags ?? def.tags) ? [...(def.cardTags ?? def.tags)] : [];
  return {
    id: inst.cardId, instanceId: cardInstanceId, kind,
    stance: Rounds.stanceFor(kind, tags), target: tlTarget, sp, tags,
  };
}

// The timeline view of a hand card aimed at targetId (null when the card is not in hand). Pays and queues nothing.
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

// A staggered (skip flag or Staggered intent's flag) or Control-locked enemy acts no further this turn or round.
function enemyHalted(combat, enemy) {
  return Boolean(enemy.skipNextTurn || S.getFlag(combat, enemy, 'skipTurn') || Control.controlRestrictions(combat, enemy).locked);
}

function finishAbilityPlay(combat) {
  const play = R.abilityResolved(combat);
  if (!play) return;
  const inst = play.instance;
  const def = resolveCombatCard(combat, inst);

  // Expanded Powers carry Exhaust; legacy Powers without it leave play.
  // The destination is the framework's call; this engine moves the card.
  if (!combat.result) {
    const destination = configuredCombat(combat)
      ? (def.keywords?.includes('exhaust') ? 'EXHAUST_PILE' : def.type === 'power' ? 'REMOVED_FROM_PLAY' : 'DISCARD_PILE')
      : combat.registries.framework.afterPlayDestination(def);
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
  validateDiscardChoice(combat, discardIds);
  endPlayerTurn(combat, discardIds);
  if (combat.result) return;
  enemyPhase(combat);
  if (Reactions.reactionPaused(combat)) return;
  if (combat.result) return;
  finishReactionPhase(combat);
}

function resumeEnemyTurn(combat) {
  if (hasCardChoice(combat) || combat.reactionResume) return;
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

// Preview presentation metadata is a deep-frozen copy made once per source
// rules object, so a preview costs no clone and a UI reader cannot alter combat.
const frozenStatusRulesBySource = new WeakMap();
function frozenStatusRules(source) {
  let frozen = frozenStatusRulesBySource.get(source);
  if (!frozen) {
    frozen = Object.isFrozen(source) ? source : deepFreeze(structuredClone(source));
    frozenStatusRulesBySource.set(source, frozen);
  }
  return frozen;
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
export function previewCard(combat, cardInstanceId, targetId, upcastRanks, { rangeRoute = 'advance', rawFace = false, knowledgeView = null } = {}) {
  if (combat.enemyKnowledge && !combat._knowledgePreview) {
    // The player's view of the fight is the same for every card on one unchanged
    // fight, and it is only read from here on (each preview clones it again), so
    // a caller that knows the fight has not moved may hand in a holder to share it.
    let visible = knowledgeView?.visible;
    if (!visible) {
      visible = F.candidateState(combat, { detached: true });
      visible._knowledgePreview = true;
      for (const enemy of visible.enemies) if (!knowledgeIntentProjection(visible, enemy)?.exact) {
        enemy.intent = { kind: 'unknown', moveId: null };
        delete enemy.combatStance;
        delete enemy.combatCounter;
        delete enemy.pendingMove;
      }
      if (knowledgeView) knowledgeView.visible = visible;
    }
    return previewCard(visible, cardInstanceId, targetId, upcastRanks, { rangeRoute, rawFace });
  }
  const inst =
    combat.piles.hand.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.draw.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.discard.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.exhaust.find((c) => c.instanceId === cardInstanceId);
  if (!inst) throw new Error(`Unknown card instance '${cardInstanceId}'`);
  let def = resolveCombatCard(combat, inst, { upcastRanks });
  if (!combat._abilityPreparingPreview) {
    const clone = preparingPreview(combat, inst, def, targetId);
    clone._abilityPreparingPreview = true;
    return previewCard(clone, cardInstanceId, targetId, upcastRanks, { rangeRoute, rawFace });
  }
  const p = combat.player;
  const isX = def.cost === 'X';
  const priceReceipt = resolvedCardPriceReceipt(combat, def);
  const paidCosts = priceReceipt.paid;
  def=selectCardVariant(combat,def,paidCosts,targetId ? findEntity(combat,targetId) : null);
  const displayCosts = priceReceipt.display;
  const shownCost = configuredCombat(combat) || combat.combatExpansionVersion === 2 ? paidCosts.energy : isX ? p.energy : effectiveCost(combat, def);
  const target = targetId != null ? findEntity(combat, targetId) : null;
  const allLiving = combat.enemies.filter((e) => e.alive);
  const living = def.targetLimit===undefined ? allLiving : allLiving.slice(0,Math.max(0,evaluate(def.targetLimit,{energySpent:paidCosts.stamina,entities:{self:p,owner:p,player:p,target,enemy:target,allEnemies:allLiving}})));

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
      instanceId: inst.instanceId, cardId: inst.cardId, upgraded: inst.upgraded, ...(inst.upgradeSteps?.length ? { upgradeSteps: inst.upgradeSteps } : {}), ...(inst.rank > 1 ? { rank: inst.rank } : {}), ...(inst.skillBonus > 0 ? { skillBonus: inst.skillBonus } : {}),
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
    meta: { energySpent:paidCosts.stamina,manaSpent:paidCosts.mana,staminaSpent:paidCosts.stamina },
  };

  Object.assign(action.card, tacticalCarrier(def, action.card, combat, p));
  // Execution enters the accepted card's stance before planning its contacts.
  // Prices above use the current stance; effect values use the prospective one.
  // This combat is already the detached preparing preview, so entry grants and
  // rating changes cannot spend or alter the live fight.
  if (combat.combatExpansionVersion === 2) setCombatStance(combat, p, action.card);
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
  const preparedEffects = previewTacticalEffects(combat, p, action.target, action.card, chargedEffects, action.meta);
  const applied = new Set();
  const expandedPreviewTargets = new Map();
  const expandedPreview = (enemy, effectIndex) => {
    if (!expandedPreviewTargets.has(enemy.id)) {
      const used = new Set();
      const actions = preparedEffects.map((effect, index) => {
        const row = { effect, source: p, owner: p, target: enemy, card: action.card,
          meta: { ...R.beforeAbilityPlay(combat, p), energySpent: shownCost, abilityEffectIndex: index } };
        R.attachAbilityCharges(row, charges, used, combat);
        return row;
      });
      expandedPreviewTargets.set(enemy.id, previewExpandedActions(combat, actions, { source: p, target: enemy, carrier: action.card }));
    }
    const contacts = expandedPreviewTargets.get(enemy.id)[effectIndex].filter(contact => contact.id === enemy.id);
    const hitDamages = contacts.map(contact => contact.amount);
    return { damage: hitDamages[0] || 0, hits: hitDamages.length, hitDamages, totalDamage: hitDamages.reduce((sum, n) => sum + n, 0), avoidance: contacts[0]?.receipt?.avoidance, damageReceipt: damageReceipt(enemy.id, contacts.map(contact => contact.receipt.damageReceipt?.hits?.[contact.index] || contact.receipt.damageReceipt?.hits?.[0]).filter(Boolean)) };
  };
  // Preparation adds the charge once to the whole Counter. Its display belongs
  // to the first eligible contact, even if an earlier opcode has no contacts.
  const counterPreviews = new Map();
  // The player once the Counter's immediate defensive effects (its Block, the stance-entry grants) have resolved, on a
  // detached copy through the same queue the live play drains; the return is simulated against this defender.
  let counterProjection;
  const counterDefenseProjection = () => {
    if (counterProjection !== undefined) return counterProjection;
    const sim = F.candidateState(combat, { detached: true });
    // The prepared effects, not the printed ones: Counterstrike scales the Block the stacks are read from (SPEC §17).
    for (const effect of preparedEffects) {
      if (effect.op === 'damage' || effect.target !== 'self') continue;
      sim.queue.push({ effect, source: sim.player, owner: sim.player, target: sim.player, card: action.card, meta: { energySpent: shownCost } });
    }
    drainQueue(sim);
    return (counterProjection = sim.player);
  };
  // Core 2: the whole HP/Poise return is one computed figure; the authored poiseDamage rows of a Counter never resolve live.
  const coreCounterCard = configuredCombat(combat) && fixCoreEnabled(combat) && action.card.combatProfile?.maneuver === 'counter';
  let coreCounterRead;
  // The card's own damage: what the armed Counter holds as its base return (live: payload.hp), plus any charged bonus.
  const counterBaseHp = resolvedTarget => chargedEffects.reduce((sum, effect) => sum + (effect.op === 'damage'
    ? counterEffectPreview(combat, p, resolvedTarget, action.card, effect, { energySpent: shownCost })?.total || 0 : 0), 0)
    + Math.max(0, charges.damage + charges.damageEffect);
  const coreCounterReturnRead = () => {
    if (coreCounterRead !== undefined) return coreCounterRead;
    const enemyTarget = action.target?.kind === 'enemy' ? action.target : living[0];
    return (coreCounterRead = enemyTarget
      ? counterPreviewAgainst(combat, enemyTarget, previewIntent(combat, enemyTarget.id), action.card, counterDefenseProjection(), counterBaseHp(enemyTarget)) : null);
  };
  // The return the card will deal: null when the attack is hidden/unknown (the face keeps the printed amount) or uncovered (no return).
  const coreCounterReturn = () => { const read = coreCounterReturnRead(); return read?.uncovered ? null : read; };
  const coreCounterUncovered = () => coreCounterReturnRead()?.uncovered === true;
  let corePoiseRowUsed = false;
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
      let coreRead;
      counterPreviews.set(key, replies.map((reply, effectIndex) => {
        if (configuredCombat(combat)) {
          // Core 2 (SPEC §17): the return is a fraction of the revealed incoming attack, priced exactly as the live
          // return is: no attack-rating bonus, no second stance multiplier. Without a revealed attack the face
          // states the printed amount.
          coreRead ??= reply && resolvedTarget?.kind === 'enemy'
            ? counterPreviewAgainst(combat, resolvedTarget, previewIntent(combat, resolvedTarget.id), action.card, counterDefenseProjection(), counterBaseHp(resolvedTarget)) : null;
          const read = effectIndex === bonusIndex ? coreRead : null;
          // Live replaces the card's whole HP payload with the one computed return (SPEC §17), so every other damage row of a
          // Counter with a known read deals nothing here: the return sits in exactly one row.
          if (effectIndex !== bonusIndex && reply && coreRead) return { damage: 0, hitDamages: [], totalDamage: 0, hits: 0 };
          // A revealed attack the Counter does not answer deals no return; a hidden one keeps the printed amount.
          if (read?.uncovered) return { damage: 0, hitDamages: [], totalDamage: 0, hits: 0 };
          const live = read;
          const hits = previewDamageHits(combat, p, resolvedTarget,
            live ? live.hp : (reply?.value || 0) + (effectIndex === bonusIndex ? bonus : 0),
            action.card.tags || [], { ...action.card, combatReaction: true, counterReturnAttack: true, ...(fixCoreEnabled(combat) ? { skipRatingBonus: true } : {}) },
            live ? 1 : reply?.hits || 0);
          // The return's own Poise damage and the Block the Counter adds ride with its HP damage (SPEC §17).
          return live ? { ...hits, damage: live.hp, hitDamages: [live.hp], totalDamage: live.hp, counterReturn: { incoming: live.incoming, hp: live.hp, poise: live.poise, block: live.block, advantaged: live.advantaged } } : hits;
        }
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
  preparedEffects.forEach((eff, i) => {
    if (typeof eff.op !== 'string') return;
    const authoredIndex = (def.effects || []).indexOf(chargedEffects[i]);
    const entry = { op: eff.op, target: eff.target || null };
    const primary = firstResolvedTarget(combat, action, eff);
    action.effect = eff;
    action.meta = { energySpent:paidCosts.stamina,manaSpent:paidCosts.mana,staminaSpent:paidCosts.stamina };
    R.attachAbilityCharges(action, charges, applied, combat);
    switch (eff.op) {
      case 'damage': {
        const attackTags = A.attackTagsFor(action, eff, combat.registries);
        const carrier = action.card;
        const isCounterReply = action.card.combatProfile?.maneuver === 'counter';
        entry.hits = isCounterReply
          ? previewCounter(primary, i).hitDamages.length
          : evalPreview(combat, action, eff.hits != null ? eff.hits : 1, primary);
        entry.perTarget = {};
        entry.perTargetHitDamages = {};
        // Core face (owner, 2026-10-28): the reference enemy's state as this effect meets it, before this effect's own hits drain it.
        // Only damage aimed at an enemy takes it; self and ally damage keep the raw number.
        const faceEnemy = !rawFace && configuredCombat(combat) && fixCoreEnabled(combat) && !isCounterReply && (!primary || primary.kind === 'enemy')
          ? (target?.kind === 'enemy' && target.alive ? target : allLiving[0]) : null;
        let faceState = null;
        if (faceEnemy) {
          const shared = damagePreviewStates.get(faceEnemy.id) || damagePreviewState(combat, faceEnemy);
          const d = shared.defender;
          faceState = { ...shared, combatRiderTargets: [...shared.combatRiderTargets],
            defender: { ...d, statuses: structuredClone(d.statuses || {}), block: 0, wardBlock: 0,
              persistentWard: d.persistentWard && { ...d.persistentWard }, persistentPoise: d.persistentPoise && { ...d.persistentPoise },
              ...(d.combatCounter ? { combatCounter: structuredClone(d.combatCounter) } : {}),
              ...(d.combatStance ? { combatStance: structuredClone(d.combatStance) } : {}) } };
        }
        for (const e of living) {
          const result = isCounterReply
            ? previewCounter(e, i)
            : !configuredCombat(combat) && combat.combatExpansionVersion === 2 ? expandedPreview(e, i)
            : previewDamageHits(combat, p, e,
              evalPreview(combat, action, eff.amount, e) + (action.meta.abilityChargeDamage || 0) + (action.meta.abilityChargeDamageEffect || 0),
              attackTags, carrier, entry.hits, damagePreviewStates.get(e.id));
          entry.perTarget[e.id] = result.damage;
          entry.perTargetHitDamages[e.id] = result.hitDamages;
          if (primary?.id === e.id && result.counterReturn) entry.counterReturn = result.counterReturn;
          if (primary?.id === e.id) Object.assign(entry, { value: result.damage,
            hitDamages: result.hitDamages, totalDamage: result.totalDamage, damageReceipt: result.damageReceipt,
            ...(configuredCombat(combat) ? { hitChance: result.hitChance, uncertain: result.uncertain, hpLossBounds: result.hpLossBounds } : {}) });
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
        // rawFace: a caller outside a fight (the smithing preview runs a stand-in fight) keeps the raw number.
        if (combat.combatExpansionVersion === 2 && (faceEnemy || !targetId) && !isCounterReply) {
          const printedBase = evalPreview(combat, action, eff.amount, null) + (action.meta.abilityChargeDamage || 0) + (action.meta.abilityChargeDamageEffect || 0);
          // Shown on the card: a whole number, rounded down (owner, 2026-10-18); the chain itself stays exact.
          entry.faceValue = Math.floor(A.computeAttackDamage(combat, p, null, printedBase, attackTags, carrier, { matchups: false, beforeDefense: true }));
          // The reference is the aimed living enemy, else the frontmost living one; no enemy leaves the raw number.
          if (faceState) {
            const faceHits = previewDamageHits(combat, p, faceState.defender, evalPreview(combat, action, eff.amount, faceEnemy) + (action.meta.abilityChargeDamage || 0) + (action.meta.abilityChargeDamageEffect || 0),
              attackTags, carrier, Math.max(1, Math.floor(entry.hits)), faceState).hitDamages;
            entry.faceValue = Math.floor(faceHits[0] ?? entry.faceValue);
            entry.faceHitDamages = faceHits.map(Math.floor);
          }
          // The face splits its amount as the contacts do: the card's own damage, then its rating bonus by category.
          entry.splitBase = Math.max(0, Math.floor(evalPreview(combat, action, eff.amount, null)));
          entry.ratingBonus = Math.floor(A.cardRatingDamage(combat, p, carrier, printedBase));
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
        const base = evalPreview(combat, action, eff.amount, primary) + (action.meta.abilityChargeBlock || 0);
        entry.defenseSplit = A.computeSpellDefenseGain(combat, p, base, action.card);
        entry.value = entry.defenseSplit ? entry.defenseSplit.block + entry.defenseSplit.ward
          : A.computeBlockGain(combat, p, base, action.card);
        break;
      }
      case 'gainBarrier': {
        // Barrier stacks, one per point (SPEC 4.1a); ratings do not scale a stack count.
        const base = evalPreview(combat, action, eff.amount, primary) + (action.meta.abilityChargeBlock || 0);
        entry.value = Math.max(0, Math.floor(base));
        entry.status = 'barrier';
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
          entry.value = Math.floor((amount + cardRatingBonus(combat, p, action.card, 'heal', amount) + (action.meta.abilityChargeHeal || 0)) * stanceEffectiveness(combat, p, action.card));
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
      case 'applyReflect':
      case 'poiseDamage':
      case 'addCinders': {
        entry.value = evalPreview(combat, action, eff.amount != null ? eff.amount : 1, primary);
        if (eff.op === 'poiseDamage' && coreCounterCard) {
          // The face shows the Poise the return really deals (SPEC §17), once; the authored rows and their conditions do not stack.
          const read = coreCounterReturn();
          if (read) { entry.value = corePoiseRowUsed ? 0 : read.poise; corePoiseRowUsed = true; }
          else if (coreCounterUncovered()) entry.value = 0; // a revealed attack this Counter never answers: no Poise return
        }
        if (configuredCombat(combat) && (eff.op === 'poiseDamage' || eff.op === 'wardDamage')) {
          // Under Core a Poise drain can break Poise mid-card; later hits of this card see the broken target (as live).
          const hit = eff.target === 'allEnemies' ? living : eff.target === 'enemy' || eff.target == null ? [primary] : [];
          for (const e of hit) {
            const state = e?.kind === 'enemy' && damagePreviewStates.get(e.id);
            if (state) previewPoiseDrain(combat, p, state, eff, action.card, evalPreview(combat, action, eff.amount != null ? eff.amount : 1, e));
          }
        }
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
        if (entry.defenseSplit) {
          tokens[`${token}.block`] = entry.defenseSplit.block;
          tokens[`${token}.ward`] = entry.defenseSplit.ward;
        }
        const sequence = entry.faceHitDamages && entry.hits > 0 ? entry.faceHitDamages : entry.hitDamages;
        if (eff.op === 'damage' && sequence?.length > 1
          && sequence.some(amount => amount !== sequence[0])) {
          const hitsToken = tokenByIndexField.get(`${authoredIndex}:hits`);
          if (hitsToken) damageSequences.push({ amountToken: token, hitsToken,
            hitDamages: sequence, totalDamage: sequence.reduce((sum, amount) => sum + amount, 0) });
        }
      }
      const hitsToken = tokenByIndexField.get(`${authoredIndex}:hits`);
      if (hitsToken && entry.hits != null) tokens[hitsToken] = entry.hits;
    }
    values.push(entry);
  });
  // A Counter with no authored damage effect (a support-only Counter) still returns half the incoming hit under Core 2:
  // the conditional return is read from the revealed attack, independent of any damage opcode.
  const authoredCosts = def.resourceCosts || def.costs || {};
  const authoredSp = authoredCosts.sp ?? def.staminaCost ?? (typeof def.cost === 'number' ? def.cost : undefined); // profileCardCosts' chain
  // The one computed return (SPEC §17) for any Core Counter, with or without an authored damage opcode: the card face
  // reads it for the HP, Poise and conditional Block rows its effects do not already carry.
  let supportCounterReturn = null;
  if (coreCounterCard) {
    const read = coreCounterReturn();
    if (read) supportCounterReturn = { incoming: read.incoming, hp: read.hp, poise: read.poise, block: read.block, advantaged: read.advantaged };
    // A Counter against a revealed attack it does not cover (or whose return is spent) will not arm: the face must not fall
    // back to the authored payload as if the intent were merely hidden.
    else if (coreCounterUncovered()) supportCounterReturn = { uncovered: true };
  }

  const rangeActions = F.cardActions(combat, { ...def, effects: preparedEffects }, p, action.target, action.card,
    action.meta || {}, null);
  const range = previewRangeRoutes(combat, p, rangeActions, paidCosts, { rangeRoute, hitPreview: previewCardAttackHit });
  const rangeCosts = range?.routes.find(row => row.id === rangeRoute)?.costs || paidCosts;
  return {
    ...(range ? { range, costs: rangeCosts } : {}),
    // The effects the play will run, a charge's added rows included; `values` follow this list (the card face reads it).
    resolvedDefinition: def, chargedEffects: preparedEffects, combatExpansionVersion: combat.combatExpansionVersion || 1,
    // Information travels with this preview, including custom saved status
    // caps. Clone presentation metadata so a UI reader cannot alter combat.
    combatStatusRules: frozenStatusRules(combat.combatStatusRules || combat.combatExpansionRules?.statuses || combatStatusRules),
    coreStatusAuthority: coreStatusPresentation(combat, def, preparedEffects),
    cardId: inst.cardId,
    upgraded: inst.upgraded,
    ...(inst.upgradeSteps?.length ? { upgradeSteps: inst.upgradeSteps } : {}),
    name: def.name,
    type: def.type,
    cost: shownCost + (range?.routes.find(row => row.id === rangeRoute)?.advanceSp || 0),
    costIsX: isX,
    manaCost: paidCosts.mana,
    ...(priceReceipt.selfFunded ? { displayCosts } : {}),
    // Core 2: whether a rule moved the SP price off the printed one (-1 cheaper, 1 dearer), so the face can mark it.
    ...(configuredCombat(combat) && !isX && Number.isFinite(authoredSp) && paidCosts.stamina !== authoredSp
      ? { costShift: Math.sign(paidCosts.stamina - authoredSp) } : {}),
    // Affordability keeps the net payment requirement, including restore funding.
    staminaCost: combat.combatExpansionVersion === 2 ? rangeCosts.stamina : shownCost,
    needsTarget: needsEnemyTarget({ ...def, effects: chargedEffects }),
    values,
    ...(supportCounterReturn ? { counterReturn: supportCounterReturn } : {}),
    tokens,
    damageSequences,
    // Core: the live Precision an entry into this card's stance grants (base + the actor's stat mix); the face prints it.
    ...(fixCoreEnabled(combat) && stanceEntryBonuses(def, combat).precision > 0 ? { entryPrecision: precisionEntryGrant(combat, p, stanceEntryBonuses(def, combat).precision, action.card) } : {}),
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

// The observer's read of the enemy's CURRENT intent: the one gate previewIntent and the follow-up trace share, so the
// UI never re-rolls or guesses a move's visibility. `concealed` is true when the exact move stays hidden.
function intentReadGate(combat, enemy) {
  const intent = enemy.intent || { kind: 'unknown', moveId: null };
  const knowledge = knowledgeIntentProjection(combat, enemy);
  const proposalRead = proposalIntentRevealUntil(enemy, combat.playerKey || 'player', combat.turn,
    { legacySolo: !(combat.players instanceof Map) }) !== null;
  if (!proposalRead && knowledge && !knowledge.exact) return { knowledge, proposalRead, concealed: true };
  const revealed = proposalRead || enemy.actorIntentRevealed || (enemy.intentReads ? enemy.intentReads[combat.playerKey] === true : enemy.intentRevealed !== false);
  return { knowledge, proposalRead, concealed: !knowledge && !revealed && !!intent.combatProfile?.camp && intent.kind !== 'staggered' };
}

// The observer's own Perception result for the enemy's current move, WITHOUT a Read Intent reveal: a reveal lifts only
// the move it names, so the follow-up trace must not inherit it (SPEC §4.6a).
function perceptionRead(combat, enemy) {
  const intent = enemy.intent || {};
  if (combat.enemyKnowledge) return enemy.knowledgeAction?.reads?.[combat.playerKey || 'player']?.visibility === 'exact';
  if (!intent.combatProfile?.camp) return true;
  return enemy.intentReads ? enemy.intentReads[combat.playerKey] === true : enemy.intentRevealed !== false;
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
  const { knowledge, proposalRead, concealed } = intentReadGate(combat, enemy);
  if (!proposalRead && knowledge && !knowledge.exact) return knowledge.intent;
  if (concealed) return concealIntent(intent, profile);
  if (intent.resolved) return { kind: 'unknown', moveId: null, revealed: true, hidden: false };
  const out = { ...intent, ...previewEnemyAction(combat, enemy, intent.moveId), profile, stance: combatIntentStance(intent, profile), revealed: true, hidden: false };
  // The armed payload is public only after this observer's read gate. This is
  // base counter damage, matching the inspector's prepared reaction value.
  if (out.stance === 'countering') {
    const counter = enemy.combatCounter;
    out.counterDamage = counter?.payload?.hp ?? counter?.damage ?? 0;
    out.counterPoiseDamage = counter?.payload?.poise ?? counter?.poiseDamage ?? 0;
  }
  if (intent.damage != null) {
    const move = expandedEnemyMove(enemy, combat.registries.enemies.get(enemy.enemyId).moves[intent.moveId], intent.moveId, combat);
    const effect = move?.effects?.find(e => e.op === 'damage');
    const carrier = { ...enemyMoveCarrier(enemy, move || {}, intent.moveId, combat), damageSchool: effect?.damageSchool || move?.damageSchool };
    Object.assign(out, previewDamageHits(combat, enemy, combat.player, intent.damage, carrier.tags, carrier,
      intent.hits != null ? intent.hits : 1, IntentProjection.enemyIntentDamageState(combat, enemy, carrier, intent.damage)));
  }
  out.pending = !!enemy.pendingMove;
  if (knowledge) {
    out.actionSerial = knowledge.actionSerial || enemy.knowledgeAction?.serial || 0;
    out.knowledgeRead = 'exact';
    out.label = intent.kind === 'staggered' ? 'Staggered' : enemy.knowledgeAction?.category;
  }
  return out;
}

/** The card's hit preview uses the same carrier and d20 rule as execution. */
export function previewCardHit(combat, cardInstanceId, targetId, upcastRanks, { observerId, rangeRoute = 'advance' } = {}) {
  const inst = combat.piles.hand.find(card => card.instanceId === cardInstanceId);
  const target = (combat.enemies || []).find(enemy => enemy.id === targetId);
  if (!inst || !target) return null;
  const def = resolveCombatCard(combat, inst, { upcastRanks });
  const carrier = tacticalCarrier(def, { cardId: def.id, instanceId: inst.instanceId, type: def.type }, combat, combat.player);
  const profile = carrier.combatProfile;
  const additionalTargets = profile?.targeting === 'area'
    ? Math.max(0, (combat.enemies || []).filter(enemy => enemy.alive).length - 1) : 0;
  const visibleTarget = observerId ? previewTargetFor(target, observerId, { turn: combat.turn, legacySolo: !(combat.players instanceof Map) }) : target;
  const preview = previewCardAttackHit(combat, combat.player, visibleTarget, carrier, { additionalTargets });
  const resolved = carrier;
  const range = previewRangeRoutes(combat, combat.player, [{ source: combat.player, target: visibleTarget, card: resolved, effect: { op: 'damage', target: 'enemy', amount: 0 } }],
    resolvedCardPlayCosts(combat, def), { rangeRoute, hitPreview: previewCardAttackHit });
  return preview && { ...preview, ...(range ? { range } : {}) };
}
