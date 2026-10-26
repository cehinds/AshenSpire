import { fixCoreEnabled, damageReceipt, fixCoreStaggeredRules, fixCoreStaggeredStance } from '../model/fixCoreMechanics.js';
import * as ProfileCombat from './gameProfileCombat.js';
import * as Actions from './actions.js';
// Receipt capture enters this shared module from multiple bundled engine
// roots. Read cyclic engine exports when invoked, never during initialization.
import * as Matchups from './combatMatchups.js';
import { reconcileWardBlock } from '../model/blockPresentation.js';
import * as Blight from './ashenBlight.js';
import { fixCoreWardDisabled } from '../model/fixCoreMechanics.js';

/**
 * Detached defender state shared by every damage effect in one previewed
 * action. A Counter charge, Guard break, Ward drain, or once-per-action rider
 * spent by an earlier effect must stay spent for the effects that follow.
 */
export function damagePreviewState(ctx, target) {
  const defender = target ? { ...target,
    persistentWard: target.persistentWard && { ...target.persistentWard },
    persistentPoise: target.persistentPoise && { ...target.persistentPoise },
    ...(target.combatCounter ? { combatCounter: structuredClone(target.combatCounter) } : {}) } : null;
  const previewCtx = { ...ctx,
    ...(ctx.player === target ? { player: defender } : {}),
    ...(ctx.playerIdForEntity ? { playerIdForEntity: entity => ctx.playerIdForEntity(entity === defender ? target : entity) } : {}),
  };
  return { defender, previewCtx, targetKey: ctx.playerIdForEntity?.(target) || target?.id,
    combatRiderTargets: [] };
}

/**
 * A Poise break staggers the owner exactly as live play does (D13): same guards, stance and Vulnerable. Detached:
 * only the previewed defender changes, so later hits of the same card see the stance and the Vulnerable multiplier.
 */
function previewPoiseBreak(ctx, defender) {
  if (ctx.foundation && defender.impactProtectedUntil >= ctx.turn) return;
  const rules = fixCoreStaggeredRules(ctx.fixCoreRules || ctx.gameProfile?.fixCoreRules);
  if (rules.stance) defender.combatStance = fixCoreStaggeredStance(defender, rules);
  if (rules.vulnerableStacks > 0) defender.statuses = { ...defender.statuses, vulnerable: { ...defender.statuses?.vulnerable, stacks: (defender.statuses?.vulnerable?.stacks || 0) + rules.vulnerableStacks } };
}

/**
 * Explicit Poise damage mid-card (a poiseDamage effect, or Ward damage redirected to Poise when Ward is off),
 * mirrored from live play (actions.js poiseDamage / wardDamage -> drainFixCorePoise): whole numbers, capped at the pool,
 * and emptying it breaks Poise before the card's later effects. Operates on the previewed target state only.
 */
export function previewPoiseDrain(ctx, source, state, effect, card, authored) {
  const { defender, previewCtx } = state;
  const poise = defender?.persistentPoise;
  if (!fixCoreEnabled(ctx) || !defender?.alive || !(poise?.value > 0)) return 0;
  const pressure = previewCtx.combatExpansionVersion === 2 ? Matchups.stancePressureMultiplier(previewCtx, source, defender, card, undefined) : 1;
  let amount;
  if (effect.op === 'poiseDamage') {
    const bonus = previewCtx.combatExpansionVersion === 2 ? Blight.ashenBlightMartialPoise(previewCtx, source,
      { cycleKey: String(source?.combatOwnerCycle || 0), camp: card?.combatProfile?.camp, authoredPoise: authored }) : 0;
    amount = Math.ceil((authored + bonus) * Matchups.matchupPoiseMultiplier(previewCtx, source, defender, card) * pressure);
  } else if (effect.op === 'wardDamage' && fixCoreWardDisabled(ctx)) {
    amount = authored * pressure
      * (!card?.combatWardEdgeApplied && card?.combatProfile?.camp === 'spell' && card?.combatProfile?.damageType === 'piercing' ? 1.25 : 1);
  } else return 0;
  const spent = Math.min(poise.value, Math.max(0, Math.floor(amount)));
  if (!(spent > 0)) return 0;
  poise.value -= spent;
  if (poise.value === 0) previewPoiseBreak(ctx, defender);
  return spent;
}

/**
 * Carries one resolved hit's effect on the previewed target to its next hit: Block, Barrier, Ward, Poise (absorbed plus a Smash's
 * Poise damage) and, when that empties Poise, the Staggered stance and Vulnerable. Shared by the card preview and the intent projection.
 */
