// Owner, 2026-11-14 (Wave 3, "a Poise break is the payoff"). Headless: state and events only, no rng, no timers.
//
// Under `poise.breakRule: "broken"` (content/source/fixCoreMechanics.json) a Poise break makes its owner BROKEN:
//   - an enemy loses its next action (the head of its planned moves, whatever its SP cost; a charging move is cancelled and
//     its charge lost) and its intent reads Broken at once; the player starts the next turn 1 Stamina short;
//   - it takes `damageMultiplier` x damage (x1.5) from every hit until Broken ends;
//   - Broken ends at the end of the turn whose action was lost (an enemy's own turn, the round after a player break), and then
//     its Poise refills to full, so a second break needs the whole bar again;
//   - while Broken its Poise cannot be refilled or damaged, so there is no second break.
// `entity.broken` is the one record of it: { since, endTurn, loseNext?, cancelledMove? }. A rules object without the key never
// reaches this module: a fight saved before this ruling keeps the Staggered stance of actions.js (fixCoreStagger).
import { cancelKnowledgeAction } from './enemyKnowledge.js';

const seatOf = (ctx, entity) => ctx.playerIdForEntity && entity.kind === 'player' ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {};

/** True while the owner is Broken. */
export const IsBroken = entity => Boolean(entity?.broken);

/** The Staggered stance a Broken owner stands in: it keeps `hasStatus staggered` content true and takes away stance mitigation. */
const brokenStance = (entity, rules) => ({ maneuver: 'staggered', camp: 'physical', range: 'melee', staggered: true, broken: true,
  damageMultiplier: rules.damageMultiplier, expiresOnOwnerCycle: (entity.combatOwnerCycle || 0) + 2 });

const ids = rows => rows.map(row => row.moveId).join(',');

/**
 * The plan is the tail of movesHistory (each pick was recorded when made): `before` leaves it and `kept` takes its place, so
 * maxConsecutive sees what will play (SPEC 4.6b: dropped moves leave history).
 */
function rewriteHistory(enemy, before, kept) {
  const history = enemy.movesHistory, start = history ? history.length - before.length : -1;
  if (start >= 0 && ids(before) === history.slice(start).join(',')) history.splice(start, before.length, ...kept.map(row => row.moveId));
}

const brokenIntent = enemy => { enemy.intent = { kind: 'staggered', moveId: null }; delete enemy.intentRevealed; };

/** Cancels the enemy's next action. Returns { applied, cancelledMove }; applied is false when no action is in reach to cancel yet. */
function cancelNextAction(ctx, enemy, phase = ctx.phase) {
  // A charging move (delayed, resolving this or a later enemy turn): cancelled, its charge lost.
  if (enemy.pendingMove) {
    const cancelledMove = enemy.pendingMove.moveId;
    enemy.pendingMove = null; enemy.plannedMoves = []; enemy.planDue = false;
    brokenIntent(enemy); cancelKnowledgeAction(ctx, enemy);
    return { applied: true, cancelledMove };
  }
  const plan = enemy.plannedMoves ?? [];
  if (phase === 'player') {
    const head = enemy.intent;
    // The shown head of this turn's plan. Nothing planned to play this turn means the action is already gone.
    if (!enemy.planDue || !head?.moveId || head.resolved) return { applied: true, cancelledMove: null };
    rewriteHistory(enemy, [{ moveId: head.moveId }, ...plan], plan);
    brokenIntent(enemy); cancelKnowledgeAction(ctx, enemy);
    enemy.planDue = plan.length > 0;
    return { applied: true, cancelledMove: head.moveId };
  }
  // Mid enemy turn (a Counter or reaction broke it): the next unplayed planned move of this turn goes, else next turn's head.
  if (enemy.planDue && plan.length) {
    const rest = plan.slice(1), dropped = plan[0].moveId;
    rewriteHistory(enemy, plan, rest);
    enemy.plannedMoves = rest;
    if (!rest.length) enemy.planDue = false;
    return { applied: true, cancelledMove: dropped };
  }
  return { applied: false, cancelledMove: null };
}

/**
 * The owner's Poise reached 0: it is Broken. Called by fixCoreStagger. Returns the move an enemy lost (or null).
 * A hit that lands while the owner is already Broken never gets here: Poise is 0 and cannot be damaged.
 */
export function BreakCombatant(ctx, entity, rules) {
  const turn = ctx.turn || 0, player = entity.kind === 'player';
  const record = { since: turn, endTurn: turn + 1 };
  let cancelledMove = null;
  if (player) {
    entity.pendingActionLoss = (entity.pendingActionLoss || 0) + 1;
  } else {
    const result = cancelNextAction(ctx, entity);
    cancelledMove = result.cancelledMove;
    if (result.applied) record.endTurn = turn; else record.loseNext = true;
    if (cancelledMove) record.cancelledMove = cancelledMove;
  }
  entity.broken = record;
  entity.combatStance = brokenStance(entity, rules);
  ctx.emit('combatStanceChanged', { targetId: entity.id, maneuver: 'staggered', broken: true });
  if (player) ctx.emit('playerStaggered', { targetId: entity.id, actionLoss: 1, statuses: {}, broken: true,
    ...(ctx.playerIdForEntity ? { targetPlayerId: ctx.playerIdForEntity(entity) } : {}), cause: 'poiseBreak' });
  return cancelledMove;
}

/**
 * A rollIntents hook: an enemy Broken in the middle of its own turn loses the head of the plan rolled for its next one.
 * Call after the head is presented (or with no head when nothing could be planned) and for a held charging move.
 */
export function ApplyPendingLoss(ctx, enemy) {
  const broken = enemy?.broken;
  if (!broken?.loseNext) return;
  const result = cancelNextAction(ctx, enemy, 'player');
  delete broken.loseNext;
  broken.endTurn = (ctx.turn || 0) + 1;
  if (result.cancelledMove) broken.cancelledMove = result.cancelledMove;
  ctx.emit('enemyStaggered', { targetId: enemy.id, enemyId: enemy.enemyId, cancelledMove: result.cancelledMove, cause: 'poiseBreak', broken: true });
}

/** Ends Broken once the turn whose action was lost is over: the stance goes and the Poise bar refills to full. */
export function EndBrokenWhenDue(ctx, entity) {
  const broken = entity?.broken;
  if (!broken || broken.loseNext || (ctx.turn || 0) < broken.endTurn) return false;
  delete entity.broken;
  if (entity.combatStance?.broken) delete entity.combatStance;
  const poise = entity.persistentPoise;
  if (poise && entity.alive) {
    const before = poise.value;
    poise.value = poise.max; delete poise.missing;
    ctx.emit('persistentPoiseChanged', { targetId: entity.id, restored: poise.value - before, value: poise.value, max: poise.max, source: 'brokenEnd', ...seatOf(ctx, entity) });
  }
  ctx.emit('brokenEnded', { targetId: entity.id, targetKind: entity.kind, ...seatOf(ctx, entity) });
  return true;
}
