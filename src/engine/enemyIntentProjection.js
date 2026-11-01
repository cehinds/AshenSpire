import * as ProfileCombat from './gameProfileCombat.js';
import * as Damage from './combatDamagePreview.js';
import * as Actions from './actions.js';
import * as Matchups from './combatMatchups.js';
import * as Tactics from './combatCardTactics.js';
import * as Control from './combatStatusControl.js';
import * as Proposal from './proposalStatusRuntime.js';

import * as Counter from './counterRule.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { effectiveD20Percent } from './d20Chance.js';

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

function damageBounds(combat, enemy, move, base, hits, neutral, action = null) {
  const { ctx, player, source } = detached(combat, enemy, neutral);
  const effect = move.effects?.find(row => row.op === 'damage');
  const moveId = action?.meta?.moveId || enemy.intent?.moveId;
  const school = combat.ratingsRules?.enemyAttackType?.[`${enemy.enemyId}:${moveId}`];
  const carrier = { ...(action?.card || Tactics.enemyMoveCarrier(source, move, moveId, ctx)),
    damageSchool: action?.effect?.damageSchool || action?.card?.damageSchool || (school && school !== 'auto' ? school : effect?.damageSchool || move.damageSchool) };
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
    const targetKey = row => JSON.stringify([row.block, row.barrier, row.persistentWard, row.persistentPoise, row.combatStance, row.statuses, row.reflectStacks]);
    const prepared = enemyIntentDamageState(ctx, source, carrier, base, action);
    let states = [{ attacker: Damage.cloneDetachedAttacker(source), target: prepared.defender, key: targetKey(prepared.defender), loss: 0, probability: 1 }];
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
        const receipt = ProfileCombat.profileDamageReceipt(ctx, state.attacker || source, state.target, base, carrier);
        const landed = structuredClone(state.target);
        Damage.applyReceiptToPreviewTarget(ctx, landed, receipt);
        const attacker = Damage.cloneDetachedAttacker(state.attacker);
        Damage.previewReflectReturn(ctx, attacker, landed, receipt, carrier);
        add({ attacker, target: landed, key: targetKey(landed) + `|${attacker?.hp}|${attacker?.combatStance}|${attacker?.persistentPoise?.value}|${JSON.stringify(attacker?.statuses)}`, loss: state.loss + receipt.hpLoss, probability: state.probability * receipt.hitChance });
        add({ ...state, probability: state.probability * (1 - receipt.hitChance) });
      }
      states = [...next.values()];
    }
    const losses = states.map(row => row.loss);
    const min = Math.min(...losses), max = Math.max(...losses);
    const expected = sum(states.map(row => row.loss * row.probability)) * proposalChance;
    return { min: proposalChance < 1 ? 0 : min, max: proposalChance === 0 ? 0 : max,
      hitChance: sum(states.filter(row => row.loss > 0).map(row => row.probability)) * proposalChance, expected };
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
  return { ...intent, projectedDamage: { basis: 'hp', ...actual,
    label: actual.min === actual.max ? String(actual.max) : `${actual.min}–${actual.max}`,
    tone: displayedReduction ? 'green' : 'red', stanceReduced, displayedReduction, uncertain: actual.min !== actual.max,
    baseline: { min: baseline.min, max: baseline.max, expected: baseline.expected },
    scope: 'directDamageAtCurrentDefenses' } };
}

export function enemyIntentDamageState(ctx, enemy, carrier, base, action = null) {
  const state = Damage.damagePreviewState(ctx, ctx.player);
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
    state.defender.block = (state.defender.block || 0) + Counter.counterBlockGrant(state.previewCtx, state.defender, extra);
  }
  return state;
}
