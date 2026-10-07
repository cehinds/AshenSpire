import { computeAttackDamage } from './actions.js';
import { prepareMatchupHit, matchupRules } from './combatMatchups.js';
import { reconcileWardBlock } from '../model/blockPresentation.js';

/** Pure per-hit threat before Block; only local tactical defense is spent. */
export function previewDamageHits(ctx, source, target, base, tags, carrier, hits = 1) {
  const defender = target ? { ...target,
    ...(target.combatCounter ? { combatCounter: structuredClone(target.combatCounter) } : {}) } : null;
  const targetKey = ctx.playerIdForEntity?.(target) || target?.id;
  const previewCtx = { ...ctx,
    ...(ctx.player === target ? { player: defender } : {}),
    ...(ctx.playerIdForEntity ? { playerIdForEntity: entity => ctx.playerIdForEntity(entity === defender ? target : entity) } : {}),
  };
  const attack = { ...carrier, combatRiderTargets: [...(carrier?.combatRiderTargets || [])] };
  const rules = matchupRules(ctx);
  const hitDamages = [];
  for (let hit = 0; hit < Math.max(0, Math.floor(hits)); hit++) {
    const raw = computeAttackDamage(previewCtx, source, defender, base, tags, attack, { matchups: false });
    const receipt = prepareMatchupHit(previewCtx, source, defender, attack, raw);
    hitDamages.push(receipt.amount);
    if (!defender) continue;
    const blocked = Math.min(Math.max(0, defender.block || 0), Math.max(0, receipt.amount - receipt.guardBypass));
    defender.block = Math.max(0, (defender.block || 0) - blocked);
    reconcileWardBlock(defender);
    if (receipt.counterEligible) delete defender.combatCounter;
    // Typed penetration and synchronous Ward stripping use the same once-per-
    // target budget as execution. Queued statuses/impact do not run in preview.
    const type = rules.damageAliases?.[receipt.profile?.damageType] || receipt.profile?.damageType;
    const rider = rules.damageRiders?.[type];
    if (!attack.combatReaction && receipt.profile && receipt.amount > 0 && rider
      && !attack.combatRiderTargets.includes(targetKey)
      && (!rider.requiresHpLoss || receipt.amount > blocked)) {
      attack.combatRiderTargets.push(targetKey);
      if (rider.wardDrain > 0) {
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
