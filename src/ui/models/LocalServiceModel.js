import { shrineHealAmount } from '../../engine/encounters.js';
import { passiveFlag } from '../../model/registries.js';
import { smithingPlan } from '../../model/smithing.js';
import { levelUpPlan } from '../../model/levelup.js';
import { graceRefillPlan, flaskChargePlan, refillFlaskCharges } from '../../model/gracerefill.js';

// Read-only projection of the same plans used when a service is activated.
// No stock rolls, resource changes, completion writes, or node-specific rules.
export function localServiceModel({ handlerId, registries, run, state = {}, healMult = 1, refillCounts = {} }) {
  const result = { benefit: '', facts: [], action: 'Inspect service', used: !!state.used };
  if (!registries) return { ...result, benefit: 'Open this service in an active run to see your benefits, costs, and availability.' };
  if (state.used) result.facts.push('This visit has been used.');
  if (handlerId === 'rest') {
    const noRest = passiveFlag(registries, run.relics, 'shrineNoRest');
    const heal = Math.floor(shrineHealAmount(registries, run) * healMult);
    const level = levelUpPlan(registries, run, { pointsPerLevel: 1 });
    const refill = state.refilled || run.flaskCharges ? null : graceRefillPlan(registries, run, { counts: refillCounts });
    result.benefit = noRest ? 'Your relic prevents healing by resting.' : heal ? `Rest to recover ${heal} HP: ${run.hp} → ${run.hp + heal} / ${run.maxHp}.` : run.hp >= run.maxHp ? 'Your health is already full.' : 'Your current modifiers allow no healing from rest.';
    result.facts.push('Rest costs no cinders. One visit at this site; other services show their own costs.');
    if (run.flaskCharges && !state.refilled) {
      const restored = refillFlaskCharges(structuredClone(run.flaskCharges));
      const pools = flaskChargePlan(registries, restored).rows.filter(row=>row.count>0);
      result.facts.push(`Entering refills your assigned flask charges: ${pools.map(row=>`${row.def?.name || row.kind} ${run.flaskCharges[`${row.kind}Current`]} → ${restored[`${row.kind}Current`]}`).join('; ')}.`);
    }
    else if (refill?.total) result.facts.push(`Entering restores ${refill.total} flask${refill.total === 1 ? '' : 's'} in your available slots.`);
    else result.facts.push(state.refilled ? 'Arrival flask refill already received.' : 'No additional flasks would be granted with your current inventory and refill settings.');
    if (refill?.shortfalls.length) result.facts.push('Full flask slots limit the arrival refill.');
    result.facts.push(level.capped ? 'Your run level is at its cap.' : `Level up: ${level.cost} cinders for ${level.pointsPerLevel} attribute point. ${level.affordable ? 'You can afford this.' : `You need ${level.short} more cinders.`}`);
    result.action = 'Enter rest services';
  } else if (handlerId === 'smith') {
    const plan = smithingPlan(registries, run);
    result.benefit = 'Upgrade carried equipment and inspect the exact changes before spending Smithing Stones.';
    result.facts.push(`You have ${plan.stones} Smithing Stones. Upgrades remain on this run's equipment.`);
    for (const item of plan.candidates) {
      const changes = [...new Set(item.changes.map(c=>`${c.label || c.op || c.tag}: ${c.before} → ${c.after}`))].join('; ');
      result.facts.push(`${item.itemName} +${item.currentLevel} → +${item.nextLevel}: ${item.cost} stones${item.affordable ? ' · affordable' : ` · need ${item.shortfall} more`}. ${changes}`);
    }
    if (!plan.candidates.length) result.facts.push('No carried equipment has an available upgrade.');
    result.action = 'Compare equipment upgrades';
  } else if (handlerId === 'shop') {
    result.benefit = 'Spend cinders on cards, equipment, weapon arts, relics, or flasks from this market’s stock. You can also remove a card from your deck.';
    result.facts.push(`You have ${run.cinders} cinders. Browsing is free; purchases require confirmation where offered.`);
    if (state.stock) {
      const stock = state.stock;
      for (const key of ['cards','armaments','weaponArts','relics','flasks']) {
        const items = stock[key] || [];
        if (items.length) result.facts.push(`${({weaponArts:'Weapon arts',armaments:'Equipment',cards:'Cards',relics:'Relics',flasks:'Flasks'})[key]}: ${items.length} remaining.`);
      }
      result.facts.push(`Remove a card: ${stock.removeCost} cinders. You must keep at least one card.`);
    } else result.facts.push('Enter the market to reveal this visit’s inventory and exact prices. Inspection does not roll or reserve stock.');
    result.action = 'Browse market';
  } else if (handlerId === 'lore') {
    result.benefit = 'Record this archive as explored in your journey.';
    result.facts.push('Free · one visit. This archive currently grants no items, cinders, or stat bonuses.');
    result.action = 'Record archive visit';
  } else result.benefit = 'Inspect this service to see its available actions.';
  return result;
}
