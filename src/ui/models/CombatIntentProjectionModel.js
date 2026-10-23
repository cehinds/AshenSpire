import { previewIntent } from '../../engine/combat.js';
import { configuredCombat, profileDamageReceipt } from '../../engine/gameProfileCombat.js';
import { applyReceiptToPreviewTarget } from '../../engine/combatDamagePreview.js';
import { computeAttackDamage, prepareExpandedDefense, cardRatingDamage, ratingBonusPart } from '../../engine/actions.js';
import { previewTacticalAction } from '../../engine/combatMatchups.js';
import { enemyMoveCarrier, expandedEnemyMove } from '../../engine/combatCardTactics.js';
import { statusIncomingModifier, controlRestrictions } from '../../engine/combatStatusControl.js';
import { proposalTargetPlan } from '../../engine/proposalStatusRuntime.js';

const sum = values => values.reduce((total, value) => total + value, 0);
const unknown = reason => ({ basis: 'hp', min: null, max: null, label: '?', tone: 'red', stanceReduced: false, uncertain: true, reason });

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

function damageBounds(combat, enemy, move, base, hits, neutral) {
  const { ctx, player, source } = detached(combat, enemy, neutral);
  const effect = move.effects?.find(row => row.op === 'damage');
  const school = combat.ratingsRules?.enemyAttackType?.[`${enemy.enemyId}:${enemy.intent.moveId}`];
  const carrier = { ...enemyMoveCarrier(source, move, enemy.intent.moveId, ctx),
    damageSchool: school && school !== 'auto' ? school : effect?.damageSchool || move.damageSchool };
  const proposal = proposalTargetPlan(ctx, source, player, carrier);
  // Dynamic perception/charge consumption and reactive damage are not a
  // deterministic HP promise; the shared attack-only projection reports a range.
  const proposalChance = (proposal.allowed === false ? 0 : 1)
    * (proposal.perceptionChance == null ? 1 : proposal.perceptionChance / 100)
    * (1 - (proposal.evadeChance || 0) / 100);
  let max, chance;
  if (configuredCombat(ctx)) {
    // A miss preserves the target's defenses for the next hit. Enumerate/merge the reachable
    // target states (Block, pools, stance, statuses) rather than multiply all-landed damage by hit probability.
    // A landed hit carries into the next one exactly as previewDamageHits does, so a Poise break ends a Smash's defensive-stance bonus.
    const targetKey = row => JSON.stringify([row.block, row.barrier, row.persistentWard, row.persistentPoise, row.combatStance, row.statuses]);
    let states = [{ target: player, key: targetKey(player), loss: 0, probability: 1 }];
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
        const receipt = profileDamageReceipt(ctx, source, state.target, base, carrier);
        const landed = structuredClone(state.target);
        applyReceiptToPreviewTarget(ctx, landed, receipt);
        add({ target: landed, key: targetKey(landed), loss: state.loss + receipt.hpLoss, probability: state.probability * receipt.hitChance });
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
    const amount = computeAttackDamage(ctx, source, player, base, carrier.tags, carrier, { matchups: false, beforeDefense: true });
    const contacts = Array.from({ length: hits }, () => ({ amount,
      splitBase: base, ratingBonus: cardRatingDamage(ctx, source, carrier, base), ratingPart: ratingBonusPart(ctx, carrier) }));
    const receipt = previewTacticalAction(ctx, source, player, carrier, contacts,
      { ...statusIncomingModifier(ctx, player, carrier.combatProfile), restrictions: controlRestrictions(ctx, player) });
    prepareExpandedDefense(ctx, player, receipt, carrier);
    max = sum(receipt.hpAmounts);
    chance = 1 - (receipt.avoidance?.chance || 0) / 100;
  } else return null;
  chance = Math.max(0, Math.min(1, chance * proposalChance));
  if (chance === 0) max = 0;
  return { min: chance < 1 ? 0 : max, max, hitChance: chance, expected: max * chance };
}

// Visibility is decided by the production observer gate BEFORE reading the
// private move/base. Neither a concealed number nor its reduction can leak.
// This is direct incoming HP loss for the revealed damage packet at CURRENT
// pools, not future turn timing, DOT, retaliation, or queued card resolution.
export function projectCombatIntent(combat, enemyInstanceId) {
  let intent = previewIntent(combat, enemyInstanceId);
  if (intent.hidden || intent.revealed === false || intent.kind === 'staggered') return intent;
  const enemy = combat.enemies.find(row => row.id === enemyInstanceId);
  if (intent.profile?.maneuver === 'evade') intent = { ...intent,
    dodgeCharges: enemy.combatEvade?.charges ?? enemy.statuses?.evade?.stacks ?? 0 };
  if (intent.damage == null) return intent;
  const rawMove = combat.registries.enemies.get(enemy.enemyId).moves[enemy.intent.moveId];
  const move = expandedEnemyMove(enemy, rawMove || {}, enemy.intent.moveId, combat);
  if ((move.effects || []).filter(row => row.op === 'damage').length > 1) return { ...intent, projectedDamage: unknown('multipleDamageEffects') };
  const base = enemy.intent.damage;
  const hits = Math.max(0, Math.floor(enemy.intent.hits ?? 1));
  if (!Number.isFinite(base) || !Number.isFinite(hits) || hits > 100) return { ...intent, projectedDamage: unknown('unresolvedDamage') };
  const actual = damageBounds(combat, enemy, move, base, hits, false);
  const baseline = damageBounds(combat, enemy, move, base, hits, true);
  if (!actual || !baseline) return { ...intent, projectedDamage: unknown('unsupportedDefenseMode') };
  const stanceReduced = actual.expected < baseline.expected - 1e-9;
  // Green describes the displayed HP range, not an undisplayed average. A
  // wider failed-dodge upper bound stays red even if its expectation improves.
  const displayedReduction = stanceReduced && actual.min <= baseline.min && actual.max < baseline.max;
  return { ...intent, projectedDamage: { basis: 'hp', ...actual,
    label: actual.min === actual.max ? String(actual.max) : `${actual.min}–${actual.max}`,
    tone: displayedReduction ? 'green' : 'red', stanceReduced, displayedReduction, uncertain: actual.min !== actual.max,
    baseline: { min: baseline.min, max: baseline.max, expected: baseline.expected },
    scope: 'directDamageAtCurrentDefenses' } };
}
