// What an item's properties read as on a screen (W25-R): its name and one-line effect from the property data, its rank and its upgrade
// count. Pure and headless; the Armoury draws it as a chip list on a tile and a section in the item's detail.
import { ITEM_PROPERTIES } from '../content/itemProperties.js';
import { ItemPropertyIds, ItemRank, ItemUpgradeCount } from './itemPicks.js';

/** The item ref the Blacksmith and the picks use: `armament/<id>`, `armor/<class>/<id>` or `relic/<id>`. */
export function ArmouryItemRef(run, kind, item) {
  if (!item?.id) return null;
  if (kind === 'relic') return `relic/${item.id}`;
  if (kind === 'armor') return `armor/${item.classId || run?.class}/${item.id}`;
  return `armament/${item.id}`;
}

/**
 * ItemPropertyLines(run, itemRef) -> { itemRef, rank, upgrades, properties: [{ id, name, text }] }. A missing ref, or an item with nothing done to
 * it, yields no properties and zero counts, so a save from before the properties reads as a plain item.
 */
export function ItemPropertyLines(run, itemRef) {
  if (!itemRef) return { itemRef: null, rank: 0, upgrades: 0, properties: [] };
  const properties = ItemPropertyIds(run, itemRef).map((id) => {
    const row = ITEM_PROPERTIES.find((entry) => entry.id === id);
    return { id, name: row?.name || id, text: row?.text || '' };
  });
  return { itemRef, rank: ItemRank(run, itemRef), upgrades: ItemUpgradeCount(run, itemRef), properties };
}
