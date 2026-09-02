// src/engine/actions.js — effect-DSL opcode implementations (SPEC §3.4)
//
// A queued ACTION is { effect, source, owner?, target?, card?, meta? }:
//   effect — one opcode object from content data
//   source — the entity performing the effect (player, an enemy, or null in
//            run-level contexts)
//   owner  — the entity owning the trigger/status that produced it (defaults
//            to source); formulas' and targets' 'owner' resolves to this
//   target — the contextual target (e.g. the enemy a card was aimed at)
//   card   — { instanceId, cardId, type } when the action came from a card
//   meta   — { energySpent, ordinalThisTurn, ordinalThisCombat, attackOrdinal }
//
// RULE (SPEC §3.9): nothing mutates HP/block/piles/statuses except an executed
// action. Triggers react to events and only enqueue further actions.
//
// Damage math (SPEC §4.2, order contractual, floor ONCE at the end):
//   dmg = base
//   dmg += attacker per-stack 'attackDamageAdd' modifiers
//   dmg *= attacker 'damageDealtMult' modifiers
//   dmg *= defender 'damageTakenMult' modifiers
//   dmg = floor(dmg); below 0 → 0
// The engine consults the generic status model only — never a named status.
//
// Headless: no document/window/localStorage/timers.

import { COMBAT_OPCODES, RUN_OPCODES, relicInRewardPool } from '../model/schemas.js';
import { evaluate, isFormula } from '../model/formulas.js';
import * as statuses from '../framework/statusSemantics.js';
import { evalPredicate, checkPhases } from './triggers.js';
import { playerWeightClass } from './combat.js';
import { damageTagIds } from '../content/tags.js';
import { flaskSlotCap } from '../model/gracerefill.js';
import { syncFlaskGrowth } from '../model/flaskgrowth.js';
import { commitSmithing, smithingPlan } from '../model/smithing.js';

// ---------------------------------------------------------------------------
// Shared math (also used by combat.js previews — no duplicated math in the UI)
// ---------------------------------------------------------------------------

/**
 * computeAttackDamage(ctx, source, target|null, base) → final integer damage.
 * Pure (no mutation). Pass target = null to preview without defender mods.
 */
export function computeAttackDamage(ctx, source, target, base, attackTags, carrier = null) {
  let dmg = base;
  const school = carrier && carrier.damageSchool;
  if (source && source.kind === 'player' && school) {
    dmg += source.damageBySchoolAdd && Number.isFinite(source.damageBySchoolAdd[school])
      ? source.damageBySchoolAdd[school]
      : 0;
  }
  dmg += statuses.getAdd(ctx, source, 'attackDamageAdd');
  dmg *= statuses.getMult(ctx, source, 'damageDealtMult');
  if (target) dmg *= statuses.getMult(ctx, target, 'damageTakenMult');
  // Tag-scoped extra vulnerability (#61): statuses whose taggedVulnerability
  // tags intersect the hit's effect tags. Composition is the row's DECLARED
  // stacking rule (closed enum, validated): 'multiplicative' sources multiply
  // in like every shipped *Mult (flat per status, stack-count-invariant);
  // 'additive' sources pool (mult − 1) and apply once. Both lanes are
  // stack-invariant, so the ceiling is the closed-form product of DISTINCT
  // table mults — stacks can never raise it.
  if (target && attackTags && attackTags.length) {
    let addPool = 0;
    for (const [id, inst] of Object.entries(target.statuses || {})) {
      if (!inst || (inst.meter ? inst.meter.value : inst.stacks) <= 0) continue;
      const def = ctx.registries.statuses.get(id);
      const tv = def && def.taggedVulnerability;
      if (!tv || !tv.tags.some((t) => attackTags.includes(t))) continue;
      if (tv.stacking === 'multiplicative') dmg *= tv.mult;
      else addPool += tv.mult - 1;
    }
    if (addPool > 0) dmg *= 1 + addPool;
  }
  if (target && school) {
    const resistance = target.damageResistanceBySchool && target.damageResistanceBySchool[school];
    if (Number.isFinite(resistance)) dmg *= Math.max(0, 1 - resistance / 100);
    for (const [id, inst] of Object.entries(target.statuses || {})) {
      if (!inst || (inst.meter ? inst.meter.value : inst.stacks) <= 0) continue;
      const def = ctx.registries.statuses.get(id);
      if (def && def.schoolDamageVulnerability && def.schoolDamageVulnerability.school === school) {
        dmg *= 1 + (inst.stacks || 0) / 100;
      }
    }
  }
  dmg = Math.floor(dmg);
  return dmg < 0 ? 0 : dmg;
}

