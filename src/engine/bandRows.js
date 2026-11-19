// Front and back rows (owner, 2026-11-15, W25-BANDS). Headless; keyed on `fixCoreRules.bands.rows` (src/model/fixCoreMechanics.js FixCoreBands),
// so a fight saved without it plays as before.
//
// A row is `enemy.row` ('front' | 'back'); the player's Advance is `entity.advanced` (the turn ends of the player it still lasts, 0 or absent = not
// Advanced). Both are written onto the existing player-enemy engagement bands (`ctx.rangeState`), so every reader of a band (the card cost quote and face,
// the hit contact, the enemy forecast, the Counter return price) keeps working unchanged:
//   Advanced        -> every pair band 0 (you are in every enemy's reach);
//   back row        -> its pair band is at least 1 (reach) while you are not Advanced;
//   front row       -> the pair band is left as stored (a Backstep or push may hold it at 1).
import { FixCoreBands } from '../model/fixCoreMechanics.js';
import { actorRangeKey, bandCap, rangePairKey } from '../model/combatEngagement.js';
import { equippedIn } from '../model/loadout.js';
import { FORMATION_ROWS, formationDimensions, perspectiveEnemyCellOrder } from '../model/formationLayout.js';
import { attackDescriptor } from '../model/attackTags.js';
import * as S from '../framework/statusSemantics.js';

export const BandRows = Object.freeze(['front', 'back']);

// The Retreat status (owner 2026-11-18): an enemy the player sent back carries Retreat stacks and stays in the back row while it has one.
// A stack is removed by one Advance, the player's (every enemy loses one) or the enemy's own (its approach spends the stack instead of moving it).
// Advancing costs `range.advanceSpPerBand` (1) Stamina for the player, as the range policy states; the stack counts are the bands block's
// optional `retreatStacks` (given per Retreat or push, default 1) and `advanceRemovesStacks` (default 1).
export const RETREAT_STATUS = 'retreat';
export const RetreatStacks = enemy => S.getStacks(enemy, RETREAT_STATUS);
function addRetreat(ctx, enemy) {
  S.applyStatus(ctx, enemy, 'retreat', BandsActive(ctx)?.retreatStacks ?? 1, null);
}
function spendRetreat(ctx, enemy, amount) {
  if (RetreatStacks(enemy) > 0) S.removeStatus(ctx, enemy, RETREAT_STATUS, { amount, reason: 'consumed' });
}

/** BandsActive(ctx) -> the band rules when the fight has rows and engagement is on, else null. */
export function BandsActive(ctx) {
  const rules = FixCoreBands(ctx);
  return rules && ctx.rangeState?.policy.enabled ? rules : null;
}
const playerEntities = ctx => ctx.players ? [...ctx.players.values()].map(row => row.entity) : [ctx.player];
const setPair = (ctx, player, enemy, band) => {
  const key = rangePairKey(actorRangeKey(ctx, player), actorRangeKey(ctx, enemy));
  if (!Object.hasOwn(ctx.rangeState.engagements, key)) return;
  ctx.rangeState = { ...ctx.rangeState, engagements: { ...ctx.rangeState.engagements, [key]: Math.min(band, bandCap(ctx.rangeState.policy)) } };
};
const pairBand = (ctx, player, enemy) => ctx.rangeState.engagements[rangePairKey(actorRangeKey(ctx, player), actorRangeKey(ctx, enemy))];

/** The row an enemy stands in at the start: the encounter's placement, else its definition's `row`, else back for an enemy that starts at reach. */
export function DefaultEnemyRow(def, placed = null) {
  if (BandRows.includes(placed)) return placed;
  if (BandRows.includes(def?.row)) return def.row;
  return def?.startingRange === 'reach' || def?.startingRange === 'ranged' ? 'back' : 'front';
}

// Presentation address: the perspective grid draws the enemy back rank in column 4 and the front rank in column 3, so a row is a column.
const rowColumn = row => row === 'back' ? '4' : '3';
function placeInRow(ctx, enemy) {
  if (!ctx.formationPolicy || !enemy.formationCell) return;
  const cells = ctx.enemies.map(other => other.formationCell).filter(Boolean);
  const lanes = Math.max(1, ...cells.map(cell => FORMATION_ROWS.indexOf(cell[0]) + 1));
  const dimensions = formationDimensions({ perspectiveGrid: true, formationPolicy: ctx.formationPolicy }, ctx.enemies.length, lanes);
  const taken = new Set(ctx.enemies.filter(other => other !== enemy).map(other => other.formationCell));
  const free = perspectiveEnemyCellOrder(dimensions).filter(cell => cell[1] === rowColumn(enemy.row) && !taken.has(cell));
  const next = free.find(cell => cell[0] === enemy.formationCell[0]) || free[0];
  if (next) enemy.formationCell = next;
}

