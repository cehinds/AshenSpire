import { combatMatchups, combatIntent, combatExpansionMatchups } from '../content/combatMatchups.js';
import { combatStatusRules as defaultStatusRules } from '../content/combatStatusRules.js';
import { ASHEN_BLIGHT_RULES } from '../content/ashenBlight.js';
import { combatExpansionEquipment } from '../content/combatExpansionEquipment.js';
import { expandedEquipmentProjection, expandedEnemyProjection } from './combatExpansionEquipment.js';
import { tacticalCarrier, prepareTacticalCard, enqueueCounterWard, enemyMoveCarrier, primeEnemyCounter, enemyCounterDefensePrimed, expandedEnemyMove } from './combatCardTactics.js';
import { clearCombatCounter, startTacticalTurn, setCombatStance } from './combatMatchups.js';
import { resolveCombatCard } from './combatExpansion.js';
import { enqueueExpandedAction } from './combatExpansionActions.js';
import { controlGate, controlRestrictions, initializePersistentWard, recoverStatusesAtOwnerStart, sleepRestoration,
  consumeControlActionLoss, endControlTurn, manualRecovery, recoveryControls } from './combatStatusControl.js';
import { payAshenBlight, rollAshenBlightEncounter, chooseAshenBlightFeat, beginAshenBlightCycle, ashenBlightRestorationPercent,
  effectiveAshenBlightAttributes, ashenBlightBonuses } from './ashenBlight.js';
import { createAshenBlightState } from '../model/ashenBlight.js';
import { decodeCoopCombatSnapshot } from './coopCombatSnapshot.js';
import { bindTurnStamina } from '../model/turnStamina.js';
import { settleExpandedPools, refreshExpandedLoadout } from './combatExpansionProjection.js';
import { hiddenIntentChance, concealIntent, combatIntentStance } from '../model/combatIntentVisibility.js';
import { passiveMax } from '../model/registries.js';
// src/engine/coopCombat.js — shared N-player combat runner (Forsaken Together S3).
//
// A SEPARATE co-op fight engine that reuses the solo engine's generic opcode /
// status / trigger primitives (actions.js, statuses.js, triggers.js) but has its
// own N-player turn loop. Solo combat.js is untouched.
//
// Model (StS2-faithful):
//   • Every present player is in ONE fight vs a SHARED enemy set.
//   • All players share the player phase; each plays from their OWN hand with
//     their OWN energy/block, and ends their OWN turn. When every connected,
//     living player has ended → the enemy phase runs, then a fresh player turn.
//   • Party-wide debuffs are automatic: everyone attacks the same shared
//     enemies, so one player's Vulnerable helps all.
//   • Enemy attacks FAN OUT — a move's player-targeted damage/effects apply to
//     each living player (each mitigated by their own block); self/enemy effects
//     (e.g. the enemy's own block) apply once.
//   • Presence auto-scales: enemy HP scales to the live headcount at fight
//     start and rescales on join/leave. A player who drops is removed from the
//     fight; the rest finish. A returner jumps back in and enemies rescale up.
//
// Reuse technique: the co-op object `C` is combat-shaped. Before resolving a
// given player's actions (or an enemy hit ON a player) we point C.player and
// C.piles at that player, so the entity-generic primitives "just work". Enemies
// live on the shared C.enemies.
//
// v1 limitations (documented, for a later pass): no poise/Stagger in the enemy
// turn; flask throw-to-ally is S5. Delayed (telegraphed) enemy moves ARE
// supported. Per-seat once/limitPerTurn gating is handled: setActive publishes
// C.playerKey and triggers.js scopes player-owned trigger state by it.

import { chargeFlaskId } from '../model/gracerefill.js';
import { reconcileWardBlock } from '../model/blockPresentation.js';
import { syncRelicProperties, syncClassProperties, syncFeatProperties, syncLoadoutProperties, syncSigilProperties, propertyMountsOf } from './properties.js';
import { assertFriendlyTarget, friendlyTargetPlan } from '../model/friendlyTargets.js';
import { cardTargetPlan, assertCardTarget, immediateCardEffects } from '../model/cardTargets.js';
import { cardChoice, assertCardChoice } from '../model/cardChoices.js';

import * as A from './actions.js';
import * as R from './abilityRiders.js';
import * as SoloCombatCosts from './combat.js';
import { previewCard as soloPreviewCard, previewIntent as soloPreviewIntent, cardNeedsEnemyTargetNow } from './combat.js';
import * as F from './combatRules.js';
import { playerWeightClass } from './combat.js';
import * as S from '../framework/statusSemantics.js';
import { emitEvent, fireOwnerHooks, findEntity } from './triggers.js';
import { resolveCard, passiveSum, passiveMult } from '../model/registries.js';
import { cardKind } from '../model/tree.js';
import { gripOf, gripTags } from '../model/loadout.js';
import { attachSkillXp } from './skillXp.js';
import { createPlayerCombatEntity, createEnemyCombatEntity, enemyMoveDamage } from '../model/state.js';
import { refreshCombatRatings, clearMeterGuards } from './combatRatings.js';
import { resolveHandRules, handRow, scaledCards } from '../model/handRules.js';
import { handStatRows, ratingStatRows, readsLegacyStatHomes, LEGACY_HAND_MAX } from '../model/statRows.js';
import { turnDrawCount, endTurnCardFate, returnUnplayedCards } from './handRules.js';
import { orderedDrawPile } from '../model/deckRules.js';
import { initializeCombatKnowledge, rollEnemyKnowledge, addKnowledgeObserver, predictEnemyIntent, cancelKnowledgeAction } from './enemyKnowledge.js';

const QUEUE_GUARD = 10000;

// Co-op enemy HP scaling by live headcount — sub-linear, StS2-flavoured. The
// factor comes from balance.coop.headcountHpFactor; the default keeps the pure
// function usable (tests) and matches that balance value.
export function coopHpMult(headcount, factor = 0.6) {
  return 1 + factor * Math.max(0, headcount - 1); // 1p ×1.0, 2p ×1.6, 3p ×2.2, 4p ×2.8
}

/**
 * createCoopCombat({ registries, rng, players, enemyIds, extraHpMult?, enemyDamageMult?, enemyStatuses? })
 *   players = [{ id, classId, maxHp, hp, deck, relicIds, flasks }]
 * Enemy HP = base roll × coopHpMult(headcount) × extraHpMult (endless/custom);
 * enemy move damage × enemyDamageMult (balance.bossTiers, SPEC §13.3).
 */