/** One derivation for live actions and previews: card identity comes from CSV. */
export function attackTagsFor(action, effect) {
  if (action.card && Array.isArray(action.card.tags) && action.card.tags.length) return action.card.tags;
  return damageTagIds(action.card && action.card.cardId, effect.tags);
}

/**
 * applyAttackDamage(ctx, source, target, base) — full attack resolution:
 * §4.2 math, block absorption first, then HP. Emits damageDealt (+ hpLost if
 * HP was touched), handles deaths and phase checks. Returns final damage.
 */
export function applyAttackDamage(ctx, source, target, base, attackTags, carrier = null) {
  if (!target || !target.alive) return 0;
  const dmg = computeAttackDamage(ctx, source, target, base, attackTags, carrier);
  const blocked = Math.min(target.block, dmg);
  target.block -= blocked;
  const hpLoss = dmg - blocked;
  if (hpLoss > 0) target.hp -= hpLoss;
  ctx.emit('damageDealt', {
    sourceId: source ? source.id : null,
    targetId: target.id,
    amount: dmg,
    blocked,
    isAttack: true,
  });
  if (hpLoss > 0) {
    ctx.emit('hpLost', { targetId: target.id, amount: hpLoss, cause: 'attack' });
    applyArcaneExposure(ctx, source, target, carrier);
  }
  afterHpChange(ctx, target);
  return dmg;
}

/** Host-only Arcane Exposure mutation, reached only after final HP loss. */
function applyArcaneExposure(ctx, source, target, carrier) {
  if (!target || target.kind !== 'enemy' || !target.arcaneExposure || !carrier) return;
  const schoolMult = ((ctx.registries.balance || {}).arcaneExposure || {}).schoolBuildupMultipliers || {};
  const school = carrier.damageSchool;
  const perHit = carrier.exposureBuildupPerHit;
  const mapped = Number.isFinite(schoolMult[school]) ? schoolMult[school] : 0;
  if (!Number.isInteger(perHit) || perHit <= 0 || mapped <= 0) return;
  const cfg = target.arcaneExposure;
  if (cfg.mode === 'immune') {
    ctx.emit('arcaneExposureRefused', { targetId: target.id, sourceId: source && source.id, reason: 'immune', school, attempted: perHit });
    return;
  }
  if (cfg.mode !== 'configured') return;
  if (statuses.hasStatus(target, cfg.onBreak.status)) {
    ctx.emit('arcaneExposureRefused', { targetId: target.id, sourceId: source && source.id, reason: 'locked', school, attempted: perHit });
    return;
  }
  const amount = Math.floor(perHit * mapped * cfg.buildupMultiplier);
  if (amount <= 0) return;
  cfg.value += amount;
  ctx.emit('arcaneExposureChanged', { targetId: target.id, sourceId: source && source.id, school, amount, value: cfg.value, threshold: cfg.threshold });
  if (cfg.value < cfg.threshold) return;
  cfg.value = 0; // authored resetMode=zero; overflowPolicy=discard
  ctx.emit('arcaneBreak', {
    targetId: target.id, sourceId: source && source.id, school,
    threshold: cfg.threshold, status: cfg.onBreak.status,
    value: cfg.onBreak.value, duration: cfg.onBreak.duration,
  });
  statuses.applyStatus(ctx, target, cfg.onBreak.status, cfg.onBreak.value, source);
  if (target.statuses[cfg.onBreak.status]) target.statuses[cfg.onBreak.status].duration = cfg.onBreak.duration;
}

/**
 * computeBlockGain(ctx, entity, base) → final integer block gain:
 * base + per-stack 'blockAdd' modifiers, × 'blockGainedMult' modifiers,
 * floored, min 0 (SPEC §4.2). Pure. Cap NOT applied here.
 */
export function computeBlockGain(ctx, entity, base) {
  let amt = base + statuses.getAdd(ctx, entity, 'blockAdd');
  amt *= statuses.getMult(ctx, entity, 'blockGainedMult');
  amt = Math.floor(amt);
  return amt < 0 ? 0 : amt;
}

