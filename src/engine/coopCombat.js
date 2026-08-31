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
import { assertFriendlyTarget, friendlyTargetPlan } from '../model/friendlyTargets.js';

import * as A from './actions.js';
import * as S from './statuses.js';
import { emitEvent, fireOwnerHooks, findEntity } from './triggers.js';
import { resolveCard, passiveSum, passiveMult } from '../model/registries.js';
import { createPlayerCombatEntity, createEnemyCombatEntity } from '../model/state.js';

const QUEUE_GUARD = 10000;

// Co-op enemy HP scaling by live headcount — sub-linear, StS2-flavoured. The
// factor comes from balance.coop.headcountHpFactor; the default keeps the pure
// function usable (tests) and matches that balance value.
export function coopHpMult(headcount, factor = 0.6) {
  return 1 + factor * Math.max(0, headcount - 1); // 1p ×1.0, 2p ×1.6, 3p ×2.2, 4p ×2.8
}

/**
 * createCoopCombat({ registries, rng, players, enemyIds, extraHpMult?, enemyStatuses? })
 *   players = [{ id, classId, maxHp, hp, deck, relicIds, flasks }]
 * Enemy HP = base roll × coopHpMult(headcount) × extraHpMult (endless/custom).
 */
export function createCoopCombat({ registries, rng, players, enemyIds, extraHpMult = 1, enemyStatuses = [] }) {
  const bal = registries.balance || {};
  const C = {
    registries,
    rng,
    turn: 0,
    phase: 'setup', // 'player' | 'enemy' | 'ended' | 'suspended'
    result: null,
    handMax: bal.handMax != null ? bal.handMax : 10,
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
  C.emit = (type, payload) => emitEvent(C, type, payload);
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

  const headcount = players.length;
  C.hpFactor = (registries.balance.coop && registries.balance.coop.headcountHpFactor) || 0.6;
  C.baseHpMult = coopHpMult(headcount, C.hpFactor) * extraHpMult;

  // Enemies (HP rolled on 'enemyHP', then scaled — determinism preserved).
  enemyIds.forEach((enemyId, i) => {
    const def = registries.enemies.get(enemyId);
    let hp = rng.int('enemyHP', def.hp[0], def.hp[1]);
    hp = Math.max(1, Math.round(hp * C.baseHpMult));
    C.enemies.push(createEnemyCombatEntity({
      instanceId: `e${i + 1}`, enemyId, hp, poiseMax: def.poiseMax,
      arcaneExposure: def.arcaneExposure,
      damageResistanceBySchool: def.damageResistanceBySchool,
    }));
  });

  // Players — each an entity + own shuffled piles (Innate on top).
  for (const p of players) addPlayerState(C, p, { initial: true });

  // combatStart per player so each player's relics/statuses hook up.
  for (const P of livingPlayers(C)) {
    setActive(C, P);
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
  const entity = createPlayerCombatEntity({
    classId: p.classId, maxHp: p.maxHp, hp: p.hp != null ? p.hp : p.maxHp,
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
  const deck = (p.deck || []).map((c) => ({
    instanceId: c.instanceId,
    cardId: c.cardId,
    upgraded: !!c.upgraded,
    ...(c.mods && c.mods.length ? { mods: [...c.mods] } : {}), // equipment numbers
    ...(typeof c.damageSchool === 'string' ? { damageSchool: c.damageSchool } : {}),
    ...(Number.isInteger(c.exposureBuildupPerHit) ? { exposureBuildupPerHit: c.exposureBuildupPerHit } : {}),
    ...(c.equipmentRole ? { equipmentRole: c.equipmentRole, profileId: c.profileId, profileReceipt: c.profileReceipt } : {}),
    ...(c.sourceArmamentId ? { sourceArmamentId: c.sourceArmamentId } : {}),
    ...(Number.isInteger(c.smithingLevel) ? { smithingLevel: c.smithingLevel } : {}),
  }));
  const shuffled = C.rng.shuffle('shuffle', deck);
  const innate = [];
  const rest = [];
  for (const card of shuffled) {
    ((resolveCard(C.registries, card).keywords || []).includes('innate') ? innate : rest).push(card);
  }
  const P = {
    id: p.id,
    name: p.name || p.id,
    classId: p.classId,
    attributeMode: p.attributeMode,
    attributes: p.attributes ? { ...p.attributes } : undefined,
    entity,
    piles: { draw: [...innate, ...rest], hand: [], discard: [], exhaust: [] },
    connected: true,
    ended: false,
  };
  C.players.set(p.id, P);
  if (!C.order.includes(p.id)) C.order.push(p.id);
  if (!initial) {
    // Mid-combat join: give them a fresh turn's hand if it's the player phase.
    if (C.phase === 'player') {
      setActive(C, P);
      P.entity.energy = P.entity.energyMax;
      A.drawCards(C, P.entity.drawPerTurn);
    }
    rescaleEnemies(C);
  }
  return P;
}

function setActive(C, P) {
  C.player = P ? P.entity : null;
  C.piles = P ? P.piles : null;
  // Every player entity carries id 'player', so triggers.js scopes player-owned
  // once / limitPerTurn gates by this seat id instead (see ownerKeyFor). Without
  // it, one seat's once-per-combat relic/stance/status consumes the party's.
  C.playerKey = P ? P.id : null;
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
  const existing = C.players.get(player.id);
  if (existing) { // returning player reconnects to their frozen body
    existing.connected = true;
    existing.entity.alive = existing.entity.hp > 0;
    rescaleEnemies(C);
    if (C.phase === 'suspended') { C.phase = 'player'; startPlayerPhase(C); }
    return existing;
  }
  return addPlayerState(C, player);
}

export function leaveCombat(C, playerId) {
  const P = C.players.get(playerId);
  if (!P) return;
  P.connected = false;
  P.ended = true; // no longer blocks the phase transition
  rescaleEnemies(C);
  if (!connectedCount(C)) { C.phase = 'suspended'; return; }
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
    endCheck(C);
    if (C.result) { C.queue.length = 0; return; }
  }
  endCheck(C);
}

function endCheck(C) {
  if (C.result) return;
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
    P.ended = false;
    e.counters.cardsPlayedThisTurn = 0;
    if (!S.getFlag(C, e, 'retainBlock')) e.block = 0;
    else { const cap = S.getCap(C, e, 'blockCap'); if (cap != null) e.block = Math.min(e.block, cap); }
    e.energy = e.energyMax;
    A.drawCards(C, e.drawPerTurn);
    C.emit('playerTurnStart', { turn: C.turn, playerId: P.id });
    fireOwnerHooks(C, e, 'ownerTurnStart');
    drainQueue(C);
    if (C.result) return;
  }
}

export function playCard(C, playerId, cardInstanceId, targetId) {
  if (C.result) throw new Error('Combat is over');
  if (C.phase !== 'player') throw new Error('Not the player phase');
  const P = C.players.get(playerId);
  if (!P || !P.connected || !P.entity.alive) throw new Error(`Player '${playerId}' cannot act`);
  if (P.ended) throw new Error(`Player '${playerId}' already ended their turn`);
  setActive(C, P);
  C._buffer = [];
  try {
    doPlayCard(C, { cardInstanceId, targetId });
    return { events: C._buffer };
  } finally {
    C._buffer = null;
  }
}

function needsEnemyTarget(def) {
  return (def.effects || []).some((eff) => eff.target === 'enemy');
}
function effectiveCost(C, def) {
  if (def.cost === 'X') return 'X';
  let cost = def.cost;
  if (def.type === 'power') cost = Math.max(0, cost - passiveSum(C.registries, C.player.relicIds, 'powerCostReduction', C.player.itemUpgradeLevels || {}));
  return cost;
}

function doPlayCard(C, { cardInstanceId, targetId }) {
  const p = C.player;
  const idx = C.piles.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx < 0) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const inst = C.piles.hand[idx];
  const def = resolveCard(C.registries, inst);
  const kws = def.keywords || [];
  if (kws.includes('unplayable')) throw new Error(`'${def.name}' is unplayable`);

  const isX = def.cost === 'X';
  const cost = isX ? p.energy : effectiveCost(C, def);
  const manaCost = def.manaCost || 0;
  const staminaCost = def.staminaCost || 0;
  if (p.energy < cost) throw new Error(`Not enough energy (need ${cost}, have ${p.energy})`);
  if (p.mana < manaCost) throw new Error(`Not enough mana (need ${manaCost}, have ${p.mana})`);
  if (p.stamina < staminaCost) throw new Error(`Not enough stamina (need ${staminaCost}, have ${p.stamina})`);

  const friendlyPlan = friendlyTargetPlan(def, C.playerKey, [...C.players.values()].map((entry) => ({
    id: entry.id,
    alive: entry.entity.alive,
    connected: entry.connected,
    ended: entry.ended,
  })));
  if (friendlyPlan.active) targetId = assertFriendlyTarget(friendlyPlan, targetId, C.playerKey);

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
  } else if (needsEnemyTarget(def)) {
    target = C.enemies.find((e) => e.alive) || null;
    if (!target) throw new Error('No living enemy to target');
  }

  p.energy -= cost;
  if (cost > 0 || isX) C.emit('energySpent', { amount: cost });
  p.mana -= manaCost;
  if (manaCost > 0) C.emit('manaSpent', { amount: manaCost });
  p.stamina -= staminaCost;
  if (staminaCost > 0) C.emit('staminaSpent', { amount: staminaCost });

  C.piles.hand.splice(idx, 1);
  p.counters.cardsPlayedThisTurn += 1;
  p.counters.cardsPlayedThisCombat += 1;
  const meta = {
    energySpent: cost,
    manaSpent: manaCost,
    staminaSpent: staminaCost,
    ordinalThisTurn: p.counters.cardsPlayedThisTurn,
    ordinalThisCombat: p.counters.cardsPlayedThisCombat,
    attackOrdinal: null,
  };
  if (def.type === 'attack') { p.counters.attacksPlayedThisCombat += 1; meta.attackOrdinal = p.counters.attacksPlayedThisCombat; }
  const cardRef = {
    instanceId: inst.instanceId, cardId: inst.cardId, upgraded: inst.upgraded,
    type: def.type, tags: def.cardTags,
    damageSchool: inst.damageSchool ?? def.damageSchool,
    exposureBuildupPerHit: inst.exposureBuildupPerHit ?? def.exposureBuildupPerHit,
  };

  for (const eff of def.effects || []) C.enqueue({ effect: eff, source: p, owner: p, target, card: cardRef, meta });
  C.emit('cardPlayed', {
    cardInstanceId: inst.instanceId, cardId: inst.cardId, cardType: def.type,
    targetId: target ? target.id : null, ordinalThisTurn: meta.ordinalThisTurn,
    ordinalThisCombat: meta.ordinalThisCombat, energySpent: cost, manaSpent: manaCost, staminaSpent: staminaCost,
  });
  drainQueue(C);

  if (!C.result) {
    if (kws.includes('exhaust')) {
      C.piles.exhaust.push(inst);
      C.emit('cardExhausted', { cardInstanceId: inst.instanceId, cardId: inst.cardId, reason: 'played' });
    } else if (def.type !== 'power') {
      C.piles.discard.push(inst);
    }
    drainQueue(C);
  }
}

