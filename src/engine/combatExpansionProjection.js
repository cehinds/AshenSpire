import { effectiveAshenBlightAttributes, ashenBlightBonuses } from '../model/ashenBlight.js';
import { deriveStat, restoreDerivedStatRuleSnapshot } from '../model/derivedStats.js';

/** Base maxima are the unboosted combat-entry pools; persist them with the actor. */
export function settleExpandedPools(ctx, entity, { allocatedAttributes = entity.allocatedAttributes || ctx.allocatedAttributes || entity.attributes || ctx.attributes || {}, basePools } = {}) {
  if (ctx.combatExpansionVersion !== 2 || entity.combatExpansionVersion !== 2) return { attributes: { ...allocatedAttributes }, pools: {} };
  entity.allocatedAttributes = { ...allocatedAttributes };
  const attributes = effectiveAshenBlightAttributes(entity, allocatedAttributes);
  entity.attributes = { ...attributes };
  const fields = { maxHp: 'hp', maxMana: 'mana', maxStamina: 'stamina' };
  if (!entity.baseResourceMaxima) entity.baseResourceMaxima = Object.fromEntries(Object.keys(fields).map(field => [field, Math.max(field === 'maxHp' ? 1 : 0, Number(basePools?.[field] ?? entity[field]) || 0)]));
  const snapshot = ctx.derivedStatRuleSnapshot || entity.derivedStatRuleSnapshot;
  const rules = snapshot ? restoreDerivedStatRuleSnapshot(snapshot, {
    attributeIds: ctx.registries?.attributes?.ids() || Object.keys(allocatedAttributes),
    classFields: ['maxHp', 'maxMana'],
  }).rules : null;
  const classDef = ctx.registries?.classes?.get(entity.classId);
  const level = ctx.characterLevel || 1;
  if (rules) entity.drawPerTurn = deriveStat(rules, 'draw', { attributes, classDef, level }).value;
  const pools = {}, bonuses = ashenBlightBonuses(entity);
  for (const [field, stat] of Object.entries(fields)) {
    const increase = rules ? deriveStat(rules, stat, { attributes, classDef, level }).value
      - deriveStat(rules, stat, { attributes: allocatedAttributes, classDef, level }).value : 0;
    const penalty = stat === 'stamina' ? bonuses.maxStaminaPenalty : 0;
    const maximum = Math.max(stat === 'hp' ? 1 : 0, entity.baseResourceMaxima[field] + increase - penalty);
    entity[field] = maximum;
    if (stat === 'stamina') entity.energyMax = maximum;
    const currentField = stat === 'hp' ? 'hp' : stat === 'mana' ? 'mana' : 'stamina';
    entity[currentField] = Math.max(0, Math.min(entity[currentField] || 0, maximum));
    pools[field] = maximum;
  }
  return { attributes, pools, ratings: entity.ratings ? { ...entity.ratings } : null };
}