/** gainBlock — mutating block gain with 'blockCap' modifier honored. */
export function gainBlock(ctx, entity, base) {
  if (!entity.alive) return 0;
  let amt = computeBlockGain(ctx, entity, base);
  const cap = statuses.getCap(ctx, entity, 'blockCap');
  if (cap != null && entity.block + amt > cap) {
    amt = Math.max(0, cap - entity.block);
  }
  entity.block += amt;
  ctx.emit('blockGained', { targetId: entity.id, amount: amt });
  return amt;
}

/** loseHp — direct HP loss: ignores ALL attack modifiers AND block (SPEC §4.2). */
export function applyLoseHp(ctx, target, amount, cause = 'effect') {
  if (!target || !target.alive) return 0;
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return 0;
  target.hp -= n;
  ctx.emit('hpLost', { targetId: target.id, amount: n, cause });
  afterHpChange(ctx, target);
  return n;
}

export function applyHeal(ctx, target, amount) {
  if (!target || !target.alive) return 0;
  const n = Math.max(0, Math.floor(amount));
  const gained = Math.min(n, target.maxHp - target.hp);
  target.hp += gained;
  const playerId = target.kind === 'player' && typeof ctx.playerIdForEntity === 'function'
    ? ctx.playerIdForEntity(target)
    : null;
  ctx.emit('healed', {
    targetId: target.id,
    ...(playerId ? { playerId } : {}),
    amount: gained,
    requested: n,
  });
  afterHpChange(ctx, target);
  return gained;
}

function afterHpChange(ctx, target) {
  if (target.hp <= 0 && target.alive) {
    target.hp = 0;
    target.alive = false;
    if (target.kind === 'enemy') {
      ctx.emit('enemyDied', { targetId: target.id, enemyId: target.enemyId });
    }
    // Player death is finalized by combat.js's end-of-combat check.
  }
  checkPhases(ctx);
}

/**
 * dealPoiseDamage(ctx, enemy, amount) — feed the engine-level poise meter
 * (SPEC §3.7, §4.4). On fill: the enemy's next turn is skipped, any committed
 * delayed move is cancelled (satisfying counterplay), meterFilled +
 * enemyStaggered are emitted, balance.poise.onFill content effects are
 * enqueued (owner = the enemy), and poiseMax grows by balance.poise.growthMult
 * (default 1.25, rounded up) unless growth is disabled.
 */
/**
 * staggerEnemy(ctx, enemy) — break the enemy's next move: cancel what it was
 * winding up, mark the skip, and emit enemyStaggered. One home for the break
 * itself; callers decide HOW it was earned — the poise bar filling
 * (dealPoiseDamage) or a direct proc (the 'stagger' opcode, insanity's row).
 * The direct path deliberately bypasses the bar: a guaranteed break that
 * neither consumes nor grows the poise meter.
 */
export function staggerEnemy(ctx, enemy) {
  if (!enemy || enemy.kind !== 'enemy' || !enemy.alive) return;
  const cancelled = enemy.pendingMove ? enemy.pendingMove.moveId : null;
  enemy.pendingMove = null;
  enemy.skipNextTurn = true;
  enemy.intent = { kind: 'staggered', moveId: null };
  ctx.emit('enemyStaggered', { targetId: enemy.id, enemyId: enemy.enemyId, cancelledMove: cancelled });
}

export function dealPoiseDamage(ctx, enemy, amount) {
  if (!enemy || enemy.kind !== 'enemy' || !enemy.alive) return;
  const n = Math.max(0, Math.floor(amount));
  enemy.poiseMeter.value += n;
  const cfg = (ctx.registries.balance && ctx.registries.balance.poise) || {};
  let guard = 0;
  while (enemy.poiseMeter.value >= enemy.poiseMeter.max) {
    if (++guard > 100) throw new Error('Poise meter fill loop did not terminate');
    enemy.poiseMeter.value -= enemy.poiseMeter.max;
    ctx.emit('meterFilled', { targetId: enemy.id, meter: 'poise', threshold: enemy.poiseMeter.max });
    staggerEnemy(ctx, enemy);
    for (const eff of cfg.onFill || []) {
      ctx.enqueue({ effect: eff, source: enemy, owner: enemy, target: enemy, meta: {} });
    }
    const growth = cfg.growthMult != null ? cfg.growthMult : 1.25;
    if (growth !== 1 && !statuses.anyCombatantFlag(ctx, 'meterMaxGrowthDisabled')) {
      enemy.poiseMeter.max = Math.ceil(enemy.poiseMeter.max * growth);
    }
  }
}

