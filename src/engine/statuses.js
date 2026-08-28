// src/engine/statuses.js — generic status-model interpreter (SPEC §3.7)
//
// Statuses are CONTENT, not code: this module interprets stackMode, decay
// (none / perTurnEnd / {duration} / onConsume), build-up meters (growthMult +
// onFill), and modifiers consulted by the damage/block math (SPEC §4.2).
// It contains no entity-specific code and never names a status id
// (design law §3.1(2)).
//
// Status instance shape on an entity:
//   entity.statuses[statusId] = { stacks, duration?, meter?: { value, max } }
// Meter statuses keep their build-up points in meter.value; their "stacks"
// (for formulas, predicates, tooltips) IS the meter value.
//
// ctx is the combat context (see engine/combat.js): must provide
// ctx.registries, ctx.emit(type, payload), ctx.enqueue(action),
// ctx.player, ctx.enemies.
//
// Headless: no document/window/localStorage/timers.

export function getStatusInstance(entity, statusId) {
  return (entity && entity.statuses && entity.statuses[statusId]) || null;
}

export function getStacks(entity, statusId) {
  const inst = getStatusInstance(entity, statusId);
  if (!inst) return 0;
  return inst.meter ? inst.meter.value : inst.stacks || 0;
}

export function hasStatus(entity, statusId) {
  return getStacks(entity, statusId) > 0;
}

/**
 * applyStatus(ctx, target, statusId, stacks, source?) — the applyStatus opcode
 * body. Interprets stackMode; feeds meters; refreshes durations; fires
 * meter onFill (SPEC §3.7). Emits statusApplied (and meterFilled on fill).
 */
export function applyStatus(ctx, target, statusId, stacks = 1, source = null) {
  const def = ctx.registries.statuses.get(statusId);
  if (!target || !target.alive) return;
  const amount = Math.floor(stacks);
  if (amount <= 0 && def.stackMode !== 'unique') return;

  let inst = target.statuses[statusId];
  if (!inst) {
    inst = target.statuses[statusId] = { stacks: 0 };
    if (def.meter) inst.meter = { value: 0, max: def.meter.max };
  }

  switch (def.stackMode) {
    case 'add':
      if (inst.meter) inst.meter.value += amount;
      else inst.stacks += amount;
      break;
    case 'refresh':
      if (inst.meter) inst.meter.value = Math.max(inst.meter.value, amount);
      else inst.stacks = Math.max(inst.stacks, amount);
      break;
    case 'unique':
      if (inst.meter) inst.meter.value = Math.max(inst.meter.value, 1);
      else inst.stacks = 1;
      break;
    default:
      throw new Error(`Unknown stackMode '${def.stackMode}' on status '${statusId}'`);
  }

  // Re-applying a duration status adds stacks (above) AND refreshes duration.
  if (isDurationDecay(def.decay)) {
    inst.duration = def.decay.duration;
  }

  ctx.emit('statusApplied', {
    targetId: target.id,
    sourceId: source ? source.id : null,
    status: statusId,
    stacks: amount,
    total: getStacks(target, statusId),
  });

  if (inst.meter) checkMeterFill(ctx, target, statusId, def, inst);
}

// Build-up meter fill loop: emit meterFilled, enqueue onFill effects (owner =
// the entity carrying the meter), reset value (overflow carries), grow the
// threshold by growthMult (rounded up) unless growth is disabled by any
// combatant's meterMaxGrowthDisabled modifier (SPEC §3.7, §4.4).
function checkMeterFill(ctx, entity, statusId, def, inst) {
  let guard = 0;
  while (inst.meter.value >= inst.meter.max) {
    if (++guard > 100) throw new Error(`Meter '${statusId}' fill loop did not terminate`);
    inst.meter.value -= inst.meter.max;
    ctx.emit('meterFilled', {
      targetId: entity.id,
      status: statusId,
      threshold: inst.meter.max,
    });
    const growth = def.meter.growthMult != null ? def.meter.growthMult : 1;
    if (growth !== 1 && !anyCombatantFlag(ctx, 'meterMaxGrowthDisabled')) {
      inst.meter.max = Math.ceil(inst.meter.max * growth);
    }
    for (const eff of def.meter.onFill || []) {
      ctx.enqueue({ effect: eff, source: entity, owner: entity, target: entity, meta: {} });
    }
  }
}

