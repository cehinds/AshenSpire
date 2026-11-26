// Pure element offense stages. Status/tag/opponent reads are explicit dependencies;
// neither this model nor its callers need the elemental effect interpreter to load.
import { ElementRulesOf, ElementOfHit, HitsAllTargets } from './elementIdentityRules.js';

/** Fire spreads to every living enemy when the card is single-target and more than one enemy stands. */
export function FireSpreads(ctx, rules, source, carrier, target = null, laneOpponents) {
  if (ElementOfHit(carrier) !== 'fire' || carrier?.elementChain || HitsAllTargets(carrier)) return false;
  // The damage op decides the spread once, before any hit lands, so a spread hit that kills the aimed enemy still
  // costs every other enemy the spread multiplier (shown = dealt).
  if (typeof carrier?.elementSpread === 'boolean') return carrier.elementSpread;
  return !rules.fire.spreadNeedsOtherEnemies || laneOpponents(ctx, source, target).length > 1;
}

/**
 * The damage multipliers of the element rules, in order, as receipt stages. `heal` is what a Necrotic hit restores
 * to an undead target instead of damaging it. Returns { stages: [{ id, label, multiplier }], heal, element }.
 */
export function ElementReceiptStages(ctx, source, target, carrier, raw, readers) {
  const { stacksOf, hasTag: ElementHasTag, opponents: laneOpponents, bandsActive: BandsActive } = readers;
  const rules = ElementRulesOf(ctx);
  if (!rules) return null;
  const element = ElementOfHit(carrier);
  const stages = [];
  const push = (id, label, multiplier) => { if (Number.isFinite(multiplier) && multiplier !== 1) stages.push({ id, label, multiplier }); };
  push('element-chill', 'Chill: damage dealt', Math.max(0, 1 - rules.frost.chillDamageDealtPerStack * stacksOf(source, 'chill')));
  if (element === 'fire' && FireSpreads(ctx, rules, source, carrier, target, laneOpponents)) push('element-fire-spread', BandsActive(ctx) ? 'Fire spreads across its row' : 'Fire spreads to every enemy', rules.fire.spreadMultiplier);
  if (carrier?.elementChain) push('element-chain', 'Lightning chains', rules.lightning.chainMultiplier);
  push('element-burn', 'Burn: damage taken', 1 + rules.burn.damageTakenPerStack * stacksOf(target, 'burn'));
  if (element === 'lightning') push('element-shock', 'Shock: lightning taken', 1 + rules.shock.lightningTakenPerStack * stacksOf(target, 'shock'));
  // One tag per element (owner, 2026-11-18): a target's <Element> Vulnerable stacks raise the damage of that element it takes.
  for (const [id, inst] of Object.entries(target?.statuses || {})) {
    const row = inst?.stacks > 0 ? ctx.registries?.statuses?.get(id)?.elementVulnerability : null;
    if (row && element === row.element) push(`element-vulnerable-${row.element}`, `${row.element[0].toUpperCase()}${row.element.slice(1)} Vulnerable`, 1 + row.perStack * inst.stacks);
  }
  if (stacksOf(target, 'brittle') > 0) push('element-brittle', 'Brittle', rules.frost.brittleMultiplier);
  const undead = ElementHasTag(ctx, target, rules.necrotic.undeadTag);
  if (element === 'divine' && undead) push('element-divine-undead', 'Divine against the undead', rules.divine.undeadMultiplier);
  let heal = 0;
  if (element === 'necrotic') {
    push('element-necrotic', 'Necrotic', rules.necrotic.damageMultiplier);
    if (undead) {
      let value = Math.max(0, raw);
      for (const stage of stages) value *= stage.multiplier;
      heal = Math.max(0, Math.floor(value));
      stages.push({ id: 'element-necrotic-heals', label: 'Necrotic heals the undead', multiplier: 0 });
    }
  }
  return { stages, heal, element };
}
