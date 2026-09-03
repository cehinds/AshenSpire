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
import { emitEvent, fireOwnerHooks, findEntity } from './triggers.js';
import * as S from '../framework/statusSemantics.js';
import { resolveCard, passiveSum, passiveMult } from '../model/registries.js';
import { evaluate } from '../model/formulas.js';
import { computeTokenBindings } from '../model/validate.js';
import { createPlayerCombatEntity, createEnemyCombatEntity, stampPlayerPoiseMax } from '../model/state.js';
import { playerPoiseThresholdReceipt, playerLoadReceipt } from '../model/statProjection.js';
import { canSwap, cycleSet, swapCostFor, resolveSwapCostRule, createEquipmentProfileRuleSnapshot, runMods, EQUIPMENT_POOL_FIELDS, moveEquipmentPool } from '../model/loadout.js';
// Deck restamping goes through the framework's adopted composition door.
import { stampDeck, reconcileGrantedCardsInCombat } from '../framework/deckComposition.js';
import { chargeFlaskId } from '../model/gracerefill.js';

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
  registries, rng, player, enemyIds, hpMult = 1, enemyStatuses = [], playerStatuses = [],
  // WHICH SWAP-COST RULE THIS FIGHT IS UNDER (A8). Resolved once here rather
  // than per swap, for the reason `hpMult` is: a fight's rules must not change
  // under the player halfway through it. Omitted resolves to the shipping
  // default, so every existing caller — and every test — keeps the price it
  // already had, and `resolveSwapCostRule(registries, meta)` is the one place
  // his Settings choice is read.
  swapCostRule = null,
}) {
  const bal = registries.balance || {};
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
      ? playerPoiseThresholdReceipt(registries, { loadout: player.loadout, relics: player.relicIds || [], class: player.classId, itemUpgradeLevels: player.itemUpgradeLevels || {} }).value
      : 0);
  const combat = {
    registries,
    equipmentProfileRuleSnapshot,
    // Namespaced item tiers are the sole current authority. The legacy armament
    // map is accepted only at the load/migration door, never written here.
    itemUpgradeLevels: structuredClone(player.itemUpgradeLevels || {}),
    equipmentPoolDeficits: player.equipmentPoolDeficits
      ? { ...player.equipmentPoolDeficits }
      : { hp: Math.max(0, player.maxHp - player.hp), mana: Math.max(0, maxMana - (player.mana ?? maxMana)), stamina: Math.max(0, (player.maxStamina || 0) - (player.stamina ?? player.maxStamina ?? 0)) },
    equipmentChanged: false,
    rng,
    turn: 0,
    phase: 'setup', // 'player' | 'enemy' | 'ended'
    result: null, // null | 'victory' | 'defeat'
    handMax: bal.handMax != null ? bal.handMax : 10,
    drawPerTurn: player.drawPerTurn,
    player: createPlayerCombatEntity({
      classId: player.classId,
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
    }),
    enemies: [],
    // The SAME object the run holds, not a copy: a weapon swapped mid-fight is
    // still swapped when the fight ends.
    loadout: player.loadout || null,
    attributes: player.attributes ? { ...player.attributes } : null,
    swapCostRule: swapCostRule || resolveSwapCostRule(registries, null),
    swapsLeft: 0,
    piles: { draw: [], hand: [], discard: [], exhaust: [] },
    queue: [],
    eventLog: [],
    _buffer: null,
    triggerState: new Map(),
    _idCounter: 0,
    _emitDepth: 0,
  };
  combat.emit = (type, payload) => emitEvent(combat, type, payload);
  combat.enqueue = (action) => combat.queue.push(action);
  combat.nextInstanceId = () => `gen${++combat._idCounter}`;

  // Enemies — HP rolled on stream 'enemyHP' (SPEC §3.11, §4.6). An optional
  // hpMult (Custom Climb difficulty rules) scales the rolled HP after the roll,
  // so the same seed rolls the same base then scales — determinism preserved.
  enemyIds.forEach((enemyId, i) => {
    const def = registries.enemies.get(enemyId);
    let hp = rng.int('enemyHP', def.hp[0], def.hp[1]);
    if (hpMult !== 1) hp = Math.max(1, Math.round(hp * hpMult));
    combat.enemies.push(
      createEnemyCombatEntity({
        instanceId: `e${i + 1}`, enemyId, hp, poiseMax: def.poiseMax,
        arcaneExposure: def.arcaneExposure,
        damageResistanceBySchool: def.damageResistanceBySchool,
      })
    );
    combat.emit('enemySpawned', { targetId: `e${i + 1}`, enemyId });
  });

  // Deck → draw pile: shuffle (stream 'shuffle'), Innate cards to top (§4.1(1)).
  const deck = player.deck.map((c) => ({
    instanceId: c.instanceId,
    cardId: c.cardId,
    upgraded: !!c.upgraded,
    ...(c.acquiredAt !== undefined ? { acquiredAt: structuredClone(c.acquiredAt) } : {}),
    // Equipment numbers ride on the instance (model/loadout.js) — copy them in
    // or every card would come back to its bare-handed self at combat start.
    ...(c.mods && c.mods.length ? { mods: [...c.mods] } : {}),
    ...(typeof c.damageSchool === 'string' ? { damageSchool: c.damageSchool } : {}),
    ...(Number.isInteger(c.exposureBuildupPerHit) ? { exposureBuildupPerHit: c.exposureBuildupPerHit } : {}),
    ...(c.equipmentRole ? { equipmentRole: c.equipmentRole, profileId: c.profileId, profileReceipt: c.profileReceipt } : {}),
    ...(c.equipmentAttackSlotId ? { equipmentAttackSlotId: c.equipmentAttackSlotId } : {}),
    ...(c.equipmentPlanFingerprint ? { equipmentPlanFingerprint: c.equipmentPlanFingerprint } : {}),
    ...(c.sourceHand ? { sourceHand: c.sourceHand } : {}),
    ...(c.weaponId ? { weaponId: c.weaponId } : {}),
    ...(c.sourceArmamentId ? { sourceArmamentId: c.sourceArmamentId } : {}),
    ...(Number.isInteger(c.smithingLevel) ? { smithingLevel: c.smithingLevel } : {}),
    ...(c.sourceEquipmentInstanceId ? { sourceEquipmentInstanceId: c.sourceEquipmentInstanceId } : {}),
  }));
  const shuffled = rng.shuffle('shuffle', deck);
  const innate = [];
  const rest = [];
  for (const card of shuffled) {
    const def = resolveCard(registries, card);
    (registries.framework.isInnate(def) ? innate : rest).push(card);
  }
  combat.piles.draw = [...innate, ...rest];

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
    const action = combat.queue.shift();
    A.executeAction(combat, action);
    endCheck(combat);
    if (combat.result) {
      combat.queue.length = 0;
      return;
    }
  }
  endCheck(combat);
}