export function createCoopCombat({ registries, rng, players, enemyIds, enemyLevels = [], extraHpMult = 1, enemyDamageMult = 1, enemyStatuses = [], ruleset = null, combatProfiles = {}, ratingsRules = registries.balance?.combatRatings || null, breakMeterVersion = null, combatExpansionVersion = players.some(p => p.combatExpansionVersion === 2) ? 2 : 1, combatExpansionRules = null, combatStatusRules = null, combatKey = 'combat', snapshot = null, knowledge = null }) {
  const C = {
    combatExpansionVersion, sharedExpansionVersion: combatExpansionVersion,
    combatExpansionRules: structuredClone(combatExpansionRules || { matchups: combatExpansionMatchups, statuses: defaultStatusRules, ashenBlight: ASHEN_BLIGHT_RULES, equipment: combatExpansionEquipment }),
    combatStatusRules: structuredClone(combatStatusRules || combatExpansionRules?.statuses || defaultStatusRules), combatKey,
    combatMatchupRules: structuredClone(registries.balance?.combatMatchups || combatMatchups),
    combatIntentRules: structuredClone(registries.balance?.combatIntent || combatIntent),
    ...(ratingsRules?.enabled ? { ratingsRules: structuredClone(ratingsRules) } : {}),
    ...(breakMeterVersion === 2 ? { breakMeterVersion: 2 } : ratingsRules?.enabled && breakMeterVersion === 1 ? { breakMeterVersion: 1 } : {}),
    foundation: F.createFoundation(ruleset, combatProfiles, registries),
    registries,
    rng,
    turn: 0,
    phase: 'setup', // 'player' | 'enemy' | 'ended' | 'suspended'
    result: null,
    // Pointed at the active seat's own hand size (setActive): each seat counts
    // cards by its own stat rows, exactly as a solo fight does.
    handMax: LEGACY_HAND_MAX,
    enemies: [],
    eventLog: [],
    queue: [],
    triggerState: new Map(),
    _buffer: null,
    _emitDepth: 0,
    _idCounter: 0,
    // Active-player slots the reused primitives read; pointed per resolution.
    player: null,
    piles: null,
    // Co-op bookkeeping.
    players: new Map(), // id → P
    order: [],
    baseHpMult: 1,
    extraHpMult,
    _enemyStatuses: enemyStatuses,
  };
  // Immutable catalogue projections stay outside the cloned combat graph.
  // Mixed legacy and expanded seats retain their own card and XP contracts.
  const seatRegistries = new Map(players.map(player => [player.id, player.registries || registries]));
  C.registriesForPlayer = id => seatRegistries.get(id) || registries;
  C.registerPlayerRegistries = (id, scoped) => seatRegistries.set(id, scoped || registries);
  C.emit = (type, payload) => emitEvent(C, type, payload);
  C._emitEvent = emitEvent;
  attachSkillXp(C); // plan phase 4a: one receipt per seat, keyed by C.playerKey
  C.enqueue = (action) => C.queue.push(action);
  C.nextInstanceId = () => `gen${++C._idCounter}`;
  // Player combat entities intentionally share the engine id `player`. Events
  // that resolve against an ally still need the authoritative member id, so
  // expose the identity of the actual resolved entity rather than whichever
  // seat happens to be active for source-card bookkeeping.
  C.playerIdForEntity = (entity) => {
    for (const [id, P] of C.players) if (P.entity === entity) return id;
    return null;
  };
  // A queued property draw can belong to an inactive seat. Draw through its
  // own piles and hand rules, then restore the current seat's context.
  C.drawCardsFor = (entity, amount) => {
    const seat = C.players.get(C.playerIdForEntity(entity));
    if (!seat) return A.drawCards(C, amount);
    const prior = C.players.get(C.playerKey);
    setActive(C, seat);
    try { return A.drawCards(C, amount); }
    finally { setActive(C, prior || null); }
  };
  C.combatControlRestrictions = entity => controlRestrictions({ ...C, combatExpansionVersion: entity?.combatExpansionVersion || 1 }, entity);
  C.restorationModifierPercent = (entity, kind) => ashenBlightRestorationPercent(
    { ...C, combatExpansionVersion: entity?.combatExpansionVersion || 1 }, entity, kind, String(entity?.combatOwnerCycle || 0));
  if (snapshot) {
    const saved = decodeCoopCombatSnapshot(snapshot);
    if (saved.foundation) F.validateFoundationSnapshot(saved.foundation);
    for (const seat of saved.players.values()) {
      const seatRegistries = C.registriesForPlayer?.(seat.id) || registries;
      if (!seatRegistries.classes.has(seat.entity.classId)) throw new Error('Saved co-op class is unavailable');
      for (const pile of ['draw', 'hand', 'discard', 'exhaust']) for (const card of seat.piles[pile]) resolveCard(seatRegistries, card, saved.breakMeterVersion || 0);
    }
    for (const enemy of saved.enemies) if (!registries.enemies.has(enemy.enemyId)) throw new Error('Saved co-op enemy is unavailable');
    Object.assign(C, saved);
    for (const P of C.players.values()) {
      bindTurnStamina(P.entity);
      // Older expanded seats omitted this equipment context. The member's
      // saved run is the fallback authority; a current seat's own copy wins.
      const member = players.find(player => player.id === P.id);
      if (P.entity.combatExpansionVersion === 2 && member) for (const key of [
        'equipmentProfileRuleSnapshot', 'equipmentAttackSlotCount', 'removedAttackSlotIds', 'itemMounts', 'poolDeck',
      ]) if (P[key] === undefined && member[key] !== undefined) P[key] = structuredClone(member[key]);
    }
    setActive(C, C.players.get(saved.playerKey) || firstLiving(C));
    return C;
  }

  const headcount = players.length;
  C.hpFactor = (registries.balance.coop && registries.balance.coop.headcountHpFactor) || 0.6;
  C.baseHpMult = coopHpMult(headcount, C.hpFactor) * extraHpMult;

  // Enemies (HP rolled on 'enemyHP', then scaled — determinism preserved).
  enemyIds.forEach((enemyId, i) => {
    const def = registries.enemies.get(enemyId);
    let hp = rng.int('enemyHP', def.hp[0], def.hp[1]);
    hp = Math.max(1, Math.round(hp * C.baseHpMult));
    C.enemies.push(createEnemyCombatEntity({
      instanceId: `e${i + 1}`, enemyId, level: enemyLevels[i], hp, poiseMax: def.poiseMax,
      arcaneExposure: C.breakMeterVersion === 1 ? undefined : def.arcaneExposure,
      damageResistanceBySchool: def.damageResistanceBySchool,
      damageMult: enemyDamageMult,
    }));
    if (C.sharedExpansionVersion === 2) {
      C.enemies.at(-1).combatExpansionVersion = 2;
      Object.assign(C.enemies.at(-1), expandedEnemyProjection(enemyId, C.combatExpansionRules.equipment));
    }
  });
  if (C.ratingsRules) {
    for (const enemy of C.enemies) {
      const values = C.ratingsRules.enemyRatings?.[enemy.enemyId] || { poise: enemy.poiseMeter?.max || 1, ward: enemy.poiseMeter?.max || 1 };
      enemy.ratings = { ar: 0, dr: 0, pr: 0, ...values };
      for (const id of C.breakMeterVersion === 1 ? ['poise'] : ['poise', 'ward']) enemy[id + 'Meter'] = { value: 0, max: Math.max(1, values[id]), growths: 0 };
    }
  }
  if (C.sharedExpansionVersion === 2) for (const enemy of C.enemies) initializePersistentWard(enemy, enemy.ratings?.ward || 0);

  // Players — each an entity + own shuffled piles (Innate on top).
  for (const p of players) addPlayerState(C, p, { initial: true });
  if (knowledge) initializeCombatKnowledge(C, knowledge);
  if (C.sharedExpansionVersion === 2 && !livingPlayers(C).length) { finish(C, 'defeat'); return C; }

  // combatStart per player so each player's relics/statuses hook up.
  //
  // THE MOUNT IS INSIDE THIS LOOP, AND THAT IS THE WHOLE OF IT. A co-op owner
  // key is the ACTIVE seat (triggers.js ownerKeyFor reads C.playerKey, which
  // setActive moves), so mounting all seats in one pass outside it filed every
  // seat's relics under whichever seat happened to be active — one owner, two
  // seats, and the second seat's relic silently conferring nothing. Mounted
  // under setActive, each seat's carriers land under the key its own scan will
  // look them up by, which is the per-seat scoping test 24 exists for.
  for (const P of livingPlayers(C)) {
    setActive(C, P);
    syncLoadoutProperties(C, P.entity, P.loadout, P.itemUpgradeLevels);
    syncRelicProperties(C, P.entity);
    syncClassProperties(C, P.entity);
    syncFeatProperties(C, P.entity, P.skillFeats);
    syncSigilProperties(C, P.entity, P.attunedSigils); // SPEC §15.4: the seat's own attuned legendaries
    if (C.ratingsRules) refreshCombatRatings(C);
    if (P.entity.combatExpansionVersion === 2) initializePersistentWard(P.entity, P.entity.ratings?.ward || 0);
    C.emit('combatStart', {});
  }
  for (const enemy of C.enemies) {
    for (const s of C._enemyStatuses) {
      setActive(C, firstLiving(C));
      C.enqueue({ effect: { op: 'applyStatus', target: 'self', status: s.status, stacks: s.stacks }, source: enemy, owner: enemy, target: enemy, meta: {} });
    }
  }
  drainQueue(C);
  rollIntents(C, true);
  if (!C.result) startPlayerPhase(C);
  return C;
}