// targetId may be an enemy id (offensive flask) OR another player's member id
// (StS2 throw-to-ally: a self-beneficial flask lands on a chosen ally instead).
export function useFlask(C, playerId, slot, targetId, chargeKind = null) {
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
  if (C.result) throw new Error('Combat is over');
  if (C.phase !== 'player') throw new Error('Not the player phase');
  const P = C.players.get(playerId);
  if (!P || P.ended) return;
  setActive(C, P);
  endOnePlayerTurn(C, P);
  P.ended = true;
  maybeEndPlayerPhase(C);
}

function endOnePlayerTurn(C, P) {
  const p = P.entity;
  C.emit('playerTurnEnd', { turn: C.turn, playerId: P.id });
  fireOwnerHooks(C, p, 'ownerTurnEnd');
  drainQueue(C);
  if (C.result) return;
  S.decayAtTurnEnd(C, p);
  const keep = [], toDiscard = [], toExhaust = [];
  for (const card of C.piles.hand) {
    const kws = resolveCard(C.registries, card).keywords || [];
    if (kws.includes('retain')) keep.push(card);
    else if (kws.includes('ethereal')) toExhaust.push(card);
    else toDiscard.push(card);
  }
  C.piles.hand = keep;
  for (const card of toExhaust) { C.piles.exhaust.push(card); C.emit('cardExhausted', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'ethereal' }); }
  for (const card of toDiscard) { C.piles.discard.push(card); C.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'turnEnd' }); }
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
  for (const e of C.enemies) { if (e.alive && !S.getFlag(C, e, 'retainBlock')) e.block = 0; }
  setActive(C, firstLiving(C));
  drainQueue(C);
  if (C.result) return;

  for (const enemy of C.enemies) {
    if (C.result) return;
    if (!enemy.alive) continue;
    setActive(C, firstLiving(C));
    fireOwnerHooks(C, enemy, 'ownerTurnStart');
    drainQueue(C);
    if (C.result || !enemy.alive) continue;

    // Staggered (poise meter filled) or skipTurn: the telegraphed move is lost.
    if (enemy.skipNextTurn || S.getFlag(C, enemy, 'skipTurn')) {
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
        if (wc.block != null) { setActive(C, firstLiving(C)); C.enqueue({ effect: { op: 'block', target: 'self', amount: wc.block }, source: enemy, owner: enemy, target: enemy, meta: {} }); drainQueue(C); }
        for (const eff of wc.effects || []) applyEnemyEffect(C, enemy, eff);
        enemy.pendingMove = { moveId: enemy.intent.moveId, resolveOnTurn: C.turn + (move.delay.turns != null ? move.delay.turns : 1) };
        enemy.intent = { ...enemy.intent, pending: true };
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
  C.emit('enemyMoveStarted', { sourceId: enemy.id, enemyId: enemy.enemyId, moveId, kind: move.intent });
  if (move.block != null) {
    setActive(C, firstLiving(C));
    C.enqueue({ effect: { op: 'block', target: 'self', amount: move.block }, source: enemy, owner: enemy, target: enemy, meta: { moveId } });
    drainQueue(C);
    if (C.result) return;
  }
  const targets = livingPlayers(C);
  for (const P of targets) {
    if (C.result) return;
    setActive(C, P);
    if (move.damage != null) {
      C.enqueue({ effect: { op: 'damage', target: 'player', amount: move.damage, hits: move.hits != null ? move.hits : 1 }, source: enemy, owner: enemy, target: P.entity, meta: { moveId } });
      drainQueue(C);
      if (C.result) return;
    }
  }
  for (const eff of move.effects || []) applyEnemyEffect(C, enemy, eff, moveId);
}

// Player-targeted effects fan out; self/enemy effects apply once.
function applyEnemyEffect(C, enemy, eff, moveId) {
  if (eff.target === 'player') {
    for (const P of livingPlayers(C)) {
      if (C.result) return;
      setActive(C, P);
      C.enqueue({ effect: eff, source: enemy, owner: enemy, target: P.entity, meta: { moveId } });
      drainQueue(C);
    }
  } else {
    setActive(C, firstLiving(C));
    C.enqueue({ effect: eff, source: enemy, owner: enemy, target: enemy, meta: { moveId } });
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
    enemy.intent = buildIntent(def.moves[moveId], moveId);
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

function buildIntent(move, moveId) {
  return {
    kind: move.intent, moveId,
    damage: move.damage != null ? move.damage : null,
    hits: move.damage != null ? (move.hits != null ? move.hits : 1) : null,
    block: move.block != null ? move.block : null,
    delayed: !!move.delay, pending: false,
  };
}

/** Per-player ending HP + party result, for the session to apply. */
export function coopOutcome(C) {
  const survivors = {};
  for (const P of C.players.values()) survivors[P.id] = { hp: Math.max(0, P.entity.hp), downed: !P.entity.alive };
  return { survivors, result: C.result || (C.phase === 'suspended' ? 'suspended' : null) };
}
