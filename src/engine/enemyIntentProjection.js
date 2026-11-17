import * as ProfileCombat from './gameProfileCombat.js';
import * as Damage from './combatDamagePreview.js';
import * as Actions from './actions.js';
import * as Matchups from './combatMatchups.js';
import * as Tactics from './combatCardTactics.js';
import * as Control from './combatStatusControl.js';
import * as Proposal from './proposalStatusRuntime.js';
import { knowledgeIntentProjection } from './enemyKnowledge.js';
import { decayAtTurnStart as decayStatuses } from './statuses.js';

import * as Counter from './counterRule.js';
import { IsBroken } from './brokenRule.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { effectiveD20Percent } from './d20Chance.js';
import { enemyMoveDamage } from '../model/state.js';

const sum = values => values.reduce((total, value) => total + value, 0);
const unknown = reason => ({ basis: 'hp', min: null, max: null, label: '?', tone: 'red', stanceReduced: false, uncertain: true, reason });

// Read cyclic engine exports at invocation time: capture also enters this
// module through the production bundler's other engine roots.

// Detached copies let shared defense preparation resize/deplete pools without
// writing to live combat, its event queue, entities, or named RNG streams.
function detached(combat, enemy, neutral) {
  const player = structuredClone(combat.player);
  const source = structuredClone(enemy);
  if (neutral) {
    delete player.combatStance;
    delete player.concurrentStances;
  }
  const ctx = { ...combat, player, enemies: combat.enemies.map(row => row.id === enemy.id ? source : structuredClone(row)),
    queue: [], eventLog: [], emit() {}, enqueue() {},
    rng: { float() { throw new Error('Intent projection must not roll RNG'); }, int() { throw new Error('Intent projection must not roll RNG'); } } };
  return { ctx, player, source };
}

// The status tick of an enemy's own turn start on a detached copy. The pools (Poise, Ward, Block) are read as they stand: the tick re-syncs their
// maxima, which the real turn does too, but a forecast must not refill what the enemy holds now.
function decayAtTurnStart(ctx, enemy) {
  const held = { persistentPoise: enemy.persistentPoise && { ...enemy.persistentPoise }, persistentWard: enemy.persistentWard && { ...enemy.persistentWard }, block: enemy.block, barrier: enemy.barrier };
  decayStatuses(ctx, enemy);
  for (const [key, value] of Object.entries(held)) { if (value === undefined) delete enemy[key]; else enemy[key] = value; }
}

// Each living enemy ahead of `source` plays its known actions through the previewed player state, in order, as the turn will run them: its
// head move, then each move of its plan (owner, 2026-11-14: a later number holds everything earlier enemies do to the player, not only the
// first attack's damage). A move lands its hits, then its authored effects on the previewed player: statuses (Vulnerable, Weak, Frail), Block,
// Poise and Ward. A delayed move ends its plan, as it does when it is played. Reactions are assumed declined. The copy's rng throws, so an action
// whose result depends on a draw (a status chance) cannot be known: the effect is rolled back and nothing after it is advanced.
// Ops that only touch the player's piles never change the HP the next hit costs and are skipped; any other op also stops the advance.
// moveEngagement changes where the enemy stands, which this forecast does not model (it never did).
const NEUTRAL_EFFECT_OPS = new Set(['addCard', 'moveEngagement']);
const PLAYER_POOL_OPS = new Set(['poiseDamage', 'wardDamage']);
const APPLIED_EFFECT_OPS = new Set(['applyStatus', 'buildup', 'removeStatus', 'block', 'gainBlock', 'gainBarrier', 'heal', 'applyReflect', 'gainCounterStacks']);

// Restores an entity object in place (the previewed state is shared by reference with its callers).
function restoreEntity(entity, saved) {
  for (const key of Object.keys(entity)) delete entity[key];
  Object.assign(entity, saved);
}

function applyMoveEffects(ctx, other, move, carrier, moveId, prepared) {
  for (const effect of move.effects || []) {
    if (!effect || effect.op === 'damage' || NEUTRAL_EFFECT_OPS.has(effect.op)) continue;
    if (PLAYER_POOL_OPS.has(effect.op)) {
      if (effect.target !== 'player' || !Number.isFinite(effect.amount)) return false;
      Damage.previewPoiseDrain(prepared.previewCtx, other, prepared, effect, carrier, effect.amount);
      continue;
    }
    if (!APPLIED_EFFECT_OPS.has(effect.op)) return false;
    const savedPlayer = structuredClone(prepared.defender), savedSelf = structuredClone(other);
    try {
      Actions.executeAction(prepared.previewCtx, { effect, source: other, owner: other, target: prepared.defender, card: carrier, meta: { moveId } });
    } catch {
      restoreEntity(prepared.defender, savedPlayer); restoreEntity(other, savedSelf);
      return false;
    }
  }
  return true;
}