// ---- player state -----------------------------------------------------------
function addPlayerState(C, p, { initial = false } = {}) {
  const previousOwnerId = initial ? null : C.playerKey;
  C.registerPlayerRegistries?.(p.id, p.registries);
  const registries = C.registriesForPlayer?.(p.id) || C.registries;
  const entity = createPlayerCombatEntity({
    classId: p.classId, classUnequipped: p.classUnequipped === true, maxHp: p.maxHp, hp: p.hp != null ? p.hp : p.maxHp,
    maxMana: Number.isFinite(p.maxMana) ? p.maxMana : 0,
    mana: p.mana,
    maxStamina: p.maxStamina, stamina: p.stamina,
    relicIds: p.relicIds || [], flasks: p.flasks || [], flaskCharges: p.flaskCharges || null,
    energyMax: p.energyMax,
    drawPerTurn: p.drawPerTurn,
    damageBySchoolAdd: p.damageBySchoolAdd || {},
    itemUpgradeLevels: p.itemUpgradeLevels || {},
    // Co-op players carry no loadout into this engine, so the vessel arrives
    // only if the caller stamped a threshold; absent stays absent (the HUD
    // refusal), never a lying 0/0. Same graceful shape as maxMana above.
    poiseMax: Number.isInteger(p.poiseMax) ? p.poiseMax : 0,
  });
  entity.combatExpansionVersion = p.combatExpansionVersion || 1;
  if (p.baseResourceMaxima) entity.baseResourceMaxima = structuredClone(p.baseResourceMaxima);
  if (entity.combatExpansionVersion === 2) {
    entity.ashenBlight = structuredClone(p.ashenBlight || createAshenBlightState());
    entity.attributes = { ...(p.attributes || {}) };
    const entry = rollAshenBlightEncounter({ ...C, combatExpansionVersion: 2 }, entity, C.combatKey);
    if (entry.terminal) { entity.hp = 0; entity.alive = false; entity.blightTerminal = true; }
  }
  const deck = (p.deck || []).map((c) => ({
    ...([1, 2].includes(C.breakMeterVersion) ? { breakMeterVersion: C.breakMeterVersion } : {}),
    instanceId: c.instanceId,
    cardId: c.cardId,
    ...(c.sourceHand ? { sourceHand: c.sourceHand } : {}),
    ...(c.equipmentAttackSlotId ? { equipmentAttackSlotId: c.equipmentAttackSlotId } : {}),
    ...(c.equipmentPlanFingerprint ? { equipmentPlanFingerprint: c.equipmentPlanFingerprint } : {}),
    ...(c.weaponId ? { weaponId: c.weaponId } : {}),
    ...(c.sourceEquipmentInstanceId ? { sourceEquipmentInstanceId: c.sourceEquipmentInstanceId } : {}),
    upgraded: !!c.upgraded,
    ...(Number.isInteger(c.abilityRank) ? { abilityRank: c.abilityRank } : {}),
    ...(c.legacyAbility === true ? { legacyAbility: true } : {}),
    ...(c.abilityOfferId ? { abilityOfferId: c.abilityOfferId } : {}),
    ...(c.rewardReceiptId ? { rewardReceiptId: c.rewardReceiptId } : {}),
    ...(Number.isInteger(c.rank) && c.rank > 1 ? { rank: c.rank } : {}),
    ...(Number.isInteger(c.skillBonus) && c.skillBonus > 0 ? { skillBonus: c.skillBonus } : {}),
    ...(Number.isInteger(c.passiveBlock) && c.passiveBlock > 0 ? { passiveBlock: c.passiveBlock } : {}),
    ...(c.mods && c.mods.length ? { mods: [...c.mods] } : {}), // equipment numbers
    ...(typeof c.damageSchool === 'string' ? { damageSchool: c.damageSchool } : {}),
    ...(Number.isInteger(c.exposureBuildupPerHit) ? { exposureBuildupPerHit: c.exposureBuildupPerHit } : {}),
    ...(c.equipmentRole ? { equipmentRole: c.equipmentRole, profileId: c.profileId, profileReceipt: c.profileReceipt } : {}),
    ...(c.ratingId ? { ratingId: c.ratingId } : {}),
    ...(Number.isFinite(c.ratingValue) ? { ratingValue: c.ratingValue } : {}),
    ...(Number.isFinite(c.ratingCap) ? { ratingCap: c.ratingCap } : {}),
    ...(c.kitRole ? { kitRole: c.kitRole } : {}),
    ...(c.grantedBy ? { grantedBy: c.grantedBy, grantSource: c.grantSource } : {}),
    ...(c.sourceArmamentId ? { sourceArmamentId: c.sourceArmamentId } : {}),
    ...(Number.isInteger(c.smithingLevel) ? { smithingLevel: c.smithingLevel } : {}),
  }));
  // Play in deck order is each seat owner's own setting (SPEC §14.1): that
  // seat draws its deck as arranged and rolls nothing for it.
  const orderedDraw = p.orderedDraw ? { order: deck.map((card) => card.instanceId) } : null;
  const drawPile = orderedDrawPile(orderedDraw ? deck : C.rng.shuffle('shuffle', deck),
    (card) => registries.framework.isInnate(resolveCard(registries, card)));
  // THE SAME ROWS A SOLO FIGHT READS (ruleset 7): the seat's hand rules are
  // the shipped behaviour options plus its own opening-hand, draw and
  // hand-size rows, and its ratings its own rating rows. A seat born before
  // ruleset 7 keeps what co-op always gave it — a fresh hand of its derived
  // draw each turn, capped by the retired fallback hand size.
  const legacy = readsLegacyStatHomes(p);
  const handRules = legacy ? null : resolveHandRules({}, handStatRows(C.registries, p));
  const level = Number.isInteger(p.level) && p.level >= 1 ? p.level : 1;
  const ratingRows = C.ratingsRules ? ratingStatRows(C.registries, p) : null;
  const P = {
    id: p.id,
    level,
    handRules,
    handMax: handRules ? scaledCards(handRow(handRules, 'handSize'), p.attributes || {}, level) : LEGACY_HAND_MAX,
    ratingRows: ratingRows && Object.values(ratingRows).every(Boolean) ? ratingRows : null,
    derivedStatRuleSnapshot: p.derivedStatRuleSnapshot || null,
    name: p.name || p.id,
    classId: p.classId,
    attributeMode: p.attributeMode,
    allocatedAttributes: p.attributes ? { ...p.attributes } : undefined,
    attributes: p.attributes ? effectiveAshenBlightAttributes(entity, p.attributes) : undefined,
    // The seat's loadout, so the framework Weight Class (dodge pricing and the
    // dodge check) is decided from THIS player's equipment, not a Light default.
    loadout: p.loadout ? structuredClone(p.loadout) : null,
    itemUpgradeLevels: p.itemUpgradeLevels || {},
    ...(entity.combatExpansionVersion === 2 ? {
      equipmentProfileRuleSnapshot: p.equipmentProfileRuleSnapshot ? structuredClone(p.equipmentProfileRuleSnapshot) : undefined,
      equipmentAttackSlotCount: p.equipmentAttackSlotCount,
      removedAttackSlotIds: structuredClone(p.removedAttackSlotIds || []),
      itemMounts: structuredClone(p.itemMounts || {}),
      ...(p.poolDeck === true ? { poolDeck: true } : {}),
    } : {}),
    skills: p.skills ? structuredClone(p.skills) : {},
    skillFeats: Array.isArray(p.skillFeats) ? [...p.skillFeats] : [],
    coreTags: Array.isArray(p.coreTags) ? [...p.coreTags] : [],
    // SPEC §15.4: the seat's attuned legendary sigils, mounted under its own key.
    attunedSigils: Array.isArray(p.attunedSigils) ? [...p.attunedSigils] : [],
    entity,
    orderedDraw,
    piles: { draw: drawPile, hand: [], discard: [], exhaust: [] },
    connected: true,
    ended: false,
  };
  C.players.set(p.id, P);
  if (entity.combatExpansionVersion === 2) {
    Object.assign(entity, expandedEquipmentProjection(C.registriesForPlayer(p.id), P.loadout, entity.classId, C.combatExpansionRules.equipment));
    setActive(C, P);
    settleExpandedPools(C, entity, { allocatedAttributes: P.allocatedAttributes });
    refreshExpandedLoadout(C, entity);
    if (!initial || !entity.alive) initializePersistentWard(entity, entity.ratings?.ward || 0);
  }
  if (!C.order.includes(p.id)) C.order.push(p.id);
  if (!initial && entity.alive) {
    // Mid-combat join. Mount the relics they arrive holding under their own
    // seat key, for the reason the initial loop states — but PUT THE ACTIVE
    // SEAT BACK. A join can land in the enemy phase, where this function did
    // not touch the active seat before, and leaving someone else's entity and
    // piles installed on the shared context is how the next enemy action hits
    // the wrong hand.
    const wasActive = C.players.get(previousOwnerId) || null;
    setActive(C, P);
    syncLoadoutProperties(C, P.entity, P.loadout, P.itemUpgradeLevels);
    syncRelicProperties(C, P.entity);
    syncClassProperties(C, P.entity);
    syncFeatProperties(C, P.entity, P.skillFeats);
    syncSigilProperties(C, P.entity, P.attunedSigils); // SPEC §15.4: the seat's own attuned legendaries
    if (C.ratingsRules) refreshCombatRatings(C);
    setActive(C, wasActive || null);
    // …and the fresh hand, which is the player phase's business only.
    if (C.phase === 'player') {
      setActive(C, P);
      P.entity.energy = P.entity.energyMax;
      A.drawCards(C, P.handRules ? turnDrawCount(C, true) : P.entity.drawPerTurn);
      P.opened = true;
    }
    rescaleEnemies(C);
  }
  if (!initial) setActive(C, C.players.get(previousOwnerId) || null);
  return P;
}

