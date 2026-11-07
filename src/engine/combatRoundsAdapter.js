// The enemy SP planner (SPEC §4.6, §4.6a). Headless: no DOM, no timers.
//
// Prices an enemy's moves in SP, keeps its per-turn SP pool, and plans its pool of moves in order (the
// multi-action plan that combat.js plays and the intent box previews). Formerly the solo adapter of the
// combat-rounds preview; its round, queue and timeline halves were removed in cleanup 3i-A.
import { stanceOf } from '../model/stanceRules.js';
import { actorRangeKey, movedEngagementState, advancedEngagementState } from '../model/combatEngagement.js';
import { core2ActionPolicyEnabled, core2MultiHitRulesEnabled } from '../model/core2ActionPolicy.js';
import { previewEnemyAction } from './enemyActionPreview.js';
import { expandedEnemyMove, enemyMoveCarrier } from './combatCardTactics.js';
import { quoteRangeActions } from './combatEngagement.js';
import * as Actions from './actions.js';
import { evaluate } from '../model/formulas.js';
import { createRng } from './rng.js';
import { stanceFor, playerKind, moveKind } from './combatRounds/stance.js';
import { branchHitCount, multiHitFloorFor, enemyMoveSpOf, enemyPoolOf } from '../model/actionCosts.js';
// A move with no stance costs 1 SP unless the move defines its own `sp` (SPEC §4.6a).
export const MOVE_SP = 1;
// Guard for zero-cost moves, which would otherwise never run the SP pool out.
const QUEUE_MAX = 16;

// A move's SP (SPEC §4.6a, owner 2026-10-12): its own `sp` when it names one, else the action-cost table price of its
// stance (model/actionCosts.js), else MOVE_SP. Given the paying `enemy` and its expanded (v2) `combat`, a spell-camp
// move costs one more SP per Silenced stack, as a player's spell card does (owner, 2026-10-13).
export function moveSp(move, { enemy = null, moveId, combat = null } = {}) {
  const entity = enemy && combat?.combatExpansionVersion === 2 ? enemy : null;
  const price = enemyMoveSpOf(move, moveKind(move), MOVE_SP, { entity, enemyId: enemy?.enemyId, moveId, ctx: combat });
  if (!core2ActionPolicyEnabled(combat)) return price;
  // Owner rule (2026-10-25): a multi-hit move costs at least its multi-hit floor (model/actionCosts.js
  // multiHitFloorFor: 1 SP per hit, less an offset for a finesse or Mana move). The authored price is never lowered
  // and there is no cap; an enemy short of SP simply cannot use the move.
  // A fight saved under rules version 1 keeps its original pricing exactly: a flat minimum of 2 SP for a multi-hit move.
  if (!core2MultiHitRulesEnabled(combat)) return enemyMoveHasMultipleHits(move, { enemy, moveId, combat }) ? Math.max(2, price) : price;
  return Math.max(price, enemyMoveHitFloor(move, { enemy, moveId, combat }));
}
export const enemyMoveSp = moveSp;