// ---------------------------------------------------------------------------
// Card pile operations
// ---------------------------------------------------------------------------

/**
 * drawCards(ctx, n) — draw with reshuffle (stream 'shuffle') when the draw
 * pile empties; cards past the hand limit overflow to discard (SPEC §4.1(3)).
 */
export function drawCards(ctx, n) {
  for (let i = 0; i < n; i++) {
    if (ctx.piles.draw.length === 0) {
      if (ctx.piles.discard.length === 0) return;
      reshuffleDiscardIntoDraw(ctx);
    }
    const card = ctx.piles.draw.shift();
    if (ctx.piles.hand.length >= ctx.handMax) {
      ctx.piles.discard.push(card);
      ctx.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'handFull' });
    } else {
      ctx.piles.hand.push(card);
      ctx.emit('cardDrawn', { cardInstanceId: card.instanceId, cardId: card.cardId });
    }
  }
}

/**
 * discardFromHand(ctx, n) — the discard op's body, one home for both callers:
 * the 'discard' effect below and the ?shotHand pose (main.js), which needs to
 * reach a small hand through the same door a played-down hand goes through —
 * same splice, same pile, same event. Non-random takes from the right end,
 * exactly as the op always has.
 */
export function discardFromHand(ctx, n, { random = false } = {}) {
  for (let i = 0; i < n && ctx.piles.hand.length > 0; i++) {
    const idx = random ? Math.floor(ctx.rng.float('misc') * ctx.piles.hand.length) : ctx.piles.hand.length - 1;
    const card = ctx.piles.hand.splice(idx, 1)[0];
    ctx.piles.discard.push(card);
    ctx.emit('cardDiscarded', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'effect' });
  }
}

export function reshuffleDiscardIntoDraw(ctx) {
  ctx.piles.draw.push(...ctx.piles.discard);
  ctx.piles.discard.length = 0;
  ctx.piles.draw = ctx.rng.shuffle('shuffle', ctx.piles.draw);
  ctx.emit('deckShuffled', { size: ctx.piles.draw.length });
}

// ---------------------------------------------------------------------------
// Target + amount resolution
// ---------------------------------------------------------------------------

function livingEnemies(ctx) {
  return (ctx.enemies || []).filter((e) => e.alive);
}

/**
 * resolveTargets(ctx, action, targetSpec) → entity array for one application.
 * Closed target set (SPEC §3.4): self | enemy | allEnemies | randomEnemy |
 * player | owner. An omitted target falls back to the action's contextual
 * target, then its source.
 */
export function resolveTargets(ctx, action, targetSpec) {
  switch (targetSpec) {
    case undefined:
    case null:
      return [action.target || action.source].filter(Boolean);
    case 'self':
      return [action.source].filter(Boolean);
    case 'owner':
      return [action.owner || action.source].filter(Boolean);
    case 'player':
      return [ctx.player].filter(Boolean);
    case 'enemy': {
      if (action.target && action.target.kind === 'enemy' && action.target.alive) return [action.target];
      if (action.source && action.source.kind === 'enemy') return [ctx.player].filter(Boolean);
      const living = livingEnemies(ctx);
      return living.length ? [living[0]] : [];
    }
    case 'allEnemies':
      return livingEnemies(ctx);
    case 'randomEnemy': {
      const living = livingEnemies(ctx);
      return living.length ? [ctx.rng.pick('misc', living)] : [];
    }
    case 'ally': {
      // Co-op: the explicitly aimed living teammate. Solo — or no pick — falls
      // back to the source, so every ally card stays fully solo-valid.
      const t = action.target;
      if (t && t.kind === 'player' && t !== action.source && t.alive) return [t];
      return [action.source].filter(Boolean);
    }
    default:
      throw new Error(`Unknown effect target '${targetSpec}'`);
  }
}

/** Formula evaluation context for an action (SPEC §3.5). */
export function formulaCtxFor(ctx, action, primaryTarget) {
  const meta = action.meta || {};
  return {
    entities: {
      self: action.source || null,
      owner: action.owner || action.source || null,
      target: primaryTarget || action.target || null,
      enemy: primaryTarget || action.target || null,
      player: ctx.player || null,
      allEnemies: livingEnemies(ctx),
    },
    energySpent: meta.energySpent != null ? meta.energySpent : 0,
    cardsPlayedThisTurn: ctx.player ? ctx.player.counters.cardsPlayedThisTurn : 0,
  };
}

