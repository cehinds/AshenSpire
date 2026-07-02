// src/engine/triggers.js — event bus + declarative trigger wiring + predicates
// (SPEC §3.6, §3.9, §3.10)
//
// Relics, powers (statuses), stances, and enemy boss phases all hook the
// engine through one declarative form: { on, if?, do, once?, limitPerTurn? }.
// Triggers REACT to events by enqueueing actions; they never mutate directly
// (SPEC §3.9). Trigger sources are scanned live on every emit, so statuses
// applied mid-combat hook up automatically.
//
// Headless: no document/window/localStorage/timers.

import { TRIGGER_EVENTS } from '../model/schemas.js';
import { getStacks } from './statuses.js';

const MAX_EMIT_DEPTH = 64;

/**
 * emitEvent(ctx, type, payload) — append to the event log (and the current
 * dispatch buffer), then scan all trigger sources for matches. Returns the
 * event object. Every event carries { type, ...payload }.
 */
export function emitEvent(ctx, type, payload = {}) {
  const event = { type, ...payload };
  ctx.eventLog.push(event);
  if (ctx._buffer) ctx._buffer.push(event);
  ctx._emitDepth = (ctx._emitDepth || 0) + 1;
  if (ctx._emitDepth > MAX_EMIT_DEPTH) {
    ctx._emitDepth = 0;
    throw new Error(`Trigger recursion exceeded ${MAX_EMIT_DEPTH} (event '${type}')`);
  }
  try {
    scanTriggers(ctx, event);
  } finally {
    ctx._emitDepth -= 1;
  }
  return event;
}

function scanTriggers(ctx, event) {
  const player = ctx.player;
  if (!player) return; // run-level contexts have no combat trigger sources

  // Relics (player-owned).
  for (const relicId of player.relicIds) {
    const def = ctx.registries.relics.get(relicId);
    (def.triggers || []).forEach((trig, i) => {
      if (trig.on !== event.type) return;
      const fired = maybeFire(ctx, `relic:${relicId}:${i}`, trig, player, event);
      if (fired && event.type !== 'relicTriggered') {
        emitEvent(ctx, 'relicTriggered', { relicId });
      }
    });
  }

  // Stance hooks (player).
  if (player.stanceId) {
    const stance = ctx.registries.stances.get(player.stanceId);
    (stance.hooks || []).forEach((trig, i) => {
      if (trig.on !== event.type) return;
      maybeFire(ctx, `stance:${player.stanceId}:${i}`, trig, player, event);
    });
  }

  // Status hooks on every living combatant (owner-relative hooks —
  // ownerTurnStart / ownerTurnEnd — fire via fireOwnerHooks, not here).
  for (const entity of allCombatants(ctx)) {
    if (!entity.alive) continue;
    for (const statusId of Object.keys(entity.statuses)) {
      const def = ctx.registries.statuses.get(statusId);
      (def.hooks || []).forEach((trig, i) => {
        if (trig.on !== event.type) return;
        maybeFire(ctx, `status:${entity.id}:${statusId}:${i}`, trig, entity, event);
      });
    }
  }

  // Enemy phases hooked on bus events (hpBelowPct phases run via checkPhases).
  for (const enemy of ctx.enemies || []) {
    if (!enemy.alive) continue;
    const def = ctx.registries.enemies.get(enemy.enemyId);
    (def.phases || []).forEach((phase, i) => {
      if (phase.on !== event.type) return;
      firePhase(ctx, enemy, phase, i, event);
    });
  }
}

function allCombatants(ctx) {
  return [ctx.player, ...(ctx.enemies || [])];
}

/**
 * fireOwnerHooks(ctx, entity, hookName) — fire status hooks (and, for the
 * player, stance hooks) declared with on:'ownerTurnStart'|'ownerTurnEnd'
 * for this specific entity. Called by the turn loop (SPEC §4.1).
 */
export function fireOwnerHooks(ctx, entity, hookName) {
  if (!entity.alive) return;
  const syntheticEvent = { type: hookName, ownerId: entity.id };
  for (const statusId of Object.keys(entity.statuses)) {
    const def = ctx.registries.statuses.get(statusId);
    (def.hooks || []).forEach((trig, i) => {
      if (trig.on !== hookName) return;
      maybeFire(ctx, `status:${entity.id}:${statusId}:${i}:${hookName}`, trig, entity, syntheticEvent);
    });
  }
  if (entity.kind === 'player' && entity.stanceId) {
    const stance = ctx.registries.stances.get(entity.stanceId);
    (stance.hooks || []).forEach((trig, i) => {
      if (trig.on !== hookName) return;
      maybeFire(ctx, `stance:${entity.stanceId}:${i}:${hookName}`, trig, entity, syntheticEvent);
    });
  }
}

// Gate a trigger through once / limitPerTurn / if, then enqueue its effects.
// Returns true if it fired.
function maybeFire(ctx, key, trigger, owner, event) {
  let st = ctx.triggerState.get(key);
  if (!st) {
    st = { fires: 0, turn: -1, turnFires: 0 };
    ctx.triggerState.set(key, st);
  }
  if (trigger.once && st.fires > 0) return false;
  if (st.turn !== ctx.turn) {
    st.turn = ctx.turn;
    st.turnFires = 0;
  }
  if (trigger.limitPerTurn != null && st.turnFires >= trigger.limitPerTurn) return false;

  const target = resolveEventEntity(ctx, event);
  if (trigger.if && !evalPredicate(ctx, trigger.if, { owner, target, event })) return false;

  st.fires += 1;
  st.turnFires += 1;
  for (const eff of trigger.do || []) {
    ctx.enqueue({ effect: eff, source: owner, owner, target, meta: { event } });
  }
  return true;
}

