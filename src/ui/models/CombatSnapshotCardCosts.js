import { passiveSum } from '../../model/registries.js';

/** A selected-tier host receipt is exact. Without it, use a conservative
 * authored price: the client cannot infer hidden preparing discounts. */
export function combatSnapshotCardCosts(registries, def, player) {
  if (def.combatPreview) {
    const preview = def.combatPreview;
    return { energy: preview.costIsX ? 0 : preview.cost, mana: preview.manaCost,
      stamina: preview.staminaCost, preview };
  }
  const pools = registries.framework.costProfile(def, {
    powerCostReduction: passiveSum(registries, player.relicIds, 'powerCostReduction', player.itemUpgradeLevels || {}),
    weightClass: player.weightClass || null,
  });
  const expanded = player.combatExpansionVersion === 2;
  const surcharge = expanded ? def.upcastSurcharge || 0 : 0;
  const action = expanded && pools.variable ? player.stamina ?? player.energy ?? 0 : pools.action;
  const price = action + surcharge;
  const mana = (pools.mana || 0) + surcharge;
  const stamina = expanded ? price : pools.stamina || 0;
  return { energy: pools.variable ? 0 : price, mana, stamina,
    preview: { costIsX: !!pools.variable, cost: price, manaCost: mana, staminaCost: stamina,
      ...(expanded ? { costIsEstimate: true } : {}), tokens: {} } };
}