function evalNum(ctx, action, value, dflt, target) {
  if (value === undefined) return dflt;
  let v;
  if (typeof value === 'number') v = Math.floor(value);
  else if (isFormula(value)) v = evaluate(value, formulaCtxFor(ctx, action, target));
  else throw new Error(`Expected number or formula, got ${JSON.stringify(value)}`);
  // Generic amount scaling (e.g. flaskPowerMult): rounded up per SPEC §5.4.
  const mult = action.meta && action.meta.amountMult;
  if (typeof mult === 'number' && mult !== 1) v = Math.ceil(v * mult);
  return v;
}

// ---------------------------------------------------------------------------
// executeAction — the queue interpreter body
// ---------------------------------------------------------------------------

export function executeAction(ctx, action) {
  if (ctx.result) return; // combat already decided; remaining actions fizzle
  const eff = action.effect;

  // Budgeted escape hatch (SPEC §3.1(6)): { script: 'name', ...args }.
  if (typeof eff.script === 'string') {
    const fn = ctx.registries.scripts[eff.script];
    if (typeof fn !== 'function') throw new Error(`Unknown script '${eff.script}'`);
    fn(ctx, action);
    return;
  }

  if (eff.if) {
    const pctx = {
      owner: action.owner || action.source,
      source: action.source,
      target: action.target,
      card: action.card,
      meta: action.meta,
    };
    if (!evalPredicate(ctx, eff.if, pctx)) return;
  }

  const repeat = evalNum(ctx, action, eff.repeat, 1);
  for (let r = 0; r < repeat; r++) {
    runOpcode(ctx, action, eff);
    if (ctx.result) return;
  }
}