// Count HP-damage contacts per target, before damage components split into
// physical/magical lanes. An area attack hitting each defender once is one hit.
// Rules version 1 predicate, kept identical in behavior: any one defender taking more than one contact.
export function enemyMoveHasMultipleHits(move, { enemy, moveId, combat }) {
  const expanded = expandedEnemyMove(enemy, move, moveId, combat);
  const carrier = enemyMoveCarrier(enemy, expanded, moveId, combat);
  if (carrier.combatProfile.maneuver === 'counter') return false;
  const effects = [...(expanded.damage != null ? [{ op: 'damage', target: 'player', amount: expanded.damage, hits: expanded.hits ?? 1 }] : []), ...(expanded.effects || [])];
  const counts = new Map();
  const detached = { ...combat, rng: createRng(combat.rng.seed, combat.rng.getCounters()) };
  for (const effect of effects) {
    if (effect.op !== 'damage') continue;
    const action = { source: enemy, owner: enemy, target: combat.player, card: carrier, effect };
    const formulas = Actions.formulaCtxFor(combat, action, action.target);
    const hits = Math.max(0, Math.floor(evaluate(effect.hits ?? 1, formulas))) * Math.max(0, Math.floor(evaluate(effect.repeat ?? 1, formulas)));
    for (let i = 0; i < hits; i++) for (const target of Actions.resolveTargets(detached, action, effect.target)) {
      const key = target.id;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (counts.get(key) > 1) return true;
    }
  }
  return false;
}
// A move's multi-hit SP floor: multiHitFloorFor over its hit count, with the Mana and finesse offsets.
export function enemyMoveHitFloor(move, { enemy, moveId, combat }) {
  const expanded = expandedEnemyMove(enemy, move, moveId, combat);
  const carrier = enemyMoveCarrier(enemy, expanded, moveId, combat);
  return multiHitFloorFor(enemyMoveHitCount(move, { enemy, moveId, combat }), {
    mana: Number(expanded.mp) > 0 || Number(expanded.manaCost) > 0,
    finesse: [...(carrier.tags || []), ...(expanded.tags || [])].includes('finesse'),
  });
}
// The most HP-damage contacts any one defender takes from the move, per guarded branch (a counter is never multi-hit).
export function enemyMoveHitCount(move, { enemy, moveId, combat }) {
  const expanded = expandedEnemyMove(enemy, move, moveId, combat);
  const carrier = enemyMoveCarrier(enemy, expanded, moveId, combat);
  if (carrier.combatProfile.maneuver === 'counter') return 0;
  const effects = [...(expanded.damage != null ? [{ op: 'damage', target: 'player', amount: expanded.damage, hits: expanded.hits ?? 1 }] : []), ...(expanded.effects || [])];
  const detached = { ...combat, rng: createRng(combat.rng.seed, combat.rng.getCounters()) };
  const actionOf = effect => ({ source: enemy, owner: enemy, target: combat.player, card: carrier, effect });
  // Guarded effects are separate branches, the same rule as a player card (model/actionCosts.js branchHitCount).
  // Each contact resolves its own targets, so a random-target volley spreads as it would in play.
  return branchHitCount(effects, {
    hitsOf: () => 1,
    targetsOf: (effect) => {
      const action = actionOf(effect);
      const formulas = Actions.formulaCtxFor(combat, action, action.target);
      const hits = Math.max(0, Math.floor(evaluate(effect.hits ?? 1, formulas))) * Math.max(0, Math.floor(evaluate(effect.repeat ?? 1, formulas)));
      const keys = [];
      for (let i = 0; i < hits; i++) for (const target of Actions.resolveTargets(detached, action, effect.target)) keys.push(target.id);
      return keys;
    },
  });
}

// A forecast only: range quotes use detached streams and do not move or charge
// either combatant. Execution revalidates this total against the live pool.
export function enemyMoveQuote(move, { enemy, moveId, combat }) {
  const sp = moveSp(move, { enemy, moveId, combat });
  if (!core2ActionPolicyEnabled(combat)) return { sp, advanceSp: 0, totalSp: sp, rangeQuote: null };
  const carrier = enemyMoveCarrier(enemy, move, moveId, combat);
  const effects = previewEnemyAction(combat, enemy, moveId)?.actionEffects || [];
  const actions = effects.map(effect => ({ effect, source: enemy, owner: enemy, target: combat.player, card: carrier }));
  const rangeQuote = quoteRangeActions(combat, enemy, actions, { route: 'advance', preview: true });
  const advanceSp = rangeQuote?.advanceSp || 0;
  return { sp, advanceSp, totalSp: sp + advanceSp, rangeQuote };
}

export function enemyTurnSp(enemy, def, combat) {
  return core2ActionPolicyEnabled(combat)
    ? Math.max(0, (enemy.maxStamina ?? enemyPool(def)) - (enemy.pendingStaminaLoss || 0)) : enemyPool(def);
}

export const enemyAvailableSp = enemy => Math.max(0, enemy.stamina ?? enemy.fixCoreStaminaRemaining ?? enemy.maxStamina ?? 0);
export function commitEnemySp(combat, enemy, moveId, required) {
  const available = enemyAvailableSp(enemy);
  if (required > available) {
    combat.emit('enemyMoveUnavailable', { sourceId: enemy.id, moveId, required, available, resource: 'sp' });
    return false;
  }
  enemy.fixCoreStaminaRemaining = available - required;
  enemy.stamina = enemy.fixCoreStaminaRemaining;
  return true;
}