function setActive(C, P) {
  if (C.registriesForPlayer) C.registries = C.registriesForPlayer(P?.id);
  C.player = P ? P.entity : null;
  C.piles = P ? P.piles : null;
  // The shared action context is combat-shaped: the dodge opcode and the
  // class-priced cost read `attributes` / `loadout` off it, so the active
  // seat's own are exposed here — the same fields the solo engine carries.
  if (P?.entity.combatExpansionVersion === 2) {
    P.attributes = effectiveAshenBlightAttributes(P.entity, P.allocatedAttributes || P.attributes);
    if (P.handRules) P.handMax = scaledCards(handRow(P.handRules, 'handSize'), P.attributes || {}, P.level);
  }
  C.attributes = P ? P.attributes : null;
  C.allocatedAttributes = P ? P.allocatedAttributes || P.attributes : null;
  C.combatExpansionVersion = P ? P.entity.combatExpansionVersion || 1 : C.sharedExpansionVersion || 1;
  C.attributeMode = P ? P.attributeMode || null : null;
  C.loadout = P ? P.loadout : null;
  C.itemUpgradeLevels = P ? P.itemUpgradeLevels : {};
  C.equipmentProfileRuleSnapshot = P?.equipmentProfileRuleSnapshot;
  C.equipmentAttackSlotCount = P?.equipmentAttackSlotCount;
  C.removedAttackSlotIds = P?.removedAttackSlotIds || [];
  C.itemMounts = P?.itemMounts || {};
  if (P?.poolDeck) C.poolDeck = true; else delete C.poolDeck;
  C.skills = P ? P.skills : {};
  // Every player entity carries id 'player', so triggers.js scopes player-owned
  // once / limitPerTurn gates by this seat id instead (see ownerKeyFor). Without
  // it, one seat's once-per-combat relic/stance/status consumes the party's.
  C.playerKey = P ? P.id : null;
  // The seat's own stat rows: the hand rules and hand size its draws obey,
  // the level its rows read, and the rating rows its ratings are priced by.
  C.handRules = P ? P.handRules : null;
  C.orderedDraw = P ? P.orderedDraw || null : null;
  C.handMax = P ? P.handMax : LEGACY_HAND_MAX;
  C.characterLevel = P ? P.level : undefined;
  C.derivedStatRuleSnapshot = P ? P.derivedStatRuleSnapshot : null;
  if (P && P.ratingRows && C.ratingsRules) C.ratingsRules.ratings = P.ratingRows;
}

function firstLiving(C) {
  return livingPlayers(C)[0] || [...C.players.values()][0];
}
function livingPlayers(C) {
  return C.order.map((id) => C.players.get(id)).filter((P) => P && P.connected && P.entity.alive);
}
function connectedCount(C) {
  return livingPlayers(C).length;
}

// ---- presence: join / leave rescale ----------------------------------------
export function joinCombat(C, player) {
  if (C.sharedExpansionVersion === 2 && !C._foundationTransaction) return F.foundationTransaction(C, candidate => joinCombat(candidate, player));
  const existing = C.players.get(player.id);
  if (existing) { // returning player reconnects to their frozen body
    existing.connected = true;
    existing.entity.alive = !existing.entity.blightTerminal && existing.entity.hp > 0;
    if (C.enemyKnowledge && existing.entity.alive && !C.result) addKnowledgeObserver(C, player.id, player.enemyKnowledgeProfile);
    if (C.sharedExpansionVersion === 2 && existing.endedBeforeDisconnect !== undefined) {
      existing.ended = existing.endedBeforeDisconnect;
      delete existing.endedBeforeDisconnect;
    }
    rescaleEnemies(C);
    if (C.phase === 'suspended') {
      C.phase = 'player';
      if (C.sharedExpansionVersion !== 2) startPlayerPhase(C);
      else if (livingPlayers(C).length && livingPlayers(C).every(seat => seat.ended)) enemyPhase(C);
    }
    return existing;
  }
  const seat = addPlayerState(C, player);
  if (C.enemyKnowledge && seat.entity.alive && !C.result) addKnowledgeObserver(C, player.id, player.enemyKnowledgeProfile);
  return seat;
}

export function predictCoopIntent(C, playerId, enemyInstanceId, actionSerial, maneuver) {
  if (!C._foundationTransaction) return F.foundationTransaction(C,
    candidate => predictCoopIntent(candidate, playerId, enemyInstanceId, actionSerial, maneuver), { advanceAction: false });
  return predictEnemyIntent(C, playerId, enemyInstanceId, actionSerial, maneuver);
}

export function leaveCombat(C, playerId) {
  if (C.sharedExpansionVersion === 2 && !C._foundationTransaction) return F.foundationTransaction(C, candidate => leaveCombat(candidate, playerId));
  const P = C.players.get(playerId);
  if (!P) return;
  if (C.sharedExpansionVersion === 2 && P.connected) P.endedBeforeDisconnect = P.ended;
  P.connected = false;
  P.ended = true; // no longer blocks the phase transition
  rescaleEnemies(C);
  if (!connectedCount(C)) { C.phase = 'suspended'; return; }
  if (C.pendingAbilityDiscard) return;
  maybeEndPlayerPhase(C);
}

// Enemy HP tracks the live headcount: rescale current + max by the mult delta.
function rescaleEnemies(C) {
  const target = coopHpMult(Math.max(1, connectedCount(C)), C.hpFactor) * C.extraHpMult;
  const ratio = target / C.baseHpMult;
  if (Math.abs(ratio - 1) < 1e-9) return;
  for (const e of C.enemies) {
    if (!e.alive) continue;
    e.maxHp = Math.max(1, Math.round(e.maxHp * ratio));
    e.hp = Math.max(1, Math.min(e.maxHp, Math.round(e.hp * ratio)));
  }
  C.baseHpMult = target;
}

// ---- queue + end checks -----------------------------------------------------
function drainQueue(C) {
  let guard = 0;
  while (C.queue.length) {
    if (++guard > QUEUE_GUARD) throw new Error('Co-op action queue did not drain (trigger loop?)');
    A.executeAction(C, C.queue.shift());
    if (C.pendingAbilityDiscard) return;
    endCheck(C);
    if (C.result) { C.queue.length = 0; return; }
  }
  endCheck(C);
}

function endCheck(C) {
  if (C.result) return;
  if (C.pendingAbilityPlay) return;
  if (C.pendingExpansionActions) return;
  // Downed players drop out of the fight; the run-level revive is the session's.
  for (const P of C.players.values()) {
    if (P.entity.alive && P.entity.hp <= 0) {
      P.entity.alive = false;
      C.emit('playerDowned', { playerId: P.id });
    }
  }
  const anyUp = [...C.players.values()].some((P) => P.connected && P.entity.alive);
  if (!anyUp) return finish(C, 'defeat');
  if (C.enemies.length && C.enemies.every((e) => !e.alive)) return finish(C, 'victory');
}

function finish(C, result) {
  C.result = result;
  C.phase = 'ended';
  C.queue.length = 0;
  C.emit('combatEnd', { victory: result === 'victory' });
  C.queue.length = 0;
}

// ---- player phase -----------------------------------------------------------
function startPlayerPhase(C) {
  C.turn += 1;
  C.phase = 'player';
  for (const P of livingPlayers(C)) {
    setActive(C, P);
    const e = P.entity;
    delete e.combatRetainedCards;
    const tacticalProtection = startTacticalTurn(C, e);
    if (C.combatExpansionVersion === 2) beginAshenBlightCycle(C, e, String(e.combatOwnerCycle));
    R.beginAbilityTurn(e);
    F.startFoundationTurn(C, e);
    P.ended = false;
    e.counters.cardsPlayedThisTurn = 0;
    // A turn's Stamina spend belongs to that turn alone. A seat that spent
    // and then disconnected is retired by leaveCombat without reaching
    // endOnePlayerTurn, so the counter is zeroed here, at every seat's turn
    // start, and never survives into a later turn to suppress its recovery.
    e.counters.staminaSpentThisTurn = 0;
    if (!S.getFlag(C, e, 'retainBlock')) e.block = Math.min(e.block, passiveMax(C.registries, e.relicIds, 'retainBlockUpTo', propertyMountsOf(C, e)));
    else { const cap = S.getCap(C, e, 'blockCap'); if (cap != null) e.block = Math.min(e.block, cap); }
    reconcileWardBlock(e);
    clearMeterGuards(e);
    if (C.combatExpansionVersion !== 2) clearCombatCounter(e);
    // Less what a Stagger took (plan phase 8): owed to this next turn only.
    e.energy = Math.max(0, e.energyMax - (e.pendingActionLoss || 0));
    e.pendingActionLoss = 0;
    if (C.combatExpansionVersion === 2) {
      fireOwnerHooks(C, e, 'ownerTurnStart'); drainQueue(C);
      if (C.result || !e.alive) continue;
      recoverStatusesAtOwnerStart(C, e, { cycle: e.combatOwnerCycle });
      sleepRestoration(C, e);
      e.energy = Math.max(0, e.energy - consumeControlActionLoss(C, e));
      if (tacticalProtection.block) A.gainBlock(C, e, tacticalProtection.block);
      if (tacticalProtection.barrier) C.enqueue({ effect: { op: 'gainBarrier', target: 'self', amount: tacticalProtection.barrier }, source: e, owner: e, target: e, meta: {} });
      drainQueue(C);
    }
    // A seat's FIRST hand is its opening hand, whichever turn it arrives on (a
    // seat that joins during the enemy phase opens on the next player turn).
    if (!controlRestrictions(C, e).locked) {
      const count = P.handRules ? turnDrawCount(C, !P.opened) : e.drawPerTurn;
      A.drawCards(C, !P.opened ? Math.max(1, count - (C.combatExpansionVersion === 2 ? ashenBlightBonuses(e).openingHandPenalty : 0)) : count);
    }
    P.opened = true;
    C.emit('playerTurnStart', { turn: C.turn, playerId: P.id });
    if (C.combatExpansionVersion !== 2) fireOwnerHooks(C, e, 'ownerTurnStart');
    drainQueue(C);
    if (C.result) return;
  }
}

