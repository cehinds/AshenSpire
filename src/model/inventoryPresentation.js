// src/model/inventoryPresentation.js — the Armoury's unified inventory read model.
// Pure and headless: the UI draws these rows but does not decide ownership,
// quantities, categories, or equipped locations.

import { ownership, slotHand } from './loadout.js';

const ARMAMENT_CATEGORIES = Object.freeze({
  weapon: 'Weapon',
  shield: 'Shield',
  staff: 'Staff',
});

function equipmentLocations(registries, run) {
  const locations = new Map();
  for (const slot of ((registries || {}).equipment || {}).slots || []) {
    const ids = (((run || {}).loadout || {}).sets || {})[slot.id] || [];
    for (const id of ids) {
      if (!id) continue;
      const labels = locations.get(id) || [];
      const label = slot.label || slotHand(slot);
      if (label && !labels.includes(label)) labels.push(label);
      locations.set(id, labels);
    }
  }
  return locations;
}

function countedRows(ids, registry, category, { equipped = false } = {}) {
  const counts = new Map();
  for (const id of ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts].map(([id, count]) => {
    const item = registry && registry.get(id);
    if (!item) return null;
    return {
      key: `${category.toLowerCase()}:${id}`,
      id,
      name: item.name,
      category,
      count,
      equippedLabels: equipped ? ['Equipped'] : [],
      item,
    };
  }).filter(Boolean);
}

/**
 * inventoryRows(registries, run, meta) → every item the current run can use.
 * Equipment follows the same ownership predicate as the hand picker. Relics
 * are active while held; potions are carried consumables and stack by id.
 */
export function inventoryRows(registries, run, meta = {}) {
  const equipment = (registries || {}).equipment || {};
  const mine = ownership(registries, { meta, loadout: run && run.loadout });
  const locations = equipmentLocations(registries, run);
  const rows = [];

  for (const item of (equipment.armour || []).filter((piece) => piece.classId === run.class && mine.has(piece))) {
    rows.push({
      key: `armour:${item.classId}:${item.id}`,
      id: item.id,
      name: item.name,
      category: 'Armour',
      count: 1,
      equippedLabels: locations.get(item.id) || [],
      item,
    });
  }
  for (const item of (equipment.armaments || []).filter((piece) => mine.has(piece))) {
    rows.push({
      key: `armament:${item.id}`,
      id: item.id,
      name: item.name,
      category: ARMAMENT_CATEGORIES[item.kind] || 'Armament',
      count: 1,
      equippedLabels: locations.get(item.id) || [],
      item,
    });
  }

  rows.push(...countedRows(run.relics || [], registries.relics, 'Relic', { equipped: true }));
  rows.push(...countedRows((run.flasks || []).map((entry) => entry.flaskId), registries.flasks, 'Potion'));
  return rows;
}

export function inventoryItemCount(rows) {
  return (rows || []).reduce((sum, row) => sum + (Number.isInteger(row.count) && row.count > 0 ? row.count : 0), 0);
}