// Best-effort contextual entity for a trigger's effects: the event's target
// if it names one, else null (effects should declare explicit targets).
function resolveEventEntity(ctx, event) {
  const id = event.targetId || event.enemyId || null;
  if (!id) return null;
  return findEntity(ctx, id);
}

export function findEntity(ctx, id) {
  if (ctx.player && ctx.player.id === id) return ctx.player;
  for (const e of ctx.enemies || []) {
    if (e.id === id) return e;
  }
  return null;
}

/**
 * checkPhases(ctx) — evaluate hpBelowPct boss/enemy phases (SPEC §3.6, §4.6).
 * Called after any HP change. hpBelowPct phases default to once:true (a phase
 * change is a one-way door); set once:false explicitly to re-fire.
 */
export function checkPhases(ctx) {
  for (const enemy of ctx.enemies || []) {
    if (!enemy.alive) continue;
    const def = ctx.registries.enemies.get(enemy.enemyId);
    (def.phases || []).forEach((phase, i) => {
      if (phase.on !== 'hpBelowPct') return;
      if (enemy.hp > (enemy.maxHp * phase.pct) / 100) return;
      firePhase(ctx, enemy, phase, i, { type: 'hpBelowPct', targetId: enemy.id });
    });
  }
}

function firePhase(ctx, enemy, phase, index, event) {
  const key = `phase:${enemy.id}:${index}`;
  const once = phase.once !== false; // default once for phases
  let st = ctx.triggerState.get(key);
  if (!st) {
    st = { fires: 0, turn: -1, turnFires: 0 };
    ctx.triggerState.set(key, st);
  }
  if (once && st.fires > 0) return;
  if (phase.if && !evalPredicate(ctx, phase.if, { owner: enemy, target: ctx.player, event })) return;
  st.fires += 1;
  for (const eff of phase.do || []) {
    ctx.enqueue({ effect: eff, source: enemy, owner: enemy, target: ctx.player, meta: { event } });
  }
  for (const moveId of phase.unlockMoves || []) {
    if (!enemy.unlockedMoves.includes(moveId)) enemy.unlockedMoves.push(moveId);
  }
}

// ---------------------------------------------------------------------------
// Predicates (SPEC §3.6, closed set, combinable)
// ---------------------------------------------------------------------------

/**
 * evalPredicate(ctx, pred, pctx) → boolean.
 * pctx = { owner?, source?, target?, card?, meta?, event? } — the evaluation
 * context of the gated effect or trigger.
 */
export function evalPredicate(ctx, pred, pctx = {}) {
  switch (pred.p) {
    case 'inStance':
      return ctx.player.stanceId === pred.stance;
    case 'hasStatus': {
      const ent = resolveOf(ctx, pctx, pred.of);
      const atLeast = pred.atLeast != null ? pred.atLeast : 1;
      return ent != null && getStacks(ent, pred.status) >= atLeast;
    }
    case 'hasBlock': {
      const ent = resolveOf(ctx, pctx, pred.of);
      return ent != null && ent.block > 0;
    }
    case 'hpBelowPct': {
      const ent = resolveOf(ctx, pctx, pred.of);
      return ent != null && ent.hp <= (ent.maxHp * pred.pct) / 100;
    }
    case 'firstCardThisTurn': {
      const meta = pctx.meta || {};
      if (meta.ordinalThisTurn != null) return meta.ordinalThisTurn === 1;
      return ctx.player.counters.cardsPlayedThisTurn === 0;
    }
    case 'firstAttackThisCombat': {
      const meta = pctx.meta || {};
      if (meta.attackOrdinal != null) return meta.attackOrdinal === 1;
      return ctx.player.counters.attacksPlayedThisCombat === 0;
    }
    case 'cardTypeIs': {
      if (pctx.card) return pctx.card.type === pred.type;
      // Trigger context: the cardPlayed event carries the type.
      return !!pctx.event && pctx.event.cardType === pred.type;
    }
    case 'eventIsAttack':
      return !!pctx.event && pctx.event.isAttack === true;
    case 'eventSourceIsOwner':
      return !!pctx.event && !!pctx.owner && pctx.event.sourceId === pctx.owner.id;
    case 'eventTargetIsOwner':
      return !!pctx.event && !!pctx.owner && pctx.event.targetId === pctx.owner.id;
    case 'eventStatusIs':
      return !!pctx.event && pctx.event.status === pred.status;
    case 'everyNthCardThisCombat': {
      const meta = pctx.meta || {};
      const ordinal = meta.ordinalThisCombat != null ? meta.ordinalThisCombat : ctx.player.counters.cardsPlayedThisCombat;
      return ordinal > 0 && ordinal % pred.n === 0;
    }
    case 'random':
      return ctx.rng.float('misc') * 100 < pred.pct;
    case 'all':
      return pred.preds.every((sub) => evalPredicate(ctx, sub, pctx));
    case 'any':
      return pred.preds.some((sub) => evalPredicate(ctx, sub, pctx));
    case 'not':
      return !evalPredicate(ctx, pred.pred, pctx);
    default:
      throw new Error(`Unknown predicate '${pred.p}'`);
  }
}

function resolveOf(ctx, pctx, of) {
  switch (of) {
    case 'player':
      return ctx.player;
    case 'self':
      return pctx.source || pctx.owner || ctx.player;
    case 'owner':
      return pctx.owner || pctx.source || null;
    case 'enemy':
    case 'target':
      return pctx.target || null;
    default:
      throw new Error(`Predicate 'of' ref '${of}' is not resolvable (use self/owner/player/enemy/target)`);
  }
}

// Sanity: every event name a trigger may declare is in the closed set.
export { TRIGGER_EVENTS };