function runOpcode(ctx, action, eff) {
  if (RUN_OPCODES.includes(eff.op)) {
    runRunOpcode(ctx, action, eff);
    return;
  }
  if (!COMBAT_OPCODES.includes(eff.op)) {
    throw new Error(`Unknown opcode '${eff.op}'`);
  }

  switch (eff.op) {
    case 'damage': {
      // hits may legitimately evaluate to 0 (X-cost at 0 energy whiffs, StS-style).
      const hits = Math.max(0, evalNum(ctx, action, eff.hits, 1));
      const attackTags = attackTagsFor(action, eff);
      for (let h = 0; h < hits; h++) {
        // Re-resolve per hit so randomEnemy splits across enemies and per-hit
        // triggers (e.g. stance-applied build-up) see live state.
        const targets = resolveTargets(ctx, action, eff.target);
        for (const t of targets) {
          if (!t.alive) continue;
          const base = evalNum(ctx, action, eff.amount, 0, t);
          applyAttackDamage(ctx, action.source, t, base, attackTags, action.card);
        }
      }
      break;
    }
    case 'block': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        gainBlock(ctx, t, evalNum(ctx, action, eff.amount, 0, t));
      }
      break;
    }
    case 'dodgeRoll': {
      // The dodge (framework contract: Weight Class and Dodge Roll). Player
      // only — the class, Dexterity and the die live on the player's side of
      // the board. The engine rolls on its own stream; the framework decides
      // the check, the difficulty and the temporary guard, which lands as
      // Block through the same door every block does.
      const p = ctx.player;
      if (!action.source || action.source.id !== p.id) break;
      const roll = ctx.rng.int('misc', 1, ctx.registries.framework.dodgeDie());
      const dexterity = (ctx.attributes && ctx.attributes.dexterity) || 10;
      const stance = playerWeightClass(ctx);
      const receipt = ctx.registries.framework.dodgeRoll({ roll, dexterity, weightClass: stance.weightClass });
      ctx.emit('dodgeRolled', {
        sourceId: p.id, roll, check: receipt.check, difficulty: receipt.difficulty,
        success: receipt.success, temporaryGuard: receipt.temporaryGuard, weightClass: stance.weightClass.id,
      });
      if (receipt.success && receipt.temporaryGuard > 0) gainBlock(ctx, p, receipt.temporaryGuard);
      break;
    }
    case 'applyStatus': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        const stacks = evalNum(ctx, action, eff.stacks, 1, t);
        statuses.applyStatus(ctx, t, eff.status, stacks, action.source);
      }
      break;
    }
    case 'removeStatus': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        statuses.removeStatus(ctx, t, eff.status, { reason: 'consumed' });
      }
      break;
    }
    case 'draw': {
      drawCards(ctx, Math.max(0, evalNum(ctx, action, eff.amount, 1)));
      break;
    }
    case 'discard': {
      const n = Math.max(0, evalNum(ctx, action, eff.amount, 1));
      discardFromHand(ctx, n, { random: !!eff.random });
      break;
    }
    case 'exhaust': {
      const n = Math.max(0, evalNum(ctx, action, eff.amount, 1));
      for (let i = 0; i < n && ctx.piles.hand.length > 0; i++) {
        const idx = eff.random ? Math.floor(ctx.rng.float('misc') * ctx.piles.hand.length) : ctx.piles.hand.length - 1;
        const card = ctx.piles.hand.splice(idx, 1)[0];
        ctx.piles.exhaust.push(card);
        ctx.emit('cardExhausted', { cardInstanceId: card.instanceId, cardId: card.cardId, reason: 'effect' });
      }
      break;
    }
    case 'addCard': {
      ctx.registries.cards.get(eff.card); // throws on dangling id
      const count = Math.max(1, evalNum(ctx, action, eff.count, 1));
      const pileName = eff.pile || 'discard';
      for (let i = 0; i < count; i++) {
        const inst = { instanceId: ctx.nextInstanceId(), cardId: eff.card, upgraded: false };
        const pile = ctx.piles[pileName];
        if (!pile) throw new Error(`Unknown pile '${pileName}'`);
        if (pileName === 'hand' && pile.length >= ctx.handMax) {
          ctx.piles.discard.push(inst);
          ctx.emit('cardDiscarded', { cardInstanceId: inst.instanceId, cardId: inst.cardId, reason: 'handFull' });
          continue;
        }
        const position = eff.position || 'random';
        if (position === 'top') pile.unshift(inst);
        else if (position === 'bottom') pile.push(inst);
        else pile.splice(Math.floor(ctx.rng.float('shuffle') * (pile.length + 1)), 0, inst);
      }
      break;
    }
    case 'gainEnergy': {
      const n = Math.max(0, evalNum(ctx, action, eff.amount, 1));
      ctx.player.energy += n;
      ctx.emit('energyGained', { amount: n });
      break;
    }
    case 'restoreMana': {
      const n = Math.max(0, evalNum(ctx, action, eff.amount, 1));
      for (const t of resolveTargets(ctx, action, eff.target)) {
        const before = t.mana;
        t.mana = Math.min(t.maxMana, t.mana + n);
        ctx.emit('manaRestored', { targetId: t.id, amount: t.mana - before });
      }
      break;
    }
    case 'loseHp': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        // `cause` labels the hpLost event (e.g. 'proc:bleed') so the damage
        // record can attribute the loss — display + instruments read it.
        applyLoseHp(ctx, t, evalNum(ctx, action, eff.amount, 0, t), eff.cause || 'effect');
      }
      break;
    }
    case 'heal': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        applyHeal(ctx, t, evalNum(ctx, action, eff.amount, 0, t));
      }
      break;
    }
    case 'shuffleDiscardIntoDraw': {
      reshuffleDiscardIntoDraw(ctx);
      break;
    }
    case 'enterStance': {
      const stanceId = eff.stance;
      const def = ctx.registries.stances.get(stanceId);
      if (ctx.player.stanceId === stanceId) break; // already in it: no-op (StS)
      if (ctx.player.stanceId) {
        ctx.emit('stanceExited', { stance: ctx.player.stanceId });
      }
      ctx.player.stanceId = stanceId;
      ctx.emit('stanceEntered', { stance: stanceId });
      for (const onEnter of def.onEnter || []) {
        ctx.enqueue({ effect: onEnter, source: ctx.player, owner: ctx.player, target: action.target, meta: action.meta });
      }
      break;
    }
    case 'poiseDamage': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        dealPoiseDamage(ctx, t, evalNum(ctx, action, eff.amount, 0, t));
      }
      break;
    }
    case 'stagger': {
      for (const t of resolveTargets(ctx, action, eff.target)) {
        staggerEnemy(ctx, t);
      }
      break;
    }
    default:
      throw new Error(`Opcode '${eff.op}' has no implementation`);
  }
}