function endCheck(combat) {
  if (combat.result) return;
  if (!combat.player.alive || combat.player.hp <= 0) {
    finishCombat(combat, 'defeat');
  } else if (combat.enemies.length > 0 && combat.enemies.every((e) => !e.alive)) {
    finishCombat(combat, 'victory');
  }
}

function finishCombat(combat, result) {
  combat.result = result;
  combat.phase = 'ended';
  combat.queue.length = 0;
  combat.emit('combatEnd', { victory: result === 'victory' });
  combat.queue.length = 0; // combatEnd triggers cannot enqueue combat actions
}

// ---------------------------------------------------------------------------
// Turn loop (SPEC §4.1 — order contractual)
// ---------------------------------------------------------------------------

function startPlayerTurn(combat) {
  combat.turn += 1;
  combat.phase = 'player';
  const p = combat.player;
  p.counters.cardsPlayedThisTurn = 0;
  const eqcfg = combat.registries.balance.equipment || {};
  combat.swapsLeft = eqcfg.swapCostKind === 'allowance' ? eqcfg.swapAllowancePerTurn || 0 : 0;

  // (2) Lose all block — unless modified (generic 'retainBlock' modifier;
  // a 'blockCap' modifier clamps what is kept).
  if (!S.getFlag(combat, p, 'retainBlock')) {
    p.block = 0;
  } else {
    const cap = S.getCap(combat, p, 'blockCap');
    if (cap != null) p.block = Math.min(p.block, cap);
  }

  // Set energy to base (relics that add energy hook playerTurnStart).
  p.energy = p.energyMax;

  // Draw.
  A.drawCards(combat, combat.drawPerTurn);

  // playerTurnStart triggers + owner-relative status/stance hooks.
  combat.emit('playerTurnStart', { turn: combat.turn });
  fireOwnerHooks(combat, p, 'ownerTurnStart');
  drainQueue(combat);
}