export function removeStatus(ctx, target, statusId, opts = {}) {
  if (!target.statuses[statusId]) return;
  delete target.statuses[statusId];
  if (!opts.silent) {
    ctx.emit('statusExpired', { targetId: target.id, status: statusId, reason: opts.reason || 'removed' });
  }
}

/**
 * decayAtTurnEnd(ctx, entity) — apply per-owner-turn-end decay:
 *   'perTurnEnd'   → −1 stack (expire at 0)
 *   { duration }   → −1 turn (expire at 0; stacks untouched until then)
 *   'none' / 'onConsume' → untouched
 */
export function decayAtTurnEnd(ctx, entity) {
  for (const statusId of Object.keys(entity.statuses)) {
    const inst = entity.statuses[statusId];
    const def = ctx.registries.statuses.get(statusId);
    if (def.decay === 'perTurnEnd') {
      if (inst.meter) inst.meter.value -= 1;
      else inst.stacks -= 1;
      if (getStacks(entity, statusId) <= 0) {
        removeStatus(ctx, entity, statusId, { reason: 'decayed' });
      }
    } else if (isDurationDecay(def.decay)) {
      inst.duration -= 1;
      if (inst.duration <= 0) {
        removeStatus(ctx, entity, statusId, { reason: 'expired' });
      }
    }
  }
}

function isDurationDecay(decay) {
  return decay !== null && typeof decay === 'object' && typeof decay.duration === 'number';
}

// ---------------------------------------------------------------------------
// Modifier aggregation (SPEC §3.7 → consulted by §4.2 math)
//
// Sources: every status on the entity, plus (for the player) the active
// stance's modifiers. Semantics:
//   *Mult   — flat per status (NOT scaled by stacks); values multiply.
//   *Add    — value × stacks; values sum.
//   flags   — true if any source has them.
//   blockCap— max of declared caps (the most generous wins).
// ---------------------------------------------------------------------------

function* modifierSources(ctx, entity) {
  for (const statusId of Object.keys(entity.statuses)) {
    const def = ctx.registries.statuses.get(statusId);
    if (def.modifiers) yield { modifiers: def.modifiers, stacks: getStacks(entity, statusId) };
  }
  if (entity.kind === 'player' && entity.stanceId) {
    const stance = ctx.registries.stances.get(entity.stanceId);
    if (stance.modifiers) yield { modifiers: stance.modifiers, stacks: 1 };
  }
}

/** Product of flat multipliers for `key` ('damageDealtMult', ...). */
export function getMult(ctx, entity, key) {
  let m = 1;
  for (const src of modifierSources(ctx, entity)) {
    if (typeof src.modifiers[key] === 'number') m *= src.modifiers[key];
  }
  return m;
}

/** Sum of per-stack adders for `key` ('attackDamageAdd', 'blockAdd'). */
export function getAdd(ctx, entity, key) {
  let a = 0;
  for (const src of modifierSources(ctx, entity)) {
    if (typeof src.modifiers[key] === 'number') a += src.modifiers[key] * src.stacks;
  }
  return a;
}

/** True if any status/stance on the entity sets boolean modifier `key`. */
export function getFlag(ctx, entity, key) {
  for (const src of modifierSources(ctx, entity)) {
    if (src.modifiers[key] === true) return true;
  }
  return false;
}

/** Max declared numeric value for `key` (e.g. blockCap), or null if none. */
export function getCap(ctx, entity, key) {
  let cap = null;
  for (const src of modifierSources(ctx, entity)) {
    if (typeof src.modifiers[key] === 'number') {
      cap = cap == null ? src.modifiers[key] : Math.max(cap, src.modifiers[key]);
    }
  }
  return cap;
}

/** True if ANY living combatant carries boolean modifier `key`. */
export function anyCombatantFlag(ctx, key) {
  if (ctx.player && ctx.player.alive && getFlag(ctx, ctx.player, key)) return true;
  for (const e of ctx.enemies || []) {
    if (e.alive && getFlag(ctx, e, key)) return true;
  }
  return false;
}