// 'stop' ends the whole advance (an action that cannot be known), 'delay' ends this enemy's plan, 'ok' goes on.
function advanceThroughEarlierEnemies(ctx, source, prepared, ownMoves = []) {
  const advance = (other, moveId, damage, hits, followUp = false) => {
    const authored = ctx.registries.enemies.get(other.enemyId)?.moves?.[moveId];
    if (!authored) return 'stop';
    const move = Tactics.expandedEnemyMove(other, authored, moveId, ctx);
    // A delayed move only starts charging this turn: it lands nothing on the player yet, so it neither spends the
    // player's Block and Poise nor applies its effects in the forecast (its charging badge shows no damage either).
    if (move.delay) return 'delay';
    const carrier = Tactics.enemyMoveCarrier(other, move, moveId, ctx);
    try {
      // Live (combat.js presentIntent -> primeEnemyCounter) a planned follow-up is presented just before it plays, and presenting it enters its stance
      // from a carrier of its own: the stance and its entry grants (Precision, Evade) are in place before the hit, and the hit's own carrier then finds
      // the enemy already in that stance, so it carries the matching-stance bonus. A head was presented earlier (its stance is already on the enemy).
      if (followUp) ProfileCombat.setProfileStance(ctx, other, Tactics.enemyMoveCarrier(other, move, moveId, ctx));
      prepared.attackerSource = null; // each move meets a fresh copy of its enemy, with the stance and buffs the moves before it left
      if (damage != null) Damage.previewDamageHits(ctx, other, prepared.defender, damage, carrier.tags, carrier, Math.max(0, Math.floor(hits ?? 1)), prepared);
      ProfileCombat.setProfileStance(ctx, other, carrier);
    } catch { return 'stop'; }
    if (!applyMoveEffects(ctx, other, move, carrier, moveId, prepared)) return 'stop';
    return 'ok';
  };
  for (const other of ctx.enemies) {
    if (other.id === source.id) {
      // The enemy's own earlier moves this turn (a follow-up is priced after its head and the follow-ups before it).
      for (const [i, own] of ownMoves.entries()) if (advance(source, own.moveId, own.damage, own.hits, i > 0) !== 'ok') return 'stop';
      return;
    }
    const intent = other.intent;
    // A Broken enemy (poise.breakRule "broken") lost only its head: its intent reads Broken, but the plan behind it still plays this turn
    // (brokenRule.js cancelNextAction keeps plannedMoves and planDue). The legacy Staggered enemy skips its whole turn (skipNextTurn).
    const broken = IsBroken(other) && intent?.kind === 'staggered' && other.planDue && !other.skipNextTurn && !other.pendingMove;
    if (!other.alive || (!broken && (!intent?.moveId || ['staggered', 'unknown'].includes(intent.kind) || intent.resolved)) || other.pendingMove || other.skipNextTurn) continue;
    if (!broken && ctx.enemyKnowledge && knowledgeIntentProjection(ctx, other)?.exact === false) continue;
    decayAtTurnStart(ctx, other);
    if (!broken) {
      const head = advance(other, intent.moveId, intent.damage, intent.hits);
      if (head === 'stop') return 'stop';
      if (head === 'delay' || !other.planDue) continue;
    }
    for (const planned of other.plannedMoves || []) {
      const authored = ctx.registries.enemies.get(other.enemyId)?.moves?.[planned.moveId];
      if (!authored || authored.reaction) continue;
      const move = Tactics.expandedEnemyMove(other, authored, planned.moveId, ctx);
      if (move.delay) break;
      const step = advance(other, planned.moveId, move.damage == null ? null : enemyMoveDamage(other, move), move.hits ?? 1, true);
      if (step === 'stop') return 'stop';
      if (step === 'delay') break;
    }
  }
}

/**
 * Owner, 2026-11-17 ("it's hard for the player to know how much poise damage they are taking from an attack"): the Poise the player loses to this move,
 * over the states where every reachable hit connected. Each state already carries its hits' Poise (absorbed, drained, spared, floored); the move's
 * own Poise and Ward damage at the player then drain it as live does (previewPoiseDrain, the same door applyMoveEffects uses for earlier moves).
 * { min, max, breaks, mayBreak } in whole Poise, or null when the player holds no Poise pool.
 */