function endPlayerTurn(combat) {
  const p = combat.player;

  // (4) playerTurnEnd triggers first…
  combat.emit('playerTurnEnd', { turn: combat.turn });
  fireOwnerHooks(combat, p, 'ownerTurnEnd');
  drainQueue(combat);
  if (combat.result) return;

  // …then player status decay (perTurnEnd statuses −1 stack at owner's turn end)…
  S.decayAtTurnEnd(combat, p);

  // …then stamina (framework contract: Mana and Stamina): an idle turn recovers,
  // a spending turn does not — the framework decides, this engine moves the pool.
  if (Number.isFinite(p.maxStamina) && p.maxStamina > 0) {
    const next = combat.registries.framework.staminaTurnEnd({
      currentStamina: p.stamina, maxStamina: p.maxStamina, staminaSpentThisTurn: p.counters.staminaSpentThisTurn || 0,
    });
    if (next.currentStamina !== p.stamina) {
      const amount = next.currentStamina - p.stamina;
      p.stamina = next.currentStamina;
      combat.emit('staminaRecovered', { amount, reason: 'idle' });
    }
  }
  p.counters.staminaSpentThisTurn = 0;

  // …then discard hand except Retain; Ethereal cards exhaust instead. The
  // fate of each card is the framework's call (src/framework/lifecycle.js);
  // this engine only moves the card and emits the receipt.
  const keep = [];
  const toDiscard = [];
  const toExhaust = [];
  for (const card of combat.piles.hand) {
    const def = resolveCard(combat.registries, card);
    const fate = combat.registries.framework.endTurnFate(def);
    if (fate === 'keep') keep.push(card);
    else if (fate === 'exhaust') toExhaust.push(card);
    else toDiscard.push(card);
  }
  combat.piles.hand = keep;
  for (const card of toExhaust) {
    combat.piles.exhaust.push(card);
    combat.emit('cardExhausted', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'ethereal' });
  }
  for (const card of toDiscard) {
    combat.piles.discard.push(card);
    combat.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'turnEnd' });
  }

  // Unspent energy is lost.
  p.energy = 0;
  drainQueue(combat);
}

function enemyPhase(combat) {
  combat.phase = 'enemy';
  combat.emit('enemyTurnStart', { turn: combat.turn });

  // (5) Enemies lose their block at the start of THEIR turn.
  for (const e of combat.enemies) {
    if (!e.alive) continue;
    if (!S.getFlag(combat, e, 'retainBlock')) e.block = 0;
  }
  drainQueue(combat);
  if (combat.result) return;

  for (const enemy of combat.enemies) {
    if (combat.result) return;
    if (!enemy.alive) continue;

    // Owner-relative turn-start hooks (DoT ticks etc.).
    fireOwnerHooks(combat, enemy, 'ownerTurnStart');
    drainQueue(combat);
    if (combat.result) return;
    if (!enemy.alive) continue;

    if (enemy.skipNextTurn || S.getFlag(combat, enemy, 'skipTurn')) {
      // Staggered / skip: the telegraphed move does not happen.
      enemy.skipNextTurn = false;
    } else if (enemy.pendingMove) {
      if (combat.turn >= enemy.pendingMove.resolveOnTurn) {
        // Delayed move resolving: the committed attack lands regardless of
        // newly rolled intents (SPEC §5.3 'Held Blade' pattern, generic data).
        const def = combat.registries.enemies.get(enemy.enemyId);
        const moveId = enemy.pendingMove.moveId;
        const move = def.moves[moveId];
        enemy.pendingMove = null;
        executeMovePayload(combat, enemy, move, moveId);
      }
      // else: still charging (delay.turns > 1) — the enemy does nothing.
    } else if (enemy.intent && enemy.intent.moveId) {
      const def = combat.registries.enemies.get(enemy.enemyId);
      const move = def.moves[enemy.intent.moveId];
      if (move.delay) {
        // Commit turn: telegraph stays, do the whileCharging part now,
        // resolve the real payload on a later enemy turn.
        const wc = (move.delay && move.delay.whileCharging) || {};
        if (wc.block != null) {
          combat.enqueue({
            effect: { op: 'block', target: 'self', amount: wc.block },
            source: enemy,
            owner: enemy,
            target: combat.player,
            meta: {},
          });
        }
        for (const eff of wc.effects || []) {
          combat.enqueue({ effect: eff, source: enemy, owner: enemy, target: combat.player, meta: {} });
        }
        enemy.pendingMove = {
          moveId: enemy.intent.moveId,
          resolveOnTurn: combat.turn + (move.delay.turns != null ? move.delay.turns : 1),
        };
        enemy.intent = { ...enemy.intent, pending: true };
      } else {
        executeMovePayload(combat, enemy, move, enemy.intent.moveId);
      }
    }
    drainQueue(combat);
    if (combat.result) return;

    // Owner-relative turn-end hooks, then decay (perTurnEnd statuses the
    // player applied to an enemy tick down at the ENEMY's turn end).
    if (enemy.alive) {
      fireOwnerHooks(combat, enemy, 'ownerTurnEnd');
      drainQueue(combat);
      if (combat.result) return;
      if (enemy.alive) S.decayAtTurnEnd(combat, enemy);
    }
  }

  combat.emit('enemyTurnEnd', { turn: combat.turn });
  drainQueue(combat);
}