// The enemy's SP pool per turn (SPEC §4.6a, owner 2026-10-12): stat-driven, the stamina row read on the enemy's
// `attributes` plus its `equipmentSp` (model/actionCosts.js enemyPoolOf). An enemy with no authored stats has 1.
export const enemyPool = (def) => enemyPoolOf(def);

// Appends picks to `queue` (in place) until the enemy's SP pool is spent, and returns it (SPEC §4.6). The queue
// ends when the pool is empty or nothing affordable is left. An enemy with an empty queue always plays one move: when
// nothing fits the pool, the first pick is offered no limit (Infinity). A queue that already holds moves keeps them,
// and the SP they spend counts against the pool.
// `combat` (optional) prices each move for this enemy: see moveSp().
export function extendEnemyQueue(enemy, def, queue, { isFirstTurn = false, pick, combat = null }) {
  const policy = core2ActionPolicyEnabled(combat);
  const pool = enemyTurnSp(enemy, def, combat);
  // Price the accepted sequence against the stance before each move; planning grants nothing.
  const pricingEnemy = { ...enemy };
  const pricing = policy ? { ...combat, rangeState: combat.rangeState && structuredClone(combat.rangeState) } : combat;
  for (const entry of queue) {
    if (policy) projectEnemyMovement(pricing, pricingEnemy, entry.moveId);
    const stance = stanceOf({ ...def.moves[entry.moveId], enemyId: enemy.enemyId, moveId: entry.moveId });
    if (stance) pricingEnemy.combatStance = stance;
  }
  let spent = queue.reduce((sum, entry) => sum + entry.sp, 0);
  while (queue.length < QUEUE_MAX) {
    if (policy && queue.some((entry) => def.moves[entry.moveId]?.delay)) break;
    if (queue.length > 0 && spent >= pool) break;
    const opener = isFirstTurn && queue.length === 0 && def.firstMove ? def.firstMove : null;
    let moveId = opener ?? pick(pricingEnemy, def, pool - spent, pricing);
    if (policy && moveId != null && enemyMoveQuote(def.moves[moveId], { enemy: pricingEnemy, moveId, combat: pricing }).totalSp > pool - spent) moveId = pick(pricingEnemy, def, pool - spent, pricing);
    if (!policy && moveId == null && queue.length === 0 && opener == null) moveId = pick(pricingEnemy, def, Infinity, pricing);
    if (moveId == null) break;
    const sp = policy ? enemyMoveQuote(def.moves[moveId], { enemy: pricingEnemy, moveId, combat: pricing }).totalSp : moveSp(def.moves[moveId], { enemy: pricingEnemy, moveId, combat });
    if (spent + sp > pool && (policy || queue.length > 0)) break;
    spent += sp;
    enemy.movesHistory.push(moveId);
    queue.push({ moveId, sp });
    if (policy) projectEnemyMovement(pricing, pricingEnemy, moveId);
    const stance = stanceOf({ ...def.moves[moveId], enemyId: enemy.enemyId, moveId });
    if (stance) pricingEnemy.combatStance = stance;
  }
  return queue;
}

