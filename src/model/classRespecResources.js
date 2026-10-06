import { deriveStat, ruleTierSize, resolveSnapshotNumbers } from './derivedStats.js';
import { resolveRelicModifiers } from './relicModifiers.js';
import { reconcileRunLoadoutHp, stampDeck } from './loadout.js';
import { syncZones, characterLevelOf } from './state.js';
import { syncFlaskGrowth } from './flaskgrowth.js';

// Rebind relic terms against the run's original base rules, never today's
// settings. Resource amounts remain unchanged except a lower maximum clamp.
export function rebuildClassRespecResources(registries, candidate, original) {
  const snapshot = candidate.derivedStatRuleSnapshot;
  if (snapshot.baseRules) {
    const rules = structuredClone(snapshot.baseRules);
    const tierSizes = Object.fromEntries(Object.entries(rules.rules).map(([id,row]) => [id,ruleTierSize(row)]));
    const modifiers = resolveRelicModifiers(registries,candidate.relics,{attributes:candidate.attributes,tierSizes});
    snapshot.rules = resolveSnapshotNumbers(rules,registries.classes.get(candidate.class),modifiers,snapshot.modifierOverride || {});
    snapshot.relicModifiers = {damageBySchoolAdd:modifiers.damageBySchoolAdd,sources:modifiers.sources};
    candidate.damageBySchoolAdd = structuredClone(modifiers.damageBySchoolAdd);
  } else if (JSON.stringify(candidate.relics) !== JSON.stringify(original.relics) && ((snapshot.relicModifiers?.sources || []).some(row => row.resource) || resolveRelicModifiers(registries,candidate.relics,{attributes:candidate.attributes}).sources.some(row=>row.resource))) {
    throw new Error('This older resource snapshot cannot exchange a resource-modifying relic safely. Keep that relic selected.');
  }
  const def = registries.classes.get(candidate.class), level = characterLevelOf(candidate);
  for (const [field,id] of [['energyMax','energy'],['drawPerTurn','draw']]) candidate[field] = deriveStat(snapshot.rules,id,{attributes:candidate.attributes,classDef:def,level}).value;
  reconcileRunLoadoutHp(registries,candidate,{adoptEquipmentBonuses:true});
  stampDeck(registries,candidate,undefined,{adoptEquipmentBonuses:true});
  syncFlaskGrowth(registries,candidate);
  for (const [field,maximum] of [['hp','maxHp'],['mana','maxMana'],['stamina','maxStamina'],['energy','energyMax']]) if (Number.isFinite(original[field])) candidate[field] = Math.min(original[field],candidate[maximum]);
  candidate.flaskCharges = structuredClone(original.flaskCharges);
  for (const [field,maximum] of [['hp','maxHp'],['mana','maxMana'],['stamina','maxStamina']]) candidate.equipmentPoolDeficits[field] = Math.max(0,candidate[maximum]-candidate[field]);
  syncZones(candidate);
}