// Enqueue a move's payload as ordinary actions (SPEC §3.9: only executed
// actions mutate). Order: damage hits, block, then effects.
// 'enemyMoveStarted' marks the acting enemy so the UI can pace playback
// one actor at a time (SPEC §7.4); content triggers may also key off it.
function executeMovePayload(combat, enemy, move, moveId) {
  combat.emit('enemyMoveStarted', { sourceId: enemy.id, enemyId: enemy.enemyId, moveId, kind: move.intent });
  if (move.damage != null) {
    combat.enqueue({
      effect: { op: 'damage', target: 'player', amount: move.damage, hits: move.hits != null ? move.hits : 1 },
      source: enemy,
      owner: enemy,
      target: combat.player,
      meta: { moveId },
    });
  }
  if (move.block != null) {
    combat.enqueue({
      effect: { op: 'block', target: 'self', amount: move.block },
      source: enemy,
      owner: enemy,
      target: combat.player,
      meta: { moveId },
    });
  }
  for (const eff of move.effects || []) {
    combat.enqueue({ effect: eff, source: enemy, owner: enemy, target: combat.player, meta: { moveId } });
  }
}

// ---------------------------------------------------------------------------
// Enemy move selection — weighted state machine + maxConsecutive (SPEC §4.6)
// ---------------------------------------------------------------------------

function rollIntents(combat, isFirstTurn = false) {
  for (const enemy of combat.enemies) {
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
    let moveId;
    if (isFirstTurn && def.firstMove) {
      moveId = def.firstMove; // optional scripted opener
    } else {
      moveId = weightedMovePick(combat, enemy, def);
    }
    if (moveId == null) {
      enemy.intent = { kind: 'unknown', moveId: null };
      continue;
    }
    enemy.movesHistory.push(moveId);
    enemy.intent = buildIntent(def.moves[moveId], moveId);
  }
}