/** SyncBandRows(ctx): write rows and Advance onto the pair bands. Idempotent. */
export function SyncBandRows(ctx) {
  if (!BandsActive(ctx)) return;
  for (const player of playerEntities(ctx)) for (const enemy of ctx.enemies) {
    if (!enemy.alive || pairBand(ctx, player, enemy) === undefined) continue;
    if (player.advanced > 0) setPair(ctx, player, enemy, 0);
    else if (enemy.row === 'back') setPair(ctx, player, enemy, Math.max(1, pairBand(ctx, player, enemy)));
  }
}

/** InitBandRows(ctx, placements): give every enemy its row (after initializeCombatRange). */
export function InitBandRows(ctx, placements = []) {
  if (!BandsActive(ctx)) return;
  ctx.enemies.forEach((enemy, i) => {
    enemy.row = DefaultEnemyRow(ctx.registries.enemies.get(enemy.enemyId), placements?.[i]);
    // A front enemy keeps the distance the fight began at (a shortbow wearer starts at reach); a back enemy is at least at reach.
    if (enemy.row === 'back') for (const player of playerEntities(ctx)) setPair(ctx, player, enemy, Math.max(1, pairBand(ctx, player, enemy) ?? 1));
  });
  // Seat each enemy in its row's column (a cell another enemy holds is skipped; an enemy with no free cell there keeps its own).
  for (const enemy of ctx.enemies) placeInRow(ctx, enemy);
  SyncBandRows(ctx);
}

/** SetEnemyRow(ctx, enemy, row, reason): move one enemy between rows; its pair bands follow (front: closed; back: reach). */
export function SetEnemyRow(ctx, enemy, row, reason = 'move') {
  if (!BandsActive(ctx) || !BandRows.includes(row) || enemy.row === row) return false;
  enemy.row = row;
  if (row === 'front') S.removeStatus(ctx, enemy, RETREAT_STATUS, { reason: 'consumed' });
  placeInRow(ctx, enemy);
  for (const player of playerEntities(ctx)) setPair(ctx, player, enemy, row === 'back' ? 1 : 0);
  SyncBandRows(ctx);
  ctx.emit?.('combatRowChanged', { targetId: enemy.id, row, reason });
  return true;
}

/** SwapEnemyRows(ctx, target): the target and the nearest living enemy (by place in the fight) in the other row trade rows and ranks; with none there, the target alone crosses. */
export function SwapEnemyRows(ctx, target) {
  if (!BandsActive(ctx) || !target?.alive || target.kind !== 'enemy') return false;
  const at = ctx.enemies.indexOf(target), row = target.row === 'back' ? 'front' : 'back';
  const other = ctx.enemies.filter(enemy => enemy.alive && enemy !== target && enemy.row === row)
    .sort((a, b) => Math.abs(ctx.enemies.indexOf(a) - at) - Math.abs(ctx.enemies.indexOf(b) - at) || ctx.enemies.indexOf(a) - ctx.enemies.indexOf(b))[0] || null;
  const cells = [target.formationCell, other?.formationCell];
  SetEnemyRow(ctx, target, row, 'swap');
  if (other) {
    SetEnemyRow(ctx, other, row === 'back' ? 'front' : 'back', 'swap');
    if (cells[0] && cells[1]) [target.formationCell, other.formationCell] = [cells[1], cells[0]];
  }
  ctx.emit?.('combatRowsSwapped', { targetId: target.id, otherId: other?.id || null });
  return true;
}

// The card play (its range root id) whose own Advance stepped the entity in, so a push in that same play (Hit and Run) steps it back out, while a
// push in a play that did not advance (Gale Push while already Advanced) leaves the Advance alone (SPEC: Advanced lasts until your next turn ends or you play Retreat).
const advancedByPlay = new WeakMap();
/** MarkAdvancedByPlay(entity, rootId): the play with this root advanced the entity in. */
export function MarkAdvancedByPlay(entity, rootId) { if (entity && rootId) advancedByPlay.set(entity, rootId); }