/**
 * cardChoicePlan(C, playerId, cardInstanceId) → the pending choice playing
 * this seat's card offers ({ kind, options }), or null — the solo engine's
 * offer for this seat's class (model/cardChoices.js). playCard's `choice`
 * answers it.
 */
export function cardChoicePlan(C, playerId, cardInstanceId) {
  const P = C.players.get(playerId);
  if (!P) throw new Error(`Unknown player '${playerId}'`);
  const inst = P.piles.hand.find((c) => c.instanceId === cardInstanceId);
  if (!inst) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const registries = C.registriesForPlayer?.(playerId) || C.registries;
  const context = { ...C, registries, player: P.entity, combatExpansionVersion: P.entity.combatExpansionVersion || 1 };
  return cardChoice(registries, resolveCombatCard(context, inst), P.entity.classId, P.entity.stanceId);
}

export function previewCoopCard(C, playerId, instanceId, targetId, upcastTier) {
  const clone = F.candidateState(C);
  setActive(clone, clone.players.get(playerId));
  return soloPreviewCard(clone, instanceId, targetId, upcastTier);
}

export function recoverControl(C, playerId, selections) {
  if (!C._foundationTransaction) return F.foundationTransaction(C, candidate => recoverControl(candidate, playerId, selections));
  const P = C.players.get(playerId);
  if (C.phase !== 'player' || C.result || !P?.connected || !P.entity.alive || P.ended) throw new Error('This seat cannot recover now');
  setActive(C, P);
  const result = manualRecovery(C, P.entity, selections);
  if (!result.ok) throw new Error(result.reason);
  drainQueue(C);
  return result;
}

export function chooseBlightFeat(C, playerId, choice) {
  if (!C._foundationTransaction) return F.foundationTransaction(C, candidate => chooseBlightFeat(candidate, playerId, choice));
  const P = C.players.get(playerId);
  if (!P?.connected || !P.entity.alive || C.result) throw new Error('This seat cannot choose a feat now');
  setActive(C, P);
  const feat = chooseAshenBlightFeat(C, P.entity, choice);
  settleExpandedPools(C, P.entity, { allocatedAttributes: P.allocatedAttributes });
  setActive(C, P); refreshExpandedLoadout(C, P.entity); refreshCombatRatings(C);
  return { ok: true, feat };
}

/** Seat-specific live intent without rebinding the authoritative fight. */
export function previewCoopIntent(C, playerId, enemyInstanceId) {
  if (!C.players.has(playerId)) throw new Error(`Unknown player '${playerId}'`);
  // Intent math only reads the graph. Copy the active-seat facade and the one
  // ratings object setActive assigns, rather than cloning every event/pile.
  const context = { ...C, ...(C.ratingsRules ? { ratingsRules: { ...C.ratingsRules } } : {}) };
  setActive(context, C.players.get(playerId));
  return soloPreviewIntent(context, enemyInstanceId);
}

// A bot previews the requested owner without rebinding the authoritative fight.
export function cardNeedsEnemyTargetForPlayer(C, playerId, instanceId) {
  if (!C.players.has(playerId)) throw new Error(`Unknown player '${playerId}'`);
  const candidate = F.candidateState(C);
  setActive(candidate, candidate.players.get(playerId));
  return cardNeedsEnemyTargetNow(candidate, instanceId);
}

export function playCard(C, playerId, cardInstanceId, targetId, choice, upcastTier, selectedBuildup = undefined) {
  R.assertNoAbilityChoice(C);
  if (!C._foundationTransaction) return F.foundationTransaction(C, (candidate) => playCard(candidate, playerId, cardInstanceId, targetId, choice, upcastTier, selectedBuildup));
  if (C.result) throw new Error('Combat is over');
  if (C.phase !== 'player') throw new Error('Not the player phase');
  const P = C.players.get(playerId);
  if (!P || !P.connected || !P.entity.alive) throw new Error(`Player '${playerId}' cannot act`);
  if (P.ended) throw new Error(`Player '${playerId}' already ended their turn`);
  setActive(C, P);
  C._buffer = [];
  try {
    doPlayCard(C, { cardInstanceId, targetId, choice, upcastTier, selectedBuildup });
    return { events: C._buffer };
  } finally {
    C._buffer = null;
  }
}

function needsEnemyTarget(def) {
  return immediateCardEffects(def).some((eff) => eff.target === 'enemy');
}
function effectiveCost(C, def) {
  if (def.cost === 'X') return 'X';
  // Same framework cost authority as the solo engine (hand parity).
  return F.foundationCosts(C, def, playerWeightClass(C).weightClass, C.registries.framework.costProfile(def, {
    powerCostReduction: passiveSum(C.registries, C.player.relicIds, 'powerCostReduction', C.player.itemUpgradeLevels || {}),
    weightClass: playerWeightClass(C).weightClass,
  })).action;
}