function weightedMovePick(combat, enemy, def) {
  const entries = Object.entries(def.moves).filter(
    ([id, mv]) => !mv.locked || enemy.unlockedMoves.includes(id)
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

function buildIntent(move, moveId) {
  return {
    kind: move.intent,
    moveId,
    damage: move.damage != null ? move.damage : null,
    hits: move.damage != null ? (move.hits != null ? move.hits : 1) : null,
    block: move.block != null ? move.block : null,
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
 *   { type: 'playCard', cardInstanceId, targetId? }
 *   { type: 'endTurn' }
 *   { type: 'useFlask', slot, targetId? }
 *
 * Throws on illegal intents (wrong phase, unaffordable card, unknown ids).
 * The action queue drains fully before this returns (SPEC §3.9).
 */
export function dispatch(combat, intent) {
  if (combat.result) throw new Error('Combat is over');
  combat._buffer = [];
  try {
    switch (intent.type) {
      case 'playCard':
        doPlayCard(combat, intent);
        break;
      case 'endTurn':
        doEndTurn(combat);
        break;
      case 'useFlask':
        doUseFlask(combat, intent);
        break;
      case 'swapArmament':
        doSwapArmament(combat, intent);
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
    relicDelta: passiveSum(combat.registries, p.relicIds, 'swapCostDelta'),
  });
  if (cfg.swapCostKind === 'allowance') {
    if ((combat.swapsLeft || 0) < 1) throw new Error('No swaps left this turn');
  } else if (p.energy < price.cost) {
    throw new Error(`Swapping costs ${price.cost} Energy`);
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

  if (cfg.swapCostKind === 'allowance') combat.swapsLeft -= 1;
  else p.energy -= price.cost;

  // Stable generated attack slots rebind wherever combat currently holds them.
  // The intent resolves before this mutation, so no in-flight card changes
  // underneath its own effects.
  const piles = [combat.piles.hand, combat.piles.draw, combat.piles.discard, combat.piles.exhaust];
  const run = {
    deck: [],
    loadout: combat.loadout,
    class: p.classId,
    attributes: combat.attributes,
    itemUpgradeLevels: combat.itemUpgradeLevels,
    equipmentProfileRuleSnapshot: combat.equipmentProfileRuleSnapshot,
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
  stampPlayerPoiseMax(p, playerPoiseThresholdReceipt(combat.registries, { loadout: combat.loadout, relics: p.relicIds || [], class: p.classId, itemUpgradeLevels: combat.itemUpgradeLevels || {} }).value);

  // The event carries what it COST and under which rule — a price nobody can
  // read back is a price nobody can check, and "try each" is a comparison.
  combat.emit('armamentSwapped', { slotId, setIndex, cost: price.cost, rule: price.ruleId });
  if (cfg.swapEndsTurn) doEndTurn(combat);
}

function needsEnemyTarget(def) {
  return (def.effects || []).some((eff) => eff.target === 'enemy');
}

/**
 * The Weight Class the player fights in — derived, never stored: the loadout
 * this fight holds (the SAME object the run holds, so a mid-fight swap moves
 * it) and the run attributes, decided by the framework (bridge.weightClass
 * over playerLoadReceipt). A fixture with no loadout or attributes carries no
 * load and stands Light, the contract's zero-load class.
 */
export function playerWeightClass(combat) {
  const registries = combat.registries;
  if (combat.loadout && combat.attributes) {
    const receipt = playerLoadReceipt(registries, {
      loadout: combat.loadout, attributes: combat.attributes, class: combat.player.classId,
      itemUpgradeLevels: combat.itemUpgradeLevels || {},
    });
    return registries.framework.weightClass({
      attributes: combat.attributes,
      weights: { mainHandWeight: receipt.hands, offHandWeight: 0, armorWeight: receipt.armour, otherCountedWeight: 0 },
    });
  }
  return registries.framework.weightClass({
    attributes: { constitution: 10, strength: 10, ...(combat.attributes || {}) },
    weights: { mainHandWeight: 0, offHandWeight: 0, armorWeight: 0, otherCountedWeight: 0 },
  });
}

// Effective numeric cost after relic passives (powerCostReduction, min 0).
// X-cost is unaffected (it always consumes all energy).
function effectiveCost(combat, def) {
  if (def.cost === 'X') return 'X';
  // The cost profile is the framework's call; this engine supplies the live
  // relic reduction and the framework applies it only where the card's
  // classification permits (Powers).
  return combat.registries.framework.costProfile(def, {
    powerCostReduction: passiveSum(combat.registries, combat.player.relicIds, 'powerCostReduction', combat.itemUpgradeLevels || {}),
    weightClass: playerWeightClass(combat).weightClass,
  }).action;
}

function doPlayCard(combat, { cardInstanceId, targetId }) {
  if (combat.phase !== 'player') throw new Error('Cards can only be played on the player turn');
  const p = combat.player;
  const idx = combat.piles.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx < 0) throw new Error(`Card '${cardInstanceId}' is not in hand`);
  const inst = combat.piles.hand[idx];
  const def = resolveCard(combat.registries, inst);
  const kws = def.keywords || [];

  if (combat.registries.framework.isUnplayable(def)) throw new Error(`'${def.name}' is unplayable`);

  const isX = def.cost === 'X';
  const cost = isX ? p.energy : effectiveCost(combat, def);
  const pools = combat.registries.framework.costProfile(def, { weightClass: playerWeightClass(combat).weightClass });
  const manaCost = pools.mana;
  const staminaCost = pools.stamina;
  if (p.energy < cost) throw new Error(`Not enough energy (need ${cost}, have ${p.energy})`);
  if (p.mana < manaCost) throw new Error(`Not enough mana (need ${manaCost}, have ${p.mana})`);
  if (p.stamina < staminaCost) throw new Error(`Not enough stamina (need ${staminaCost}, have ${p.stamina})`);

  let target = null;
  if (targetId != null) {
    target = findEntity(combat, targetId);
    if (!target || !target.alive) throw new Error(`Invalid target '${targetId}'`);
  } else if (needsEnemyTarget(def)) {
    target = combat.enemies.find((e) => e.alive) || null;
    if (!target) throw new Error('No living enemy to target');
  }

  // Pay cost (X-cost consumes ALL energy — SPEC §4.3).
  p.energy -= cost;
  if (cost > 0 || isX) combat.emit('energySpent', { amount: cost });
  p.mana -= manaCost;
  if (manaCost > 0) combat.emit('manaSpent', { amount: manaCost });
  p.stamina -= staminaCost;
  if (staminaCost > 0) {
    p.counters.staminaSpentThisTurn = (p.counters.staminaSpentThisTurn || 0) + staminaCost;
    combat.emit('staminaSpent', { amount: staminaCost });
  }

  // Remove from hand; bump counters (used by predicates + formulas).
  combat.piles.hand.splice(idx, 1);
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
  if (def.type === 'attack') {
    p.counters.attacksPlayedThisCombat += 1;
    meta.attackOrdinal = p.counters.attacksPlayedThisCombat;
  }
  const cardRef = {
    instanceId: inst.instanceId, cardId: inst.cardId, upgraded: inst.upgraded,
    type: def.type, tags: def.cardTags,
    damageSchool: inst.damageSchool ?? def.damageSchool,
    exposureBuildupPerHit: inst.exposureBuildupPerHit ?? def.exposureBuildupPerHit,
  };

  // Enqueue the card's own effects first, then announce the play — triggers
  // reacting to cardPlayed enqueue after the card's effects (FIFO).
  for (const eff of def.effects || []) {
    combat.enqueue({ effect: eff, source: p, owner: p, target, card: cardRef, meta });
  }
  combat.emit('cardPlayed', {
    cardInstanceId: inst.instanceId,
    cardId: inst.cardId,
    cardType: def.type,
    targetId: target ? target.id : null,
    ordinalThisTurn: meta.ordinalThisTurn,
    ordinalThisCombat: meta.ordinalThisCombat,
    energySpent: cost,
    manaSpent: manaCost,
    staminaSpent: staminaCost,
  });
  drainQueue(combat);

  // Placement after resolution (SPEC §4.3): Exhaust → exhaust pile;
  // Powers are removed from play (NOT exhausted); everything else → discard.
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

function doEndTurn(combat) {
  if (combat.phase !== 'player') throw new Error('Not the player turn');
  endPlayerTurn(combat);
  if (combat.result) return;
  enemyPhase(combat);
  if (combat.result) return;
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
  const amountMult = passiveMult(combat.registries, p.relicIds, 'flaskPowerMult');
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
export function previewCard(combat, cardInstanceId, targetId) {
  const inst =
    combat.piles.hand.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.draw.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.discard.find((c) => c.instanceId === cardInstanceId) ||
    combat.piles.exhaust.find((c) => c.instanceId === cardInstanceId);
  if (!inst) throw new Error(`Unknown card instance '${cardInstanceId}'`);
  const def = resolveCard(combat.registries, inst);
  const p = combat.player;
  const isX = def.cost === 'X';
  const shownCost = isX ? p.energy : effectiveCost(combat, def);
  const target = targetId != null ? findEntity(combat, targetId) : null;
  const living = combat.enemies.filter((e) => e.alive);

  // Same action shape execution uses, so formulas resolve identically.
  const action = {
    source: p,
    owner: p,
    target: target || (needsEnemyTarget(def) ? living[0] || null : null),
    card: {
      instanceId: inst.instanceId, cardId: inst.cardId, upgraded: inst.upgraded,
      type: def.type, tags: def.cardTags,
      damageSchool: inst.damageSchool ?? def.damageSchool,
      exposureBuildupPerHit: inst.exposureBuildupPerHit ?? def.exposureBuildupPerHit,
    },
    meta: { energySpent: isX ? p.energy : typeof shownCost === 'number' ? shownCost : 0 },
  };

  const bindings = computeTokenBindings(def.effects || []);
  const tokenByIndexField = new Map();
  for (const bd of bindings) tokenByIndexField.set(`${bd.index}:${bd.field}`, bd.token);

  const values = [];
  const tokens = {};
  (def.effects || []).forEach((eff, i) => {
    if (typeof eff.op !== 'string') return;
    const entry = { op: eff.op, target: eff.target || null };
    const primary = firstResolvedTarget(combat, action, eff);
    switch (eff.op) {
      case 'damage': {
        const attackTags = A.attackTagsFor(action, eff);
        const base = evalPreview(combat, action, eff.amount, primary);
        entry.value = A.computeAttackDamage(combat, p, primary && primary.kind === 'enemy' ? primary : null, base, attackTags, action.card);
        entry.hits = evalPreview(combat, action, eff.hits != null ? eff.hits : 1, primary);
        entry.perTarget = {};
        for (const e of living) {
          const b = evalPreview(combat, action, eff.amount, e);
          entry.perTarget[e.id] = A.computeAttackDamage(combat, p, e, b, attackTags, action.card);
        }
        // #61 M5: when the aimed target's tag-scoped vulnerability matches
        // this hit's tags, name the matched row's tint so the hand can accent
        // the boosted number. Engine states the fact; display reads it.
        if (attackTags.length && primary && primary.kind === 'enemy') {
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
        entry.value = A.computeBlockGain(combat, p, evalPreview(combat, action, eff.amount, primary));
        break;
      }
      case 'applyStatus': {
        entry.status = eff.status;
        entry.value = evalPreview(combat, action, eff.stacks != null ? eff.stacks : 1, primary);
        break;
      }
      case 'heal':
      case 'loseHp':
      case 'draw':
      case 'gainEnergy':
      case 'restoreMana':
      case 'poiseDamage':
      case 'addCinders': {
        entry.value = evalPreview(combat, action, eff.amount != null ? eff.amount : 1, primary);
        break;
      }
      case 'loseMaxHpPct': {
        entry.value = evalPreview(combat, action, eff.pct != null ? eff.pct : 0, primary);
        break;
      }
      default:
        entry.value = null;
    }
    if (entry.value != null) {
      const valueField = eff.op === 'applyStatus' ? 'stacks' : eff.op === 'loseMaxHpPct' ? 'pct' : 'amount';
      const token = tokenByIndexField.get(`${i}:${valueField}`);
      if (token) {
        entry.token = token;
        tokens[token] = entry.value;
      }
      const hitsToken = tokenByIndexField.get(`${i}:hits`);
      if (hitsToken && entry.hits != null) tokens[hitsToken] = entry.hits;
    }
    values.push(entry);
  });

  return {
    cardId: inst.cardId,
    upgraded: inst.upgraded,
    name: def.name,
    type: def.type,
    cost: shownCost,
    costIsX: isX,
    manaCost: def.manaCost || 0,
    // The stamina badge in a fight is the class-priced one for the pure dodge.
    staminaCost: combat.registries.framework.costProfile(def, { weightClass: playerWeightClass(combat).weightClass }).stamina,
    needsTarget: needsEnemyTarget(def),
    values,
    tokens,
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
 * { kind, moveId, damage, hits, totalDamage, block, delayed, pending }
 * Attack numbers include the enemy's attack modifiers and the player's
 * damage-taken modifiers, recomputed live through the same §4.2 math.
 */
export function previewIntent(combat, enemyInstanceId) {
  const enemy = findEntity(combat, enemyInstanceId);
  if (!enemy || enemy.kind !== 'enemy') throw new Error(`Unknown enemy instance '${enemyInstanceId}'`);
  const intent = enemy.intent || { kind: 'unknown', moveId: null };
  const out = { ...intent };
  if (intent.damage != null) {
    out.damage = A.computeAttackDamage(combat, enemy, combat.player, intent.damage);
    out.hits = intent.hits != null ? intent.hits : 1;
    out.totalDamage = out.damage * out.hits;
  }
  out.pending = !!enemy.pendingMove;
  return out;
}