function endAdvance(ctx, entity) {
  advancedByPlay.delete(entity);
  entity.advanced = 0;
  for (const enemy of ctx.enemies) if (enemy.alive && enemy.row === 'back') setPair(ctx, entity, enemy, 1);
  SyncBandRows(ctx);
  ctx.emit?.('combatAdvancedChanged', { sourceId: entity.id, advanced: false, turnEnds: 0 });
}
/** SetAdvanced(ctx, entity, on): the player steps in (every enemy is in reach) or steps back. */
export function SetAdvanced(ctx, entity, on) {
  const rules = BandsActive(ctx);
  if (!rules || !entity) return false;
  if (!on) { if (!(entity.advanced > 0)) return false; endAdvance(ctx, entity); return true; }
  // Each Advance of the player removes Retreat stacks from every enemy (one each by default), even when the Advance is already
  // at its full duration (Codex on PR #2835: a second Advance in a turn still spends a stack).
  const holding = ctx.enemies.some(enemy => enemy.alive && RetreatStacks(enemy) > 0);
  if (entity.advanced === rules.advancedTurnEnds && !holding) return false;
  entity.advanced = rules.advancedTurnEnds;
  for (const enemy of ctx.enemies) if (enemy.alive) spendRetreat(ctx, enemy, rules.advanceRemovesStacks ?? 1);
  SyncBandRows(ctx);
  ctx.emit?.('combatAdvancedChanged', { sourceId: entity.id, advanced: true, turnEnds: entity.advanced });
  return true;
}

/** BandsPlayerTurnEnd(ctx): one of the Advance's turn ends is spent; at zero the player is back out of reach of the back row. */
export function BandsPlayerTurnEnd(ctx) {
  if (!BandsActive(ctx)) return;
  for (const player of playerEntities(ctx)) if (player.advanced > 0 && --player.advanced === 0) endAdvance(ctx, player);
}

/** BandsEnemyPhaseStart(ctx): with no front-row enemy alive, every back-row enemy steps forward, except one still holding Retreat stacks (a retreated enemy stays back). */
export function BandsEnemyPhaseStart(ctx) {
  if (!BandsActive(ctx)) return;
  const living = ctx.enemies.filter(enemy => enemy.alive);
  if (living.length && !living.some(enemy => enemy.row === 'front')) for (const enemy of living) if (!(RetreatStacks(enemy) > 0)) SetEnemyRow(ctx, enemy, 'front', 'frontEmpty');
}

/** BandsFormationBlock(ctx, enemy): the Block an enemy gains at its turn start for standing in a row with another living enemy (0 when alone or without rows). */
export function BandsFormationBlock(ctx, enemy) {
  const rules = BandsActive(ctx);
  if (!rules || !enemy?.alive || !(rules.formationBlock > 0)) return 0;
  return ctx.enemies.some(other => other !== enemy && other.alive && other.row === enemy.row) ? rules.formationBlock : 0;
}

/** BandsEnemyAdvance(ctx, enemy, reason): a back-row enemy's own Advance (owner 2026-11-18): while it holds Retreat stacks it spends ONE and stays back; with none it steps to the front. Returns true when it moved. */
export function BandsEnemyAdvance(ctx, enemy, reason = 'advance') {
  if (RetreatStacks(enemy) > 0) { spendRetreat(ctx, enemy, 1); return false; }
  SetEnemyRow(ctx, enemy, 'front', reason);
  return true;
}

/** BandsEnemyHeldBack(ctx, enemy): true when the enemy stands in the back row holding Retreat stacks, so an Advance of its own spends a stack and does not close the distance. */
export const BandsEnemyHeldBack = (ctx, enemy) => Boolean(BandsActive(ctx)) && enemy?.row === 'back' && RetreatStacks(enemy) > 0;

/** BandsMoveEngagement(ctx, source, target, bands): a moveEngagement effect under rows. Returns true when rows handled it (the pair band is not moved by the caller). */
export function BandsMoveEngagement(ctx, source, target, bands, rootId = null) {
  if (!BandsActive(ctx)) return false;
  if (source.kind === 'enemy') {
    if (bands > 0) { SetEnemyRow(ctx, source, 'back', 'retreat'); return true; }
    // A retreated enemy's approach removes one of its Retreat stacks instead of moving it forward; with none it steps forward as normal.
    // The move is spent either way, so the intent shown (the step forward) is the move played.
    if (source.row === 'back') { BandsEnemyAdvance(ctx, source, 'approach'); return true; }
    return false; // a front enemy held at reach (a Backstep, a push): the ordinary pair move closes it
  }
  // A player's push ("Retreat one band": Gale Push, Hit and Run; owner 2026-11-18) sends the target to the back row, as a Force push does.
  // The push ends the pusher's Advance only when this same play advanced in first (Hit and Run steps back out); any other push leaves the Advance on.
  if (bands > 0 && target?.kind === 'enemy') { if (rootId && advancedByPlay.get(source) === rootId) SetAdvanced(ctx, source, false); SetEnemyRow(ctx, target, 'back', 'push'); addRetreat(ctx, target); return true; }
  if (bands < 0) {
    if (target?.row === 'back') { SetAdvanced(ctx, source, true); return true; }
    return false; // a front enemy held at reach by a Backstep: the ordinary pair move closes it
  }
  SetAdvanced(ctx, source, false); // Backstep: you step back out of every reach you closed
  return false;
}

