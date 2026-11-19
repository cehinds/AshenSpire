// src/engine/gearHooks.js — what a fight does with the gear vocabulary (`player.itemProps`, built by model/gearEffects.js GearSummary).
// Headless. Card numbers change on the card DEFINITION (GearCardDefinition), so the face, the quote and the play read one number; turn and play
// grants queue ordinary effect ops, as engine/itemPropertyHooks.js does.
import { ApplyGearCardRules, GearStatusRules, GearCondMet, GearSelectorMatches } from '../model/gearEffects.js';
import { GearState, GearProps } from './gearReceipt.js';
import { ChangeAttribute } from './liveStats.js';

const queue = (ctx, entity, effect) => ctx.enqueue({ effect: { target: 'self', ...effect }, source: entity, owner: entity, target: entity,
  // A Block grant is the same flat Block an item property lays (itemPropertyHooks.js QueueItemTurnStart): it keeps its printed floor.
  ...(effect.op === 'block' ? { card: { proposalProtectionFloor: true } } : {}), meta: { itemProperty: true, gear: true } });

/** GearCardDefinition(ctx, def) -> the card definition after the worn gear's card rules and the player's Multi-hit and Reach statuses. */
export function GearCardDefinition(ctx, def) {
  const player = ctx?.player;
  if (!player || !def) return def;
  const rules = [...(GearProps(player)?.cardRules || []), ...GearStatusRules(player.statuses)];
  return rules.length ? ApplyGearCardRules(rules, def, GearState(ctx, player)) : def;
}

/** Stamina the first turn changes by (Encumbered is -1; Gutter Leathers +1): added once at the first turn start. */
export const GearFirstTurnSp = entity => Number(GearProps(entity)?.firstTurnSp) || 0;

function grantEffect(grant) {
  const n = Math.max(0, grant.amount);
  if (grant.grant === 'block') return { op: 'block', amount: n };
  // The end-of-turn grants are exact: they take no gain bonus.
  if (grant.grant === 'counter') return { op: 'gainCounterStacks', amount: n, noGainBonus: true };
  if (grant.grant === 'retreat') return { op: 'moveEngagement', bands: 1 }; // the Retreat itself; the stacks are a floor, set in QueueGearTurnGrants
  if (grant.grant === 'heal') return { op: 'heal', amount: n };
  if (grant.grant === 'draw') return { op: 'draw', amount: n };
  if (grant.status) return { op: 'applyStatus', status: grant.status, stacks: n, noGainBonus: true };
  return null;
}

/** QueueGearTurnGrants(ctx, player, 'start'|'end'): Block, Counter, Evade, Ward, Retreat, Reach, heal at a turn's edge. A Block granted at the end lasts until the start of its holder's next turn. */
export function QueueGearTurnGrants(ctx, player, phase) {
  const props = GearProps(player);
  if (!props?.turnGrants) return;
  const state = GearState(ctx, player);
  let retreatFloor = 0;
  for (const grant of props.turnGrants) {
    if (grant.phase !== phase || !grant.conds.every(cond => GearCondMet(cond, state))) continue;
    const effect = grantEffect(grant);
    if (grant.grant === 'retreat' && grant.amount > 0) retreatFloor += grant.amount;
    if (effect && grant.amount > 0) queue(ctx, player, effect);
  }
  // Owner, 2026-11-19: a Retreat grant is a floor, not an addition: the holder ends with max(current, floor) Retreat stacks, so a stack already held adds nothing.
  const missing = retreatFloor - Math.max(0, Number(player.statuses?.retreat?.stacks) || 0);
  if (missing > 0) queue(ctx, player, { op: 'applyStatus', status: 'retreat', stacks: missing, noGainBonus: true });
}

/** QueueGearCardPlayed(ctx, player, def): what playing a matching card grants (Evade on a Defend, Ward on a spell, a draw, STR until end of turn). */
export function QueueGearCardPlayed(ctx, player, def) {
  const after = [];
  const props = GearProps(player);
  const spell = (def?.tags || def?.cardTags || []).includes('camp:spell');
  const state = GearState(ctx, player);
  if (props?.playGrants) for (const grant of props.playGrants) {
    if (!GearSelectorMatches(grant.selector, grant.arg, def) || !grant.conds.every(cond => GearCondMet(cond, state))) continue;
    // STR until the end of the turn lands once the card's own effects have resolved, so the play that earns it does not quote or deal it.
    if (grant.grant === 'strength') after.push(() => ChangeAttribute(ctx, player, 'strength', grant.amount, { thisTurn: true }));
    else { const effect = grantEffect(grant); if (effect && grant.amount > 0) queue(ctx, player, effect); }
  }
  if (spell && player?.counters) player.counters.spellsPlayedThisTurn = (player.counters.spellsPlayedThisTurn || 0) + 1;
  return () => { for (const run of after) run(); };
}