function PoiseBounds(ctx, source, move, carrier, prepared, connected, start) {
  if (!Number.isFinite(start)) return null;
  const pools = (move.effects || []).filter(effect => PLAYER_POOL_OPS.has(effect?.op) && effect.target === 'player' && Number.isFinite(effect.amount));
  const ends = connected.map(row => {
    const target = structuredClone(row.target);
    for (const effect of pools) Damage.previewPoiseDrain(prepared.previewCtx, row.attacker || source, { ...prepared, defender: target }, effect, carrier, effect.amount);
    return Math.max(0, target.persistentPoise?.value ?? start);
  });
  const lost = ends.map(end => Math.max(0, start - end));
  const broken = ends.map(end => start > 0 && end === 0);
  return { min: Math.min(...lost), max: Math.max(...lost), breaks: broken.every(Boolean), mayBreak: broken.some(Boolean) };
}

function damageBounds(combat, enemy, move, base, hits, neutral, action = null, own = null) {
  const { ctx, player, source } = detached(combat, enemy, neutral);
  const effect = move.effects?.find(row => row.op === 'damage');
  const moveId = action?.meta?.moveId || own?.moveId || enemy.intent?.moveId;
  const carrier = { ...(action?.card || Tactics.enemyMoveCarrier(source, move, moveId, ctx)),
    damageSchool: action?.effect?.damageSchool || action?.card?.damageSchool || (effect?.damageSchool || move.damageSchool) };
  const proposal = Proposal.proposalTargetPlan(ctx, source, player, carrier);
  // Dynamic perception/charge consumption and reactive damage are not a
  // deterministic HP promise; the shared attack-only projection reports a range.
  // Perception and evade are d20 checks at 5% steps (owner, 2026-11-01): the projection uses the step they really roll.
  const proposalChance = (proposal.allowed === false ? 0 : 1)
    * (proposal.perceptionChance == null ? 1 : effectiveD20Percent(proposal.perceptionChance) / 100)
    * (1 - effectiveD20Percent(proposal.evadeChance || 0) / 100);
  let max, chance;
  if (ProfileCombat.configuredCombat(ctx)) {
    // A miss preserves the target's defenses for the next hit. Enumerate/merge the reachable
    // target states (Block, pools, stance, statuses) rather than multiply all-landed damage by hit probability.
    // A landed hit carries into the next one exactly as previewDamageHits does, so a Poise break ends a Smash's defensive-stance bonus.
    const targetKey = row => JSON.stringify([row.block, row.barrier, row.persistentWard, row.persistentPoise, row.combatStance, row.broken, row.statuses, row.reflectStacks]);
    // Owner, 2026-11-14: enemies act in order, so the number on a later attacker is what the player loses after the earlier ones have hit
    // (their Block spent, their Poise broken, a Counter used up). A forecast with no action in flight carries each earlier, readable attack
    // through the same state before the Counter's own Block is read; the receipt taken as an action starts already holds them.
    // The attacker's own statuses tick at its turn start (Weak wears off), before its move: a forecast prices the hit after that tick.
    if (!action) decayAtTurnStart(ctx, source);
    const prepared = enemyIntentDamageState(ctx, source, carrier, base, action, action ? null : state => { if (advanceThroughEarlierEnemies(ctx, source, state, own?.moves) === 'stop' && own) own.unknown = true; });
    // Owner, 2026-11-14: the shown number is the HP the player loses if the move resolved now (receipt.hpLoss): after the player's Block, Poise, stance,
    // Reflect and Evade, carried hit to hit. Supersedes the 2026-11-03 raw hit. `landed` counts the hits that connected so the displayed range ignores misses.
    const poiseStart = prepared.defender?.persistentPoise?.value ?? null;
    let states = [{ attacker: Damage.cloneDetachedAttacker(source), target: prepared.defender, key: targetKey(prepared.defender), loss: 0, landed: 0, probability: 1 }];
    for (let hit = 0; hit < hits; hit++) {
      const next = new Map();
      const add = row => {
        if (!(row.probability > 0)) return;
        const key = `${row.key}:${row.loss}`;
        const previous = next.get(key);
        if (previous) previous.probability += row.probability;
        else next.set(key, row);
      };
      for (const state of states) {
        if (!(state.attacker?.hp > 0)) { add(state); continue; }
        const receipt = ProfileCombat.profileDamageReceipt(ctx, state.attacker || source, state.target, base, carrier, { forecast: true });
        const landed = structuredClone(state.target);
        Damage.applyReceiptToPreviewTarget(ctx, landed, receipt, state.attacker || source);
        const attacker = Damage.cloneDetachedAttacker(state.attacker);
        Damage.previewReflectReturn(ctx, attacker, landed, receipt, carrier);
        add({ attacker, target: landed, key: targetKey(landed) + `|${attacker?.hp}|${attacker?.combatStance}|${attacker?.persistentPoise?.value}|${JSON.stringify(attacker?.statuses)}`, loss: state.loss + receipt.hpLoss, landed: state.landed + 1, probability: state.probability * receipt.hitChance });
        // A hit Evade cancels spends one stack, so the next hit of the same move meets one stack fewer, as live does.
        const missed = receipt.evaded ? structuredClone(state.target) : state.target;
        if (receipt.evaded) Damage.SpendPreviewEvade(missed);
        add({ ...state, target: missed, key: receipt.evaded ? targetKey(missed) : state.key, probability: state.probability * (1 - receipt.hitChance) });
      }
      states = [...next.values()];
    }
    // Misses (Evade/AC/perception) are a chance, not a smaller number: the range spans the states where every reachable hit connected.
    if (own?.unknown) return null;
    const mostLanded = Math.max(...states.map(row => row.landed));
    const connected = states.filter(row => row.landed === mostLanded);
    const losses = connected.map(row => row.loss);
    const min = Math.min(...losses), max = Math.max(...losses);
    const expected = sum(states.map(row => row.loss * row.probability)) * proposalChance;
    const poise = proposalChance === 0 ? null : PoiseBounds(ctx, source, move, carrier, prepared, connected, poiseStart);
    return { min: proposalChance === 0 ? 0 : min, max: proposalChance === 0 ? 0 : max, hitChance: sum(connected.map(row => row.probability)) * proposalChance, expected,
      ...(poise ? { poise } : {}) };
  } else if (ctx.combatExpansionVersion === 2) {
    const amount = Actions.computeAttackDamage(ctx, source, player, base, carrier.tags, carrier, { matchups: false, beforeDefense: true });
    const contacts = Array.from({ length: hits }, () => ({ amount,
      splitBase: base, ratingBonus: Actions.cardRatingDamage(ctx, source, carrier, base), ratingPart: Actions.ratingBonusPart(ctx, carrier) }));
    const receipt = Matchups.previewTacticalAction(ctx, source, player, carrier, contacts,
      { ...Control.statusIncomingModifier(ctx, player, carrier.combatProfile), restrictions: Control.controlRestrictions(ctx, player) });
    Actions.prepareExpandedDefense(ctx, player, receipt, carrier);
    max = sum(receipt.hpAmounts);
    chance = 1 - (receipt.avoidance?.chance || 0) / 100;
  } else return null;
  chance = Math.max(0, Math.min(1, chance * proposalChance));
  if (chance === 0) max = 0;
  return { min: chance < 1 ? 0 : max, max, hitChance: chance, expected: max * chance };
}