/** PlayerRetreat(ctx, entity): the player's Retreat (owner 2026-11-18): the Advance ends if there is one, and every living front-row enemy steps back (band +1). Works Advanced or not. */
export function PlayerRetreat(ctx, entity) {
  if (!BandsActive(ctx)) return false;
  SetAdvanced(ctx, entity, false);
  for (const enemy of ctx.enemies) if (enemy.alive && enemy.row === 'front') { SetEnemyRow(ctx, enemy, 'back', 'retreat'); addRetreat(ctx, enemy); }
  return true;
}

const pieceTags = piece => [...(piece?.tags || []), ...(piece?.propertyTags || [])];
/** HoldsRetreatWeapon(ctx, entity): true when a wielded weapon carries the rules' retreat tag. */
export function HoldsRetreatWeapon(ctx, entity = ctx.player) {
  const rules = BandsActive(ctx);
  if (!rules || !ctx.loadout) return false;
  for (const slot of ctx.registries.equipment?.slots || []) {
    const piece = equippedIn(ctx.registries, ctx.loadout, entity.classId, slot.id);
    if (piece && attackDescriptor(piece).source === 'weapon' && pieceTags(piece).includes(rules.retreatTag)) return true;
  }
  return false;
}

/** GrantRetreatCard(ctx): at the start of the player's turn a retreat weapon puts one free Retreat card in hand (never two, whatever is wielded). */
export function GrantRetreatCard(ctx) {
  const rules = BandsActive(ctx);
  if (!rules || !HoldsRetreatWeapon(ctx) || !ctx.registries.cards.has(rules.retreatCardId)) return false;
  if (ctx.piles.hand.some(card => card.cardId === rules.retreatCardId)) return false;
  if (ctx.piles.hand.length >= ctx.handMax) return false; // a full hand is granted none: no overflow
  ctx.piles.hand.push({ instanceId: ctx.nextInstanceId(), cardId: rules.retreatCardId, upgraded: false });
  ctx.emit?.('combatRetreatGranted', { cardId: rules.retreatCardId });
  return true;
}

/** BandsEnemyBackAtPhase(ctx, enemy): true when the enemy will still stand in the back row when the coming enemy phase begins (an empty front row steps it forward first). */
export function BandsEnemyBackAtPhase(ctx, enemy) {
  if (!BandsActive(ctx) || enemy?.row !== 'back') return false;
  return RetreatStacks(enemy) > 0 || ctx.enemies.some(other => other.alive && other.row === 'front');
}

/**
 * BandsEnemyPhaseRangeState(ctx): a detached copy of the range state as it will stand when the coming enemy phase begins, for planning and
 * re-quoting an enemy's intents (owner, 2026-11-15). The end of this player turn spends one turn end of the Advance, so an Advance with a single
 * turn end left is over by then; a back-row enemy that stays back is at reach, and one that steps forward is closed. Pure: the fight is not changed.
 */
export function BandsEnemyPhaseRangeState(ctx) {
  const copy = ctx.rangeState && structuredClone(ctx.rangeState);
  if (!copy || !BandsActive(ctx)) return copy;
  const view = { ...ctx, rangeState: copy };
  const living = ctx.enemies.filter(enemy => enemy.alive);
  const frontHeld = living.some(enemy => enemy.row === 'front');
  for (const player of playerEntities(ctx)) for (const enemy of living) {
    const key = rangePairKey(actorRangeKey(ctx, player), actorRangeKey(ctx, enemy));
    if (!Object.hasOwn(copy.engagements, key)) continue;
    const advanced = player.advanced > 1;
    const staysBack = enemy.row === 'back' && (frontHeld || RetreatStacks(enemy) > 0);
    if (advanced) copy.engagements[key] = 0;
    else if (enemy.row === 'back') copy.engagements[key] = staysBack ? Math.min(Math.max(1, copy.engagements[key]), bandCap(view.rangeState.policy)) : 0;
  }
  return copy;
}