// ---------------------------------------------------------------------------
// Run-level opcodes (events, shops, rewards reuse the same DSL — SPEC §3.4)
// ---------------------------------------------------------------------------

function runRunOpcode(ctx, action, eff) {
  const run = ctx.run;
  if (!run) {
    throw new Error(`Run-level opcode '${eff.op}' requires a run context (use executeRunEffects)`);
  }
  switch (eff.op) {
    case 'addCinders': {
      const n = evalNum(ctx, action, eff.amount, 0);
      run.cinders = Math.max(0, run.cinders + n);
      ctx.emit('cindersChanged', { amount: n, total: run.cinders });
      break;
    }
    case 'addCardToDeck': {
      ctx.registries.cards.get(eff.card); // throws on dangling id
      run.deck.push({ instanceId: ctx.nextInstanceId(), cardId: eff.card, upgraded: false });
      break;
    }
    case 'removeCardFromDeck': {
      // Equipment-granted instances (grantedBy) are package outputs: the next
      // authoritative reconcile would recreate the same deterministic id, so
      // a removal here could never persist — they are not candidates.
      let idx = -1;
      if (eff.card) idx = run.deck.findIndex((c) => c.cardId === eff.card && !c.grantedBy);
      else if (eff.random) {
        const candidates = run.deck.map((c, i) => i).filter((i) => !run.deck[i].grantedBy);
        idx = candidates.length ? candidates[Math.floor(ctx.rng.float('misc') * candidates.length)] : -1;
      }
      if (idx >= 0) run.deck.splice(idx, 1);
      break;
    }
    case 'upgradeCard': {
      const plan = smithingPlan(ctx.registries, run);
      // Since the item-upgrade redesign the plan also offers non-armament
      // items (no armamentId, no affectedCards); a card upgrade can only ride
      // an armament, so only those become candidates here.
      // AND ONLY AN ARMAMENT WITH CARDS IN THE DECK TODAY. A carried armament
      // with no live cards is a Smithing candidate (the Shrine previews it
      // through its authored roles), but a "random card" upgrade that landed
      // on it would set a tier and upgrade zero cards the player holds — the
      // choice promised a card (Codex, #535).
      const armaments = plan.candidates
        .filter((candidate) => candidate.itemKind === 'armament')
        .filter((candidate) => candidate.affectedCards.length > 0)
        .filter((candidate) => !eff.card || candidate.affectedCards.some((card) => card.cardId === eff.card))
        .map((candidate) => ({ kind: 'armament', id: candidate.armamentId }));
      const ordinary = run.deck
        // Equipment-composed instances are excluded like sourceArmamentId
        // ones: a granted/weaponArt instance (grantedBy) is rebuilt from its
        // package on every reconcile, so a per-copy upgraded flag would not
        // survive an unequip/re-equip — its upgrade rides the armament. An
        // UNARMED role instance (equipmentRole without a source piece — the
        // unarmed Strikes and Evasive Guards) keeps its per-copy flag through
        // reconcile (loadout.js resets it only when a piece takes the slot),
        // so it stays a candidate. A card whose upgrade is not authored — the
        // pure Dodge Roll — is never one: the event would spend for nothing.
        .filter((card) => !card.sourceArmamentId && !card.grantedBy && !card.upgraded && (!eff.card || card.cardId === eff.card))
        .filter((card) => ctx.registries.cards.has(card.cardId) && !!ctx.registries.cards.get(card.cardId).upgrade)
        .map((card) => ({ kind: 'card', card }));
      const candidates = [...armaments, ...ordinary];
      if (candidates.length === 0) break;
      const chosen = eff.random ? ctx.rng.pick('misc', candidates) : candidates[0];
      if (chosen.kind === 'armament') {
        const receipt = commitSmithing(ctx.registries, run, chosen.id, undefined, { free: true });
        ctx.emit('armamentSmithed', receipt);
      } else {
        chosen.card.upgraded = true;
      }
      break;
    }
    case 'addRelic': {
      let relicId = eff.id || null;
      if (!relicId && eff.random) {
        // Quest-pool relics are never "a random relic" — they are the named
        // reward of the choice that grants them (RELIC_POOLS, model/schemas.js).
        const pool = ctx.registries.relics.ids()
          .filter((id) => !run.relics.includes(id) && relicInRewardPool(ctx.registries.relics.get(id)));
        if (pool.length === 0) break;
        relicId = ctx.rng.pick('relicRewards', pool);
      }
      if (relicId && !run.relics.includes(relicId)) {
        ctx.registries.relics.get(relicId); // throws on dangling id
        run.relics.push(relicId);
        syncFlaskGrowth(ctx.registries, run); // growth chain: a relic source binds the moment it is held
      }
      break;
    }
    case 'addFlask': {
      const slots = flaskSlotCap(ctx.registries.balance);
      if (run.flasks.length >= slots) break;
      let flaskId = eff.id || null;
      if (!flaskId && eff.random) {
        const pool = ctx.registries.flasks.ids();
        if (pool.length === 0) break;
        flaskId = ctx.rng.pick('flaskRewards', pool);
      }
      if (flaskId) {
        ctx.registries.flasks.get(flaskId); // throws on dangling id
        run.flasks.push({ flaskId });
      }
      break;
    }
    case 'addFlaskCapacity': {
      const kind = eff.kind;
      if (!run.flaskCharges || !['hp', 'mana'].includes(kind) || !Number.isInteger(eff.amount) || eff.amount <= 0) break;
      run.flaskCharges.capacity += eff.amount;
      run.flaskCharges[kind] += eff.amount;
      run.flaskCharges[`${kind}Current`] += eff.amount;
      // THE MOMENT DOOR'S LEDGER LINE — not optional. Capacity is enforced as
      // base + grown + granted at the save shape (validateRunShape), so a
      // grant that raises capacity without recording itself makes the very
      // next save unaccountable and refused by name. The kind is deliberately
      // not recorded: under pool (D19) the grant's kind is spent the moment it
      // lands above, and the live split stays freely reallocatable at a grace.
      run.flaskCharges.granted += eff.amount;
      break;
    }
    case 'loseMaxHpPct': {
      const pct = evalNum(ctx, action, eff.pct, 0);
      if (!Number.isInteger(run.maxHpAdjustment)) {
        throw new Error('loseMaxHpPct requires the run maxHpAdjustment ledger');
      }
      const before = run.maxHp;
      run.maxHp = Math.max(1, Math.floor(run.maxHp * (1 - pct / 100)));
      run.maxHpAdjustment += run.maxHp - before;
      run.hp = Math.min(run.hp, run.maxHp);
      break;
    }
    case 'startCombat': {
      ctx.registries.encounters.get(eff.encounterId); // throws on dangling id
      run.combatEntered = eff.encounterId;
      break;
    }
    default:
      throw new Error(`Run opcode '${eff.op}' has no implementation`);
  }
}

