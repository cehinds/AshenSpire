import { effectiveAshenBlightAttributes, ashenBlightBonuses } from '../model/ashenBlight.js';
import { deriveStat, restoreDerivedStatRuleSnapshot } from '../model/derivedStats.js';
import * as DeckComposition from '../framework/deckComposition.js';
import * as State from '../model/state.js';
import * as Loadout from '../model/loadout.js';
import * as StatProjection from '../model/statProjection.js';

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

/** Keep live Blight-derived equipment receipts and Poise at their saved authority.
 * Subset stamping never mints cards, moves piles, changes pools, or rewrites an
 * already prepared Counter/ability payload. Always start from allocated stats.
 */
export function refreshExpandedLoadout(ctx, entity, { refreshPoise = true } = {}) {
  if (ctx.combatExpansionVersion !== 2 || entity?.combatExpansionVersion !== 2 || !ctx.loadout) return;
  if (!Object.values(ashenBlightBonuses(entity).attributes).some(value => value !== 0)) return;
  const attributes = entity.allocatedAttributes || ctx.allocatedAttributes || {};
  const piles = ctx.piles || {};
  const cards = ['draw', 'hand', 'discard', 'exhaust'].flatMap(key => piles[key] || []);
  if (cards.some(card => card.equipmentRole || card.kitRole)) {
    const run = {
      class: entity.classId, loadout: ctx.loadout, attributes,
      combatExpansionVersion: 2, ashenBlight: entity.ashenBlight,
      equipmentProfileRuleSnapshot: ctx.equipmentProfileRuleSnapshot || Loadout.createEquipmentProfileRuleSnapshot(ctx.registries),
      equipmentAttackSlotCount: ctx.equipmentAttackSlotCount,
      removedAttackSlotIds: ctx.removedAttackSlotIds || [],
      itemUpgradeLevels: ctx.itemUpgradeLevels || {}, itemMounts: ctx.itemMounts || {},
      derivedStatRuleSnapshot: ctx.derivedStatRuleSnapshot,
      ...(Number.isInteger(ctx.characterLevel) ? { level: { level: ctx.characterLevel } } : {}),
      ...(ctx.poolDeck ? { poolDeck: true } : {}), deck: cards,
    };
    DeckComposition.stampDeck(ctx.registries, run, cards, { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
  }
  if (refreshPoise && !ctx.ratingsRules) State.stampPlayerPoiseMax(entity, StatProjection.playerPoiseThresholdReceipt(ctx.registries, {
    loadout: ctx.loadout, relics: entity.relicIds || [], class: entity.classId,
    itemUpgradeLevels: ctx.itemUpgradeLevels || {}, attributes: entity.attributes || ctx.attributes,
    derivedStatRuleSnapshot: ctx.derivedStatRuleSnapshot || null,
    ...(Number.isInteger(ctx.characterLevel) ? { level: { level: ctx.characterLevel } } : {}),
  }).value);
}