export function applyReceiptToPreviewTarget(ctx, defender, receipt) {
  defender.block = receipt.blockRemaining;
  if (!fixCoreEnabled(ctx)) return;
  defender.barrier = Math.max(0, (defender.barrier || 0) - receipt.barrierMitigated);
  if (defender.persistentWard) defender.persistentWard.value = Math.max(0, defender.persistentWard.value - receipt.wardMitigated);
  if (defender.persistentPoise) {
    const poiseBefore = defender.persistentPoise.value;
    defender.persistentPoise.value = Math.max(0, poiseBefore - receipt.poiseMitigated - (receipt.poiseDrain || 0));
    if (poiseBefore > 0 && defender.persistentPoise.value === 0) previewPoiseBreak(ctx, defender);
  }
}

/** Pure per-hit threat before Block; only detached tactical defense is spent. */
export function previewDamageHits(ctx, source, target, base, tags, carrier, hits = 1, state = null) {
  const local = state || damagePreviewState(ctx, target);
  const { defender, previewCtx, targetKey } = local;
  const attack = { ...carrier, combatRiderTargets: local.combatRiderTargets };
  if (ProfileCombat.configuredCombat(ctx)) {
    const receipts = [];
    for (let hit = 0; hit < Math.max(0, Math.floor(hits)); hit++) {
      const receipt = ProfileCombat.profileDamageReceipt(previewCtx, source, defender, base, carrier);
      receipts.push(receipt);
      if (defender) applyReceiptToPreviewTarget(ctx, defender, receipt);
    }
    return { damageReceipt: damageReceipt(target?.id, receipts.flatMap(row => row.damageReceipt?.hits || [])),
      damage: (fixCoreEnabled(ctx) ? receipts[0]?.hpLoss : receipts[0]?.amount) || 0, hits: receipts.length,
      hitDamages: receipts.map(receipt => fixCoreEnabled(ctx) ? receipt.hpLoss : receipt.amount),
      totalDamage: receipts.reduce((sum, receipt) => sum + (fixCoreEnabled(ctx) ? receipt.hpLoss : receipt.amount), 0),
      hpLoss: receipts.reduce((sum, receipt) => sum + receipt.hpLoss, 0),
      hitChance: receipts[0]?.hitChance ?? 1, uncertain: receipts.some(receipt => receipt.uncertain),
      hpLossBounds: [receipts.reduce((sum, receipt) => sum + receipt.hpLossBounds[0], 0), receipts.reduce((sum, receipt) => sum + receipt.hpLossBounds[1], 0)] };
  }
  const rules = Matchups.matchupRules(ctx);
  const hitDamages = [];
  for (let hit = 0; hit < Math.max(0, Math.floor(hits)); hit++) {
    const raw = Actions.computeAttackDamage(previewCtx, source, defender, base, tags, attack, { matchups: false });
    const receipt = Matchups.prepareMatchupHit(previewCtx, source, defender, attack, raw);
    hitDamages.push(receipt.amount);
    if (!defender) continue;
    const blocked = Math.min(Math.max(0, defender.block || 0), Math.max(0, receipt.amount - receipt.guardBypass));
    defender.block = Math.max(0, (defender.block || 0) - blocked);
    reconcileWardBlock(defender);
    if (receipt.counterEligible) delete defender.combatCounter;
    // Typed penetration and synchronous Ward stripping use the same once-per-
    // target budget as execution. Queued statuses/impact do not run in preview.
    const type = rules.damageAliases?.[receipt.profile?.damageType] || receipt.profile?.damageType;
    // Mirrors matchupRiderEffects: damage-type and technique riders share
    // one once-per-target budget, spent when any of them applies.
    const riders = Matchups.hitRiders(rules, type, attack, ctx).filter(row => !row.requiresHpLoss || receipt.amount > blocked);
    if (!attack.combatReaction && receipt.profile && receipt.amount > 0 && riders.length
      && !local.combatRiderTargets.includes(targetKey)) {
      local.combatRiderTargets.push(targetKey);
      // Every rider of a mixed hit drains, as matchupRiderEffects does.
      for (const rider of riders) if (rider.wardDrain > 0) {
        const ward = Math.max(0, Math.min(defender.block, defender.wardBlock || 0));
        const loss = Math.min(ward, rider.wardDrain);
        defender.block -= loss;
        defender.wardBlock = ward - loss;
        defender.wardGuard = Math.max(0, (defender.wardGuard || 0) - (rider.wardDrain - loss));
      }
    }
  }
  return { damage: hitDamages[0] || 0, hits: hitDamages.length,
    hitDamages, totalDamage: hitDamages.reduce((sum, amount) => sum + amount, 0) };
}