function doPlayCard(C, { cardInstanceId, targetId, choice, upcastTier, selectedBuildup, preflightOnly = false }) {
  const p = C.player;
  const idx = C.piles.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx < 0) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const inst = C.piles.hand[idx];
  const def = resolveCombatCard(C, inst, { upcastTier });
  if (!controlGate(C, p, def).allowed) throw new Error('Recover from active control before playing this card');
  if (!preflightOnly && C.combatExpansionVersion === 2 && p.ashenBlight?.milestones.some(row => row.path === null)) throw new Error('Choose the pending Ashen Blight feat first');
  const kws = def.keywords || [];
  const chosen = assertCardChoice(cardChoice(C.registries, def, p.classId), choice);
  F.assertFoundationPlayable(C, def, chosen);
  if (C.registries.framework.isUnplayable(def)) throw new Error(`'${def.name}' is unplayable`);

  const isX = def.cost === 'X';
  const expandedCosts = C.combatExpansionVersion === 2 ? SoloCombatCosts.resolvedCardPlayCosts(C, def) : null;
  let cost = expandedCosts?.energy ?? ((isX ? p.energy : effectiveCost(C, def)) + (def.upcastSurcharge || 0));
  const pools = F.foundationCosts(C, def, playerWeightClass(C).weightClass, C.registries.framework.costProfile(def, { weightClass: playerWeightClass(C).weightClass }));
  let manaCost = Math.max(0, pools.mana - R.matchingAbilityCharges(p, { ...def, type: cardKind(def), authoredTags: def.cardTags || def.tags }).manaDiscount) + (def.upcastSurcharge || 0);
  let staminaCost = expandedCosts?.stamina ?? cost;

  const friendlyPlan = friendlyTargetPlan(def, C.playerKey, [...C.players.values()].map((entry) => ({
    id: entry.id,
    alive: entry.entity.alive,
    connected: entry.connected,
    ended: entry.ended,
  })));
  const chargedEnemyTarget = friendlyPlan.active && cardNeedsEnemyTargetNow(C, inst.instanceId);
  if (friendlyPlan.active && !chargedEnemyTarget) targetId = assertFriendlyTarget(friendlyPlan, targetId, C.playerKey);
  assertCardTarget(cardTargetPlan({ ...def, combatPreview: { needsTarget: chargedEnemyTarget } }, C.playerKey, C.enemies, [...C.players.values()].map(entry => ({
    id: entry.id, alive: entry.entity.alive, connected: entry.connected,
  }))), targetId);

  let target = null;
  if (targetId != null) {
    // targetId may be a teammate's member id (ally-targeted co-op cards).
    if (C.players.has(targetId)) {
      const AP = C.players.get(targetId);
      if (!AP.entity.alive) throw new Error(`Ally '${targetId}' is down`);
      target = AP.entity;
    } else {
      target = findEntity(C, targetId);
      if (!target || !target.alive) throw new Error(`Invalid target '${targetId}'`);
    }
  } else if (needsEnemyTarget(def) || chargedEnemyTarget) {
    target = C.enemies.find((e) => e.alive) || null;
    if (!target) throw new Error('No living enemy to target');
  }

  // The kind tag, not def.type (model/tree.js cardKind) — as solo combat reads it.
  const kind = cardKind(def);
  // The grip's derived tags ride the snapshot, as in solo combat (plan phase 3c).
  const derivedTags = gripTags(gripOf(C.registries, C.loadout, p.classId));
  const cardRef = {
    abilityKind: def.abilityKind || ((def.cardTags || def.tags || []).includes('source:spell') ? 'spell' : 'maneuver'), abilityFamily: def.abilityFamily, abilityRank: def.abilityRank,
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
    ...(inst.grantedBy ? { grantedBy: inst.grantedBy } : {}),
    damageSchool: inst.damageSchool ?? def.damageSchool,
    exposureBuildupPerHit: inst.exposureBuildupPerHit ?? def.exposureBuildupPerHit,
    // The resolved face's Poise/Ward values: a staff's Strike resolves
    // magical and carries Ward, which the registry def cannot (attackImpact).
    ...(def.cardRatingValues ? { cardRatingValues: def.cardRatingValues } : {}),
  };
  Object.assign(cardRef, tacticalCarrier(def, cardRef, C, p));
  const sourceSnapshots = F.cardSourceSnapshots(C, def, p, cardRef);
  if (cardRef.combatProfile?.maneuver === 'counter' && sourceSnapshots?.size) {
    Object.assign(cardRef, sourceSnapshots.values().next().value);
  }
  const before = { ...R.beforeAbilityPlay(C, p), cardTargetsAllEnemies: R.cardTargetsAllEnemies(def) };
  A.preflightCardHp(C, def, p, target, before);
  if (!preflightOnly && C.combatExpansionVersion === 2) {
    const candidate = F.candidateState(C);
    const acceptedCost = doPlayCard(candidate, { cardInstanceId, targetId, choice, upcastTier, selectedBuildup, preflightOnly: true });
    const price = def.ashenBlightCost || 0;
    const payment = payAshenBlight(C, p, { amount: price, combatKey: C.combatKey,
      receiptId: `${C.combatKey}:${C.playerKey}:${(p.counters.cardsPlayedThisCombat || 0) + 1}` });
    if (payment.recorded) C.emit('ashenBlightPaid', { playerId: C.playerKey, amount: payment.paid, added: payment.added, value: payment.value, outcome: payment.outcome });
    if (payment.terminal) {
      p.energy -= acceptedCost.energy; p.mana -= acceptedCost.mana;
      C.piles.hand.splice(idx, 1); C.piles.exhaust.push(inst);
      p.hp = 0; p.alive = false; p.blightTerminal = true;
      C.emit('playerDowned', { playerId: C.playerKey, reason: 'ashenBlight' }); endCheck(C); return;
    }
  }
  C.emit('cardPreparing', { cardInstanceId: inst.instanceId, cardId: inst.cardId, cardType: kind, cardTags: cardRef.authoredTags, abilityKind: cardRef.abilityKind, sourceId: p.id, sourcePlayerId: C.playerKey, playerId: C.playerKey, targetId: target?.id || null, ...before });
  drainQueue(C);
  const charges = R.matchingAbilityCharges(p, cardRef, { enemyAvailable: C.enemies.some(e => e.alive) });
  const chargedEffects = R.abilityChargedEffects(def.effects || [], charges, C.enemies.some(e => e.alive), C);
  if (chargedEffects !== def.effects) {
    if (target && target.kind !== 'enemy') throw new Error('Buildup charge requires a living enemy target');
    target ||= C.enemies.find(e => e.alive) || null;
  }
  if (C.combatExpansionVersion === 2) {
    ({ energy: cost, mana: manaCost, stamina: staminaCost } = SoloCombatCosts.resolvedCardPlayCosts(C, def));
  } else manaCost = Math.max(0, pools.mana - charges.manaDiscount) + (def.upcastSurcharge || 0);
  if (p.energy < cost) throw new Error('Not enough Actions (Stamina) to play this card');
  if (p.mana < manaCost) throw new Error('Not enough mana to play this card');
  if (preflightOnly) return { energy: cost, mana: manaCost };

  p.energy -= cost;
  if (cost > 0 || isX) C.emit('energySpent', { amount: cost });
  p.mana -= manaCost;
  if (manaCost > 0) C.emit('manaSpent', { amount: manaCost });
  if (staminaCost > 0) C.emit('staminaSpent', { amount: staminaCost });
  p.counters.staminaSpentThisTurn = (p.counters.staminaSpentThisTurn || 0) + staminaCost;

  C.piles.hand.splice(idx, 1);
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
    ...(selectedBuildup !== undefined ? { selectedBuildup } : {}),
  };
  if (kind === 'attack') { p.counters.attacksPlayedThisCombat += 1; meta.attackOrdinal = p.counters.attacksPlayedThisCombat; }
  R.recordAbilityCard(p, cardRef, manaCost);
  R.consumeAbilityCharges(p, charges.keys);
  if (charges.keys.length) C.emit('cardChargeConsumed', { keys: charges.keys, cardId: inst.cardId, sourceId: p.id, sourcePlayerId: C.playerKey, playerId: C.playerKey });
  C.pendingAbilityPlay = { instance: inst, ref: cardRef, kind, printedManaCost: def.manaCost || 0, targetId: target?.id || null, playerId: C.playerKey, before };
  const charged = new Set();
  const tacticalEffects = prepareTacticalCard(C, p, target, cardRef, chargedEffects, meta, { damageBonus: charges.damage + charges.damageEffect, poiseBonus: charges.break });
  const actions = F.cardActions(C, { ...def, effects: tacticalEffects }, p, target, cardRef, meta, sourceSnapshots);
  for (const [index, action] of actions.entries()) {
    action.meta = { ...action.meta, abilityEffectIndex: index };
    R.attachAbilityCharges(action, charges, charged);
  }
  enqueueExpandedAction(C, actions, { source: p, target, carrier: cardRef });
  enqueueCounterWard(C, p, cardRef, meta);
  C.emit('cardPlayed', {
    ...before, abilityKind: cardRef.abilityKind, printedManaCost: def.manaCost || 0, sourceId: p.id, sourcePlayerId: C.playerKey,
    playerId: C.playerKey, profileId: inst.profileId, upgraded: inst.upgraded, sourceArmamentId: inst.sourceArmamentId,
    ...(C.combatExpansionVersion === 2 ? { cardInstance: structuredClone(inst),
      ...(def.upcast ? { upcastTier: def.upcastTier ?? def.upcast.baseTier } : {}) } : {}),
    cardInstanceId: inst.instanceId, cardId: inst.cardId, cardType: kind, cardTags: cardRef.tags || [], derivedTags,
    targetId: target ? target.id : null, ordinalThisTurn: meta.ordinalThisTurn,
    ordinalThisCombat: meta.ordinalThisCombat, energySpent: cost, manaSpent: manaCost, staminaSpent: staminaCost,
  });
  drainQueue(C);

  finishAbilityPlay(C);
}

function finishAbilityPlay(C) {
  const play = R.abilityResolved(C);
  if (!play) return;
  const inst = play.instance;
  const def = resolveCombatCard(C, inst);

  if (!C.result) {
    // Same framework placement authority as the solo engine (hand parity).
    const destination = C.registries.framework.afterPlayDestination(def);
    if (destination === 'EXHAUST_PILE') {
      C.piles.exhaust.push(inst);
      C.emit('cardExhausted', { cardInstanceId: inst.instanceId, cardId: inst.cardId, reason: 'played' });
    } else if (destination === 'HAND') {
      C.piles.hand.push(inst);
    } else if (destination !== 'REMOVED_FROM_PLAY') {
      C.piles.discard.push(inst);
    }
    drainQueue(C);
  }
}

// targetId may be an enemy id (offensive flask) OR another player's member id
// (StS2 throw-to-ally: a self-beneficial flask lands on a chosen ally instead).
export function useFlask(C, playerId, slot, targetId, chargeKind = null) {
  R.assertNoAbilityChoice(C);
  if (!C._foundationTransaction && (C.foundation || C.sharedExpansionVersion === 2)) return F.foundationTransaction(C, (candidate) => useFlask(candidate, playerId, slot, targetId, chargeKind));
  if (C.result) throw new Error('Combat is over');
  if (C.phase !== 'player') throw new Error('Not the player phase');
  const P = C.players.get(playerId);
  if (!P || !P.connected || !P.entity.alive) throw new Error(`Player '${playerId}' cannot act`);
  const p = P.entity;
  const chargeId = chargeFlaskId(C.registries, chargeKind);
  const currentKey = chargeKind && `${chargeKind}Current`;
  if (chargeId && (!p.flaskCharges || p.flaskCharges[currentKey] <= 0)) throw new Error(`No ${chargeKind} flask charges`);
  const flask = chargeId ? { flaskId: chargeId } : p.flasks[slot];
  if (!flask) throw new Error(`No flask in slot ${slot}`);
  const def = C.registries.flasks.get(flask.flaskId);

  // Throw-to-ally: a non-offensive flask directed at another living player.
  const ally = targetId && C.players.get(targetId);
  const thrown = ally && !def.targeted && ally.entity.alive;
  const recipient = thrown ? ally.entity : p;

  let enemyTarget = null;
  if (!thrown) {
    if (targetId != null && !C.players.has(targetId)) {
      enemyTarget = findEntity(C, targetId);
      if (!enemyTarget || !enemyTarget.alive) throw new Error(`Invalid target '${targetId}'`);
    } else if (def.targeted) {
      enemyTarget = C.enemies.find((e) => e.alive) || null;
    }
  }

  if (chargeId) p.flaskCharges[currentKey] -= 1;
  else p.flasks.splice(slot, 1);
  // Effects that target 'self'/'player' resolve against the recipient (thrower
  // or ally); offensive effects still hit the enemy target.
  setActive(C, thrown ? ally : P);
  C._buffer = [];
  try {
    C.emit(thrown ? 'flaskThrown' : 'flaskUsed', { flaskId: flask.flaskId, slot, from: playerId, to: thrown ? targetId : (enemyTarget ? enemyTarget.id : null) });
    const amountMult = passiveMult(C.registries, p.relicIds, 'flaskPowerMult');
    for (const eff of def.effects || []) {
      C.enqueue({ effect: eff, source: recipient, owner: recipient, target: enemyTarget || recipient, meta: amountMult !== 1 ? { amountMult } : {} });
    }
    drainQueue(C);
    return { events: C._buffer };
  } finally { C._buffer = null; }
}