/**
 * executeRunEffects({ run, registries, rng }, effects) → { events }.
 * Executes run-level effect lists (event choices, shop purchases, rewards)
 * outside combat. Combat statistics ops are unavailable, but damage / loseHp /
 * heal apply to the run's HP through a player facade so events like
 * "take 6 damage" and "heal 20% max HP" work.
 */
export function executeRunEffects({ run, registries, rng }, effects) {
  const events = [];
  const facade = {
    id: 'player',
    kind: 'player',
    hp: run.hp,
    maxHp: run.maxHp,
    block: 0,
    statuses: {},
    stanceId: null,
    relicIds: [],
    counters: { cardsPlayedThisTurn: 0, cardsPlayedThisCombat: 0, attacksPlayedThisCombat: 0 },
    alive: run.hp > 0,
  };
  const ctx = {
    run,
    registries,
    rng,
    player: facade,
    enemies: [],
    piles: { draw: [], hand: [], discard: [], exhaust: [] },
    handMax: registries.balance.handMax,
    queue: [],
    eventLog: events,
    _buffer: null,
    result: null,
    turn: 0,
    triggerState: new Map(),
    _idCounter: 0,
    emit(type, payload) {
      events.push({ type, ...payload });
    },
    enqueue(a) {
      ctx.queue.push(a);
    },
    nextInstanceId() {
      return `run${++ctx._idCounter}`;
    },
  };
  for (const eff of effects) {
    ctx.enqueue({ effect: eff, source: facade, owner: facade, target: facade, meta: {} });
  }
  let guard = 0;
  while (ctx.queue.length) {
    if (++guard > 1000) throw new Error('Run effect queue did not drain');
    executeAction(ctx, ctx.queue.shift());
  }
  run.hp = Math.min(facade.hp, run.maxHp);
  return { events };
}