// The caller must apply its observer gate before handing us a public intent.
// Contact receipts and idle forecasts share this evaluator, including detached
// Counter Block and evolving Block/Poise over a multi-hit action.
export function projectEnemyIntentDamage(combat, enemy, intent, { action = null, base = enemy.intent?.damage, hits = enemy.intent?.hits ?? 1, move = null } = {}) {
  if (intent.hidden || intent.revealed === false || intent.kind === 'staggered') return intent;
  if (intent.profile?.maneuver === 'evade') intent = { ...intent,
    dodgeCharges: enemy.combatEvade?.charges ?? enemy.statuses?.evade?.stacks ?? 0 };
  if (intent.damage == null) return intent;
  const moveId = action?.meta?.moveId || enemy.intent?.moveId;
  move ||= Tactics.expandedEnemyMove(enemy, combat.registries.enemies.get(enemy.enemyId).moves[moveId] || {}, moveId, combat);
  if (!action && (move.effects || []).filter(row => row.op === 'damage').length > 1) return { ...intent, projectedDamage: unknown('multipleDamageEffects') };
  hits = Math.max(0, Math.floor(hits));
  if (!Number.isFinite(base) || !Number.isFinite(hits) || hits > 100) return { ...intent, projectedDamage: unknown('unresolvedDamage') };
  const actual = damageBounds(combat, enemy, move, base, hits, false, action);
  const baseline = damageBounds(combat, enemy, move, base, hits, true, action);
  if (!actual || !baseline) return { ...intent, projectedDamage: unknown('unsupportedDefenseMode') };
  const stanceReduced = actual.expected < baseline.expected - 1e-9;
  const displayedReduction = stanceReduced && actual.min <= baseline.min && actual.max < baseline.max;
  const { poise, ...hp } = actual;
  return { ...intent, ...(poise ? { projectedPoise: { ...poise, label: poise.min === poise.max ? String(poise.max) : `${poise.min}–${poise.max}` } } : {}),
    projectedDamage: { basis: 'hp', ...hp,
    label: actual.min === actual.max ? String(actual.max) : `${actual.min}–${actual.max}`,
    tone: displayedReduction ? 'green' : 'red', stanceReduced, displayedReduction, uncertain: actual.min !== actual.max,
    baseline: { min: baseline.min, max: baseline.max, expected: baseline.expected },
    scope: 'directDamageAtCurrentDefenses' } };
}