export function endTurn(C, playerId) {
  R.assertNoAbilityChoice(C);
  if (!C._foundationTransaction && (C.foundation || C.sharedExpansionVersion === 2)) return F.foundationTransaction(C, (candidate) => endTurn(candidate, playerId));
  if (C.result) throw new Error('Combat is over');
  if (C.phase !== 'player') throw new Error('Not the player phase');
  const P = C.players.get(playerId);
  if (!P || P.ended) return;
  setActive(C, P);
  endOnePlayerTurn(C, P);
  P.ended = true;
  maybeEndPlayerPhase(C);
}

export function chooseDiscard(C, playerId, cardInstanceIds) {
  if (!C._foundationTransaction) return F.foundationTransaction(C, candidate => chooseDiscard(candidate, playerId, cardInstanceIds));
  if (C.pendingAbilityDiscard?.playerId !== playerId) throw new Error('This discard choice belongs to another player');
  const P = C.players.get(playerId);
  if (!P) throw new Error('Unknown player');
  setActive(C, P);
  C._buffer = [];
  try {
    R.chooseAbilityDiscard(C, cardInstanceIds);
    drainQueue(C);
    finishAbilityPlay(C);
    return { events: C._buffer };
  } finally { C._buffer = null; }
}

function endOnePlayerTurn(C, P) {
  const p = P.entity;
  C.emit('playerTurnEnd', { turn: C.turn, playerId: P.id });
  fireOwnerHooks(C, p, 'ownerTurnEnd');
  drainQueue(C);
  if (C.result) return;
  // Each card still in this seat's hand fires its authored `onTurnEndInHand`
  // list (Guilt: lose 1 HP, SPEC §5.2) — the solo engine's rule, same order:
  // after owner hooks, before status decay and the hand discard.
  let inHandFired = false;
  for (const card of [...C.piles.hand]) {
    const hook = resolveCombatCard(C, card).onTurnEndInHand;
    if (!Array.isArray(hook) || !hook.length) continue;
    for (const eff of hook) {
      C.enqueue({ effect: eff, source: p, owner: p, target: p, meta: { cardInstanceId: card.instanceId, cardId: card.cardId, trigger: 'turnEndInHand' } });
    }
    inHandFired = true;
  }
  if (inHandFired) {
    drainQueue(C);
    if (C.result) return;
  }
  S.decayAtTurnEnd(C, p);
  const locked = controlRestrictions(C, p).locked;
  endControlTurn(C, p);
  // Stamina refills with the next player turn.
  p.counters.staminaSpentThisTurn = 0;
  const keep = [], toDiscard = [], toExhaust = [];
  for (const card of C.piles.hand) {
    if (locked) { keep.push(card); continue; }
    const def = resolveCombatCard(C, card);
    const fate = P.handRules || C.combatExpansionVersion === 2 ? endTurnCardFate(C, card)
      : C.foundation && def.effects.some((e) => e.op === 'dodgeRoll') ? 'keep' : C.registries.framework.endTurnFate(def);
    if (fate === 'keep') keep.push(card);
    else if (fate === 'exhaust') toExhaust.push(card);
    else toDiscard.push(card);
  }
  // Kept cards past the seat's hand size go to the discard, as a solo fight's
  // overflow does (co-op has no turn-end discard prompt).
  const overflow = !locked && P.handRules && P.handRules.overflow === 'discard' ? keep.splice(C.handMax) : [];
  C.piles.hand = keep;
  for (const card of toExhaust) { C.piles.exhaust.push(card); C.emit('cardExhausted', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'ethereal' }); }
  for (const card of overflow) { C.piles.discard.push(card); C.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'turnEnd' }); }
  returnUnplayedCards(C, toDiscard);
  p.energy = 0;
  drainQueue(C);
}

function maybeEndPlayerPhase(C) {
  if (C.result || C.phase !== 'player') return;
  const active = livingPlayers(C);
  if (active.length && active.every((P) => P.ended)) {
    enemyPhase(C);
    if (C.result) return;
    rollIntents(C);
    startPlayerPhase(C);
  }
}

// ---- enemy phase (fan-out) --------------------------------------------------
function enemyPhase(C) {
  C.phase = 'enemy';
  C.emit('enemyTurnStart', { turn: C.turn });
  for (const e of C.enemies) {
    if (e.alive && !S.getFlag(C, e, 'retainBlock')) e.block = 0;
    reconcileWardBlock(e);
    clearMeterGuards(e);
    if (C.sharedExpansionVersion !== 2) clearCombatCounter(e);
  }
  setActive(C, firstLiving(C));
  drainQueue(C);
  if (C.result) return;

  for (const enemy of C.enemies) {
    if (C.result) return;
    if (!enemy.alive) continue;
    setActive(C, firstLiving(C));
    let tacticalProtection = { block: 0, barrier: 0 };
    if (C.sharedExpansionVersion === 2) { C.combatExpansionVersion = 2; tacticalProtection = startTacticalTurn(C, enemy); }
    fireOwnerHooks(C, enemy, 'ownerTurnStart');
    drainQueue(C);
    if (C.result || !enemy.alive) continue;
    if (C.sharedExpansionVersion === 2) {
      recoverStatusesAtOwnerStart(C, enemy, { cycle: enemy.combatOwnerCycle }); sleepRestoration(C, enemy);
      if (controlRestrictions(C, enemy).locked) { if (!enemy.pendingMove) cancelKnowledgeAction(C, enemy); endControlTurn(C, enemy); continue; }
      if (tacticalProtection.block) A.gainBlock(C, enemy, tacticalProtection.block);
      if (tacticalProtection.barrier) C.enqueue({ effect: { op: 'gainBarrier', target: 'self', amount: tacticalProtection.barrier }, source: enemy, owner: enemy, target: enemy, meta: {} });
      drainQueue(C);
    }

    // Staggered (poise meter filled) or skipTurn: the telegraphed move is lost.
    if (enemy.skipNextTurn || S.getFlag(C, enemy, 'skipTurn')) {
      if (!enemy.pendingMove) cancelKnowledgeAction(C, enemy);
      enemy.skipNextTurn = false;
    } else if (enemy.pendingMove) {
      if (C.turn >= enemy.pendingMove.resolveOnTurn) {
        const def = C.registries.enemies.get(enemy.enemyId);
        const move = def.moves[enemy.pendingMove.moveId];
        const moveId = enemy.pendingMove.moveId;
        enemy.pendingMove = null;
        executeMove(C, enemy, move, moveId);
      }
    } else if (enemy.intent && enemy.intent.moveId) {
      const def = C.registries.enemies.get(enemy.enemyId);
      const move = def.moves[enemy.intent.moveId];
      if (move.delay) {
        const wc = move.delay.whileCharging || {};
        const carrier = enemyMoveCarrier(enemy, move, enemy.intent.moveId, C);
        if (wc.block != null) { setActive(C, firstLiving(C)); C.enqueue({ effect: { op: 'block', target: 'self', amount: wc.block }, source: enemy, owner: enemy, target: enemy, card: carrier, meta: { moveId: enemy.intent.moveId } }); drainQueue(C); }
        if (C.sharedExpansionVersion === 2) executeExpandedEnemyPayload(C, enemy, expandedEnemyMove(enemy, { ...wc, effects: wc.effects || [] }, enemy.intent.moveId, C), enemy.intent.moveId, carrier);
        for (const eff of C.sharedExpansionVersion === 2 ? [] : wc.effects || []) {
          if (C.result || !enemy.alive) break;
          applyEnemyEffect(C, enemy, eff, enemy.intent.moveId, carrier);
        }
        if (!C.result && enemy.alive) {
          enemy.pendingMove = { moveId: enemy.intent.moveId, resolveOnTurn: C.turn + (move.delay.turns != null ? move.delay.turns : 1) };
          enemy.intent = { ...enemy.intent, pending: true };
        }
      } else {
        executeMove(C, enemy, move, enemy.intent.moveId);
      }
    }
    if (C.result) return;
    if (enemy.alive) { setActive(C, firstLiving(C)); fireOwnerHooks(C, enemy, 'ownerTurnEnd'); drainQueue(C); if (C.result) return; if (enemy.alive) S.decayAtTurnEnd(C, enemy); }
  }
  C.emit('enemyTurnEnd', { turn: C.turn });
  setActive(C, firstLiving(C));
  drainQueue(C);
}