// Re-quotes a committed Core 2 plan against what the enemy can afford now (owner, 2026-11-02: "The intent shown during
// the player's turn is what the enemy does"; "if the enemy would lose sp reacting then the other actions they have queued
// should be removed"). `entries` is the head then the planned follow-ups, in play order, as `{ moveId, sp? }`. The walk
// mirrors execution (executeMovePayload): an entry that fits the SP left is kept, in order; one that does not is either
// replaced by the enemy's own affordable range-closing move (the swap execution would make) or dropped, and the walk
// goes on, because a refused move spends nothing. Nothing is picked and no RNG is drawn. Returns the kept entries.
export function trimEnemyPlan(enemy, def, entries, { combat }) {
  const pool = enemyTurnSp(enemy, def, combat);
  const pricingEnemy = { ...enemy };
  const pricing = { ...combat, rangeState: combat.rangeState && structuredClone(combat.rangeState) };
  const closingId = def.rangeClosingMove, closing = def.moves[closingId];
  const closingEligible = Boolean(closing) && !closing.reaction && (!closing.locked || enemy.unlockedMoves.includes(closingId))
    && Boolean(closing.effects?.some(effect => effect.op === 'moveEngagement'));
  const kept = [];
  let spent = 0;
  for (const entry of entries) {
    let moveId = entry.moveId;
    let quote = enemyMoveQuote(def.moves[moveId], { enemy: pricingEnemy, moveId, combat: pricing });
    if (spent + quote.totalSp > pool) {
      const left = pool - spent;
      if (!(quote.advanceSp > 0 && closingEligible && closingId !== moveId
        && enemyMoveSp(closing, { enemy: pricingEnemy, moveId: closingId, combat: pricing }) <= left)) continue;
      moveId = closingId;
      quote = enemyMoveQuote(closing, { enemy: pricingEnemy, moveId, combat: pricing });
      if (spent + quote.totalSp > pool) continue;
    }
    spent += quote.totalSp;
    kept.push({ moveId, sp: quote.totalSp });
    projectEnemyMovement(pricing, pricingEnemy, moveId);
    const stance = stanceOf({ ...def.moves[moveId], enemyId: enemy.enemyId, moveId });
    if (stance) pricingEnemy.combatStance = stance;
    if (def.moves[moveId]?.delay) break;
  }
  return kept;
}

// Authored movement and a paid implicit Advance both persist (SPEC range rule): once an
// attack has closed the distance, later attacks against that target quote no Advance until
// something grows the distance again. The quote is taken before the move's own movement
// effects, matching execution (the Advance is accepted when the move's actions are).
function projectEnemyMovement(pricing, enemy, moveId) {
  if (!pricing.rangeState?.policy.enabled) return;
  const move = expandedEnemyMove(enemy, pricing.registries.enemies.get(enemy.enemyId).moves[moveId], moveId, pricing);
  if (move.delay) return;
  if (core2MultiHitRulesEnabled(pricing)) pricing.rangeState = advancedEngagementState(pricing.rangeState, enemyMoveQuote(move, { enemy, moveId, combat: pricing }).rangeQuote);
  if (!move.effects?.some(effect => effect.op === 'moveEngagement')) return;
  const preview = previewEnemyAction(pricing, enemy, moveId);
  for (const effect of preview?.actionEffects || []) {
    if (effect.op !== 'moveEngagement' || effect.if && effect.conditionMet !== true || effect.oncePerTurn) continue;
    const repeats = Math.max(0, Math.floor(effect.repeat ?? 1));
    for (let repeat = 0; repeat < repeats; repeat++) {
      pricing.rangeState = movedEngagementState(pricing.rangeState, actorRangeKey(pricing, enemy),
        actorRangeKey(pricing, pricing.player), effect.bands);
    }
  }
}

// The multi-action plan (SPEC §4.6). Tops enemy.plannedMoves up to the SP pool with the same weighted pick
// (each pick is recorded in movesHistory when it is made), then takes its head: the move this roll plays. The plan
// is the moves the enemy plays, in order, so a planned follow-up is the action it does next. null when nothing picks.
export function takePlannedMove(combat, enemy, def, { isFirstTurn = false, pick }) {
  const plan = enemy.plannedMoves ?? (enemy.plannedMoves = []);
  extendEnemyQueue(enemy, def, plan, { isFirstTurn, pick, combat });
  return plan.shift()?.moveId ?? null;
}

// The timeline stance and kind helpers live in combatRounds/stance.js (no cycle with model/actionCosts.js).
export { stanceFor, playerKind, moveKind };

// The timeline card of one queued enemy move. An attack aims at the player; a defensive or other
// move is for its owner.
export function enemyTimelineCard(enemy, entry, index, def) {
  const move = def.moves[entry.moveId];
  const kind = moveKind(move);
  const tags = Array.isArray(move.tags) ? [...move.tags] : [];
  return {
    id: entry.moveId,
    instanceId: `${enemy.id}:${index}`,
    kind,
    target: kind === 'attack' ? 'player' : 'self',
    sp: entry.sp,
    tags,
    stance: stanceFor(kind, tags),
  };
}