export function enemyIntentDamageState(ctx, enemy, carrier, base, action = null, before = null) {
  const state = Damage.damagePreviewState(ctx, ctx.player);
  before?.(state);
  if (!fixCoreEnabled(ctx) || !ProfileCombat.configuredCombat(ctx)) return state;
  const group = action?.meta?.expansionGroup;
  const contact = !!group?.contactSequence && action?.effect?.op === 'damage';
  const planned = contact && action.meta?.expansionContacts?.[0]?.[0];
  const serial = contact && group?.manualCounterSerials?.[ctx.playerKey || 'player'];
  const receipt = (contact && planned && group?.targets?.[planned.key]?.receipt)
    || Matchups.previewTacticalAction(state.previewCtx, enemy, state.defender, carrier,
      [{ amount: Actions.computeAttackDamage(state.previewCtx, enemy, state.defender, base, carrier.tags, carrier, { matchups: false, beforeDefense: true }) }]);
  const paid = serial && serial === receipt?.counter?.serial;
  if (receipt && (!Counter.counterReturnSpent(ctx.player) || paid)) {
    const chance = ProfileCombat.profileDamageReceipt(state.previewCtx, enemy, state.defender, base, carrier);
    const extra = Counter.counterBlockBonus(state.previewCtx, receipt, contact ? planned.index : 0, chance.damageReceipt?.hits?.[0]?.incoming);
    state.defender.block = (state.defender.block || 0) + Matchups.CounterBlockGrant(state.previewCtx, state.defender, extra);
    state.counterBlocked = true; // previewDamageHits must not grant it a second time
  }
  return state;
}

// Owner, 2026-11-14: an enemy planning the same stance twice in a row shows every number, not only the first. The follow-up at `index` of
// `enemy.plannedMoves` is priced as the HP the player loses when it lands after the head and the follow-ups before it have resolved
// (their Block spent, Poise broken, the attacker's own stance and statuses carried). null when it has no number: it is not an attack, a
// delayed move ends the plan before it, a reaction, or something in front of it cannot be known.
export function ProjectPlannedMoveDamage(combat, enemy, index) {
  const planned = enemy.plannedMoves || [], head = enemy.intent;
  const defs = combat.registries.enemies.get(enemy.enemyId)?.moves;
  const broken = IsBroken(enemy) && head?.kind === 'staggered' && enemy.planDue;
  if (!defs || !planned[index] || (!broken && (!head?.moveId || head.kind === 'staggered'))) return null;
  // A Broken enemy lost its head, not its plan: the follow-ups are priced as the first moves it plays.
  const moves = broken ? [] : [{ moveId: head.moveId, damage: head.damage, hits: head.hits }];
  for (let i = 0; i < index; i++) {
    const authored = defs[planned[i].moveId];
    if (!authored || authored.reaction) return null;
    const move = Tactics.expandedEnemyMove(enemy, authored, planned[i].moveId, combat);
    moves.push({ moveId: planned[i].moveId, damage: move.damage == null ? null : enemyMoveDamage(enemy, move), hits: move.hits ?? 1 });
  }
  const authored = defs[planned[index].moveId];
  if (!authored || authored.reaction) return null;
  const move = Tactics.expandedEnemyMove(enemy, authored, planned[index].moveId, combat);
  if (move.delay || move.damage == null || (move.effects || []).filter(row => row.op === 'damage').length > 1) return null;
  const hits = Math.max(0, Math.floor(move.hits ?? 1)), base = enemyMoveDamage(enemy, move);
  if (!Number.isFinite(base) || hits > 100) return null;
  try {
    const bounds = damageBounds(combat, enemy, move, base, hits, false, null, { moves, moveId: planned[index].moveId });
    return bounds && { min: bounds.min, max: bounds.max, label: bounds.min === bounds.max ? String(bounds.max) : `${bounds.min}–${bounds.max}` };
  } catch { return null; }
}