// A move's self/enemy-targeted parts apply once; player-targeted damage +
// effects fan out to every living player (each blocks independently).
function executeMove(C, enemy, move, moveId) {
  if (C.result || !enemy.alive) return;
  (enemy.performedMoves ||= []).push(moveId); // performed, not rolled (see combat.js)
  C.emit('enemyMoveStarted', { sourceId: enemy.id, enemyId: enemy.enemyId, moveId, kind: move.intent });
  if (C.sharedExpansionVersion === 2) move = expandedEnemyMove(enemy, move, moveId, { ...C, combatExpansionVersion: 2 });
  const carrier = enemyMoveCarrier(enemy, move, moveId, C);
  if (C.sharedExpansionVersion === 2) {
    executeExpandedEnemyPayload(C, enemy, move, moveId, carrier);
    return;
  }
  if (move.block != null && !(carrier.combatProfile.maneuver === 'counter' && enemyCounterDefensePrimed(enemy, moveId))) {
    setActive(C, firstLiving(C));
    C.enqueue({ effect: { op: 'block', target: 'self', amount: move.block }, source: enemy, owner: enemy, target: enemy, card: enemyMoveCarrier(enemy, move, moveId), meta: { moveId } });
    drainQueue(C);
    if (C.result || !enemy.alive) return;
  }
  const targets = livingPlayers(C);
  for (const P of targets) {
    if (C.result || !enemy.alive) return;
    setActive(C, P);
    if (move.damage != null && carrier.combatProfile.maneuver !== 'counter') {
      C.enqueue({ effect: { op: 'damage', target: 'player', amount: enemyMoveDamage(enemy, move), hits: move.hits != null ? move.hits : 1 }, source: enemy, owner: enemy, target: P.entity, card: carrier, meta: { moveId } });
      drainQueue(C);
      if (C.result || !enemy.alive) return;
    }
  }
  for (const eff of move.effects || []) {
    if (C.result || !enemy.alive) return;
    if (carrier.combatProfile.maneuver !== 'counter' || !['damage', 'poiseDamage'].includes(eff.op)) applyEnemyEffect(C, enemy, eff, moveId, carrier);
  }
}

// Ops that act on the active seat's card piles (actions.js reads `ctx.piles`,
// never `eff.target`). An enemy has no piles, so in an enemy effect these are
// always aimed at the players: they fan out like `target: 'player'` even when
// the row names no target (Dazed injectors; docs/FINISH.md, Owner decisions).
const SEAT_PILE_OPS = new Set(['addCard', 'draw', 'discard', 'exhaust', 'shuffleDiscardIntoDraw']);

function executeExpandedEnemyPayload(C, enemy, move, moveId, carrier) {
  const effects = move.effects || [];
  setActive(C, firstLiving(C)); C.combatExpansionVersion = 2;
  const self = effects.filter(effect => effect.target !== 'player' && !SEAT_PILE_OPS.has(effect.op));
  if (move.block != null && !(carrier.combatProfile.maneuver === 'counter' && enemyCounterDefensePrimed(enemy, moveId))) self.unshift({ op: 'block', target: 'self', amount: move.block });
  if (move.barrier != null && !(carrier.combatProfile.maneuver === 'counter' && enemyCounterDefensePrimed(enemy, moveId))) self.unshift({ op: 'gainBarrier', target: 'self', amount: move.barrier });
  for (const effect of self) C.enqueue({ effect, source: enemy, owner: enemy, target: enemy, card: carrier, meta: { moveId } });
  drainQueue(C);
  for (const P of livingPlayers(C)) {
    if (C.result || !enemy.alive) break;
    setActive(C, P);
    const targetEffects = effects.filter(effect => effect.target === 'player' || SEAT_PILE_OPS.has(effect.op));
    if (move.damage != null) targetEffects.unshift({ op: 'damage', target: 'player', amount: enemyMoveDamage(enemy, move), hits: move.hits ?? 1 });
    const actions = targetEffects.filter(effect => carrier.combatProfile.maneuver !== 'counter' || !['damage', 'poiseDamage'].includes(effect.op))
      .map(effect => ({ effect, source: enemy, owner: enemy, target: P.entity, card: carrier, meta: { moveId } }));
    enqueueExpandedAction(C, actions, { source: enemy, target: P.entity, carrier });
    drainQueue(C);
  }
}

// Player-targeted effects (and seat-pile ops) fan out to every living seat;
// self/enemy effects apply once.
function applyEnemyEffect(C, enemy, eff, moveId, rootCarrier = null) {
  if (C.result || !enemy.alive) return;
  const move = C.registries.enemies.get(enemy.enemyId).moves[moveId];
  const carrier = rootCarrier || enemyMoveCarrier(enemy, move, moveId);
  if (eff.target === 'player' || SEAT_PILE_OPS.has(eff.op)) {
    for (const P of livingPlayers(C)) {
      if (C.result || !enemy.alive) return;
      setActive(C, P);
      C.enqueue({ effect: eff, source: enemy, owner: enemy, target: P.entity, card: carrier, meta: { moveId } });
      drainQueue(C);
    }
  } else {
    setActive(C, firstLiving(C));
    C.enqueue({ effect: eff, source: enemy, owner: enemy, target: enemy, card: carrier, meta: { moveId } });
    drainQueue(C);
  }
}

// ---- enemy intent (mirrors combat.js §4.6) ----------------------------------
function rollIntents(C, isFirstTurn = false) {
  for (const enemy of C.enemies) {
    if (!enemy.alive) continue;
    if (enemy.pendingMove) { if (enemy.intent) enemy.intent = { ...enemy.intent, pending: true }; continue; }
    if (enemy.skipNextTurn || S.getFlag(C, enemy, 'skipTurn')) { enemy.intent = { kind: 'staggered', moveId: null }; continue; }
    const def = C.registries.enemies.get(enemy.enemyId);
    let moveId;
    if (isFirstTurn && def.firstMove) moveId = def.firstMove;
    else moveId = weightedMovePick(C, enemy, def);
    if (moveId == null) { enemy.intent = { kind: 'unknown', moveId: null }; continue; }
    enemy.movesHistory.push(moveId);
    if (C.sharedExpansionVersion !== 2) clearCombatCounter(enemy);
    if (C.sharedExpansionVersion === 2) C.combatExpansionVersion = 2;
    enemy.intent = buildIntent(def.moves[moveId], moveId, enemy, C);
    if (C.enemyKnowledge) {
      rollEnemyKnowledge(C, enemy, { charging: !!def.moves[moveId].delay });
      delete enemy.intentReads;
    } else if (enemy.intent.combatProfile.camp) {
      enemy.intentReads = Object.fromEntries(livingPlayers(C).map(P => [P.id, C.rng.float('enemyIntentVisibility') >= hiddenIntentChance(P.attributes || {}, C.combatIntentRules || {})]));
    } else delete enemy.intentReads;
    primeEnemyCounter(C, enemy, def.moves[moveId], moveId);
    drainQueue(C);
  }
}

function weightedMovePick(C, enemy, def) {
  const entries = Object.entries(def.moves).filter(([id, mv]) => !mv.locked || enemy.unlockedMoves.includes(id));
  if (!entries.length) return null;
  const eligible = entries.filter(([id, mv]) => {
    if (mv.maxConsecutive == null) return true;
    let run = 0;
    for (let i = enemy.movesHistory.length - 1; i >= 0; i--) { if (enemy.movesHistory[i] === id) run++; else break; }
    return run < mv.maxConsecutive;
  });
  const pool = eligible.length ? eligible : entries;
  const total = pool.reduce((acc, [, mv]) => acc + mv.weight, 0);
  if (total <= 0) return pool[0][0];
  let r = C.rng.float('enemyAI') * total;
  for (const [id, mv] of pool) { r -= mv.weight; if (r < 0) return id; }
  return pool[pool.length - 1][0];
}

function buildIntent(move, moveId, enemy = null, C = null) {
  move = expandedEnemyMove(enemy, move, moveId, C);
  return {
    combatProfile: enemyMoveCarrier(enemy || {}, move, moveId, C).combatProfile,
    kind: move.intent, moveId,
    damage: enemyMoveDamage(enemy, move),
    hits: move.damage != null ? (move.hits != null ? move.hits : 1) : null,
    block: move.block != null ? move.block : null,
    ...(move.barrier != null ? { barrier: move.barrier } : {}),
    delayed: !!move.delay, pending: false,
  };
}

/** Per-player ending HP + party result, for the session to apply. */
export function coopOutcome(C) {
  const survivors = {};
  for (const P of C.players.values()) survivors[P.id] = { hp: Math.max(0, P.entity.hp), downed: !P.entity.alive,
    ...(P.entity.ashenBlight ? { ashenBlight: structuredClone(P.entity.ashenBlight) } : {}), blightTerminal: !!P.entity.blightTerminal };
  return { survivors, result: C.result || (C.phase === 'suspended' ? 'suspended' : null) };
}
